// src/game/views/RoomView.ts

import { GameObjects, Scene } from "phaser";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import { DungeonRoomType, getRoomTypeLabel } from "../components/mapComponents/DungeonRoom";
import { EventBus } from "../EventBus";
import { formatRoomCapacity } from "../rooms/RoomCapacity";
import type { RoomPopulationSnapshot } from "../rooms/RoomPopulationManager";
import { DenizenRole, DenizenStatus } from "../components/entityComponents/entityData";

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
    private readonly denizenLayer: GameObjects.Container;
    private readonly handlePopulationChanged: (snapshot: RoomPopulationSnapshot) => void;

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

        const name = new GameObjects.Text(scene, 0, -28, getRoomTypeLabel(room.type), {
            color: "#ffffff",
            fontFamily: "Arial, sans-serif",
            fontSize: "18px",
            fontStyle: "bold",
            align: "center",
        }).setOrigin(0.5);

        const details = new GameObjects.Text(
            scene,
            0,
            4,
            `Level ${room.level}\n${formatRoomCapacity(room)}`,
            {
            color: "#d6cadd",
            fontFamily: "Arial, sans-serif",
            fontSize: "11px",
            align: "center",
        }).setOrigin(0.5);

        this.denizenLayer = new GameObjects.Container(scene, 0, 35);
        this.add([this.background, name, details, this.denizenLayer]);
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

        this.handlePopulationChanged = (snapshot): void => {
            if (snapshot.roomId === this.room.id) this.renderDenizens(snapshot);
        };
        EventBus.on("room-population-changed", this.handlePopulationChanged);
        this.once("destroy", () => {
            EventBus.off("room-population-changed", this.handlePopulationChanged);
        });
    }

    private renderDenizens(snapshot: RoomPopulationSnapshot): void {
        this.denizenLayer.removeAll(true);
        const markerSpacing = 22;
        const columns = Math.min(5, Math.max(1, snapshot.denizens.length));
        const rows = Math.ceil(snapshot.denizens.length / columns);

        snapshot.denizens.forEach((denizen, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = (column - (columns - 1) / 2) * markerSpacing;
            const y = (row - (rows - 1) / 2) * markerSpacing;
            const color = denizen.role === DenizenRole.GATHERER ? 0x67c587 : 0xd66b5d;
            const marker = new GameObjects.Arc(this.scene, x, y, 8, 0, 360, false, color)
                .setStrokeStyle(2, denizen.status === DenizenStatus.RECOVERING ? 0x7b7282 : 0xf5e9cf)
                .setAlpha(denizen.status === DenizenStatus.RECOVERING ? 0.45 : 1);
            this.denizenLayer.add(marker);
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
