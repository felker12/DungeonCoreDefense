import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import { DungeonRoomType, getRoomTypeLabel } from "../components/mapComponents/DungeonRoom";
import initialDungeonData from "./maps/initialDungeon.json";

const ROOM_SIZES = {
    [DungeonRoomType.ENTRANCE]: { width: 180, height: 140 },
    [DungeonRoomType.CORE]: { width: 210, height: 170 },
    [DungeonRoomType.GUARD]: { width: 200, height: 160 },
    [DungeonRoomType.PRODUCTION]: { width: 210, height: 170 },
} as const;

const dungeonData = initialDungeonData as DungeonMap;

export const initialDungeon: DungeonMap = {
    ...dungeonData,
    rooms: dungeonData.rooms.map((room) => ({
        ...room,
        name: getRoomTypeLabel(room.type),
        size: { ...ROOM_SIZES[room.type] },
    })),
};
