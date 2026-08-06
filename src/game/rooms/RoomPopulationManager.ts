import type { EntityId } from "../components/DungeonData";
import {
    DenizenRole,
    DenizenStatus,
    type DenizenData,
} from "../components/entityComponents/entityData";
import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import {
    DungeonRoomType,
    type DungeonRoom,
    type RoomCapacity,
} from "../components/mapComponents/DungeonRoom";
import { EventBus } from "../EventBus";
import { createInitialRoomCapacity } from "./RoomCapacity";

export type ResourceSlotType = "gatherer" | "defender";

export interface RoomPopulationState {
    denizens: readonly DenizenData[];
    rosterCapacity: number;
    capacities: Record<EntityId, RoomCapacity>;
}

export interface RoomPopulationOptions {
    gathererRecoveryMs?: number;
    baseProductionPerSecond?: number;
    rosterCapacity?: number;
    initialState?: RoomPopulationState;
}

export interface RoomPopulationSnapshot {
    roomId: EntityId;
    capacity: RoomCapacity;
    assignedGatherers: number;
    activeGatherers: number;
    recoveringGatherers: number;
    assignedDefenders: number;
    productionPerSecond: number;
    denizens: readonly DenizenData[];
}

export interface DenizenRosterSnapshot {
    denizens: readonly DenizenData[];
    capacity: number;
}

export class RoomPopulationManager {
    private readonly capacities = new Map<EntityId, RoomCapacity>();
    private readonly denizens = new Map<EntityId, DenizenData>();
    private readonly gathererRecoveryMs: number;
    private readonly baseProductionPerSecond: number;
    private rosterCapacity: number;

    constructor(
        private readonly dungeon: DungeonMap,
        denizens: readonly DenizenData[] = [],
        options: RoomPopulationOptions = {},
    ) {
        this.gathererRecoveryMs = options.gathererRecoveryMs ?? 20_000;
        this.baseProductionPerSecond = options.baseProductionPerSecond ?? 1;
        this.rosterCapacity = options.rosterCapacity ?? 8;

        for (const room of dungeon.rooms) {
            const capacity = createInitialRoomCapacity(room);
            if (capacity) {
                this.capacities.set(room.id, capacity);
                room.populationCapacity = { ...capacity };
            }
        }

        if (options.initialState) {
            this.restoreState(options.initialState);
        } else {
            for (const denizen of denizens) {
                this.denizens.set(denizen.id, { ...denizen });
            }
            this.rebuildRoomAssignments();
        }
    }

    registerRoom(room: DungeonRoom): boolean {
        if (this.capacities.has(room.id)) return false;

        const capacity = createInitialRoomCapacity(room);
        if (!capacity) return true;

        this.capacities.set(room.id, capacity);
        room.populationCapacity = { ...capacity };
        this.emitRoom(room.id);
        return true;
    }

    swapRoomPopulation(firstRoomId: EntityId, secondRoomId: EntityId): boolean {
        const firstRoom = this.dungeon.rooms.find(
            (room) => room.id === firstRoomId,
        );
        const secondRoom = this.dungeon.rooms.find(
            (room) => room.id === secondRoomId,
        );
        if (!firstRoom || !secondRoom || firstRoomId === secondRoomId) {
            return false;
        }

        const firstCapacity = this.capacities.get(firstRoomId);
        const secondCapacity = this.capacities.get(secondRoomId);
        this.capacities.delete(firstRoomId);
        this.capacities.delete(secondRoomId);
        if (secondCapacity) this.capacities.set(firstRoomId, secondCapacity);
        if (firstCapacity) this.capacities.set(secondRoomId, firstCapacity);

        firstRoom.populationCapacity = secondCapacity
            ? { ...secondCapacity }
            : undefined;
        secondRoom.populationCapacity = firstCapacity
            ? { ...firstCapacity }
            : undefined;

        for (const denizenId of firstRoom.denizenIds) {
            const denizen = this.denizens.get(denizenId);
            if (denizen) denizen.assignedRoomId = firstRoomId;
        }
        for (const denizenId of secondRoom.denizenIds) {
            const denizen = this.denizens.get(denizenId);
            if (denizen) denizen.assignedRoomId = secondRoomId;
        }

        this.emitRoom(firstRoomId);
        this.emitRoom(secondRoomId);
        this.emitRoster();
        return true;
    }

    emitRoomSnapshot(roomId: EntityId): void {
        this.emitRoom(roomId);
    }

    addDenizen(denizen: DenizenData): boolean {
        if (
            this.denizens.has(denizen.id) ||
            this.denizens.size >= this.rosterCapacity
        ) {
            return false;
        }

        this.denizens.set(denizen.id, { ...denizen });
        this.emitRoster();
        return true;
    }

    removeDenizen(denizenId: EntityId): boolean {
        const denizen = this.denizens.get(denizenId);
        if (!denizen || denizen.assignedRoomId) return false;

        this.denizens.delete(denizenId);
        this.emitRoster();
        return true;
    }

    getDenizen(denizenId: EntityId): DenizenData | null {
        const denizen = this.denizens.get(denizenId);
        return denizen ? { ...denizen } : null;
    }

    canAssignDenizen(denizenId: EntityId, roomId: EntityId): boolean {
        const denizen = this.denizens.get(denizenId);
        const room = this.dungeon.rooms.find(
            (candidate) => candidate.id === roomId,
        );
        const capacity = this.capacities.get(roomId);
        if (!denizen || denizen.assignedRoomId || !room || !capacity) {
            return false;
        }

        const snapshot = this.getSnapshot(roomId);
        if (!snapshot) return false;

        if (denizen.role === DenizenRole.GATHERER) {
            return (
                capacity.kind === "resource" &&
                snapshot.assignedGatherers < capacity.gatherers
            );
        }

        return snapshot.assignedDefenders < capacity.defenders;
    }

    assignDenizen(denizenId: EntityId, roomId: EntityId): boolean {
        if (!this.canAssignDenizen(denizenId, roomId)) return false;

        const denizen = this.denizens.get(denizenId)!;
        const room = this.dungeon.rooms.find(
            (candidate) => candidate.id === roomId,
        )!;

        denizen.assignedRoomId = roomId;
        if (!room.denizenIds.includes(denizenId)) {
            room.denizenIds.push(denizenId);
        }
        this.emitRoom(roomId);
        this.emitRoster();
        return true;
    }

    unassignDenizen(denizenId: EntityId): boolean {
        const denizen = this.denizens.get(denizenId);
        if (!denizen?.assignedRoomId) return false;

        const roomId = denizen.assignedRoomId;
        const room = this.dungeon.rooms.find(
            (candidate) => candidate.id === roomId,
        );
        denizen.assignedRoomId = null;
        if (room)
            room.denizenIds = room.denizenIds.filter((id) => id !== denizenId);
        this.emitRoom(roomId);
        this.emitRoster();
        return true;
    }

    upgradeCombatSlot(roomId: EntityId): boolean {
        const capacity = this.capacities.get(roomId);
        if (
            !capacity ||
            capacity.kind !== "combat" ||
            capacity.defenders >= capacity.maxDefenders
        ) {
            return false;
        }
        capacity.defenders += 1;
        this.syncRoomCapacity(roomId);
        this.raiseRoomLevel(roomId);
        this.emitRoom(roomId);
        return true;
    }

    upgradeResourceSlot(roomId: EntityId, slot: ResourceSlotType): boolean {
        const capacity = this.capacities.get(roomId);
        if (!capacity || capacity.kind !== "resource") return false;

        if (slot === "gatherer") {
            if (capacity.gatherers >= capacity.maxGatherers) return false;
            capacity.gatherers += 1;
        } else {
            if (capacity.defenders >= capacity.maxDefenders) return false;
            capacity.defenders += 1;
        }

        this.syncRoomCapacity(roomId);
        this.raiseRoomLevel(roomId);
        this.emitRoom(roomId);
        return true;
    }

    defeatGatherer(denizenId: EntityId): boolean {
        const gatherer = this.denizens.get(denizenId);
        if (
            !gatherer ||
            gatherer.role !== DenizenRole.GATHERER ||
            !gatherer.assignedRoomId
        ) {
            return false;
        }

        gatherer.status = DenizenStatus.RECOVERING;
        gatherer.health = 0;
        gatherer.recoveryRemainingMs = this.gathererRecoveryMs;
        this.emitRoom(gatherer.assignedRoomId);
        return true;
    }

    update(deltaMs: number): void {
        const changedRooms = new Set<EntityId>();
        for (const denizen of this.denizens.values()) {
            if (denizen.status !== DenizenStatus.RECOVERING) continue;

            denizen.recoveryRemainingMs = Math.max(
                0,
                denizen.recoveryRemainingMs - deltaMs,
            );
            if (denizen.recoveryRemainingMs > 0) continue;

            denizen.status = DenizenStatus.ACTIVE;
            denizen.health = denizen.maxHealth;
            if (denizen.assignedRoomId)
                changedRooms.add(denizen.assignedRoomId);
        }
        for (const roomId of changedRooms) this.emitRoom(roomId);
    }

    getRosterSnapshot(): DenizenRosterSnapshot {
        return {
            denizens: Array.from(this.denizens.values(), (denizen) => ({
                ...denizen,
            })),
            capacity: this.rosterCapacity,
        };
    }

    exportState(): RoomPopulationState {
        return {
            denizens: this.getRosterSnapshot().denizens,
            rosterCapacity: this.rosterCapacity,
            capacities: Object.fromEntries(
                Array.from(this.capacities, ([roomId, capacity]) => [
                    roomId,
                    { ...capacity },
                ]),
            ),
        };
    }

    expandRosterCapacity(amount: number): boolean {
        if (!Number.isInteger(amount) || amount <= 0) return false;

        this.rosterCapacity += amount;
        this.emitRoster();
        return true;
    }

    getSnapshot(roomId: EntityId): RoomPopulationSnapshot | null {
        const room = this.dungeon.rooms.find(
            (candidate) => candidate.id === roomId,
        );
        const capacity = this.capacities.get(roomId);
        if (!room || !capacity) return null;

        const assigned = room.denizenIds
            .map((id) => this.denizens.get(id))
            .filter((denizen): denizen is DenizenData => denizen !== undefined);
        const gatherers = assigned.filter(
            (denizen) => denizen.role === DenizenRole.GATHERER,
        );
        const activeGatherers = gatherers.filter(
            (denizen) => denizen.status === DenizenStatus.ACTIVE,
        );
        const defenders = assigned.filter(
            (denizen) => denizen.role === DenizenRole.DEFENDER,
        );
        const isResourceRoom = room.type === DungeonRoomType.PRODUCTION;

        return {
            roomId,
            capacity: { ...capacity },
            assignedGatherers: gatherers.length,
            activeGatherers: activeGatherers.length,
            recoveringGatherers: gatherers.length - activeGatherers.length,
            assignedDefenders: defenders.length,
            productionPerSecond: isResourceRoom
                ? this.baseProductionPerSecond +
                  activeGatherers.reduce(
                      (sum, gatherer) => sum + gatherer.gatheringPower,
                      0,
                  )
                : 0,
            denizens: assigned.map((denizen) => ({ ...denizen })),
        };
    }

    private restoreState(state: RoomPopulationState): void {
        this.rosterCapacity = Math.max(
            1,
            normalizePositiveInteger(state.rosterCapacity, this.rosterCapacity),
            state.denizens?.length ?? 0,
        );

        for (const room of this.dungeon.rooms) {
            const savedCapacity = cloneValidCapacity(
                state.capacities?.[room.id],
            );
            if (!savedCapacity) continue;

            this.capacities.set(room.id, savedCapacity);
            room.populationCapacity = { ...savedCapacity };
        }

        this.denizens.clear();
        for (const savedDenizen of state.denizens ?? []) {
            if (!savedDenizen?.id || this.denizens.has(savedDenizen.id))
                continue;
            this.denizens.set(savedDenizen.id, {
                ...savedDenizen,
                assignedRoomId: null,
            });
        }

        const assignments = (state.denizens ?? []).flatMap((denizen) =>
            denizen.assignedRoomId
                ? [{ denizenId: denizen.id, roomId: denizen.assignedRoomId }]
                : [],
        );
        this.rebuildRoomAssignments();

        for (const assignment of assignments) {
            const denizen = this.denizens.get(assignment.denizenId);
            if (
                !denizen ||
                !this.canAssignDenizen(denizen.id, assignment.roomId)
            ) {
                continue;
            }

            const room = this.dungeon.rooms.find(
                (candidate) => candidate.id === assignment.roomId,
            );
            if (!room) continue;

            denizen.assignedRoomId = room.id;
            room.denizenIds.push(denizen.id);
        }
    }

    private rebuildRoomAssignments(): void {
        for (const room of this.dungeon.rooms) room.denizenIds = [];

        for (const denizen of this.denizens.values()) {
            if (!denizen.assignedRoomId) continue;

            const room = this.dungeon.rooms.find(
                (candidate) => candidate.id === denizen.assignedRoomId,
            );
            if (!room) {
                denizen.assignedRoomId = null;
                continue;
            }

            room.denizenIds.push(denizen.id);
        }
    }

    private syncRoomCapacity(roomId: EntityId): void {
        const room = this.dungeon.rooms.find(
            (candidate) => candidate.id === roomId,
        );
        const capacity = this.capacities.get(roomId);
        if (room && capacity) room.populationCapacity = { ...capacity };
    }

    private raiseRoomLevel(roomId: EntityId): void {
        const room = this.dungeon.rooms.find(
            (candidate) => candidate.id === roomId,
        );
        if (room) room.level += 1;
    }

    private emitRoom(roomId: EntityId): void {
        const snapshot = this.getSnapshot(roomId);
        if (snapshot) EventBus.emit("room-population-changed", snapshot);
    }

    private emitRoster(): void {
        EventBus.emit("denizen-roster-changed", this.getRosterSnapshot());
    }
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isInteger(value) && value > 0
        ? value
        : fallback;
}

function cloneValidCapacity(value: unknown): RoomCapacity | null {
    if (!value || typeof value !== "object") return null;
    const capacity = value as Partial<RoomCapacity> & Record<string, unknown>;

    if (
        capacity.kind === "combat" &&
        isNonNegativeInteger(capacity.defenders) &&
        isNonNegativeInteger(capacity.maxDefenders) &&
        capacity.defenders <= capacity.maxDefenders
    ) {
        return {
            kind: "combat",
            defenders: capacity.defenders,
            maxDefenders: capacity.maxDefenders,
        };
    }

    if (
        capacity.kind === "resource" &&
        isNonNegativeInteger(capacity.gatherers) &&
        isNonNegativeInteger(capacity.maxGatherers) &&
        isNonNegativeInteger(capacity.defenders) &&
        isNonNegativeInteger(capacity.maxDefenders) &&
        capacity.gatherers <= capacity.maxGatherers &&
        capacity.defenders <= capacity.maxDefenders
    ) {
        return {
            kind: "resource",
            gatherers: capacity.gatherers,
            maxGatherers: capacity.maxGatherers,
            defenders: capacity.defenders,
            maxDefenders: capacity.maxDefenders,
        };
    }

    return null;
}

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
