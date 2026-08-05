// src/game/views/DungeonMapView.ts

import { GameObjects, Scene } from "phaser";
import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import { CorridorView } from "./CorridorView";
import { RoomView } from "./RoomView";

export class DungeonMapView extends GameObjects.Container {
    private readonly roomViews = new Map<string, RoomView>();

    constructor(scene: Scene, dungeon: DungeonMap) {
        super(scene, 0, 0);
        scene.add.existing(this);

        const roomsById = new Map(dungeon.rooms.map((room) => [room.id, room]));

        for (const connection of dungeon.connections) {
            this.add(new CorridorView(scene, connection, roomsById));
        }

        for (const room of dungeon.rooms) {
            const view = new RoomView(scene, room);
            this.roomViews.set(room.id, view);
            this.add(view);
        }
    }

    selectRoom(roomId: string): void {
        for (const [id, view] of this.roomViews) {
            view.setSelected(id === roomId);
        }
    }

    getMapBounds(): Phaser.Geom.Rectangle {
        const roomBounds = [...this.roomViews.values()].map((view) => view.getBounds());

        if (roomBounds.length === 0) {
            return new Phaser.Geom.Rectangle(0, 0, 1, 1);
        }

        const left = Math.min(...roomBounds.map((bounds) => bounds.left));
        const top = Math.min(...roomBounds.map((bounds) => bounds.top));
        const right = Math.max(...roomBounds.map((bounds) => bounds.right));
        const bottom = Math.max(...roomBounds.map((bounds) => bounds.bottom));

        return new Phaser.Geom.Rectangle(left, top, right - left, bottom - top);
    }
}
