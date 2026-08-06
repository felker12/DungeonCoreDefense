import { Scene } from "phaser";
import { DungeonCameraController } from "../camera/DungeonCameraController";
import type { EntityId } from "../components/DungeonData";
import {
    DenizenRole,
    type DenizenType,
} from "../components/entityComponents/entityData";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import type { CardinalDirection } from "../components/mapComponents/DungeonRoom";
import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import {
    DungeonCoreManager,
    type DungeonCoreSnapshot,
} from "../core/DungeonCoreManager";
import {
    createCoreRelocationCandidate,
    swapCoreRoomRoles,
    validateCoreRelocationTarget,
} from "../core/DungeonCoreRelocation";
import { initialDungeon } from "../data/initialDungeon";
import {
    CARDINAL_DIRECTIONS,
    ROOM_CONSTRUCTION_CATALOG,
    areRoomsConnectable,
    canRemoveConnection,
    cloneDungeonMap,
    createRoomCandidate,
    createRoomConnection,
    findConnectionBetween,
    getAdjacentUnconnectedRooms,
    getConnectionDirection,
    getConstructionDefinition,
    getFunctionalRoomCount,
    getRoomLimit,
    getRoomLimitIncrease,
    validateRoomConstruction,
    type BuildableRoomType,
} from "../construction/DungeonConstruction";
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
import { getRoomSlotUpgradeCost } from "../rooms/RoomSlotUpgrade";
import {
    ResourceManager,
    type ResourceCost,
} from "../resources/ResourceManager";
import { DungeonMapView } from "../views/DungeonMapView";
import type { AdventurerParty } from "../waves/PartyData";
import { WaveManager, type WaveStatus } from "../waves/WaveManager";

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
    roomCapacityReward: number;
}

export interface DungeonProgressionSnapshot {
    level: number;
    nextExpansion: DungeonExpansionRequirement;
}

export interface RoomBuildDirectionOption {
    direction: CardinalDirection;
    available: boolean;
    reason: string | null;
}

export interface RoomBuildCatalogOption {
    type: BuildableRoomType;
    label: string;
    description: string;
    costs: readonly ResourceCost[];
    directions: readonly RoomBuildDirectionOption[];
}

export interface RoomConnectionOption {
    connectionId: EntityId;
    roomId: EntityId;
    roomName: string;
    direction: CardinalDirection;
    removable: boolean;
    removalReason: string | null;
}

export interface AdjacentRoomOption {
    roomId: EntityId;
    roomName: string;
    direction: CardinalDirection;
}

export interface CoreRelocationOption {
    currentCoreRoomId: EntityId;
    available: boolean;
    reason: string | null;
}

export interface DungeonConstructionSnapshot {
    selectedRoomId: EntityId;
    functionalRoomCount: number;
    roomLimit: number;
    roomLimitIncrease: number;
    atOrAboveLimit: boolean;
    locked: boolean;
    catalog: readonly RoomBuildCatalogOption[];
    connections: readonly RoomConnectionOption[];
    adjacentRooms: readonly AdjacentRoomOption[];
    coreRelocation: CoreRelocationOption;
}

export class DungeonScene extends Scene {
    private mapView?: DungeonMapView;
    private cameraController?: DungeonCameraController;
    private waveManager?: WaveManager;
    private coreManager?: DungeonCoreManager;
    private roomPopulation?: RoomPopulationManager;
    private resourceManager?: ResourceManager;
    private initialCenterFrame?: number;
    private nextDenizenId = 1;
    private nextRoomId = 1;
    private nextConnectionId = 1;
    private dungeonLevel = 1;
    private dungeon: DungeonMap = cloneDungeonMap(initialDungeon);

    constructor() {
        super("DungeonScene");
    }

    startNextWave(): boolean {
        const waves = this.waveManager;
        const core = this.coreManager;
        if (!waves || !core || !core.beginRaid()) return false;

        if (waves.startNextWave()) return true;

        core.cancelRaidStart();
        return false;
    }

    retryCurrentWave(): boolean {
        const waves = this.waveManager;
        const core = this.coreManager;
        if (!waves || !core || waves.getStatus().state !== "failed") {
            return false;
        }

        if (!core.prepareRetry() || !core.beginRaid()) return false;
        if (waves.retryCurrentWave()) return true;

        core.cancelRaidStart();
        return false;
    }

    getWaveStatus(): WaveStatus {
        return (
            this.waveManager?.getStatus() ?? {
                waveNumber: 0,
                completedWaves: 0,
                state: "waiting",
                totalAdventurers: 0,
                remainingAdventurers: 0,
                totalParties: 0,
                remainingParties: 0,
            }
        );
    }

    getDungeonCoreStatus(): DungeonCoreSnapshot {
        return (
            this.coreManager?.getSnapshot() ?? {
                health: 300,
                maxHealth: 300,
                defense: 5,
                state: "stable",
                raidStartHealth: null,
                regenerationPerSecond: 0.75,
                regenerationCap: 180,
                regenerationCapPercent: 0.6,
                retryHealth: null,
                lastDamage: 0,
                lastAttackerCount: 0,
            }
        );
    }

    getRoomDetails(roomId: EntityId): RoomDetails | null {
        const room = this.dungeon.rooms.find(
            (candidate) => candidate.id === roomId,
        );
        const connectionCount = this.dungeon.connections.filter(
            (connection) =>
                connection.fromRoomId === roomId ||
                connection.toRoomId === roomId,
        ).length;
        return room
            ? {
                  room: {
                      ...room,
                      position: { ...room.position },
                      size: { ...room.size },
                      denizenIds: [...room.denizenIds],
                      deadEnd:
                          room.type !== "entrance" &&
                          room.type !== "core" &&
                          connectionCount === 1,
                  },
                  population: this.roomPopulation?.getSnapshot(roomId) ?? null,
              }
            : null;
    }

    upgradeSelectedRoom(
        roomId: EntityId,
        slot: ResourceSlotType | "defender",
    ): boolean {
        if (this.waveManager?.isActive()) return false;

        const populationManager = this.roomPopulation;
        const resources = this.resourceManager;
        const population = populationManager?.getSnapshot(roomId);
        if (!populationManager || !resources || !population) return false;

        const upgradeSlot: ResourceSlotType =
            population.capacity.kind === "combat" ? "defender" : slot;

        if (
            upgradeSlot === "gatherer" &&
            (population.capacity.kind !== "resource" ||
                population.capacity.gatherers >=
                    population.capacity.maxGatherers)
        ) {
            return false;
        }

        if (
            upgradeSlot === "defender" &&
            population.capacity.defenders >= population.capacity.maxDefenders
        ) {
            return false;
        }

        const cost = getRoomSlotUpgradeCost(upgradeSlot);
        if (!resources.canAfford(cost.resource, cost.amount)) return false;

        const upgraded =
            population.capacity.kind === "combat"
                ? populationManager.upgradeCombatSlot(roomId)
                : populationManager.upgradeResourceSlot(roomId, upgradeSlot);

        // The checks and mutation are synchronous, so spending after a successful
        // upgrade guarantees a rejected upgrade never charges the player.
        return upgraded && resources.spend(cost.resource, cost.amount);
    }

    create(): void {
        this.cameras.main.setBackgroundColor("#111018");
        this.dungeon = cloneDungeonMap(initialDungeon);
        validateDungeonMap(this.dungeon);
        this.mapView = new DungeonMapView(this, this.dungeon);
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

        this.coreManager = new DungeonCoreManager({
            maxHealth: 300,
            defense: 5,
            regenerationPerSecond: 0.75,
            regenerationCapPercent: 0.6,
            minimumRetryHealthPercent: 0.5,
            onChange: (snapshot) =>
                EventBus.emit("dungeon-core-changed", snapshot),
        });
        this.waveManager = new WaveManager(this, this.dungeon, {
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
        this.roomPopulation = new RoomPopulationManager(this.dungeon, [], {
            gathererRecoveryMs: 20_000,
            baseProductionPerSecond: 1,
            rosterCapacity: 8,
        });
        this.resourceManager = new ResourceManager();

        for (const room of this.dungeon.rooms) {
            const snapshot = this.roomPopulation.getSnapshot(room.id);
            if (snapshot) EventBus.emit("room-population-changed", snapshot);
        }

        const handleRoomSelected = (room: DungeonRoom): void => {
            this.mapView?.selectRoom(room.id);
        };
        const handlePartyCoreReached = (party: AdventurerParty): void => {
            const result = this.coreManager?.applySurvivorAttacks(
                party.members,
            );
            if (result?.breached) this.waveManager?.failCurrentWave();
        };
        const handleWaveStatus = (status: WaveStatus): void => {
            if (status.state === "completed") {
                this.coreManager?.completeRaid();
            }
        };

        EventBus.on("room-selected", handleRoomSelected);
        EventBus.on("party-core-reached", handlePartyCoreReached);
        EventBus.on("wave-status-changed", handleWaveStatus);
        this.events.once("shutdown", () => {
            if (this.initialCenterFrame !== undefined) {
                cancelAnimationFrame(this.initialCenterFrame);
                this.initialCenterFrame = undefined;
            }

            EventBus.off("room-selected", handleRoomSelected);
            EventBus.off("party-core-reached", handlePartyCoreReached);
            EventBus.off("wave-status-changed", handleWaveStatus);
            this.waveManager?.destroy();
            this.waveManager = undefined;
            this.coreManager = undefined;
            this.roomPopulation = undefined;
            this.resourceManager = undefined;
            this.cameraController?.destroy();
            this.cameraController = undefined;
        });

        EventBus.emit("current-scene-ready", this);
    }

    update(_time: number, delta: number): void {
        if (!this.waveManager?.isActive() || !this.roomPopulation) return;

        this.coreManager?.update(delta);
        this.roomPopulation.update(delta);
        const productionPerSecond = this.dungeon.rooms.reduce(
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

        return this.dungeon.rooms.flatMap((room) => {
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

    getRoomConstructionSnapshot(
        roomId: EntityId,
    ): DungeonConstructionSnapshot | null {
        const selectedRoom = this.dungeon.rooms.find(
            (room) => room.id === roomId,
        );
        if (!selectedRoom) return null;

        const waveStatus = this.waveManager?.getStatus();
        const locked = this.waveManager?.isActive() ?? false;
        const functionalRoomCount = getFunctionalRoomCount(this.dungeon);
        const roomLimit = getRoomLimit(this.dungeonLevel);
        const atOrAboveLimit = functionalRoomCount >= roomLimit;

        const catalog = ROOM_CONSTRUCTION_CATALOG.map((definition) => ({
            type: definition.type,
            label: definition.label,
            description: definition.description,
            costs: definition.costs,
            directions: CARDINAL_DIRECTIONS.map((direction) => {
                const candidate = createRoomCandidate(
                    this.dungeon,
                    {
                        sourceRoomId: roomId,
                        roomType: definition.type,
                        direction,
                    },
                    "construction-preview",
                );
                const validation = candidate
                    ? validateRoomConstruction(
                          this.dungeon,
                          this.dungeonLevel,
                          {
                              sourceRoomId: roomId,
                              roomType: definition.type,
                              direction,
                          },
                          candidate,
                      )
                    : {
                          valid: false,
                          reason: "The selected room no longer exists.",
                      };

                return {
                    direction,
                    available: validation.valid && !locked,
                    reason: locked
                        ? "Construction is locked during an active raid."
                        : validation.reason,
                };
            }),
        }));

        const connections = this.dungeon.connections.flatMap((connection) => {
            if (
                connection.fromRoomId !== roomId &&
                connection.toRoomId !== roomId
            ) {
                return [];
            }

            const otherRoomId =
                connection.fromRoomId === roomId
                    ? connection.toRoomId
                    : connection.fromRoomId;
            const otherRoom = this.dungeon.rooms.find(
                (room) => room.id === otherRoomId,
            );
            const direction = otherRoom
                ? getConnectionDirection(selectedRoom, otherRoom)
                : null;
            if (!otherRoom || !direction) return [];

            const removal = canRemoveConnection(this.dungeon, connection.id);
            return [
                {
                    connectionId: connection.id,
                    roomId: otherRoom.id,
                    roomName: otherRoom.name,
                    direction,
                    removable: removal.valid && !locked,
                    removalReason: locked
                        ? "Connections cannot change during an active raid."
                        : removal.reason,
                },
            ];
        });

        const adjacentRooms = getAdjacentUnconnectedRooms(
            this.dungeon,
            roomId,
        ).flatMap((room) => {
            const direction = getConnectionDirection(selectedRoom, room);
            if (
                !direction ||
                this.hasRoomConnectionOnSide(selectedRoom.id, direction)
            ) {
                return [];
            }

            const reverseDirection = getConnectionDirection(room, selectedRoom);
            if (
                !reverseDirection ||
                this.hasRoomConnectionOnSide(room.id, reverseDirection)
            ) {
                return [];
            }

            return [
                {
                    roomId: room.id,
                    roomName: room.name,
                    direction,
                },
            ];
        });

        const currentCoreRoomId =
            this.dungeon.rooms.find((room) => room.type === "core")?.id ?? "";
        const relocation = validateCoreRelocationTarget(this.dungeon, roomId);
        const relocationLocked = locked || waveStatus?.state === "failed";
        const coreRelocation: CoreRelocationOption = {
            currentCoreRoomId,
            available: relocation.valid && !relocationLocked,
            reason: locked
                ? "The Core cannot move during an active raid."
                : waveStatus?.state === "failed"
                  ? "Retry or resolve the failed wave before moving the Core."
                  : relocation.reason,
        };

        return {
            selectedRoomId: roomId,
            functionalRoomCount,
            roomLimit,
            roomLimitIncrease: getRoomLimitIncrease(),
            atOrAboveLimit,
            locked,
            catalog,
            connections,
            adjacentRooms,
            coreRelocation,
        };
    }

    moveCoreToRoom(targetRoomId: EntityId): boolean {
        const waves = this.waveManager;
        const population = this.roomPopulation;
        if (!waves || !population || waves.isActive()) return false;
        if (waves.getStatus().state === "failed") return false;

        const validation = validateCoreRelocationTarget(
            this.dungeon,
            targetRoomId,
        );
        if (!validation.valid) return false;

        const candidate = createCoreRelocationCandidate(
            this.dungeon,
            targetRoomId,
        );
        if (!candidate) return false;
        try {
            validateDungeonMap(candidate);
        } catch {
            return false;
        }

        const result = swapCoreRoomRoles(this.dungeon, targetRoomId);
        if (!result) return false;
        if (
            !population.swapRoomPopulation(
                result.previousCoreRoomId,
                result.coreRoomId,
            )
        ) {
            swapCoreRoomRoles(this.dungeon, result.previousCoreRoomId);
            return false;
        }

        this.mapView?.refreshRoom(result.previousCoreRoomId);
        this.mapView?.refreshRoom(result.coreRoomId);
        population.emitRoomSnapshot(result.previousCoreRoomId);
        population.emitRoomSnapshot(result.coreRoomId);
        this.mapView?.selectRoom(result.coreRoomId);
        this.refreshTopology(result.coreRoomId);

        const coreRoom = this.dungeon.rooms.find(
            (room) => room.id === result.coreRoomId,
        );
        if (coreRoom) EventBus.emit("room-selected", coreRoom);
        return true;
    }

    buildRoom(
        sourceRoomId: EntityId,
        roomType: BuildableRoomType,
        direction: CardinalDirection,
    ): boolean {
        const resources = this.resourceManager;
        if (!resources || this.waveManager?.isActive()) return false;

        const roomId = this.createUniqueRoomId();
        const request = { sourceRoomId, roomType, direction };
        const room = createRoomCandidate(this.dungeon, request, roomId);
        if (!room) return false;

        const validation = validateRoomConstruction(
            this.dungeon,
            this.dungeonLevel,
            request,
            room,
        );
        if (!validation.valid) return false;

        const definition = getConstructionDefinition(roomType);
        if (!resources.canAffordAll(definition.costs)) return false;

        const connection = createRoomConnection(
            sourceRoomId,
            room.id,
            this.createUniqueConnectionId(),
        );
        const candidateMap: DungeonMap = {
            ...this.dungeon,
            rooms: [...this.dungeon.rooms, room],
            connections: [...this.dungeon.connections, connection],
        };
        try {
            validateDungeonMap(candidateMap);
        } catch {
            return false;
        }

        if (!resources.spendAll(definition.costs)) return false;

        this.dungeon.rooms.push(room);
        this.dungeon.connections.push(connection);
        this.roomPopulation?.registerRoom(room);
        this.mapView?.addRoom(room);
        this.mapView?.addConnection(connection);
        this.refreshTopology(room.id);
        this.mapView?.selectRoom(room.id);
        EventBus.emit("room-selected", room);
        return true;
    }

    addConnectionBetweenRooms(
        firstRoomId: EntityId,
        secondRoomId: EntityId,
    ): boolean {
        if (this.waveManager?.isActive()) return false;
        if (findConnectionBetween(this.dungeon, firstRoomId, secondRoomId)) {
            return false;
        }

        const first = this.dungeon.rooms.find((room) => room.id === firstRoomId);
        const second = this.dungeon.rooms.find((room) => room.id === secondRoomId);
        if (!first || !second || !areRoomsConnectable(this.dungeon, first, second)) {
            return false;
        }

        const firstDirection = getConnectionDirection(first, second);
        const secondDirection = getConnectionDirection(second, first);
        if (
            !firstDirection ||
            !secondDirection ||
            this.hasRoomConnectionOnSide(first.id, firstDirection) ||
            this.hasRoomConnectionOnSide(second.id, secondDirection)
        ) {
            return false;
        }

        const connection = createRoomConnection(
            firstRoomId,
            secondRoomId,
            this.createUniqueConnectionId(),
        );
        const candidateMap: DungeonMap = {
            ...this.dungeon,
            connections: [...this.dungeon.connections, connection],
        };
        try {
            validateDungeonMap(candidateMap);
        } catch {
            return false;
        }

        this.dungeon.connections.push(connection);
        this.mapView?.addConnection(connection);
        this.refreshTopology(firstRoomId);
        return true;
    }

    removeConnection(connectionId: EntityId): boolean {
        if (this.waveManager?.isActive()) return false;

        const validation = canRemoveConnection(this.dungeon, connectionId);
        if (!validation.valid) return false;

        const connectionIndex = this.dungeon.connections.findIndex(
            (connection) => connection.id === connectionId,
        );
        if (connectionIndex < 0) return false;

        const [connection] = this.dungeon.connections.splice(connectionIndex, 1);
        this.mapView?.removeConnection(connection.id);
        this.refreshTopology();
        return true;
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
        EventBus.emit("dungeon-construction-changed", null);
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
            roomCapacityReward: getRoomLimitIncrease(),
        };
    }

    private emitProgression(): void {
        EventBus.emit(
            "dungeon-progression-changed",
            this.getDungeonProgression(),
        );
    }

    private refreshTopology(selectedRoomId?: EntityId): void {
        this.waveManager?.refreshTopology();
        if (this.mapView && this.cameraController) {
            this.cameraController.updateFocusBounds(
                this.mapView.getMapBounds(),
            );
        }
        EventBus.emit(
            "dungeon-construction-changed",
            selectedRoomId
                ? this.getRoomConstructionSnapshot(selectedRoomId)
                : null,
        );
    }

    private hasRoomConnectionOnSide(
        roomId: EntityId,
        direction: CardinalDirection,
    ): boolean {
        const room = this.dungeon.rooms.find((candidate) => candidate.id === roomId);
        if (!room) return false;

        return this.dungeon.connections.some((connection) => {
            if (
                connection.fromRoomId !== roomId &&
                connection.toRoomId !== roomId
            ) {
                return false;
            }
            const otherRoomId =
                connection.fromRoomId === roomId
                    ? connection.toRoomId
                    : connection.fromRoomId;
            const otherRoom = this.dungeon.rooms.find(
                (candidate) => candidate.id === otherRoomId,
            );
            return (
                otherRoom !== undefined &&
                getConnectionDirection(room, otherRoom) === direction
            );
        });
    }

    private createUniqueRoomId(): EntityId {
        let id: EntityId;
        do {
            id = `player-room-${this.nextRoomId++}`;
        } while (this.dungeon.rooms.some((room) => room.id === id));
        return id;
    }

    private createUniqueConnectionId(): EntityId {
        let id: EntityId;
        do {
            id = `player-connection-${this.nextConnectionId++}`;
        } while (
            this.dungeon.connections.some((connection) => connection.id === id)
        );
        return id;
    }
}
