import {
    AdventurerClass,
    type AdventurerData,
} from "../components/entityComponents/entityData";

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
