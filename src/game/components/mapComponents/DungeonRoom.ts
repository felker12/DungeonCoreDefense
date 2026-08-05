// src/game/components/mapComponents/DungeonRoom.ts

import type { EntityId, Position, Size } from "../DungeonData";

export enum DungeonRoomType {
    ENTRANCE = "entrance",
    CORE = "core",
    GUARD = "guard",
    PRODUCTION = "production",
}

export interface DungeonRoom {
    id: EntityId;
    name: string;
    type: DungeonRoomType;
    position: Position;
    size: Size;
    level: number;
    capacity: number;
    denizenIds: EntityId[];
}
