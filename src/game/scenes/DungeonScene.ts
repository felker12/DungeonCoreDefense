// src/game/scenes/DungeonScene.ts

import { Scene } from "phaser";
import { DungeonCameraController } from "../camera/DungeonCameraController";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import { initialDungeon } from "../data/initialDungeon";
import { EventBus } from "../EventBus";
import { DungeonMapView } from "../views/DungeonMapView";

export class DungeonScene extends Scene {
    private mapView?: DungeonMapView;
    private cameraController?: DungeonCameraController;

    constructor() {
        super("DungeonScene");
    }

    create(): void {
        this.cameras.main.setBackgroundColor("#111018");
        this.mapView = new DungeonMapView(this, initialDungeon);
        this.cameraController = new DungeonCameraController(
            this,
            this.mapView.getMapBounds(),
        );

        const handleRoomSelected = (room: DungeonRoom): void => {
            this.mapView?.selectRoom(room.id);
        };

        EventBus.on("room-selected", handleRoomSelected);
        this.events.once("shutdown", () => {
            EventBus.off("room-selected", handleRoomSelected);
            this.cameraController?.destroy();
            this.cameraController = undefined;
        });

        EventBus.emit("current-scene-ready", this);
    }
}
