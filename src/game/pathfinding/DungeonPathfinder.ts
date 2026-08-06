import type { EntityId } from "../components/DungeonData";
import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import { DungeonRoomType } from "../components/mapComponents/DungeonRoom";

export class DungeonPathfinder {
    private readonly routes: EntityId[][];
    private readonly adjacency: ReadonlyMap<EntityId, EntityId[]>;

    constructor(private readonly dungeon: DungeonMap) {
        this.adjacency = this.createAdjacency();
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

    chooseRouteWithWrongTurn(
        random: () => number = Math.random,
        wrongTurnChance = 0.65,
    ): EntityId[] {
        const route = this.chooseRoute(random);
        if (random() >= wrongTurnChance) return route;

        const possibleTurns = this.findWrongTurnBranches(route);
        if (possibleTurns.length === 0) return route;

        const turn = possibleTurns[Math.floor(random() * possibleTurns.length)];
        const returnPath = turn.branchPath.slice(0, -1).reverse();
        return [
            ...route.slice(0, turn.routeIndex + 1),
            ...turn.branchPath,
            ...returnPath,
            turn.junctionId,
            ...route.slice(turn.routeIndex + 1),
        ];
    }

    private findWrongTurnBranches(route: readonly EntityId[]): {
        junctionId: EntityId;
        routeIndex: number;
        branchPath: EntityId[];
    }[] {
        const routeSet = new Set(route);
        const branches: {
            junctionId: EntityId;
            routeIndex: number;
            branchPath: EntityId[];
        }[] = [];

        route.forEach((junctionId, routeIndex) => {
            for (const neighbor of this.adjacency.get(junctionId) ?? []) {
                if (routeSet.has(neighbor)) continue;
                const branchPath = this.findBranchPath(
                    junctionId,
                    neighbor,
                    routeSet,
                );
                if (branchPath) {
                    branches.push({ junctionId, routeIndex, branchPath });
                }
            }
        });

        return branches;
    }

    private findBranchPath(
        junctionId: EntityId,
        startId: EntityId,
        routeSet: ReadonlySet<EntityId>,
    ): EntityId[] | null {
        const queue: EntityId[] = [startId];
        const parents = new Map<EntityId, EntityId | null>([[startId, null]]);
        const distances = new Map<EntityId, number>([[startId, 1]]);
        let endpoint = startId;

        while (queue.length > 0) {
            const current = queue.shift()!;
            if ((distances.get(current) ?? 0) > (distances.get(endpoint) ?? 0)) {
                endpoint = current;
            }

            for (const neighbor of this.adjacency.get(current) ?? []) {
                if (neighbor === junctionId) continue;
                if (routeSet.has(neighbor)) return null;
                if (parents.has(neighbor)) continue;

                parents.set(neighbor, current);
                distances.set(neighbor, (distances.get(current) ?? 0) + 1);
                queue.push(neighbor);
            }
        }

        const path: EntityId[] = [];
        let current: EntityId | null = endpoint;
        while (current) {
            path.push(current);
            current = parents.get(current) ?? null;
        }
        return path.reverse();
    }

    private createAdjacency(): ReadonlyMap<EntityId, EntityId[]> {
        const adjacency = new Map<EntityId, EntityId[]>();
        for (const room of this.dungeon.rooms) adjacency.set(room.id, []);
        for (const connection of this.dungeon.connections) {
            adjacency.get(connection.fromRoomId)?.push(connection.toRoomId);
            adjacency.get(connection.toRoomId)?.push(connection.fromRoomId);
        }
        return adjacency;
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

        const routes: EntityId[][] = [];
        const visit = (roomId: EntityId, path: EntityId[], seen: Set<EntityId>): void => {
            if (roomId === core.id) {
                routes.push(path);
                return;
            }
            for (const neighbor of this.adjacency.get(roomId) ?? []) {
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
