import { EventBus } from "../EventBus";

export type DungeonResourceId = "essence" | "stone" | "supplies";

export interface DungeonResource {
    id: DungeonResourceId;
    value: number;
    capacity: number;
}

export interface ResourceSnapshot {
    resources: Record<DungeonResourceId, DungeonResource>;
    incomePerSecond: Record<DungeonResourceId, number>;
    totalEarned: Record<DungeonResourceId, number>;
}

export interface ResourceCost {
    resource: DungeonResourceId;
    amount: number;
}

export interface ResourceManagerState extends ResourceSnapshot {
    fractions: Record<DungeonResourceId, number>;
}

const STARTING_RESOURCES: ResourceSnapshot["resources"] = {
    essence: { id: "essence", value: 148, capacity: 250 },
    stone: { id: "stone", value: 72, capacity: 150 },
    supplies: { id: "supplies", value: 34, capacity: 100 },
};

// Each point of room production is divided among the current prototype
// resources. These values are intentionally centralized for later balancing.
const PRODUCTION_WEIGHTS: Record<DungeonResourceId, number> = {
    essence: 0.25,
    stone: 0.5,
    supplies: 1,
};

export class ResourceManager {
    private readonly resources: ResourceSnapshot["resources"];
    private readonly fractions: Record<DungeonResourceId, number> = {
        essence: 0,
        stone: 0,
        supplies: 0,
    };
    private readonly totalEarned: Record<DungeonResourceId, number> = {
        essence: 0,
        stone: 0,
        supplies: 0,
    };
    private incomePerSecond: Record<DungeonResourceId, number> = {
        essence: 0,
        stone: 0,
        supplies: 0,
    };

    constructor(initialState?: ResourceManagerState) {
        this.resources = {
            essence: { ...STARTING_RESOURCES.essence },
            stone: { ...STARTING_RESOURCES.stone },
            supplies: { ...STARTING_RESOURCES.supplies },
        };

        if (initialState) this.restoreState(initialState);
        this.emitSnapshot();
    }

    update(deltaMs: number, productionPerSecond: number): void {
        if (deltaMs <= 0 || productionPerSecond <= 0) return;

        this.incomePerSecond = {
            essence: productionPerSecond * PRODUCTION_WEIGHTS.essence,
            stone: productionPerSecond * PRODUCTION_WEIGHTS.stone,
            supplies: productionPerSecond * PRODUCTION_WEIGHTS.supplies,
        };

        let changed = false;
        const elapsedSeconds = deltaMs / 1000;

        for (const id of Object.keys(this.resources) as DungeonResourceId[]) {
            const resource = this.resources[id];
            if (resource.value >= resource.capacity) continue;

            this.fractions[id] +=
                productionPerSecond * PRODUCTION_WEIGHTS[id] * elapsedSeconds;
            const wholeUnits = Math.floor(this.fractions[id]);
            if (wholeUnits < 1) continue;

            const gained = Math.min(
                wholeUnits,
                resource.capacity - resource.value,
            );
            resource.value += gained;
            this.totalEarned[id] += gained;
            this.fractions[id] -= wholeUnits;
            changed = changed || gained > 0;
        }

        if (changed) this.emitSnapshot();
    }

    canAfford(id: DungeonResourceId, amount: number): boolean {
        return amount >= 0 && this.resources[id].value >= amount;
    }

    canAffordAll(costs: readonly ResourceCost[]): boolean {
        return costs.every(
            (cost) =>
                Number.isFinite(cost.amount) &&
                cost.amount >= 0 &&
                this.canAfford(cost.resource, cost.amount),
        );
    }

    spend(id: DungeonResourceId, amount: number): boolean {
        if (
            !Number.isFinite(amount) ||
            amount < 0 ||
            !this.canAfford(id, amount)
        ) {
            return false;
        }

        this.resources[id].value -= amount;
        this.emitSnapshot();
        return true;
    }

    spendAll(costs: readonly ResourceCost[]): boolean {
        if (!this.canAffordAll(costs)) return false;

        for (const cost of costs) {
            this.resources[cost.resource].value -= cost.amount;
        }

        this.emitSnapshot();
        return true;
    }

    getSnapshot(): ResourceSnapshot {
        return {
            resources: {
                essence: { ...this.resources.essence },
                stone: { ...this.resources.stone },
                supplies: { ...this.resources.supplies },
            },
            incomePerSecond: { ...this.incomePerSecond },
            totalEarned: { ...this.totalEarned },
        };
    }

    exportState(): ResourceManagerState {
        return {
            ...this.getSnapshot(),
            fractions: { ...this.fractions },
        };
    }

    private restoreState(state: ResourceManagerState): void {
        for (const id of Object.keys(this.resources) as DungeonResourceId[]) {
            const savedResource = state.resources?.[id];
            if (savedResource) {
                const capacity = normalizeNonNegativeNumber(
                    savedResource.capacity,
                    this.resources[id].capacity,
                );
                this.resources[id].capacity = capacity;
                this.resources[id].value = Math.min(
                    capacity,
                    normalizeNonNegativeNumber(savedResource.value, 0),
                );
            }

            this.fractions[id] = Math.min(
                0.999999,
                normalizeNonNegativeNumber(state.fractions?.[id], 0),
            );
            this.totalEarned[id] = normalizeNonNegativeNumber(
                state.totalEarned?.[id],
                0,
            );
            this.incomePerSecond[id] = normalizeNonNegativeNumber(
                state.incomePerSecond?.[id],
                0,
            );
        }
    }

    private emitSnapshot(): void {
        EventBus.emit("resources-changed", this.getSnapshot());
    }
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : fallback;
}
