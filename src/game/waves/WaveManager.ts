import type { Scene } from "phaser";
import type { EntityId } from "../components/DungeonData";
import {
    AdventurerClass,
    type AdventurerData,
} from "../components/entityComponents/entityData";
import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import {
    DungeonRoomType,
    type DungeonRoom,
} from "../components/mapComponents/DungeonRoom";
import { AdventurerController } from "../controllers/AdventurerController";
import { EventBus } from "../EventBus";
import { DungeonPathfinder } from "../pathfinding/DungeonPathfinder";
import { createSeededRandom } from "./SeededRandom";

export type WaveState = "waiting" | "spawning" | "advancing" | "completed";

export interface WaveStatus {
    waveNumber: number;
    state: WaveState;
    totalAdventurers: number;
    remainingAdventurers: number;
}

export interface WaveManagerOptions {
    seed?: number;
    spawnInterval?: number;
}

const CLASSES = Object.values(AdventurerClass);

export class WaveManager {
    private readonly pathfinder: DungeonPathfinder;
    private readonly roomsById: ReadonlyMap<EntityId, DungeonRoom>;
    private readonly random: () => number;
    private readonly spawnInterval: number;
    private readonly controllers = new Set<AdventurerController>();
    private status: WaveStatus = {
        waveNumber: 0,
        state: "waiting",
        totalAdventurers: 0,
        remainingAdventurers: 0,
    };
    private destroyed = false;

    constructor(
        private readonly scene: Scene,
        private readonly dungeon: DungeonMap,
        options: WaveManagerOptions = {},
    ) {
        this.pathfinder = new DungeonPathfinder(dungeon);
        this.roomsById = new Map(dungeon.rooms.map((room) => [room.id, room]));
        this.random = options.seed === undefined ? Math.random : createSeededRandom(options.seed);
        this.spawnInterval = options.spawnInterval ?? 500;
        this.emitStatus();
    }

    startNextWave(): boolean {
        if (this.destroyed || this.status.state === "spawning" || this.status.state === "advancing") {
            return false;
        }

        const waveNumber = this.status.waveNumber + 1;
        const partySize = Math.min(3 + Math.floor(waveNumber / 2), 10);
        this.status = {
            waveNumber,
            state: "spawning",
            totalAdventurers: partySize,
            remainingAdventurers: partySize,
        };
        this.emitStatus();

        for (let index = 0; index < partySize; index += 1) {
            this.scene.time.delayedCall(index * this.spawnInterval, () => {
                if (!this.destroyed) this.spawnAdventurer(index);
            });
        }
        return true;
    }

    destroy(): void {
        this.destroyed = true;
        for (const controller of this.controllers) controller.destroy();
        this.controllers.clear();
    }

    private spawnAdventurer(index: number): void {
        const route = this.pathfinder.chooseRoute(this.random);
        const entrance = this.dungeon.rooms.find((room) => room.type === DungeonRoomType.ENTRANCE);
        if (!entrance) throw new Error("Cannot spawn without an Entrance.");

        const adventurer = this.createAdventurer(index, entrance.id);
        const controller = new AdventurerController(
            this.scene,
            adventurer,
            route,
            this.roomsById,
        );
        this.controllers.add(controller);

        this.status.state = "advancing";
        this.emitStatus();
        EventBus.emit("adventurer-spawned", { adventurer, route });

        void controller.advance().then(() => {
            if (this.destroyed) return;
            this.controllers.delete(controller);
            this.status.remainingAdventurers -= 1;
            if (this.status.remainingAdventurers === 0) this.status.state = "completed";
            this.emitStatus();
        });
    }

    private createAdventurer(index: number, entranceId: EntityId): AdventurerData {
        const adventurerClass = CLASSES[Math.floor(this.random() * CLASSES.length)];
        const level = 1 + Math.floor((this.status.waveNumber - 1) / 3);
        const maxHealth = 80 + level * 20;
        return {
            id: `wave-${this.status.waveNumber}-adventurer-${index + 1}`,
            class: adventurerClass,
            position: { x: 0, y: 0 },
            size: { width: 30, height: 30 },
            level,
            health: maxHealth,
            maxHealth,
            attack: 8 + level * 3,
            defense: 4 + level * 2,
            currentRoomId: entranceId,
            xpReward: 10 * level,
            essenceReward: 5 * level,
        };
    }

    private emitStatus(): void {
        EventBus.emit("wave-status-changed", { ...this.status });
    }
}
