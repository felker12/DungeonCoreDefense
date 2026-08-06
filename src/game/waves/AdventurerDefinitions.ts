import {
    AdventurerClass,
    type AdventurerData,
} from "../components/entityComponents/entityData";
import type { DungeonResourceId } from "../resources/ResourceManager";

export interface AdventurerArchetype {
    label: string;
    baseHealth: number;
    healthPerLevel: number;
    baseAttack: number;
    attackPerLevel: number;
    baseDefense: number;
    defensePerLevel: number;
    baseXpReward: number;
    xpRewardPerLevel: number;
    baseEssenceReward: number;
    essenceRewardPerLevel: number;
}

/**
 * Central balance definitions for every adventurer class.
 * Base values represent a level-1 adventurer. Per-level values are applied for
 * every level after the first.
 */
export const ADVENTURER_ARCHETYPES: Record<
    AdventurerClass,
    AdventurerArchetype
> = {
    [AdventurerClass.WARRIOR]: {
        label: "Warrior",
        baseHealth: 125,
        healthPerLevel: 20,
        baseAttack: 9,
        attackPerLevel: 2,
        baseDefense: 8,
        defensePerLevel: 2,
        baseXpReward: 12,
        xpRewardPerLevel: 8,
        baseEssenceReward: 5,
        essenceRewardPerLevel: 4,
    },
    [AdventurerClass.ROGUE]: {
        label: "Rogue",
        baseHealth: 85,
        healthPerLevel: 14,
        baseAttack: 13,
        attackPerLevel: 3,
        baseDefense: 4,
        defensePerLevel: 1,
        baseXpReward: 11,
        xpRewardPerLevel: 8,
        baseEssenceReward: 5,
        essenceRewardPerLevel: 4,
    },
    [AdventurerClass.CLERIC]: {
        label: "Cleric",
        baseHealth: 105,
        healthPerLevel: 18,
        baseAttack: 9,
        attackPerLevel: 2,
        baseDefense: 6,
        defensePerLevel: 2,
        baseXpReward: 12,
        xpRewardPerLevel: 9,
        baseEssenceReward: 6,
        essenceRewardPerLevel: 5,
    },
    [AdventurerClass.ARCANIST]: {
        label: "Arcanist",
        baseHealth: 75,
        healthPerLevel: 12,
        baseAttack: 15,
        attackPerLevel: 4,
        baseDefense: 3,
        defensePerLevel: 1,
        baseXpReward: 13,
        xpRewardPerLevel: 9,
        baseEssenceReward: 7,
        essenceRewardPerLevel: 5,
    },
};

export interface AdventurerCombatStats {
    maxHealth: number;
    attack: number;
    defense: number;
    xpReward: number;
    essenceReward: number;
}

export function getAdventurerCombatStats(
    adventurerClass: AdventurerClass,
    level: number,
): AdventurerCombatStats {
    const archetype = ADVENTURER_ARCHETYPES[adventurerClass];
    const normalizedLevel = Math.max(1, Math.floor(level));
    const levelIncreases = normalizedLevel - 1;

    return {
        maxHealth: Math.round(
            archetype.baseHealth + archetype.healthPerLevel * levelIncreases,
        ),
        attack: Math.round(
            archetype.baseAttack + archetype.attackPerLevel * levelIncreases,
        ),
        defense: Math.round(
            archetype.baseDefense + archetype.defensePerLevel * levelIncreases,
        ),
        xpReward: Math.round(
            archetype.baseXpReward +
                archetype.xpRewardPerLevel * levelIncreases,
        ),
        essenceReward: Math.round(
            archetype.baseEssenceReward +
                archetype.essenceRewardPerLevel * levelIncreases,
        ),
    };
}

export function getAdventurerClassLabel(
    adventurerClass: AdventurerData["class"],
): string {
    return ADVENTURER_ARCHETYPES[adventurerClass].label;
}


export interface AdventurerResourceDrop {
    resource: DungeonResourceId;
    amount: number;
}

const ADVENTURER_DROP_WEIGHTS: Record<
    AdventurerClass,
    readonly [DungeonResourceId, number][]
> = {
    [AdventurerClass.WARRIOR]: [
        ["stone", 0.6],
        ["supplies", 0.25],
        ["essence", 0.15],
    ],
    [AdventurerClass.ROGUE]: [
        ["supplies", 0.6],
        ["stone", 0.25],
        ["essence", 0.15],
    ],
    [AdventurerClass.CLERIC]: [
        ["essence", 0.6],
        ["supplies", 0.25],
        ["stone", 0.15],
    ],
    [AdventurerClass.ARCANIST]: [
        ["essence", 0.7],
        ["stone", 0.15],
        ["supplies", 0.15],
    ],
};

/**
 * Returns the small resource bundle recovered when an adventurer is defeated.
 * Combat provides a progression floor, while resource rooms remain the reliable
 * source of sustained income.
 */
export function getAdventurerResourceDrop(
    adventurer: Pick<AdventurerData, "class" | "level">,
    random: () => number = Math.random,
): AdventurerResourceDrop {
    const weightedDrops = ADVENTURER_DROP_WEIGHTS[adventurer.class];
    const roll = Math.max(0, Math.min(0.999999, random()));
    let cumulativeWeight = 0;

    for (const [resource, weight] of weightedDrops) {
        cumulativeWeight += weight;
        if (roll < cumulativeWeight) {
            return {
                resource,
                amount: 2 + Math.max(1, Math.floor(adventurer.level)),
            };
        }
    }

    // Floating-point fallback; the configured weights should total 1.
    return {
        resource: weightedDrops[weightedDrops.length - 1][0],
        amount: 2 + Math.max(1, Math.floor(adventurer.level)),
    };
}
