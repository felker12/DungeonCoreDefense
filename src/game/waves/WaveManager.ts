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
    startingMaxPartySize?: number;
    maxPartySize?: number;
    wavesPerPartySizeIncrease?: number;
    startingWaveCapacity?: number;
    linearWaveGrowth?: number;
    quadraticWaveGrowth?: number;
    wrongTurnChance?: number;
}

const CLASSES = Object.values(AdventurerClass);

export class WaveManager {
    private readonly pathfinder: DungeonPathfinder;
    private readonly roomsById: ReadonlyMap<EntityId, DungeonRoom>;
    private readonly random: () => number;
    private readonly partySpawnInterval: number;
    private readonly minPartySize: number;
    private readonly startingMaxPartySize: number;
    private readonly maxPartySize: number;
    private readonly wavesPerPartySizeIncrease: number;
    private readonly startingWaveCapacity: number;
    private readonly linearWaveGrowth: number;
    private readonly quadraticWaveGrowth: number;
    private readonly wrongTurnChance: number;
    private readonly controllers = new Set<PartyController>();
    private partiesWaitingToSpawn = 0;
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
        this.random =
            options.seed === undefined
                ? Math.random
                : createSeededRandom(options.seed);
        this.partySpawnInterval = options.partySpawnInterval ?? 1400;
        this.minPartySize = options.minPartySize ?? 1;
        this.startingMaxPartySize = options.startingMaxPartySize ?? 3;
        this.maxPartySize = options.maxPartySize ?? 10;
        this.wavesPerPartySizeIncrease = options.wavesPerPartySizeIncrease ?? 5;
        this.startingWaveCapacity = options.startingWaveCapacity ?? 3;
        this.linearWaveGrowth = options.linearWaveGrowth ?? 1.25;
        this.quadraticWaveGrowth = options.quadraticWaveGrowth ?? 0.035;
        this.wrongTurnChance = options.wrongTurnChance ?? 0.65;
        if (
            this.minPartySize < 1 ||
            this.startingMaxPartySize < this.minPartySize ||
            this.maxPartySize < this.startingMaxPartySize
        ) {
            throw new Error(
                "Party size options must describe a valid positive range.",
            );
        }
        if (
            !Number.isInteger(this.wavesPerPartySizeIncrease) ||
            this.wavesPerPartySizeIncrease < 1
        ) {
            throw new Error(
                "Waves per party-size increase must be a positive integer.",
            );
        }
        if (
            this.startingWaveCapacity < 1 ||
            this.linearWaveGrowth < 0 ||
            this.quadraticWaveGrowth < 0
        ) {
            throw new Error(
                "Wave-growth options must produce positive, non-decreasing waves.",
            );
        }
        if (this.wrongTurnChance < 0 || this.wrongTurnChance > 1) {
            throw new Error("Wrong-turn chance must be between 0 and 1.");
        }
        this.emitStatus();
    }

    startNextWave(): boolean {
        if (
            this.destroyed ||
            this.status.state === "spawning" ||
            this.status.state === "advancing"
        ) {
            return false;
        }

        const waveNumber = this.status.waveNumber + 1;
        const waveCapacity = this.getWaveCapacity(waveNumber);
        const maximumPartySize = this.getMaxPartySize(waveNumber);
        const partySizes = this.partitionWaveCapacity(
            waveCapacity,
            maximumPartySize,
        );
        this.status = {
            waveNumber,
            state: "spawning",
            totalAdventurers: waveCapacity,
            remainingAdventurers: waveCapacity,
            totalParties: partySizes.length,
            remainingParties: partySizes.length,
        };
        this.partiesWaitingToSpawn = partySizes.length;
        this.emitStatus();

        let adventurerIndex = 0;
        const partyPlans = partySizes.map((partySize, partyIndex) => {
            const firstAdventurerIndex = adventurerIndex;
            adventurerIndex += partySize;
            return { partyIndex, partySize, firstAdventurerIndex };
        });

        this.spawnPartiesSequentially(partyPlans);
        return true;
    }

    isActive(): boolean {
        return (
            this.status.state === "spawning" ||
            this.status.state === "advancing"
        );
    }

    destroy(): void {
        this.destroyed = true;
        for (const controller of this.controllers) controller.destroy();
        this.controllers.clear();
    }

    private spawnParty(
        partyIndex: number,
        partySize: number,
        firstAdventurerIndex: number,
    ): void {
        const route = this.pathfinder.chooseRouteWithWrongTurn(
            this.random,
            this.wrongTurnChance,
        );
        const entrance = this.dungeon.rooms.find(
            (room) => room.type === DungeonRoomType.ENTRANCE,
        );
        if (!entrance) throw new Error("Cannot spawn without an Entrance.");

        const partyId = `wave-${this.status.waveNumber}-party-${partyIndex + 1}`;
        const members = Array.from({ length: partySize }, (_, memberIndex) =>
            this.createAdventurer(
                firstAdventurerIndex + memberIndex,
                entrance.id,
                partyId,
            ),
        );
        const party: AdventurerParty = {
            id: partyId,
            waveNumber: this.status.waveNumber,
            members,
            route,
        };
        const controller = new PartyController(
            this.scene,
            party,
            this.roomsById,
        );
        this.controllers.add(controller);

        this.partiesWaitingToSpawn -= 1;
        this.status.state =
            this.partiesWaitingToSpawn > 0 ? "spawning" : "advancing";
        this.emitStatus();
        EventBus.emit("party-spawned", party);
        for (const adventurer of members)
            EventBus.emit("adventurer-spawned", { adventurer, route });

        void controller.advance().then(() => {
            if (this.destroyed) return;
            this.controllers.delete(controller);
            this.status.remainingAdventurers -= party.members.length;
            this.status.remainingParties -= 1;
            if (
                this.status.remainingAdventurers === 0 &&
                this.partiesWaitingToSpawn === 0
            ) {
                this.status.state = "completed";
            }
            this.emitStatus();
        });
    }

    private spawnPartiesSequentially(
        partyPlans: readonly {
            partyIndex: number;
            partySize: number;
            firstAdventurerIndex: number;
        }[],
        planIndex = 0,
    ): void {
        if (this.destroyed || planIndex >= partyPlans.length) return;

        const plan = partyPlans[planIndex];
        this.spawnParty(
            plan.partyIndex,
            plan.partySize,
            plan.firstAdventurerIndex,
        );

        if (planIndex + 1 < partyPlans.length) {
            this.scene.time.delayedCall(this.partySpawnInterval, () => {
                this.spawnPartiesSequentially(partyPlans, planIndex + 1);
            });
        }
    }

    private createAdventurer(
        index: number,
        entranceId: EntityId,
        partyId: EntityId,
    ): AdventurerData {
        const adventurerClass =
            CLASSES[Math.floor(this.random() * CLASSES.length)];
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

    private getWaveCapacity(waveNumber: number): number {
        const completedWaves = waveNumber - 1;

        return Math.floor(
            this.startingWaveCapacity +
                completedWaves * this.linearWaveGrowth +
                completedWaves * completedWaves * this.quadraticWaveGrowth,
        );
    }

    private getMaxPartySize(waveNumber: number): number {
        const milestoneIncreases = Math.floor(
            (waveNumber - 1) / this.wavesPerPartySizeIncrease,
        );

        return Math.min(
            this.maxPartySize,
            this.startingMaxPartySize + milestoneIncreases,
        );
    }

    private partitionWaveCapacity(
        capacity: number,
        maximumPartySize: number,
    ): number[] {
        const sizes: number[] = [];
        let remaining = capacity;
        while (remaining > 0) {
            const largestAllowed = Math.min(maximumPartySize, remaining);
            const smallestAllowed = Math.min(this.minPartySize, largestAllowed);
            const weightedRandom = Math.sqrt(this.random());
            const size =
                smallestAllowed +
                Math.floor(
                    weightedRandom * (largestAllowed - smallestAllowed + 1),
                );
            sizes.push(size);
            remaining -= size;
        }
        return sizes;
    }

    private emitStatus(): void {
        EventBus.emit("wave-status-changed", { ...this.status });
    }
}
