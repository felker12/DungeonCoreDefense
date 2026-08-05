import {
    DungeonRoomType,
    type DungeonRoom,
    type RoomCapacity,
} from "../components/mapComponents/DungeonRoom";

export const DEFAULT_COMBAT_CAPACITY = {
    defenders: 3,
    maxDefenders: 10,
} as const;

export const DEFAULT_RESOURCE_CAPACITY = {
    gatherers: 2,
    maxGatherers: 3,
    defenders: 2,
    maxDefenders: 7,
} as const;

export function createInitialRoomCapacity(room: DungeonRoom): RoomCapacity | null {
    if (room.populationCapacity) return { ...room.populationCapacity };

    if (room.type === DungeonRoomType.GUARD) {
        return { kind: "combat", ...DEFAULT_COMBAT_CAPACITY };
    }

    if (room.type === DungeonRoomType.PRODUCTION) {
        return { kind: "resource", ...DEFAULT_RESOURCE_CAPACITY };
    }

    return null;
}

export function formatRoomCapacity(room: DungeonRoom): string {
    const capacity = createInitialRoomCapacity(room);
    if (!capacity) return "No denizen slots";

    return capacity.kind === "combat"
        ? `${capacity.defenders}/${capacity.maxDefenders} defender slots`
        : `${capacity.gatherers}/${capacity.maxGatherers} gatherers · ${capacity.defenders}/${capacity.maxDefenders} defenders`;
}
