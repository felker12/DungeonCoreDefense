import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import { DungeonRoomType } from "../components/mapComponents/DungeonRoom";
import { DungeonPathfinder } from "./DungeonPathfinder";
import { createInitialRoomCapacity } from "../rooms/RoomCapacity";
import {
    getConnectionDirection,
    getUnreachableRoomIds,
} from "../construction/DungeonConstruction";

export function validateDungeonMap(dungeon: DungeonMap): void {
    const rooms = new Map(dungeon.rooms.map((room) => [room.id, room]));
    if (rooms.size !== dungeon.rooms.length) throw new Error("Dungeon contains duplicate room IDs.");

    const connectionIds = new Set<string>();
    const connectionPairs = new Set<string>();

    for (const connection of dungeon.connections) {
        if (connectionIds.has(connection.id)) {
            throw new Error(`Dungeon contains duplicate connection ID ${connection.id}.`);
        }
        connectionIds.add(connection.id);

        const pair = [connection.fromRoomId, connection.toRoomId].sort().join("::");
        if (connectionPairs.has(pair)) {
            throw new Error(`Rooms ${pair} are connected more than once.`);
        }
        connectionPairs.add(pair);

        const from = rooms.get(connection.fromRoomId);
        const to = rooms.get(connection.toRoomId);
        if (!from || !to) throw new Error(`Connection ${connection.id} references a missing room.`);

        const fromSide = getConnectionDirection(from, to);
        const toSide = getConnectionDirection(to, from);
        if (!fromSide || !toSide) {
            throw new Error(
                `Connection between ${from.id} and ${to.id} is not cardinally aligned.`,
            );
        }
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

    const unreachableRoomIds = getUnreachableRoomIds(dungeon);
    if (unreachableRoomIds.length > 0) {
        throw new Error(
            `Every room must remain reachable from the Entrance. Inaccessible: ${unreachableRoomIds.join(", ")}.`,
        );
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
