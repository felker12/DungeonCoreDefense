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

export interface DungeonRoom {
    id: EntityId;
    name: string;
    type: DungeonRoomType;
    position: Position;
    size: Size;
    level: number;
    capacity: number;
    denizenIds: EntityId[];
    deadEnd?: boolean;
    terminal?: boolean;
    allowedConnectionSides?: CardinalDirection[];
}
