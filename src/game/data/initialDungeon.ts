// src/game/data/initialDungeon.ts

import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import { DungeonRoomType } from "../components/mapComponents/DungeonRoom";

export const initialDungeon: DungeonMap = {
    id: "dungeon-001",
    name: "The First Delve",
    rooms: [
        {
            id: "room-entrance",
            name: "Dungeon Entrance",
            type: DungeonRoomType.ENTRANCE,
            position: { x: 160, y: 384 },
            size: { width: 150, height: 110 },
            level: 1,
            capacity: 0,
            denizenIds: [],
        },
        {
            id: "room-guard",
            name: "Guard Room",
            type: DungeonRoomType.GUARD,
            position: { x: 420, y: 384 },
            size: { width: 170, height: 130 },
            level: 1,
            capacity: 2,
            denizenIds: [],
        },
        {
            id: "room-core",
            name: "Dungeon Core",
            type: DungeonRoomType.CORE,
            position: { x: 720, y: 384 },
            size: { width: 180, height: 140 },
            level: 1,
            capacity: 1,
            denizenIds: [],
        },
        {
            id: "room-production",
            name: "Fungal Grotto",
            type: DungeonRoomType.PRODUCTION,
            position: { x: 420, y: 620 },
            size: { width: 180, height: 140 },
            level: 1,
            capacity: 1,
            denizenIds: [],
        },
    ],
    connections: [
        {
            id: "connection-entrance-guard",
            fromRoomId: "room-entrance",
            toRoomId: "room-guard",
        },
        {
            id: "connection-guard-core",
            fromRoomId: "room-guard",
            toRoomId: "room-core",
        },
        {
            id: "connection-guard-production",
            fromRoomId: "room-guard",
            toRoomId: "room-production",
        },
    ],
};
