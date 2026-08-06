import { EventBus } from "../EventBus";

export type DungeonResourceId = "essence" | "stone" | "supplies";

export interface DungeonResource {
    id: DungeonResourceId;
    value: number;
    capacity: number;
}

type ResourceValues = Record<DungeonResourceId, number>;

export interface ResourceSnapshot {
    resources: Record<DungeonResourceId, DungeonResource>;
    incomePerSecond: ResourceValues;
    totalEarned: ResourceValues;
}

const STARTING_RESOURCES: ResourceSnapshot["resources"] = {
    essence: { id: "essence", value: 148, capacity: 250 },
    stone: { id: "stone", value: 72, capacity: 150 },
    supplies: { id: "supplies", value: 34, capacity: 100 },
};

const PRODUCTION_WEIGHTS: ResourceValues = {
    essence: 0.25,
    stone: 0.5,
    supplies: 1,
};

const createEmptyResourceValues = (): ResourceValues => ({
    essence: 0,
    stone: 0,
    supplies: 0,
});

export class ResourceManager {
    private readonly resources: ResourceSnapshot["resources"];
    private readonly fractions = createEmptyResourceValues();
    private readonly totalEarned = createEmptyResourceValues();
    private incomePerSecond = createEmptyResourceValues();
    private lastProductionPerSecond = 0;

    constructor() {
        this.resources = {
            essence: { ...STARTING_RESOURCES.essence },
            stone: { ...STARTING_RESOURCES.stone },
            supplies: { ...STARTING_RESOURCES.supplies },
        };

        this.emitSnapshot();
    }

    update(deltaMs: number, productionPerSecond: number): void {
        if (deltaMs <= 0 || productionPerSecond <= 0) {
            return;
        }

        let changed = false;

        if (productionPerSecond !== this.lastProductionPerSecond) {
            this.lastProductionPerSecond = productionPerSecond;
            this.updateIncomeRates(productionPerSecond);
            changed = true;
        }

        const elapsedSeconds = deltaMs / 1000;

        for (const id of Object.keys(this.resources) as DungeonResourceId[]) {
            const resource = this.resources[id];

            if (resource.value >= resource.capacity) {
                continue;
            }

            this.fractions[id] +=
                productionPerSecond * PRODUCTION_WEIGHTS[id] * elapsedSeconds;

            const wholeUnits = Math.floor(this.fractions[id]);

            if (wholeUnits < 1) {
                continue;
            }

            const gained = Math.min(
                wholeUnits,
                resource.capacity - resource.value,
            );

            resource.value += gained;
            this.totalEarned[id] += gained;
            this.fractions[id] -= wholeUnits;

            if (gained > 0) {
                changed = true;
            }
        }

        if (changed) {
            this.emitSnapshot();
        }
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

    private updateIncomeRates(productionPerSecond: number): void {
        this.incomePerSecond = {
            essence: productionPerSecond * PRODUCTION_WEIGHTS.essence,
            stone: productionPerSecond * PRODUCTION_WEIGHTS.stone,
            supplies: productionPerSecond * PRODUCTION_WEIGHTS.supplies,
        };
    }

    private emitSnapshot(): void {
        EventBus.emit("resources-changed", this.getSnapshot());
    }

    spend(id: DungeonResourceId, amount: number): boolean {
        if (!Number.isFinite(amount) || amount <= 0) return false;

        const resource = this.resources[id];
        if (resource.value < amount) return false;

        resource.value -= amount;
        this.emitSnapshot();
        return true;
    }
}
