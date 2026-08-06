import { Scene } from "phaser";
import { DungeonCameraController } from "../camera/DungeonCameraController";
import type { EntityId } from "../components/DungeonData";
import {
    DenizenRole,
    type DenizenType,
} from "../components/entityComponents/entityData";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import { initialDungeon } from "../data/initialDungeon";
import { getDenizenAssignmentCost } from "../denizens/DenizenAssignment";
import { DENIZEN_OFFERS, createDenizen } from "../denizens/DenizenRecruitment";
import { EventBus } from "../EventBus";
import { validateDungeonMap } from "../pathfinding/validateDungeonMap";
import { RoomPopulationManager } from "../rooms/RoomPopulationManager";
import type {
    DenizenRosterSnapshot,
    RoomPopulationSnapshot,
    ResourceSlotType,
} from "../rooms/RoomPopulationManager";
import {
    ResourceManager,
    type ResourceCost,
} from "../resources/ResourceManager";
import { DungeonMapView } from "../views/DungeonMapView";
import { WaveManager } from "../waves/WaveManager";

const EXPANSION_CAPACITY_REWARD = 2;

export interface RoomDetails {
    room: DungeonRoom;
    population: RoomPopulationSnapshot | null;
}

export interface DenizenRoomOption {
    id: EntityId;
    name: string;
    assignedDefenders: number;
    defenderCapacity: number;
    assignedProducers: number;
    producerCapacity: number;
}

export type DefenderRoomOption = DenizenRoomOption;

export interface DungeonExpansionRequirement {
    level: number;
    waveRequired: number;
    costs: readonly ResourceCost[];
    denizenCapacityReward: number;
}

export interface DungeonProgressionSnapshot {
    level: number;
    nextExpansion: DungeonExpansionRequirement;
}

export class DungeonScene extends Scene {
    private mapView?: DungeonMapView;
    private cameraController?: DungeonCameraController;
    private waveManager?: WaveManager;
    private roomPopulation?: RoomPopulationManager;
    private resourceManager?: ResourceManager;
    private initialCenterFrame?: number;
    private nextDenizenId = 1;
    private dungeonLevel = 1;

    constructor() {
        super("DungeonScene");
    }

    startNextWave(): boolean {
        return this.waveManager?.startNextWave() ?? false;
    }

    getRoomDetails(roomId: EntityId): RoomDetails | null {
        const room = initialDungeon.rooms.find(
            (candidate) => candidate.id === roomId,
        );
        return room
            ? {
                  room: { ...room },
                  population: this.roomPopulation?.getSnapshot(roomId) ?? null,
              }
            : null;
    }

    upgradeSelectedRoom(
        roomId: EntityId,
        slot: ResourceSlotType | "defender",
    ): boolean {
        const population = this.roomPopulation?.getSnapshot(roomId);
        if (!population) return false;
        return population.capacity.kind === "combat"
            ? (this.roomPopulation?.upgradeCombatSlot(roomId) ?? false)
            : (this.roomPopulation?.upgradeResourceSlot(roomId, slot) ?? false);
    }

    create(): void {
        this.cameras.main.setBackgroundColor("#111018");
        validateDungeonMap(initialDungeon);
        this.mapView = new DungeonMapView(this, initialDungeon);
        this.mapView.setVisible(false);
        this.cameraController = new DungeonCameraController(
            this,
            this.mapView.getMapBounds(),
            { southWorldPadding: 4500 },
        );

        this.initialCenterFrame = requestAnimationFrame(() => {
            this.initialCenterFrame = undefined;
            if (!this.scene.isActive() || !this.cameraController) return;
            this.scale.refresh();
            this.cameraController.initializeViewport();
            this.mapView?.setVisible(true);
        });

        this.waveManager = new WaveManager(this, initialDungeon, {
            seed: 1337,
            partySpawnInterval: 1400,
            minPartySize: 1,
            startingMaxPartySize: 3,
            maxPartySize: 10,
            wavesPerPartySizeIncrease: 5,
            startingWaveCapacity: 3,
            linearWaveGrowth: 1.25,
            quadraticWaveGrowth: 0.035,
            wrongTurnChance: 0.65,
        });
        this.roomPopulation = new RoomPopulationManager(initialDungeon, [], {
            gathererRecoveryMs: 20_000,
            baseProductionPerSecond: 1,
            rosterCapacity: 8,
        });
        this.resourceManager = new ResourceManager();

        for (const room of initialDungeon.rooms) {
            const snapshot = this.roomPopulation.getSnapshot(room.id);
            if (snapshot) EventBus.emit("room-population-changed", snapshot);
        }

        const handleRoomSelected = (room: DungeonRoom): void => {
            this.mapView?.selectRoom(room.id);
        };

        EventBus.on("room-selected", handleRoomSelected);
        this.events.once("shutdown", () => {
            if (this.initialCenterFrame !== undefined) {
                cancelAnimationFrame(this.initialCenterFrame);
                this.initialCenterFrame = undefined;
            }

            EventBus.off("room-selected", handleRoomSelected);
            this.waveManager?.destroy();
            this.waveManager = undefined;
            this.roomPopulation = undefined;
            this.resourceManager = undefined;
            this.cameraController?.destroy();
            this.cameraController = undefined;
        });

        EventBus.emit("current-scene-ready", this);
    }

    update(_time: number, delta: number): void {
        if (!this.waveManager?.isActive() || !this.roomPopulation) return;

        this.roomPopulation.update(delta);
        const productionPerSecond = initialDungeon.rooms.reduce(
            (total, room) =>
                total +
                (this.roomPopulation?.getSnapshot(room.id)
                    ?.productionPerSecond ?? 0),
            0,
        );
        this.resourceManager?.update(delta, productionPerSecond);
    }

    getDenizenRoster(): DenizenRosterSnapshot {
        return (
            this.roomPopulation?.getRosterSnapshot() ?? {
                denizens: [],
                capacity: 8,
            }
        );
    }

    getDenizenRoomOptions(): DenizenRoomOption[] {
        if (!this.roomPopulation) return [];

        return initialDungeon.rooms.flatMap((room) => {
            const population = this.roomPopulation?.getSnapshot(room.id);
            if (!population) return [];

            return [
                {
                    id: room.id,
                    name: room.name,
                    assignedDefenders: population.assignedDefenders,
                    defenderCapacity: population.capacity.defenders,
                    assignedProducers: population.assignedGatherers,
                    producerCapacity:
                        population.capacity.kind === "resource"
                            ? population.capacity.gatherers
                            : 0,
                },
            ];
        });
    }

    getDefenderRoomOptions(): DenizenRoomOption[] {
        return this.getDenizenRoomOptions();
    }

    assignDenizenToRoom(denizenId: EntityId, roomId: EntityId): boolean {
        if (this.waveManager?.isActive()) return false;

        const population = this.roomPopulation;
        const resources = this.resourceManager;
        const denizen = population?.getDenizen(denizenId);
        if (
            !population ||
            !resources ||
            !denizen ||
            !population.canAssignDenizen(denizenId, roomId)
        ) {
            return false;
        }

        const cost = getDenizenAssignmentCost(denizen.role);
        if (!resources.spend(cost.resource, cost.amount)) return false;

        return population.assignDenizen(denizenId, roomId);
    }

    assignDefenderToRoom(denizenId: EntityId, roomId: EntityId): boolean {
        return this.assignDenizenToRoom(denizenId, roomId);
    }

    unassignDenizen(denizenId: EntityId): boolean {
        if (this.waveManager?.isActive()) return false;
        return this.roomPopulation?.unassignDenizen(denizenId) ?? false;
    }

    unassignDefender(denizenId: EntityId): boolean {
        return this.unassignDenizen(denizenId);
    }

    recruitDenizen(type: DenizenType): boolean {
        const population = this.roomPopulation;
        const resources = this.resourceManager;
        const offer = DENIZEN_OFFERS.find(
            (candidate) => candidate.type === type,
        );
        if (!population || !resources || !offer) return false;

        const roster = population.getRosterSnapshot();
        if (
            roster.denizens.length >= roster.capacity ||
            !resources.canAfford("supplies", offer.cost)
        ) {
            return false;
        }

        const roleLabel =
            offer.role === DenizenRole.GATHERER ? "producer" : "defender";
        const denizen = createDenizen(
            offer,
            `recruited-${roleLabel}-${this.nextDenizenId++}`,
        );

        if (!resources.spend("supplies", offer.cost)) return false;
        if (population.addDenizen(denizen)) return true;

        return false;
    }

    recruitDefender(type: DenizenType): boolean {
        return this.recruitDenizen(type);
    }

    getDungeonProgression(): DungeonProgressionSnapshot {
        return {
            level: this.dungeonLevel,
            nextExpansion: this.createExpansionRequirement(),
        };
    }

    expandDungeon(): boolean {
        const resources = this.resourceManager;
        const population = this.roomPopulation;
        const waves = this.waveManager;
        if (!resources || !population || !waves || waves.isActive()) {
            return false;
        }

        const requirement = this.createExpansionRequirement();
        const completedWaveCount = waves.getCompletedWaveCount();

        if (
            completedWaveCount < requirement.waveRequired ||
            !resources.canAffordAll(requirement.costs)
        ) {
            return false;
        }

        if (!resources.spendAll(requirement.costs)) return false;
        if (
            !population.expandRosterCapacity(requirement.denizenCapacityReward)
        ) {
            return false;
        }

        this.dungeonLevel += 1;
        this.emitProgression();
        return true;
    }

    private createExpansionRequirement(): DungeonExpansionRequirement {
        const resources = this.resourceManager?.getSnapshot().resources;
        const stoneCapacity = resources?.stone.capacity ?? 150;
        const essenceCapacity = resources?.essence.capacity ?? 250;

        return {
            level: this.dungeonLevel + 1,
            waveRequired: this.dungeonLevel * 3,
            costs: [
                {
                    resource: "stone",
                    amount: Math.min(
                        stoneCapacity,
                        150 + (this.dungeonLevel - 1) * 25,
                    ),
                },
                {
                    resource: "essence",
                    amount: Math.min(
                        essenceCapacity,
                        50 + (this.dungeonLevel - 1) * 25,
                    ),
                },
            ],
            denizenCapacityReward: EXPANSION_CAPACITY_REWARD,
        };
    }

    private emitProgression(): void {
        EventBus.emit(
            "dungeon-progression-changed",
            this.getDungeonProgression(),
        );
    }
}
