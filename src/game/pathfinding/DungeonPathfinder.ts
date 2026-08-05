import type { EntityId } from "../components/DungeonData";
import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import { DungeonRoomType } from "../components/mapComponents/DungeonRoom";

export class DungeonPathfinder {
    private readonly routes: EntityId[][];

    constructor(private readonly dungeon: DungeonMap) {
        this.routes = this.findEntranceToCoreRoutes();
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
