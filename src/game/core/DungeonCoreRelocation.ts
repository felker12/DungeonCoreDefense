import type { EntityId } from "../components/DungeonData";
import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import {
    DungeonRoomType,
    getRoomTypeLabel,
    type DungeonRoom,
    type RoomCapacity,
} from "../components/mapComponents/DungeonRoom";
import { cloneDungeonMap } from "../construction/DungeonConstruction";

export interface CoreRelocationValidation {
    valid: boolean;
    reason: string | null;
}

export interface CoreRelocationResult {
    previousCoreRoomId: EntityId;
    coreRoomId: EntityId;
}

interface RoomRoleState {
    type: DungeonRoom["type"];
    name: string;
    level: number;
    capacity?: number;
    populationCapacity?: RoomCapacity;
    denizenIds: EntityId[];
    deadEnd?: boolean;
    terminal?: boolean;
}

export function validateCoreRelocationTarget(
    dungeon: DungeonMap,
    targetRoomId: EntityId,
): CoreRelocationValidation {
    const cores = dungeon.rooms.filter(
        (room) => room.type === DungeonRoomType.CORE,
    );
    if (cores.length !== 1) {
        return invalid("The dungeon must have exactly one Core before it can move.");
    }

    const target = dungeon.rooms.find((room) => room.id === targetRoomId);
    if (!target) return invalid("That room no longer exists.");

    if (target.type === DungeonRoomType.ENTRANCE) {
        return invalid("The Entrance is fixed and cannot exchange places with the Core.");
    }
    if (target.type === DungeonRoomType.CORE) {
        return invalid("This room is already the Dungeon Core.");
    }
    if (
        target.type !== DungeonRoomType.GUARD &&
        target.type !== DungeonRoomType.PRODUCTION
    ) {
        return invalid("Only a functional room can exchange places with the Core.");
    }

    const targetConnectionCount = dungeon.connections.filter(
        (connection) =>
            connection.fromRoomId === target.id ||
            connection.toRoomId === target.id,
    ).length;
    if (targetConnectionCount > 3) {
        return invalid("The Core supports at most three room connections.");
    }

    return { valid: true, reason: null };
}

export function createCoreRelocationCandidate(
    dungeon: DungeonMap,
    targetRoomId: EntityId,
): DungeonMap | null {
    const validation = validateCoreRelocationTarget(dungeon, targetRoomId);
    if (!validation.valid) return null;

    const candidate = cloneDungeonMap(dungeon);
    return swapCoreRoomRoles(candidate, targetRoomId) ? candidate : null;
}

/**
 * Exchanges room gameplay roles while preserving the physical room nodes and
 * their connections. This keeps authored geometry valid even when the Core and
 * target room have different dimensions.
 */
export function swapCoreRoomRoles(
    dungeon: DungeonMap,
    targetRoomId: EntityId,
): CoreRelocationResult | null {
    const core = dungeon.rooms.find(
        (room) => room.type === DungeonRoomType.CORE,
    );
    const target = dungeon.rooms.find((room) => room.id === targetRoomId);
    if (!core || !target || core.id === target.id) return null;

    const coreState = getRoomRoleState(core);
    const targetState = getRoomRoleState(target);

    applyRoomRoleState(core, targetState);
    applyRoomRoleState(target, coreState);
    target.name = getRoomTypeLabel(DungeonRoomType.CORE);

    return {
        previousCoreRoomId: core.id,
        coreRoomId: target.id,
    };
}

function getRoomRoleState(room: DungeonRoom): RoomRoleState {
    return {
        type: room.type,
        name: room.name,
        level: room.level,
        capacity: room.capacity,
        populationCapacity: room.populationCapacity
            ? { ...room.populationCapacity }
            : undefined,
        denizenIds: [...room.denizenIds],
        deadEnd: room.deadEnd,
        terminal: room.terminal,
    };
}

function applyRoomRoleState(room: DungeonRoom, state: RoomRoleState): void {
    room.type = state.type;
    room.name = state.name;
    room.level = state.level;
    room.capacity = state.capacity;
    room.populationCapacity = state.populationCapacity
        ? { ...state.populationCapacity }
        : undefined;
    room.denizenIds = [...state.denizenIds];
    room.deadEnd = state.deadEnd;
    room.terminal = state.terminal;
}

function invalid(reason: string): CoreRelocationValidation {
    return { valid: false, reason };
}
