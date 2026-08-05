// src/game/views/RoomView.ts

import { GameObjects, Scene } from "phaser";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import { DungeonRoomType } from "../components/mapComponents/DungeonRoom";
import { EventBus } from "../EventBus";

const ROOM_COLORS: Record<DungeonRoomType, number> = {
    [DungeonRoomType.ENTRANCE]: 0x4b5563,
    [DungeonRoomType.CORE]: 0x7c3aed,
    [DungeonRoomType.GUARD]: 0x991b1b,
    [DungeonRoomType.PRODUCTION]: 0x3f6212,
};

export class RoomView extends GameObjects.Container {
    private readonly room: DungeonRoom;
    private readonly background: GameObjects.Rectangle;
    private selected = false;
    private hovered = false;

    constructor(scene: Scene, room: DungeonRoom) {
        super(scene, room.position.x, room.position.y);
        this.room = room;

        this.background = new GameObjects.Rectangle(
            scene,
            0,
            0,
            room.size.width,
            room.size.height,
            ROOM_COLORS[room.type],
        );
        this.background.setStrokeStyle(3, 0xa99ab8);

        const name = new GameObjects.Text(scene, 0, -10, room.name, {
            color: "#ffffff",
            fontFamily: "Arial, sans-serif",
            fontSize: "18px",
            fontStyle: "bold",
            align: "center",
        }).setOrigin(0.5);

        const details = new GameObjects.Text(scene, 0, 18, `Level ${room.level}`, {
            color: "#d6cadd",
            fontFamily: "Arial, sans-serif",
            fontSize: "13px",
        }).setOrigin(0.5);

        this.add([this.background, name, details]);
        this.setSize(room.size.width, room.size.height);
        this.setDepth(1);
        this.setInteractive({ useHandCursor: true });

        this.on("pointerover", () => {
            this.hovered = true;
            this.refreshBorder();
        });
        this.on("pointerout", () => {
            this.hovered = false;
            this.refreshBorder();
        });
        this.on("pointerdown", () => {
            this.setSelected(true);
            EventBus.emit("room-selected", this.room);
        });
    }

    setSelected(selected: boolean): void {
        this.selected = selected;
        this.refreshBorder();
    }

    private refreshBorder(): void {
        if (this.selected) {
            this.background.setStrokeStyle(5, 0xffd166);
            return;
        }

        this.background.setStrokeStyle(this.hovered ? 4 : 3, this.hovered ? 0xf0d98c : 0xa99ab8);
    }
}
