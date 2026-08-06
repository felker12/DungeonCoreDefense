import type { Scene } from "phaser";
import type { EntityId, Position } from "../components/DungeonData";
import type { AdventurerData } from "../components/entityComponents/entityData";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import type {
    PartyCombatPresentation,
    RoomEncounterResolver,
} from "../combat/CombatTypes";
import { EventBus } from "../EventBus";
import { AdventurerView } from "../views/AdventurerView";
import type { AdventurerParty } from "../waves/PartyData";

export interface PartyMovementOptions {
    travelDuration?: number;
    roomPauseDuration?: number;
    encounterResolver?: RoomEncounterResolver;
}

export type PartyAdvanceResult = "core" | "defeated" | "cancelled";

const FORMATION_COLUMN_SPACING = 34;
const FORMATION_ROW_SPACING = 32;

function createFormationOffsets(memberCount: number): readonly Position[] {
    if (memberCount < 1) return [];

    const columnCount = Math.ceil(Math.sqrt(memberCount));
    const rowCount = Math.ceil(memberCount / columnCount);
    const offsets: Position[] = [];

    for (let row = 0; row < rowCount; row += 1) {
        const membersAlreadyPlaced = row * columnCount;
        const membersInRow = Math.min(
            columnCount,
            memberCount - membersAlreadyPlaced,
        );
        const y = (row - (rowCount - 1) / 2) * FORMATION_ROW_SPACING;

        for (let column = 0; column < membersInRow; column += 1) {
            offsets.push({
                x:
                    (column - (membersInRow - 1) / 2) *
                    FORMATION_COLUMN_SPACING,
                y,
            });
        }
    }

    return offsets;
}

export class PartyController implements PartyCombatPresentation {
    private readonly views = new Map<EntityId, AdventurerView>();
    private readonly formationOffsets: readonly Position[];
    private readonly travelDuration: number;
    private readonly roomPauseDuration: number;
    private readonly encounterResolver?: RoomEncounterResolver;
    private destroyed = false;

    constructor(
        private readonly scene: Scene,
        private readonly party: AdventurerParty,
        private readonly roomsById: ReadonlyMap<EntityId, DungeonRoom>,
        options: PartyMovementOptions = {},
    ) {
        this.travelDuration = options.travelDuration ?? 700;
        this.roomPauseDuration = options.roomPauseDuration ?? 250;
        this.encounterResolver = options.encounterResolver;
        for (const member of party.members) {
            this.views.set(member.id, new AdventurerView(scene, member));
        }
        this.formationOffsets = createFormationOffsets(party.members.length);
    }

    async advance(): Promise<PartyAdvanceResult> {
        for (
            let routeIndex = 0;
            routeIndex < this.party.route.length;
            routeIndex += 1
        ) {
            if (this.destroyed) return "cancelled";

            const roomId = this.party.route[routeIndex];
            const room = this.roomsById.get(roomId);
            if (!room) {
                throw new Error(`Party route references missing room ${roomId}.`);
            }

            if (routeIndex === 0) this.placeParty(room.position);
            else await this.moveParty(room.position);
            if (this.destroyed) return "cancelled";

            for (const member of this.getLivingMembers()) {
                member.currentRoomId = room.id;
            }
            EventBus.emit("party-room-entered", { party: this.party, room });
            for (const member of this.getLivingMembers()) {
                EventBus.emit("adventurer-room-entered", {
                    adventurer: member,
                    room,
                });
            }

            if (this.encounterResolver) {
                const outcome = await this.encounterResolver(
                    this.party,
                    room,
                    this,
                );
                if (this.destroyed) return "cancelled";
                if (outcome === "defeated") {
                    this.destroyViews();
                    return "defeated";
                }
            }

            await this.wait(this.roomPauseDuration);
        }

        if (this.destroyed) return "cancelled";
        if (this.getLivingMembers().length === 0) {
            this.destroyViews();
            return "defeated";
        }

        EventBus.emit("party-core-reached", this.party);
        for (const member of this.getLivingMembers()) {
            EventBus.emit("adventurer-core-reached", member);
        }
        this.destroyViews();
        return "core";
    }

    getLivingMembers(): AdventurerData[] {
        return this.party.members.filter((member) => member.health > 0);
    }

    setFighting(active: boolean): void {
        for (const member of this.getLivingMembers()) {
            this.views.get(member.id)?.setFighting(active);
        }
    }

    flashAdventurer(adventurerId: EntityId): void {
        this.views.get(adventurerId)?.flashHit();
    }

    defeatAdventurer(adventurerId: EntityId): void {
        this.views.get(adventurerId)?.defeat();
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        for (const view of this.views.values()) {
            this.scene.tweens.killTweensOf(view);
            view.setFighting(false);
        }
        this.destroyViews();
    }

    private placeParty(center: Position): void {
        this.party.members.forEach((member, index) => {
            if (member.health <= 0) return;
            const view = this.views.get(member.id);
            const offset = this.formationOffsets[index];
            view?.setPosition(center.x + offset.x, center.y + offset.y);
        });
    }

    private moveParty(center: Position): Promise<void> {
        const movements = this.party.members.flatMap((member, index) => {
            if (member.health <= 0) return [];
            const view = this.views.get(member.id);
            if (!view?.active) return [];

            view.setFighting(false);
            const offset = this.formationOffsets[index];
            return [
                new Promise<void>((resolve) => {
                    this.scene.tweens.add({
                        targets: view,
                        x: center.x + offset.x,
                        y: center.y + offset.y,
                        duration: this.travelDuration,
                        ease: "Sine.easeInOut",
                        onComplete: () => resolve(),
                    });
                }),
            ];
        });

        return Promise.all(movements).then(() => undefined);
    }

    private wait(duration: number): Promise<void> {
        return new Promise((resolve) =>
            this.scene.time.delayedCall(duration, resolve),
        );
    }

    private destroyViews(): void {
        for (const view of this.views.values()) {
            if (view.active) view.destroy();
        }
        this.views.clear();
    }
}
