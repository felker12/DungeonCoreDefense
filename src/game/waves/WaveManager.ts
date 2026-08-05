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
import { PartyController } from "../controllers/PartyController";
import { EventBus } from "../EventBus";
import { DungeonPathfinder } from "../pathfinding/DungeonPathfinder";
import { createSeededRandom } from "./SeededRandom";
import type { AdventurerParty } from "./PartyData";

export type WaveState = "waiting" | "spawning" | "advancing" | "completed";

export interface WaveStatus {
    waveNumber: number;
    state: WaveState;
    totalAdventurers: number;
    remainingAdventurers: number;
    totalParties: number;
    remainingParties: number;
}

export interface WaveManagerOptions {
    seed?: number;
    partySpawnInterval?: number;
    minPartySize?: number;
    maxPartySize?: number;
}

const CLASSES = Object.values(AdventurerClass);

export class WaveManager {
    private readonly pathfinder: DungeonPathfinder;
    private readonly roomsById: ReadonlyMap<EntityId, DungeonRoom>;
    private readonly random: () => number;
    private readonly partySpawnInterval: number;
    private readonly minPartySize: number;
    private readonly maxPartySize: number;
    private readonly controllers = new Set<PartyController>();
    private status: WaveStatus = {
        waveNumber: 0,
        state: "waiting",
        totalAdventurers: 0,
        remainingAdventurers: 0,
        totalParties: 0,
        remainingParties: 0,
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
        this.partySpawnInterval = options.partySpawnInterval ?? 1400;
        this.minPartySize = options.minPartySize ?? 1;
        this.maxPartySize = options.maxPartySize ?? 3;
        if (this.minPartySize < 1 || this.maxPartySize < this.minPartySize) {
            throw new Error("Party size options must describe a valid positive range.");
        }
        this.emitStatus();
    }

    startNextWave(): boolean {
        if (this.destroyed || this.status.state === "spawning" || this.status.state === "advancing") {
            return false;
        }

        const waveNumber = this.status.waveNumber + 1;
        const waveCapacity = Math.min(3 + Math.floor(waveNumber / 2), 10);
        const partySizes = this.partitionWaveCapacity(waveCapacity);
        this.status = {
            waveNumber,
            state: "spawning",
            totalAdventurers: waveCapacity,
            remainingAdventurers: waveCapacity,
            totalParties: partySizes.length,
            remainingParties: partySizes.length,
        };
        this.emitStatus();

        let adventurerIndex = 0;
        partySizes.forEach((partySize, partyIndex) => {
            const firstAdventurerIndex = adventurerIndex;
            adventurerIndex += partySize;
            this.scene.time.delayedCall(partyIndex * this.partySpawnInterval, () => {
                if (!this.destroyed) this.spawnParty(partyIndex, partySize, firstAdventurerIndex);
            });
        });
        return true;
    }

    destroy(): void {
        this.destroyed = true;
        for (const controller of this.controllers) controller.destroy();
        this.controllers.clear();
    }

    private spawnParty(partyIndex: number, partySize: number, firstAdventurerIndex: number): void {
        const route = this.pathfinder.chooseRoute(this.random);
        const entrance = this.dungeon.rooms.find((room) => room.type === DungeonRoomType.ENTRANCE);
        if (!entrance) throw new Error("Cannot spawn without an Entrance.");

        const partyId = `wave-${this.status.waveNumber}-party-${partyIndex + 1}`;
        const members = Array.from({ length: partySize }, (_, memberIndex) =>
            this.createAdventurer(firstAdventurerIndex + memberIndex, entrance.id, partyId),
        );
        const party: AdventurerParty = { id: partyId, waveNumber: this.status.waveNumber, members, route };
        const controller = new PartyController(this.scene, party, this.roomsById);
        this.controllers.add(controller);

        this.status.state = "advancing";
        this.emitStatus();
        EventBus.emit("party-spawned", party);
        for (const adventurer of members) EventBus.emit("adventurer-spawned", { adventurer, route });

        void controller.advance().then(() => {
            if (this.destroyed) return;
            this.controllers.delete(controller);
            this.status.remainingAdventurers -= party.members.length;
            this.status.remainingParties -= 1;
            if (this.status.remainingAdventurers === 0) this.status.state = "completed";
            this.emitStatus();
        });
    }

    private createAdventurer(index: number, entranceId: EntityId, partyId: EntityId): AdventurerData {
        const adventurerClass = CLASSES[Math.floor(this.random() * CLASSES.length)];
        const level = 1 + Math.floor((this.status.waveNumber - 1) / 3);
        const maxHealth = 80 + level * 20;
        return {
            id: `wave-${this.status.waveNumber}-adventurer-${index + 1}`,
            class: adventurerClass,
            partyId,
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

    private partitionWaveCapacity(capacity: number): number[] {
        const sizes: number[] = [];
        let remaining = capacity;
        while (remaining > 0) {
            const largestAllowed = Math.min(this.maxPartySize, remaining);
            const smallestAllowed = Math.min(this.minPartySize, largestAllowed);
            const size = smallestAllowed + Math.floor(this.random() * (largestAllowed - smallestAllowed + 1));
            sizes.push(size);
            remaining -= size;
        }
        return sizes;
    }

    private emitStatus(): void {
        EventBus.emit("wave-status-changed", { ...this.status });
    }
}
