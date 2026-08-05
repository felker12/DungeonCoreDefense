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
import type { EntityId } from "../components/DungeonData";
import type {
    RoomPopulationSnapshot,
    ResourceSlotType,
} from "../rooms/RoomPopulationManager";

export interface RoomDetails {
    room: DungeonRoom;
    population: RoomPopulationSnapshot | null;
}

export class DungeonScene extends Scene {
    private mapView?: DungeonMapView;
    private cameraController?: DungeonCameraController;
    private waveManager?: WaveManager;
    private roomPopulation?: RoomPopulationManager;
    private initialCenterFrame?: number;

    constructor() {
        super("DungeonScene");
    }

    startNextWave(): boolean {
        return this.waveManager?.startNextWave() ?? false;
    }

    getRoomDetails(roomId: EntityId): RoomDetails | null {
        const room = initialDungeon.rooms.find(
            (candidate) => candidate.id === roomId,
        );
        return room
            ? {
                  room: { ...room },
                  population: this.roomPopulation?.getSnapshot(roomId) ?? null,
              }
            : null;
    }

    upgradeSelectedRoom(
        roomId: EntityId,
        slot: ResourceSlotType | "defender",
    ): boolean {
        const population = this.roomPopulation?.getSnapshot(roomId);
        if (!population) return false;
        return population.capacity.kind === "combat"
            ? (this.roomPopulation?.upgradeCombatSlot(roomId) ?? false)
            : (this.roomPopulation?.upgradeResourceSlot(roomId, slot) ?? false);
    }

    create(): void {
        this.cameras.main.setBackgroundColor("#111018");
        validateDungeonMap(initialDungeon);
        this.mapView = new DungeonMapView(this, initialDungeon);
        this.mapView.setVisible(false);
        this.cameraController = new DungeonCameraController(
            this,
            this.mapView.getMapBounds(),
            { southWorldPadding: 4500 },
        );

        // The explicit CSS grid gives Phaser a stable map cell. Wait one paint,
        // fit to that cell once, then reveal the correctly framed dungeon.
        this.initialCenterFrame = requestAnimationFrame(() => {
            this.initialCenterFrame = undefined;
            if (!this.scene.isActive() || !this.cameraController) return;
            this.scale.refresh();
            this.cameraController.initializeViewport();
            this.mapView?.setVisible(true);
        });
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
        for (const room of initialDungeon.rooms) {
            const snapshot = this.roomPopulation.getSnapshot(room.id);
            if (snapshot) EventBus.emit("room-population-changed", snapshot);
        }

        const handleRoomSelected = (room: DungeonRoom): void => {
            this.mapView?.selectRoom(room.id);
        };

        EventBus.on("room-selected", handleRoomSelected);
        this.events.once("shutdown", () => {
            if (this.initialCenterFrame !== undefined) {
                cancelAnimationFrame(this.initialCenterFrame);
                this.initialCenterFrame = undefined;
            }

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
