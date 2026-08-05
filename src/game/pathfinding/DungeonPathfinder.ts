import type { EntityId } from "../components/DungeonData";
import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import { DungeonRoomType } from "../components/mapComponents/DungeonRoom";

export class DungeonPathfinder {
    private readonly routes: EntityId[][];
    private readonly deadEndsByJunction: ReadonlyMap<EntityId, EntityId[]>;

    constructor(private readonly dungeon: DungeonMap) {
        this.routes = this.findEntranceToCoreRoutes();
        this.deadEndsByJunction = this.findDeadEndsByJunction();
        if (this.routes.length === 0) {
            throw new Error("Dungeon has no route from its Entrance to its Core.");
        }
    }

    getRoutes(): readonly EntityId[][] {
        return this.routes;
    }

    chooseRoute(random: () => number = Math.random): EntityId[] {
        return [...this.routes[Math.floor(random() * this.routes.length)]];
    }

    chooseRouteWithWrongTurn(
        random: () => number = Math.random,
        wrongTurnChance = 0.65,
    ): EntityId[] {
        const route = this.chooseRoute(random);
        if (random() >= wrongTurnChance) return route;

        const possibleTurns = route.flatMap((junctionId, routeIndex) =>
            (this.deadEndsByJunction.get(junctionId) ?? []).map((deadEndId) => ({
                deadEndId,
                junctionId,
                routeIndex,
            })),
        );
        if (possibleTurns.length === 0) return route;

        const turn = possibleTurns[Math.floor(random() * possibleTurns.length)];
        return [
            ...route.slice(0, turn.routeIndex + 1),
            turn.deadEndId,
            turn.junctionId,
            ...route.slice(turn.routeIndex + 1),
        ];
    }

    private findDeadEndsByJunction(): ReadonlyMap<EntityId, EntityId[]> {
        const result = new Map<EntityId, EntityId[]>();
        for (const room of this.dungeon.rooms) {
            if (!room.deadEnd) continue;
            const connection = this.dungeon.connections.find(
                (candidate) =>
                    candidate.fromRoomId === room.id || candidate.toRoomId === room.id,
            );
            if (!connection) continue;
            const junctionId = connection.fromRoomId === room.id
                ? connection.toRoomId
                : connection.fromRoomId;
            const deadEnds = result.get(junctionId) ?? [];
            deadEnds.push(room.id);
            result.set(junctionId, deadEnds);
        }
        return result;
    }

    private findEntranceToCoreRoutes(): EntityId[][] {
        const entrance = this.dungeon.rooms.find(
            (room) => room.type === DungeonRoomType.ENTRANCE,
        );
        const core = this.dungeon.rooms.find(
            (room) => room.type === DungeonRoomType.CORE,
        );
        if (!entrance || !core) {
            throw new Error("Dungeon requires exactly one Entrance and one Core.");
        }

        const adjacency = new Map<EntityId, EntityId[]>();
        for (const room of this.dungeon.rooms) adjacency.set(room.id, []);
        for (const connection of this.dungeon.connections) {
            adjacency.get(connection.fromRoomId)?.push(connection.toRoomId);
            adjacency.get(connection.toRoomId)?.push(connection.fromRoomId);
        }

        const routes: EntityId[][] = [];
        const visit = (roomId: EntityId, path: EntityId[], seen: Set<EntityId>): void => {
            if (roomId === core.id) {
                routes.push(path);
                return;
            }
            for (const neighbor of adjacency.get(roomId) ?? []) {
                if (seen.has(neighbor)) continue;
                const nextSeen = new Set(seen);
                nextSeen.add(neighbor);
                visit(neighbor, [...path, neighbor], nextSeen);
            }
        };

        visit(entrance.id, [entrance.id], new Set([entrance.id]));
        return routes;
    }
}
