import type { Scene } from "phaser";
import type { EntityId } from "../components/DungeonData";
import {
    DenizenRole,
    type AdventurerData,
    type DenizenData,
} from "../components/entityComponents/entityData";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import { EventBus } from "../EventBus";
import type { RoomPopulationManager } from "../rooms/RoomPopulationManager";
import type { AdventurerParty } from "../waves/PartyData";
import type {
    PartyCombatPresentation,
    RoomAttackersSnapshot,
    RoomCombatOutcome,
    RoomEncounterResolver,
} from "./CombatTypes";

const ADVENTURER_ATTACK_INTERVAL_MS = 900;
const DENIZEN_ATTACK_INTERVAL_MS = 1_050;
const GATHERER_ATTACK_MULTIPLIER = 0.35;

interface BattleParty {
    party: AdventurerParty;
    presentation: PartyCombatPresentation;
    resolve: (outcome: RoomCombatOutcome) => void;
}

interface RoomBattle {
    room: DungeonRoom;
    parties: Map<EntityId, BattleParty>;
    adventurerCooldowns: Map<EntityId, number>;
    denizenCooldowns: Map<EntityId, number>;
    targetCursor: number;
}

export class CombatManager {
    private readonly battles = new Map<EntityId, RoomBattle>();
    private destroyed = false;

    readonly encounterResolver: RoomEncounterResolver = (
        party,
        room,
        presentation,
    ) => this.engageParty(party, room, presentation);

    constructor(
        _scene: Scene,
        private readonly population: RoomPopulationManager,
    ) {}

    update(deltaMs: number): void {
        if (this.destroyed || deltaMs <= 0) return;

        for (const battle of [...this.battles.values()]) {
            this.updateBattle(battle, deltaMs);
        }
    }

    getRoomAttackersSnapshot(roomId: EntityId): RoomAttackersSnapshot | null {
        const battle = this.battles.get(roomId);
        return battle ? this.createRoomAttackersSnapshot(battle) : null;
    }

    cancelAll(): void {
        for (const battle of [...this.battles.values()]) {
            this.finishBattle(battle, "defeated");
        }
    }

    destroy(): void {
        this.destroyed = true;
        this.cancelAll();
    }

    private engageParty(
        party: AdventurerParty,
        room: DungeonRoom,
        presentation: PartyCombatPresentation,
    ): Promise<RoomCombatOutcome> {
        if (this.destroyed || presentation.getLivingMembers().length === 0) {
            return Promise.resolve("defeated");
        }

        const activeDenizens = this.population.getActiveDenizens(room.id);
        const existingBattle = this.battles.get(room.id);
        if (!existingBattle && activeDenizens.length === 0) {
            return Promise.resolve("cleared");
        }

        const battle = existingBattle ?? this.createBattle(room);
        presentation.setFighting(true);

        return new Promise<RoomCombatOutcome>((resolve) => {
            battle.parties.set(party.id, { party, presentation, resolve });
            for (const adventurer of presentation.getLivingMembers()) {
                if (!battle.adventurerCooldowns.has(adventurer.id)) {
                    battle.adventurerCooldowns.set(
                        adventurer.id,
                        getInitialCooldown(
                            adventurer.id,
                            ADVENTURER_ATTACK_INTERVAL_MS,
                        ),
                    );
                }
            }
            this.emitRoomAttackersSnapshot(battle);
        });
    }

    private createBattle(room: DungeonRoom): RoomBattle {
        const battle: RoomBattle = {
            room,
            parties: new Map(),
            adventurerCooldowns: new Map(),
            denizenCooldowns: new Map(),
            targetCursor: 0,
        };
        this.battles.set(room.id, battle);
        EventBus.emit("room-combat-state-changed", {
            roomId: room.id,
            active: true,
        });
        return battle;
    }

    private updateBattle(battle: RoomBattle, deltaMs: number): void {
        const adventurers = this.getLivingAdventurers(battle);
        const denizens = this.population.getActiveDenizens(battle.room.id);

        if (adventurers.length === 0) {
            this.finishBattle(battle, "defeated");
            return;
        }
        if (denizens.length === 0) {
            this.finishBattle(battle, "cleared");
            return;
        }

        this.attackWithAdventurers(battle, adventurers, deltaMs);

        const survivingAdventurers = this.getLivingAdventurers(battle);
        const survivingDenizens = this.population.getActiveDenizens(
            battle.room.id,
        );
        if (survivingAdventurers.length === 0) {
            this.finishBattle(battle, "defeated");
            return;
        }
        if (survivingDenizens.length === 0) {
            this.finishBattle(battle, "cleared");
            return;
        }

        this.attackWithDenizens(battle, survivingDenizens, deltaMs);

        if (this.getLivingAdventurers(battle).length === 0) {
            this.finishBattle(battle, "defeated");
        } else if (
            this.population.getActiveDenizens(battle.room.id).length === 0
        ) {
            this.finishBattle(battle, "cleared");
        }
    }

    private attackWithAdventurers(
        battle: RoomBattle,
        adventurers: readonly AdventurerData[],
        deltaMs: number,
    ): void {
        for (const adventurer of adventurers) {
            const remaining =
                (battle.adventurerCooldowns.get(adventurer.id) ?? 0) - deltaMs;
            if (remaining > 0) {
                battle.adventurerCooldowns.set(adventurer.id, remaining);
                continue;
            }

            const target = chooseDenizenTarget(
                this.population.getActiveDenizens(battle.room.id),
            );
            if (!target) break;

            battle.adventurerCooldowns.set(
                adventurer.id,
                ADVENTURER_ATTACK_INTERVAL_MS,
            );
            const damage = calculateDamage(adventurer.attack, target.defense);
            const result = this.population.applyDamage(target.id, damage);
            if (!result) continue;

            EventBus.emit("denizen-hit", {
                roomId: battle.room.id,
                denizenId: target.id,
                damage: result.damage,
            });
            if (result.defeated) {
                EventBus.emit("denizen-defeated", {
                    roomId: battle.room.id,
                    denizenId: target.id,
                });
            }
        }
    }

    private attackWithDenizens(
        battle: RoomBattle,
        denizens: readonly DenizenData[],
        deltaMs: number,
    ): void {
        let attackerHealthChanged = false;

        for (const denizen of denizens) {
            const remaining =
                (battle.denizenCooldowns.get(denizen.id) ??
                    getInitialCooldown(
                        denizen.id,
                        DENIZEN_ATTACK_INTERVAL_MS,
                    )) - deltaMs;
            if (remaining > 0) {
                battle.denizenCooldowns.set(denizen.id, remaining);
                continue;
            }

            const livingTargets = this.getLivingAdventurers(battle);
            if (livingTargets.length === 0) break;

            const target =
                livingTargets[battle.targetCursor % livingTargets.length];
            battle.targetCursor += 1;
            battle.denizenCooldowns.set(
                denizen.id,
                DENIZEN_ATTACK_INTERVAL_MS,
            );

            const attack =
                denizen.role === DenizenRole.GATHERER
                    ? Math.max(
                          1,
                          Math.floor(
                              denizen.attack * GATHERER_ATTACK_MULTIPLIER,
                          ),
                      )
                    : denizen.attack;
            const damage = calculateDamage(attack, target.defense);
            target.health = Math.max(0, target.health - damage);
            attackerHealthChanged = true;

            const owner = this.findPartyForAdventurer(battle, target.id);
            owner?.presentation.flashAdventurer(target.id);
            EventBus.emit("adventurer-hit", {
                adventurerId: target.id,
                partyId: target.partyId,
                roomId: battle.room.id,
                damage,
                health: target.health,
                maxHealth: target.maxHealth,
            });

            if (target.health === 0) {
                owner?.presentation.defeatAdventurer(target.id);
                EventBus.emit("adventurer-defeated", {
                    adventurer: { ...target },
                    adventurerId: target.id,
                    partyId: target.partyId,
                    roomId: battle.room.id,
                });
            }
        }

        if (attackerHealthChanged && this.battles.has(battle.room.id)) {
            this.emitRoomAttackersSnapshot(battle);
        }
    }

    private getLivingAdventurers(battle: RoomBattle): AdventurerData[] {
        return [...battle.parties.values()].flatMap((participant) =>
            participant.presentation
                .getLivingMembers()
                .filter((adventurer) => adventurer.health > 0),
        );
    }

    private findPartyForAdventurer(
        battle: RoomBattle,
        adventurerId: EntityId,
    ): BattleParty | undefined {
        return [...battle.parties.values()].find((participant) =>
            participant.party.members.some(
                (adventurer) => adventurer.id === adventurerId,
            ),
        );
    }

    private createRoomAttackersSnapshot(
        battle: RoomBattle,
    ): RoomAttackersSnapshot {
        const parties = [...battle.parties.values()].flatMap((participant) => {
            const attackers = participant.presentation
                .getLivingMembers()
                .filter((adventurer) => adventurer.health > 0)
                .map((adventurer) => ({
                    id: adventurer.id,
                    partyId: participant.party.id,
                    waveNumber: participant.party.waveNumber,
                    class: adventurer.class,
                    level: adventurer.level,
                    health: adventurer.health,
                    maxHealth: adventurer.maxHealth,
                    attack: adventurer.attack,
                    defense: adventurer.defense,
                }));

            return attackers.length > 0
                ? [
                      {
                          partyId: participant.party.id,
                          waveNumber: participant.party.waveNumber,
                          attackers,
                      },
                  ]
                : [];
        });

        return {
            roomId: battle.room.id,
            active: true,
            totalAttackers: parties.reduce(
                (total, party) => total + party.attackers.length,
                0,
            ),
            parties,
        };
    }

    private emitRoomAttackersSnapshot(battle: RoomBattle): void {
        EventBus.emit(
            "room-attackers-changed",
            this.createRoomAttackersSnapshot(battle),
        );
    }

    private finishBattle(
        battle: RoomBattle,
        fallbackOutcome: RoomCombatOutcome,
    ): void {
        if (!this.battles.delete(battle.room.id)) return;

        EventBus.emit("room-combat-state-changed", {
            roomId: battle.room.id,
            active: false,
        });
        EventBus.emit("room-attackers-changed", {
            roomId: battle.room.id,
            active: false,
            totalAttackers: 0,
            parties: [],
        } satisfies RoomAttackersSnapshot);

        for (const participant of battle.parties.values()) {
            participant.presentation.setFighting(false);
            participant.resolve(
                participant.presentation.getLivingMembers().length > 0
                    ? fallbackOutcome
                    : "defeated",
            );
        }
    }
}

function chooseDenizenTarget(
    denizens: readonly DenizenData[],
): DenizenData | null {
    return (
        denizens.find((denizen) => denizen.role === DenizenRole.DEFENDER) ??
        denizens.find((denizen) => denizen.role === DenizenRole.GATHERER) ??
        null
    );
}

function calculateDamage(attack: number, defense: number): number {
    return Math.max(1, Math.round(attack) - Math.round(defense));
}

function getInitialCooldown(id: EntityId, interval: number): number {
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
        hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
    }
    return 150 + (hash % Math.max(1, interval - 150));
}
