// src/game/components/mapComponents/DungeonRoom.ts

import type { EntityId, Position, Size } from "../DungeonData";

export const DungeonRoomType = {
    ENTRANCE: "entrance",
    CORE: "core",
    GUARD: "guard",
    PRODUCTION: "production",
} as const;

export type DungeonRoomType =
    (typeof DungeonRoomType)[keyof typeof DungeonRoomType];

export type CardinalDirection = "north" | "east" | "south" | "west";

export interface CombatRoomCapacity {
    kind: "combat";
    defenders: number;
    maxDefenders: number;
}

export interface ResourceRoomCapacity {
    kind: "resource";
    gatherers: number;
    maxGatherers: number;
    defenders: number;
    maxDefenders: number;
}

export type RoomCapacity = CombatRoomCapacity | ResourceRoomCapacity;

export interface DungeonRoom {
    id: EntityId;
    name: string;
    type: DungeonRoomType;
    position: Position;
    size: Size;
    level: number;
    /** Legacy map field. New population rules use populationCapacity. */
    capacity?: number;
    populationCapacity?: RoomCapacity;
    denizenIds: EntityId[];
    deadEnd?: boolean;
    terminal?: boolean;
    allowedConnectionSides?: CardinalDirection[];
}
