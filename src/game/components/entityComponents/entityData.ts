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

export enum AdventurerClass {
    WARRIOR = "warrior",
    ROGUE = "rogue",
    CLERIC = "cleric",
    ARCANIST = "arcanist",
}

export interface AdventurerData extends EntityData {
    class: AdventurerClass;
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
