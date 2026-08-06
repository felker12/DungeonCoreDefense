// src/game/views/DungeonMapView.ts

import { GameObjects, Geom, Scene } from "phaser";
import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import type { DungeonConnection } from "../components/mapComponents/DungeonConnection";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import { CorridorView } from "./CorridorView";
import { RoomView } from "./RoomView";

export class DungeonMapView extends GameObjects.Container {
    private readonly roomViews = new Map<string, RoomView>();
    private readonly corridorViews = new Map<string, CorridorView>();
    private selectedRoomId: string | null = null;

    constructor(
        scene: Scene,
        private readonly dungeon: DungeonMap,
    ) {
        super(scene, 0, 0);
        scene.add.existing(this);

        const roomsById = new Map(dungeon.rooms.map((room) => [room.id, room]));

        for (const connection of dungeon.connections) {
            const view = new CorridorView(scene, connection, roomsById);
            this.corridorViews.set(connection.id, view);
            this.add(view);
        }

        for (const room of dungeon.rooms) {
            const view = new RoomView(scene, room);
            this.roomViews.set(room.id, view);
            this.add(view);
        }
    }

    addRoom(room: DungeonRoom): void {
        if (this.roomViews.has(room.id)) return;

        const view = new RoomView(this.scene, room);
        this.roomViews.set(room.id, view);
        this.add(view);
    }

    addConnection(connection: DungeonConnection): void {
        if (this.corridorViews.has(connection.id)) return;

        const roomsById = new Map(
            this.dungeon.rooms.map((room) => [room.id, room]),
        );
        const view = new CorridorView(this.scene, connection, roomsById);
        this.corridorViews.set(connection.id, view);
        this.add(view);
        this.sendToBack(view);
    }

    removeConnection(connectionId: string): void {
        const view = this.corridorViews.get(connectionId);
        if (!view) return;

        this.corridorViews.delete(connectionId);
        this.remove(view, true);
    }

    refreshRoom(roomId: string): void {
        const room = this.dungeon.rooms.find((candidate) => candidate.id === roomId);
        const previousView = this.roomViews.get(roomId);
        if (!room || !previousView) return;

        this.roomViews.delete(roomId);
        this.remove(previousView, true);

        const replacement = new RoomView(this.scene, room);
        replacement.setSelected(this.selectedRoomId === roomId);
        this.roomViews.set(roomId, replacement);
        this.add(replacement);
    }

    selectRoom(roomId: string): void {
        this.selectedRoomId = roomId;
        for (const [id, view] of this.roomViews) {
            view.setSelected(id === roomId);
        }
    }

    getMapBounds(): Geom.Rectangle {
        const roomBounds = [...this.roomViews.values()].map((view) => view.getBounds());

        if (roomBounds.length === 0) {
            return new Geom.Rectangle(0, 0, 1, 1);
        }

        const left = Math.min(...roomBounds.map((bounds) => bounds.left));
        const top = Math.min(...roomBounds.map((bounds) => bounds.top));
        const right = Math.max(...roomBounds.map((bounds) => bounds.right));
        const bottom = Math.max(...roomBounds.map((bounds) => bounds.bottom));

        return new Geom.Rectangle(left, top, right - left, bottom - top);
    }
}
