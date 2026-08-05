// src/game/components/entityComponents/entityData.ts

import type { EntityId, Position, Size } from "../DungeonData";

export interface SpriteData {
    id: EntityId;
    position: Position;
    size: Size;
}

export interface EntityData extends SpriteData {
    level: number;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
}

export const AdventurerClass = {
    WARRIOR: "warrior",
    ROGUE: "rogue",
    CLERIC: "cleric",
    ARCANIST: "arcanist",
} as const;

export type AdventurerClass =
    (typeof AdventurerClass)[keyof typeof AdventurerClass];

export interface AdventurerData extends EntityData {
    class: AdventurerClass;
    partyId: EntityId;
    currentRoomId: EntityId | null;
    xpReward: number;
    essenceReward: number;
}

export enum DenizenType {
    GOBLIN = "goblin",
    ORC = "orc",
    SLIME = "slime",
    SKELETON = "skeleton",
}

export interface DenizenData extends EntityData {
    type: DenizenType;
    assignedRoomId: EntityId | null;
    experience: number;
}
