import type { EntityId, Position, Size } from "../components/DungeonData";
import type { DungeonConnection } from "../components/mapComponents/DungeonConnection";
import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import {
    DungeonRoomType,
    type CardinalDirection,
    type DungeonRoom,
} from "../components/mapComponents/DungeonRoom";
import type { ResourceCost } from "../resources/ResourceManager";

export type BuildableRoomType =
    | typeof DungeonRoomType.GUARD
    | typeof DungeonRoomType.PRODUCTION;

export interface RoomConstructionDefinition {
    type: BuildableRoomType;
    label: string;
    description: string;
    size: Size;
    costs: readonly ResourceCost[];
}

export interface BuildRoomRequest {
    sourceRoomId: EntityId;
    roomType: BuildableRoomType;
    direction: CardinalDirection;
}

export interface ConstructionValidation {
    valid: boolean;
    reason: string | null;
}

export const CARDINAL_DIRECTIONS: readonly CardinalDirection[] = [
    "north",
    "east",
    "south",
    "west",
];

export const ROOM_CONSTRUCTION_CATALOG: readonly RoomConstructionDefinition[] =
    [
        {
            type: DungeonRoomType.GUARD,
            label: "Guard Room",
            description:
                "A defensive chamber with expandable defender capacity.",
            size: { width: 200, height: 160 },
            costs: [
                { resource: "stone", amount: 60 },
                { resource: "supplies", amount: 15 },
            ],
        },
        {
            type: DungeonRoomType.PRODUCTION,
            label: "Resource Room",
            description:
                "A working chamber for producers and a smaller guard detail.",
            size: { width: 210, height: 170 },
            costs: [
                { resource: "stone", amount: 45 },
                { resource: "essence", amount: 10 },
            ],
        },
    ];

const CORRIDOR_GAP = 90;
const MINIMUM_ROOM_GAP = 30;
const MAXIMUM_ADJACENT_EDGE_GAP = 420;

export function cloneDungeonMap(dungeon: DungeonMap): DungeonMap {
    return {
        ...dungeon,
        rooms: dungeon.rooms.map((room) => ({
            ...room,
            position: { ...room.position },
            size: { ...room.size },
            denizenIds: [...room.denizenIds],
            populationCapacity: room.populationCapacity
                ? { ...room.populationCapacity }
                : undefined,
            allowedConnectionSides: room.allowedConnectionSides
                ? [...room.allowedConnectionSides]
                : undefined,
        })),
        connections: dungeon.connections.map((connection) => ({
            ...connection,
        })),
    };
}

export function getFunctionalRoomCount(dungeon: DungeonMap): number {
    return dungeon.rooms.filter(
        (room) =>
            room.type !== DungeonRoomType.ENTRANCE &&
            room.type !== DungeonRoomType.CORE,
    ).length;
}

export function getConstructionDefinition(
    roomType: BuildableRoomType,
): RoomConstructionDefinition {
    const definition = ROOM_CONSTRUCTION_CATALOG.find(
        (candidate) => candidate.type === roomType,
    );
    if (!definition) throw new Error(`Unsupported room type: ${roomType}`);
    return definition;
}

export function createRoomCandidate(
    dungeon: DungeonMap,
    request: BuildRoomRequest,
    roomId: EntityId,
): DungeonRoom | null {
    const source = dungeon.rooms.find(
        (candidate) => candidate.id === request.sourceRoomId,
    );
    if (!source) return null;

    const definition = getConstructionDefinition(request.roomType);
    const position = getConnectedRoomPosition(
        source,
        definition.size,
        request.direction,
    );
    const sameTypeCount = dungeon.rooms.filter(
        (room) => room.type === request.roomType,
    ).length;

    return {
        id: roomId,
        name: `${definition.label} ${sameTypeCount + 1}`,
        type: request.roomType,
        position,
        size: { ...definition.size },
        level: 1,
        denizenIds: [],
        allowedConnectionSides: [...CARDINAL_DIRECTIONS],
    };
}

export function createRoomConnection(
    sourceRoomId: EntityId,
    targetRoomId: EntityId,
    connectionId: EntityId,
): DungeonConnection {
    return {
        id: connectionId,
        fromRoomId: sourceRoomId,
        toRoomId: targetRoomId,
    };
}

export function validateRoomConstruction(
    dungeon: DungeonMap,
    _dungeonLevel: number,
    request: BuildRoomRequest,
    candidate: DungeonRoom,
): ConstructionValidation {
    const source = dungeon.rooms.find(
        (room) => room.id === request.sourceRoomId,
    );
    if (!source) return invalid("The selected room no longer exists.");


    if (
        source.allowedConnectionSides &&
        !source.allowedConnectionSides.includes(request.direction)
    ) {
        return invalid(
            `${source.name} cannot connect to the ${request.direction}.`,
        );
    }

    if (hasConnectionOnSide(dungeon, source, request.direction)) {
        return invalid(
            `The ${request.direction} side already has a connection.`,
        );
    }

    if (
        dungeon.rooms.some((room) =>
            rectanglesOverlapWithGap(room, candidate, MINIMUM_ROOM_GAP),
        )
    ) {
        return invalid("A room already occupies that construction area.");
    }

    return { valid: true, reason: null };
}

export function getConnectionDirection(
    from: DungeonRoom,
    to: DungeonRoom,
): CardinalDirection | null {
    if (
        from.position.x === to.position.x &&
        from.position.y !== to.position.y
    ) {
        return to.position.y < from.position.y ? "north" : "south";
    }
    if (
        from.position.y === to.position.y &&
        from.position.x !== to.position.x
    ) {
        return to.position.x < from.position.x ? "west" : "east";
    }
    return null;
}

export function findConnectionBetween(
    dungeon: DungeonMap,
    firstRoomId: EntityId,
    secondRoomId: EntityId,
): DungeonConnection | null {
    return (
        dungeon.connections.find(
            (connection) =>
                (connection.fromRoomId === firstRoomId &&
                    connection.toRoomId === secondRoomId) ||
                (connection.fromRoomId === secondRoomId &&
                    connection.toRoomId === firstRoomId),
        ) ?? null
    );
}

export function getAdjacentUnconnectedRooms(
    dungeon: DungeonMap,
    roomId: EntityId,
): DungeonRoom[] {
    const room = dungeon.rooms.find((candidate) => candidate.id === roomId);
    if (!room) return [];

    return dungeon.rooms.filter(
        (candidate) =>
            candidate.id !== roomId &&
            !findConnectionBetween(dungeon, roomId, candidate.id) &&
            areRoomsConnectable(dungeon, room, candidate),
    );
}

export function areRoomsConnectable(
    dungeon: DungeonMap,
    first: DungeonRoom,
    second: DungeonRoom,
): boolean {
    const direction = getConnectionDirection(first, second);
    const reverseDirection = getConnectionDirection(second, first);
    if (!direction || !reverseDirection) return false;

    if (
        (first.allowedConnectionSides &&
            !first.allowedConnectionSides.includes(direction)) ||
        (second.allowedConnectionSides &&
            !second.allowedConnectionSides.includes(reverseDirection))
    ) {
        return false;
    }

    const edgeGap = getEdgeGap(first, second, direction);
    if (edgeGap < 0 || edgeGap > MAXIMUM_ADJACENT_EDGE_GAP) return false;

    return !dungeon.rooms.some(
        (room) =>
            room.id !== first.id &&
            room.id !== second.id &&
            roomIntersectsCorridor(room, first.position, second.position),
    );
}

export function getUnreachableRoomIds(dungeon: DungeonMap): EntityId[] {
    const entrance = dungeon.rooms.find(
        (room) => room.type === DungeonRoomType.ENTRANCE,
    );
    if (!entrance) return dungeon.rooms.map((room) => room.id);

    const adjacency = new Map<EntityId, EntityId[]>();
    for (const room of dungeon.rooms) adjacency.set(room.id, []);
    for (const connection of dungeon.connections) {
        adjacency.get(connection.fromRoomId)?.push(connection.toRoomId);
        adjacency.get(connection.toRoomId)?.push(connection.fromRoomId);
    }

    const reachable = new Set<EntityId>([entrance.id]);
    const queue: EntityId[] = [entrance.id];
    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const neighbor of adjacency.get(current) ?? []) {
            if (reachable.has(neighbor)) continue;
            reachable.add(neighbor);
            queue.push(neighbor);
        }
    }

    return dungeon.rooms
        .filter((room) => !reachable.has(room.id))
        .map((room) => room.id);
}

export function canRemoveConnection(
    dungeon: DungeonMap,
    connectionId: EntityId,
): ConstructionValidation {
    if (
        !dungeon.connections.some(
            (connection) => connection.id === connectionId,
        )
    ) {
        return invalid("That connection no longer exists.");
    }

    const candidate: DungeonMap = {
        ...dungeon,
        connections: dungeon.connections.filter(
            (connection) => connection.id !== connectionId,
        ),
    };
    const unreachable = getUnreachableRoomIds(candidate);
    if (unreachable.length > 0) {
        return invalid(
            "Removing this connection would make part of the dungeon inaccessible to raid parties.",
        );
    }

    return { valid: true, reason: null };
}

function getConnectedRoomPosition(
    source: DungeonRoom,
    targetSize: Size,
    direction: CardinalDirection,
): Position {
    const horizontalDistance =
        source.size.width / 2 + targetSize.width / 2 + CORRIDOR_GAP;
    const verticalDistance =
        source.size.height / 2 + targetSize.height / 2 + CORRIDOR_GAP;

    switch (direction) {
        case "north":
            return {
                x: source.position.x,
                y: source.position.y - verticalDistance,
            };
        case "east":
            return {
                x: source.position.x + horizontalDistance,
                y: source.position.y,
            };
        case "south":
            return {
                x: source.position.x,
                y: source.position.y + verticalDistance,
            };
        case "west":
            return {
                x: source.position.x - horizontalDistance,
                y: source.position.y,
            };
    }
}

function hasConnectionOnSide(
    dungeon: DungeonMap,
    room: DungeonRoom,
    direction: CardinalDirection,
): boolean {
    return dungeon.connections.some((connection) => {
        if (
            connection.fromRoomId !== room.id &&
            connection.toRoomId !== room.id
        ) {
            return false;
        }
        const otherId =
            connection.fromRoomId === room.id
                ? connection.toRoomId
                : connection.fromRoomId;
        const other = dungeon.rooms.find(
            (candidate) => candidate.id === otherId,
        );
        return other
            ? getConnectionDirection(room, other) === direction
            : false;
    });
}

function rectanglesOverlapWithGap(
    first: DungeonRoom,
    second: DungeonRoom,
    gap: number,
): boolean {
    return !(
        first.position.x + first.size.width / 2 + gap <=
            second.position.x - second.size.width / 2 ||
        first.position.x - first.size.width / 2 - gap >=
            second.position.x + second.size.width / 2 ||
        first.position.y + first.size.height / 2 + gap <=
            second.position.y - second.size.height / 2 ||
        first.position.y - first.size.height / 2 - gap >=
            second.position.y + second.size.height / 2
    );
}

function getEdgeGap(
    first: DungeonRoom,
    second: DungeonRoom,
    direction: CardinalDirection,
): number {
    if (direction === "east" || direction === "west") {
        return (
            Math.abs(first.position.x - second.position.x) -
            first.size.width / 2 -
            second.size.width / 2
        );
    }
    return (
        Math.abs(first.position.y - second.position.y) -
        first.size.height / 2 -
        second.size.height / 2
    );
}

function roomIntersectsCorridor(
    room: DungeonRoom,
    start: Position,
    end: Position,
): boolean {
    const corridorHalfWidth = 24;
    const left = Math.min(start.x, end.x) - corridorHalfWidth;
    const right = Math.max(start.x, end.x) + corridorHalfWidth;
    const top = Math.min(start.y, end.y) - corridorHalfWidth;
    const bottom = Math.max(start.y, end.y) + corridorHalfWidth;

    const roomLeft = room.position.x - room.size.width / 2;
    const roomRight = room.position.x + room.size.width / 2;
    const roomTop = room.position.y - room.size.height / 2;
    const roomBottom = room.position.y + room.size.height / 2;

    return !(
        roomRight <= left ||
        roomLeft >= right ||
        roomBottom <= top ||
        roomTop >= bottom
    );
}

function invalid(reason: string): ConstructionValidation {
    return { valid: false, reason };
}

