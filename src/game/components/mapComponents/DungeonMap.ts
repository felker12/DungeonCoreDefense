// src/game/components/mapComponents/DungeonMap.ts

import type { DungeonRoom } from "./DungeonRoom";
import type { DungeonConnection } from "./DungeonConnection";

export interface DungeonMap {
    id: string;
    name: string;
    rooms: DungeonRoom[];
    connections: DungeonConnection[];
}
