import type { AdventurerData } from "../components/entityComponents/entityData";

export type DungeonCoreState = "stable" | "under-attack" | "breached";

export interface DungeonCoreSnapshot {
    health: number;
    maxHealth: number;
    defense: number;
    state: DungeonCoreState;
    raidStartHealth: number | null;
    regenerationPerSecond: number;
    regenerationCap: number;
    regenerationCapPercent: number;
    retryHealth: number | null;
    lastDamage: number;
    lastAttackerCount: number;
}

export interface DungeonCorePersistentState {
    health: number;
    state: DungeonCoreState;
    raidStartHealth: number | null;
    retryHealth: number | null;
    lastDamage: number;
    lastAttackerCount: number;
}

export interface DungeonCoreOptions {
    maxHealth?: number;
    defense?: number;
    regenerationPerSecond?: number;
    regenerationCapPercent?: number;
    minimumRetryHealthPercent?: number;
    initialState?: DungeonCorePersistentState;
    onChange?: (snapshot: DungeonCoreSnapshot) => void;
}

export interface CoreDamageResult {
    damage: number;
    attackerCount: number;
    breached: boolean;
}

const DEFAULT_MAX_HEALTH = 300;
const DEFAULT_DEFENSE = 5;
const DEFAULT_REGENERATION_PER_SECOND = 0.75;
const DEFAULT_REGENERATION_CAP_PERCENT = 0.6;
const DEFAULT_MINIMUM_RETRY_HEALTH_PERCENT = 0.5;
const UPDATE_EMIT_INTERVAL_MS = 250;

export class DungeonCoreManager {
    private maxHealth: number;
    private readonly defense: number;
    private readonly regenerationPerSecond: number;
    private readonly regenerationCapPercent: number;
    private readonly minimumRetryHealthPercent: number;
    private readonly onChange?: (snapshot: DungeonCoreSnapshot) => void;
    private health: number;
    private state: DungeonCoreState = "stable";
    private raidStartHealth: number | null = null;
    private retryHealth: number | null = null;
    private lastDamage = 0;
    private lastAttackerCount = 0;
    private timeSinceEmitMs = 0;

    constructor(options: DungeonCoreOptions = {}) {
        this.maxHealth = options.maxHealth ?? DEFAULT_MAX_HEALTH;
        this.defense = options.defense ?? DEFAULT_DEFENSE;
        this.regenerationPerSecond =
            options.regenerationPerSecond ?? DEFAULT_REGENERATION_PER_SECOND;
        this.regenerationCapPercent =
            options.regenerationCapPercent ?? DEFAULT_REGENERATION_CAP_PERCENT;
        this.minimumRetryHealthPercent =
            options.minimumRetryHealthPercent ??
            DEFAULT_MINIMUM_RETRY_HEALTH_PERCENT;
        this.onChange = options.onChange;

        if (!Number.isFinite(this.maxHealth) || this.maxHealth <= 0) {
            throw new Error("Core maximum health must be positive.");
        }
        if (!Number.isFinite(this.defense) || this.defense < 0) {
            throw new Error("Core defense cannot be negative.");
        }
        if (
            !Number.isFinite(this.regenerationPerSecond) ||
            this.regenerationPerSecond < 0
        ) {
            throw new Error("Core regeneration cannot be negative.");
        }
        if (
            this.regenerationCapPercent <= 0 ||
            this.regenerationCapPercent > 1 ||
            this.minimumRetryHealthPercent <= 0 ||
            this.minimumRetryHealthPercent > 1
        ) {
            throw new Error(
                "Core health percentages must be above 0 and at most 1.",
            );
        }

        this.health = this.maxHealth;
        if (options.initialState) this.restoreState(options.initialState);
        this.emitSnapshot();
    }

    beginRaid(): boolean {
        if (this.state !== "stable" || this.health <= 0) return false;

        this.raidStartHealth = this.health;
        this.retryHealth = null;
        this.lastDamage = 0;
        this.lastAttackerCount = 0;
        this.state = "under-attack";
        this.timeSinceEmitMs = 0;
        this.emitSnapshot();
        return true;
    }

    cancelRaidStart(): void {
        if (this.state !== "under-attack" || this.lastDamage > 0) return;

        this.state = "stable";
        this.raidStartHealth = null;
        this.emitSnapshot();
    }

    completeRaid(): void {
        if (this.state !== "under-attack") return;

        this.state = "stable";
        this.raidStartHealth = null;
        this.retryHealth = null;
        this.emitSnapshot();
    }

    applySurvivorAttacks(
        adventurers: readonly AdventurerData[],
    ): CoreDamageResult {
        if (this.state !== "under-attack") {
            return { damage: 0, attackerCount: 0, breached: false };
        }

        const survivors = adventurers.filter(
            (adventurer) => adventurer.health > 0,
        );
        const damage = survivors.reduce(
            (total, adventurer) =>
                total + Math.max(1, adventurer.attack - this.defense),
            0,
        );

        this.lastDamage = damage;
        this.lastAttackerCount = survivors.length;
        this.health = Math.max(0, this.health - damage);

        if (this.health === 0) {
            this.state = "breached";
            this.retryHealth = Math.min(
                this.maxHealth,
                Math.max(
                    this.raidStartHealth ?? 0,
                    this.maxHealth * this.minimumRetryHealthPercent,
                ),
            );
        }

        this.timeSinceEmitMs = 0;
        this.emitSnapshot();
        return {
            damage,
            attackerCount: survivors.length,
            breached: this.state === "breached",
        };
    }

    prepareRetry(): boolean {
        if (this.state !== "breached" || this.retryHealth === null) {
            return false;
        }

        this.health = this.retryHealth;
        this.state = "stable";
        this.raidStartHealth = null;
        this.lastDamage = 0;
        this.lastAttackerCount = 0;
        this.emitSnapshot();
        return true;
    }

    update(deltaMs: number): void {
        if (this.state !== "under-attack" || this.regenerationPerSecond === 0) {
            return;
        }

        const cap = this.getRegenerationCap();
        if (this.health >= cap) return;

        const previousHealth = this.health;
        this.health = Math.min(
            cap,
            this.health + (this.regenerationPerSecond * deltaMs) / 1000,
        );
        if (this.health === previousHealth) return;

        this.timeSinceEmitMs += deltaMs;
        if (
            this.health === cap ||
            this.timeSinceEmitMs >= UPDATE_EMIT_INTERVAL_MS
        ) {
            this.timeSinceEmitMs = 0;
            this.emitSnapshot();
        }
    }

    increaseMaxHealth(amount: number): boolean {
        if (!Number.isFinite(amount) || amount <= 0) return false;

        this.maxHealth += amount;
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.emitSnapshot();
        return true;
    }

    getSnapshot(): DungeonCoreSnapshot {
        return {
            health: this.health,
            maxHealth: this.maxHealth,
            defense: this.defense,
            state: this.state,
            raidStartHealth: this.raidStartHealth,
            regenerationPerSecond: this.regenerationPerSecond,
            regenerationCap: this.getRegenerationCap(),
            regenerationCapPercent: this.regenerationCapPercent,
            retryHealth: this.retryHealth,
            lastDamage: this.lastDamage,
            lastAttackerCount: this.lastAttackerCount,
        };
    }

    exportState(): DungeonCorePersistentState {
        return {
            health: this.health,
            state: this.state,
            raidStartHealth: this.raidStartHealth,
            retryHealth: this.retryHealth,
            lastDamage: this.lastDamage,
            lastAttackerCount: this.lastAttackerCount,
        };
    }

    private restoreState(saved: DungeonCorePersistentState): void {
        const savedHealth = clampNumber(saved.health, 0, this.maxHealth);
        const fallbackHealth =
            nullableClampedNumber(saved.retryHealth, 1, this.maxHealth) ??
            nullableClampedNumber(saved.raidStartHealth, 1, this.maxHealth) ??
            this.maxHealth;

        // Saves are written only between raids. Normalize stale active or failed
        // data to a stable state so loading can never leave the next wave blocked.
        this.health = Math.max(
            1,
            saved.state === "stable" ? savedHealth : fallbackHealth,
        );
        this.state = "stable";
        this.raidStartHealth = null;
        this.retryHealth = null;
        this.lastDamage = clampNumber(saved.lastDamage, 0, Number.MAX_SAFE_INTEGER);
        this.lastAttackerCount = Math.floor(
            clampNumber(saved.lastAttackerCount, 0, Number.MAX_SAFE_INTEGER),
        );
    }

    private getRegenerationCap(): number {
        return this.maxHealth * this.regenerationCapPercent;
    }

    private emitSnapshot(): void {
        this.onChange?.(this.getSnapshot());
    }
}

function clampNumber(value: unknown, minimum: number, maximum: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return minimum;
    return Math.min(maximum, Math.max(minimum, value));
}

function nullableClampedNumber(
    value: unknown,
    minimum: number,
    maximum: number,
): number | null {
    return value === null ? null : clampNumber(value, minimum, maximum);
}
