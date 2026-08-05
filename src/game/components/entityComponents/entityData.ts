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

export const DenizenRole = {
    DEFENDER: "defender",
    GATHERER: "gatherer",
} as const;

export type DenizenRole = (typeof DenizenRole)[keyof typeof DenizenRole];

export const DenizenStatus = {
    ACTIVE: "active",
    RECOVERING: "recovering",
} as const;

export type DenizenStatus = (typeof DenizenStatus)[keyof typeof DenizenStatus];

export interface DenizenData extends EntityData {
    type: DenizenType;
    role: DenizenRole;
    status: DenizenStatus;
    assignedRoomId: EntityId | null;
    experience: number;
    /** Production units contributed per second while active. */
    gatheringPower: number;
    recoveryRemainingMs: number;
}

