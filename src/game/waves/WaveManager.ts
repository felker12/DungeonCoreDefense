import type { Scene, Time } from "phaser";
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
import type { RoomEncounterResolver } from "../combat/CombatTypes";
import { EventBus } from "../EventBus";
import { DungeonPathfinder } from "../pathfinding/DungeonPathfinder";
import { createSeededRandom } from "./SeededRandom";
import type { AdventurerParty } from "./PartyData";
import { getAdventurerCombatStats } from "./AdventurerDefinitions";

export type WaveState =
    | "waiting"
    | "spawning"
    | "advancing"
    | "completed"
    | "failed";

export interface WaveStatus {
    waveNumber: number;
    completedWaves: number;
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
    completedWaveCount?: number;
    encounterResolver?: RoomEncounterResolver;
}

const CLASSES = Object.values(AdventurerClass);

interface PartyPlan {
    partyIndex: number;
    partySize: number;
    firstAdventurerIndex: number;
}

export class WaveManager {
    private pathfinder: DungeonPathfinder;
    private roomsById: ReadonlyMap<EntityId, DungeonRoom>;
    private random: () => number;
    private readonly seed?: number;
    private readonly partySpawnInterval: number;
    private readonly minPartySize: number;
    private readonly startingMaxPartySize: number;
    private readonly maxPartySize: number;
    private readonly wavesPerPartySizeIncrease: number;
    private readonly startingWaveCapacity: number;
    private readonly linearWaveGrowth: number;
    private readonly quadraticWaveGrowth: number;
    private readonly wrongTurnChance: number;
    private readonly encounterResolver?: RoomEncounterResolver;
    private readonly controllers = new Set<PartyController>();
    private readonly pendingSpawnTimers = new Set<Time.TimerEvent>();
    private partiesWaitingToSpawn = 0;
    private currentWavePlan: readonly PartyPlan[] = [];
    private activeRunId = 0;
    private completedWaveCount = 0;
    private status: WaveStatus = {
        waveNumber: 0,
        completedWaves: 0,
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
        this.seed = options.seed;
        this.random =
            options.seed === undefined
                ? Math.random
                : createSeededRandom(options.seed);
        this.partySpawnInterval = options.partySpawnInterval ?? 1400;
        this.minPartySize = options.minPartySize ?? 1;
        this.startingMaxPartySize = options.startingMaxPartySize ?? 2;
        this.maxPartySize = options.maxPartySize ?? 10;
        this.wavesPerPartySizeIncrease = options.wavesPerPartySizeIncrease ?? 5;
        this.startingWaveCapacity = options.startingWaveCapacity ?? 3;
        this.linearWaveGrowth = options.linearWaveGrowth ?? 1.25;
        this.quadraticWaveGrowth = options.quadraticWaveGrowth ?? 0.035;
        this.wrongTurnChance = options.wrongTurnChance ?? 0.65;
        this.encounterResolver = options.encounterResolver;
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

        this.completedWaveCount = normalizeCompletedWaveCount(
            options.completedWaveCount,
        );
        if (this.completedWaveCount > 0) {
            this.status = {
                waveNumber: this.completedWaveCount,
                completedWaves: this.completedWaveCount,
                state: "completed",
                totalAdventurers: 0,
                remainingAdventurers: 0,
                totalParties: 0,
                remainingParties: 0,
            };
        }
        this.emitStatus();
    }

    startNextWave(): boolean {
        if (
            this.destroyed ||
            this.isActive() ||
            this.status.state === "failed"
        ) {
            return false;
        }

        const waveNumber = this.completedWaveCount + 1;
        const waveCapacity = this.getWaveCapacity(waveNumber);
        const maximumPartySize = this.getMaxPartySize(waveNumber);
        const partySizes = this.partitionWaveCapacity(
            waveCapacity,
            maximumPartySize,
        );
        let adventurerIndex = 0;
        this.currentWavePlan = partySizes.map((partySize, partyIndex) => {
            const firstAdventurerIndex = adventurerIndex;
            adventurerIndex += partySize;
            return { partyIndex, partySize, firstAdventurerIndex };
        });

        return this.beginWave(waveNumber, this.currentWavePlan);
    }

    retryCurrentWave(): boolean {
        if (
            this.destroyed ||
            this.status.state !== "failed" ||
            this.currentWavePlan.length === 0
        ) {
            return false;
        }

        return this.beginWave(this.status.waveNumber, this.currentWavePlan);
    }

    failCurrentWave(): boolean {
        if (!this.isActive() || this.destroyed) return false;

        this.activeRunId += 1;
        this.cancelPendingSpawns();
        this.destroyActiveControllers();
        this.partiesWaitingToSpawn = 0;
        this.status = {
            ...this.status,
            completedWaves: this.completedWaveCount,
            state: "failed",
            remainingAdventurers: 0,
            remainingParties: 0,
        };
        this.emitStatus();
        return true;
    }

    isActive(): boolean {
        return (
            this.status.state === "spawning" ||
            this.status.state === "advancing"
        );
    }

    getStatus(): WaveStatus {
        return { ...this.status };
    }

    getCompletedWaveCount(): number {
        return this.completedWaveCount;
    }

    refreshTopology(): boolean {
        if (this.isActive() || this.destroyed) return false;

        this.pathfinder = new DungeonPathfinder(this.dungeon);
        this.roomsById = new Map(
            this.dungeon.rooms.map((room) => [room.id, room]),
        );
        return true;
    }

    destroy(): void {
        this.destroyed = true;
        this.activeRunId += 1;
        this.cancelPendingSpawns();
        this.destroyActiveControllers();
    }

    private beginWave(
        waveNumber: number,
        partyPlans: readonly PartyPlan[],
    ): boolean {
        if (this.destroyed || this.isActive() || partyPlans.length === 0) {
            return false;
        }

        this.activeRunId += 1;
        const runId = this.activeRunId;
        if (this.seed !== undefined) {
            this.random = createSeededRandom(this.seed + waveNumber * 9_973);
        }
        const totalAdventurers = partyPlans.reduce(
            (total, plan) => total + plan.partySize,
            0,
        );
        this.status = {
            waveNumber,
            completedWaves: this.completedWaveCount,
            state: "spawning",
            totalAdventurers,
            remainingAdventurers: totalAdventurers,
            totalParties: partyPlans.length,
            remainingParties: partyPlans.length,
        };
        this.partiesWaitingToSpawn = partyPlans.length;
        this.emitStatus();
        this.spawnPartiesSequentially(partyPlans, 0, runId);
        return true;
    }

    private spawnParty(
        partyIndex: number,
        partySize: number,
        firstAdventurerIndex: number,
        runId: number,
    ): void {
        if (runId !== this.activeRunId || !this.isActive()) return;

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
            { encounterResolver: this.encounterResolver },
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
            if (this.destroyed || runId !== this.activeRunId) return;
            this.controllers.delete(controller);
            this.status.remainingAdventurers -= party.members.length;
            this.status.remainingParties -= 1;
            if (
                this.status.remainingAdventurers === 0 &&
                this.partiesWaitingToSpawn === 0
            ) {
                this.status.state = "completed";
                this.completedWaveCount = this.status.waveNumber;
                this.status.completedWaves = this.completedWaveCount;
            }
            this.emitStatus();
        });
    }

    private spawnPartiesSequentially(
        partyPlans: readonly PartyPlan[],
        planIndex: number,
        runId: number,
    ): void {
        if (
            this.destroyed ||
            runId !== this.activeRunId ||
            !this.isActive() ||
            planIndex >= partyPlans.length
        ) {
            return;
        }

        const plan = partyPlans[planIndex];
        this.spawnParty(
            plan.partyIndex,
            plan.partySize,
            plan.firstAdventurerIndex,
            runId,
        );

        if (planIndex + 1 < partyPlans.length) {
            const timer = this.scene.time.delayedCall(
                this.partySpawnInterval,
                () => {
                    this.pendingSpawnTimers.delete(timer);
                    this.spawnPartiesSequentially(
                        partyPlans,
                        planIndex + 1,
                        runId,
                    );
                },
            );
            this.pendingSpawnTimers.add(timer);
        }
    }

    private cancelPendingSpawns(): void {
        for (const timer of this.pendingSpawnTimers) {
            timer.remove(false);
        }
        this.pendingSpawnTimers.clear();
    }

    private destroyActiveControllers(): void {
        for (const controller of this.controllers) {
            controller.destroy();
        }
        this.controllers.clear();
    }

    private createAdventurer(
        index: number,
        entranceId: EntityId,
        partyId: EntityId,
    ): AdventurerData {
        const adventurerClass =
            CLASSES[Math.floor(this.random() * CLASSES.length)];
        const level = 1 + Math.floor((this.status.waveNumber - 1) / 3);
        const stats = getAdventurerCombatStats(adventurerClass, level);

        return {
            id: `wave-${this.status.waveNumber}-adventurer-${index + 1}`,
            class: adventurerClass,
            partyId,
            position: { x: 0, y: 0 },
            size: { width: 30, height: 30 },
            level,
            health: stats.maxHealth,
            maxHealth: stats.maxHealth,
            attack: stats.attack,
            defense: stats.defense,
            currentRoomId: entranceId,
            xpReward: stats.xpReward,
            essenceReward: stats.essenceReward,
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

function normalizeCompletedWaveCount(value: unknown): number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0
        ? value
        : 0;
}

