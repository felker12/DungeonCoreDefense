// src/game/components/mapComponents/DungeonConnection.ts

import type { EntityId } from "../DungeonData";

export interface DungeonConnection {
    id: EntityId;
    fromRoomId: EntityId;
    toRoomId: EntityId;
}
