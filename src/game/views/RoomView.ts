// src/game/views/RoomView.ts

import { GameObjects, Scene } from "phaser";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import {
    DungeonRoomType,
    getRoomTypeLabel,
} from "../components/mapComponents/DungeonRoom";
import { EventBus } from "../EventBus";
import { formatRoomCapacity } from "../rooms/RoomCapacity";
import type { RoomPopulationSnapshot } from "../rooms/RoomPopulationManager";
import {
    DenizenRole,
    DenizenStatus,
} from "../components/entityComponents/entityData";

interface RoomVisualStyle {
    accent: number;
    floor: number;
    icon: string;
}

const ROOM_VISUALS: Record<DungeonRoomType, RoomVisualStyle> = {
    [DungeonRoomType.ENTRANCE]: {
        accent: 0x9aa6b7,
        floor: 0x242a33,
        icon: "⇥",
    },
    [DungeonRoomType.CORE]: {
        accent: 0xa56dff,
        floor: 0x271a3d,
        icon: "◆",
    },
    [DungeonRoomType.GUARD]: {
        accent: 0xd05252,
        floor: 0x35191c,
        icon: "⚔",
    },
    [DungeonRoomType.PRODUCTION]: {
        accent: 0x83b84b,
        floor: 0x203018,
        icon: "●",
    },
};

const SELECTED_COLOR = 0xffd166;
const HOVER_COLOR = 0xf0d98c;

export class RoomView extends GameObjects.Container {
    private readonly room: DungeonRoom;
    private readonly style: RoomVisualStyle;
    private readonly glow: GameObjects.Graphics;
    private readonly surface: GameObjects.Graphics;
    private readonly denizenLayer: GameObjects.Container;
    private selected = false;
    private hovered = false;
    private readonly handlePopulationChanged: (
        snapshot: RoomPopulationSnapshot,
    ) => void;

    constructor(scene: Scene, room: DungeonRoom) {
        super(scene, room.position.x, room.position.y);
        this.room = room;
        this.style = ROOM_VISUALS[room.type];

        const shadow = new GameObjects.Graphics(scene);
        shadow.fillStyle(0x050407, 0.72);
        shadow.fillRoundedRect(
            -room.size.width / 2 + 7,
            -room.size.height / 2 + 9,
            room.size.width,
            room.size.height,
            14,
        );

        this.glow = new GameObjects.Graphics(scene);
        this.surface = new GameObjects.Graphics(scene);

        const iconBadge = new GameObjects.Arc(
            scene,
            0,
            -48,
            15,
            0,
            360,
            false,
            0x120f16,
            0.98,
        ).setStrokeStyle(2, this.style.accent, 0.9);

        const icon = new GameObjects.Text(scene, 0, -48, this.style.icon, {
            color: toCssColor(this.style.accent),
            fontFamily: "Arial, sans-serif",
            fontSize: room.type === DungeonRoomType.GUARD ? "14px" : "15px",
            fontStyle: "bold",
        })
            .setOrigin(0.5)
            .setShadow(0, 2, "#000000", 3, false, true);

        const name = new GameObjects.Text(
            scene,
            0,
            -20,
            getRoomTypeLabel(room.type),
            {
                color: "#fffaf2",
                fontFamily: "Arial, sans-serif",
                fontSize: "17px",
                fontStyle: "bold",
                align: "center",
            },
        )
            .setOrigin(0.5)
            .setShadow(0, 2, "#000000", 4, false, true);

        const details = new GameObjects.Text(
            scene,
            0,
            8,
            `Level ${room.level}\n${formatRoomCapacity(room)}`,
            {
                color: "#cfc5d5",
                fontFamily: "Arial, sans-serif",
                fontSize: "10px",
                align: "center",
                lineSpacing: 2,
                wordWrap: {
                    width: Math.max(120, room.size.width - 24),
                    useAdvancedWrap: true,
                },
            },
        ).setOrigin(0.5);

        this.denizenLayer = new GameObjects.Container(scene, 0, 45);

        this.add([
            shadow,
            this.glow,
            this.surface,
            iconBadge,
            icon,
            name,
            details,
            this.denizenLayer,
        ]);

        if (room.type === DungeonRoomType.CORE) {
            const coreAura = new GameObjects.Arc(
                scene,
                0,
                0,
                Math.max(room.size.width, room.size.height) * 0.52,
                0,
                360,
                false,
                this.style.accent,
                0.09,
            );
            this.addAt(coreAura, 0);

            const pulse = scene.tweens.add({
                targets: coreAura,
                alpha: { from: 0.08, to: 0.22 },
                scaleX: { from: 0.96, to: 1.06 },
                scaleY: { from: 0.96, to: 1.06 },
                duration: 1_350,
                ease: "Sine.InOut",
                yoyo: true,
                repeat: -1,
            });

            this.once("destroy", () => pulse.remove());
        }

        this.refreshVisualState();
        this.setSize(room.size.width, room.size.height);
        this.setDepth(1);
        this.setInteractive({ useHandCursor: true });

        this.on("pointerover", () => {
            this.hovered = true;
            this.refreshVisualState();
        });
        this.on("pointerout", () => {
            this.hovered = false;
            this.refreshVisualState();
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
            EventBus.off(
                "room-population-changed",
                this.handlePopulationChanged,
            );
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
            const color =
                denizen.role === DenizenRole.GATHERER ? 0x67c587 : 0xd66b5d;
            const recovering = denizen.status === DenizenStatus.RECOVERING;

            const shadow = new GameObjects.Arc(
                this.scene,
                x + 2,
                y + 3,
                9,
                0,
                360,
                false,
                0x050407,
                0.65,
            );
            const marker = new GameObjects.Arc(
                this.scene,
                x,
                y,
                8,
                0,
                360,
                false,
                color,
                recovering ? 0.4 : 1,
            ).setStrokeStyle(2, recovering ? 0x7b7282 : 0xf5e9cf, 1);
            const center = new GameObjects.Arc(
                this.scene,
                x,
                y,
                2.5,
                0,
                360,
                false,
                0x17131b,
                recovering ? 0.4 : 0.85,
            );

            this.denizenLayer.add([shadow, marker, center]);
        });
    }

    setSelected(selected: boolean): void {
        this.selected = selected;
        this.refreshVisualState();
    }

    private refreshVisualState(): void {
        const width = this.room.size.width;
        const height = this.room.size.height;
        const left = -width / 2;
        const top = -height / 2;
        const borderColor = this.selected
            ? SELECTED_COLOR
            : this.hovered
              ? HOVER_COLOR
              : this.style.accent;
        const borderSize = this.selected ? 6 : this.hovered ? 5 : 4;

        this.glow.clear();
        if (this.selected || this.hovered) {
            this.glow.fillStyle(
                this.selected ? SELECTED_COLOR : this.style.accent,
                this.selected ? 0.17 : 0.1,
            );
            this.glow.fillRoundedRect(
                left - 9,
                top - 9,
                width + 18,
                height + 18,
                18,
            );
        }

        this.surface.clear();

        // Thick outer frame and recessed interior floor.
        this.surface.fillStyle(0x0c0910, 1);
        this.surface.fillRoundedRect(left, top, width, height, 13);
        this.surface.fillStyle(borderColor, this.selected ? 1 : 0.78);
        this.surface.fillRoundedRect(
            left + 2,
            top + 2,
            width - 4,
            height - 4,
            11,
        );
        this.surface.fillStyle(this.style.floor, 1);
        this.surface.fillRoundedRect(
            left + borderSize,
            top + borderSize,
            width - borderSize * 2,
            height - borderSize * 2,
            8,
        );

        // Subtle inner bevel and top room-type accent.
        this.surface.lineStyle(1, 0xffffff, 0.1);
        this.surface.strokeRoundedRect(
            left + borderSize + 2,
            top + borderSize + 2,
            width - borderSize * 2 - 4,
            height - borderSize * 2 - 4,
            7,
        );
        this.surface.fillStyle(this.style.accent, 0.95);
        this.surface.fillRoundedRect(left + 18, top + 9, width - 36, 4, 2);

        // Small metal-like corner studs keep the rooms from feeling like flat cards.
        this.surface.fillStyle(this.style.accent, 0.5);
        this.surface.fillCircle(left + 13, top + 13, 2.5);
        this.surface.fillCircle(left + width - 13, top + 13, 2.5);
        this.surface.fillCircle(left + 13, top + height - 13, 2.5);
        this.surface.fillCircle(left + width - 13, top + height - 13, 2.5);
    }
}

function toCssColor(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
}

