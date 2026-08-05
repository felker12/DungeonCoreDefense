// src/game/views/CorridorView.ts

import { GameObjects, Scene } from "phaser";
import type { DungeonConnection } from "../components/mapComponents/DungeonConnection";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";

export class CorridorView extends GameObjects.Graphics {
    constructor(
        scene: Scene,
        connection: DungeonConnection,
        roomsById: ReadonlyMap<string, DungeonRoom>,
    ) {
        super(scene);

        const from = roomsById.get(connection.fromRoomId);
        const to = roomsById.get(connection.toRoomId);

        if (!from || !to) {
            throw new Error(`Invalid dungeon connection: ${connection.id}`);
        }

        const isHorizontal =
            from.position.y === to.position.y &&
            from.position.x !== to.position.x;
        const isVertical =
            from.position.x === to.position.x &&
            from.position.y !== to.position.y;

        if (!isHorizontal && !isVertical) {
            throw new Error(
                `Connection ${connection.id} is invalid. Connected rooms must occupy distinct positions and share exactly one coordinate.`,
            );
        }

        this.setDepth(0);

        this.lineStyle(46, 0x282330, 1);
        this.beginPath();
        this.moveTo(from.position.x, from.position.y);
        this.lineTo(to.position.x, to.position.y);
        this.strokePath();

        this.lineStyle(2, 0x62566f, 0.9);
        this.beginPath();
        this.moveTo(from.position.x, from.position.y);
        this.lineTo(to.position.x, to.position.y);
        this.strokePath();
    }
}
