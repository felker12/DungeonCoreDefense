// src/game/scenes/DungeonScene.ts

import { Scene } from "phaser";
import { DungeonCameraController } from "../camera/DungeonCameraController";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import { initialDungeon } from "../data/initialDungeon";
import { EventBus } from "../EventBus";
import { validateDungeonMap } from "../pathfinding/validateDungeonMap";
import { DungeonMapView } from "../views/DungeonMapView";
import { WaveManager } from "../waves/WaveManager";
import { RoomPopulationManager } from "../rooms/RoomPopulationManager";

export class DungeonScene extends Scene {
    private mapView?: DungeonMapView;
    private cameraController?: DungeonCameraController;
    private waveManager?: WaveManager;
    private roomPopulation?: RoomPopulationManager;

    constructor() {
        super("DungeonScene");
    }

    startNextWave(): boolean {
        return this.waveManager?.startNextWave() ?? false;
    }

    create(): void {
        this.cameras.main.setBackgroundColor("#111018");
        validateDungeonMap(initialDungeon);
        this.mapView = new DungeonMapView(this, initialDungeon);
        this.cameraController = new DungeonCameraController(
            this,
            this.mapView.getMapBounds(),
        );
        this.waveManager = new WaveManager(this, initialDungeon, {
            // Remove the seed when you want a different sequence each reload.
            seed: 1337,
            partySpawnInterval: 1400,
            minPartySize: 1,
            startingMaxPartySize: 3,
            maxPartySize: 10,
            wavesPerPartySizeIncrease: 5,
            startingWaveCapacity: 3,
            linearWaveGrowth: 1.25,
            quadraticWaveGrowth: 0.035,
            wrongTurnChance: 0.65,
        });
        this.roomPopulation = new RoomPopulationManager(initialDungeon, [], {
            gathererRecoveryMs: 20_000,
            baseProductionPerSecond: 1,
        });

        const handleRoomSelected = (room: DungeonRoom): void => {
            this.mapView?.selectRoom(room.id);
        };

        EventBus.on("room-selected", handleRoomSelected);
        this.events.once("shutdown", () => {
            EventBus.off("room-selected", handleRoomSelected);
            this.waveManager?.destroy();
            this.waveManager = undefined;
            this.roomPopulation = undefined;
            this.cameraController?.destroy();
            this.cameraController = undefined;
        });

        EventBus.emit("current-scene-ready", this);
    }

    update(_time: number, delta: number): void {
        this.roomPopulation?.update(delta);
    }
}
