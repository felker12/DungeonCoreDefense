import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import type { CardinalDirection, DungeonRoom } from "../components/mapComponents/DungeonRoom";
import { DungeonRoomType } from "../components/mapComponents/DungeonRoom";
import { DungeonPathfinder } from "./DungeonPathfinder";
import { createInitialRoomCapacity } from "../rooms/RoomCapacity";

function connectionSide(from: DungeonRoom, to: DungeonRoom): CardinalDirection {
    if (from.position.x === to.position.x && from.position.y !== to.position.y) {
        return to.position.y < from.position.y ? "north" : "south";
    }
    if (from.position.y === to.position.y && from.position.x !== to.position.x) {
        return to.position.x < from.position.x ? "west" : "east";
    }
    throw new Error(`Connection between ${from.id} and ${to.id} is not cardinal.`);
}

export function validateDungeonMap(dungeon: DungeonMap): void {
    const rooms = new Map(dungeon.rooms.map((room) => [room.id, room]));
    if (rooms.size !== dungeon.rooms.length) throw new Error("Dungeon contains duplicate room IDs.");

    for (const connection of dungeon.connections) {
        const from = rooms.get(connection.fromRoomId);
        const to = rooms.get(connection.toRoomId);
        if (!from || !to) throw new Error(`Connection ${connection.id} references a missing room.`);

        const fromSide = connectionSide(from, to);
        const toSide = connectionSide(to, from);
        if (from.allowedConnectionSides && !from.allowedConnectionSides.includes(fromSide)) {
            throw new Error(`${from.name} does not permit a ${fromSide} connection.`);
        }
        if (to.allowedConnectionSides && !to.allowedConnectionSides.includes(toSide)) {
            throw new Error(`${to.name} does not permit a ${toSide} connection.`);
        }
    }

    const cores = dungeon.rooms.filter((room) => room.type === DungeonRoomType.CORE);
    if (cores.length !== 1 || !cores[0].terminal) {
        throw new Error("Dungeon requires exactly one terminal Core.");
    }
    const coreConnections = dungeon.connections.filter(
        (connection) => connection.fromRoomId === cores[0].id || connection.toRoomId === cores[0].id,
    );
    if (coreConnections.length > 3) throw new Error("The terminal Core supports at most three connections.");

    for (const room of dungeon.rooms.filter((candidate) => candidate.deadEnd)) {
        if (room.type === DungeonRoomType.ENTRANCE || room.type === DungeonRoomType.CORE) {
            throw new Error(`${room.name} cannot be marked as a dead end.`);
        }
        const connectionCount = dungeon.connections.filter(
            (connection) =>
                connection.fromRoomId === room.id || connection.toRoomId === room.id,
        ).length;
        if (connectionCount !== 1) {
            throw new Error(`${room.name} is marked as a dead end but has ${connectionCount} connections.`);
        }
    }

    for (const room of dungeon.rooms) {
        const capacity = createInitialRoomCapacity(room);
        if (!capacity) continue;
        if (capacity.kind === "combat") {
            if (capacity.defenders < 0 || capacity.defenders > capacity.maxDefenders) {
                throw new Error(`${room.name} has invalid defender capacity.`);
            }
        } else if (
            capacity.gatherers < 0 ||
            capacity.gatherers > capacity.maxGatherers ||
            capacity.defenders < 0 ||
            capacity.defenders > capacity.maxDefenders
        ) {
            throw new Error(`${room.name} has invalid resource-room capacity.`);
        }
    }

    new DungeonPathfinder(dungeon);
}
