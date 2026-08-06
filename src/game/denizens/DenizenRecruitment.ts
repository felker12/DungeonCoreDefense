import type { DenizenData } from "../components/entityComponents/entityData";
import {
    DenizenRole,
    DenizenStatus,
    DenizenType,
} from "../components/entityComponents/entityData";

export interface DefenderOffer {
    type: DenizenType;
    name: string;
    mark: string;
    description: string;
    cost: number;
    health: number;
    attack: number;
    defense: number;
}

export const DEFENDER_OFFERS: readonly DefenderOffer[] = [
    {
        type: DenizenType.GOBLIN,
        name: "Goblin Skirmisher",
        mark: "G",
        description: "Cheap, quick muscle for filling an exposed guard room.",
        cost: 15,
        health: 55,
        attack: 12,
        defense: 4,
    },
    {
        type: DenizenType.SKELETON,
        name: "Skeleton Guard",
        mark: "S",
        description: "A dependable defender with balanced staying power.",
        cost: 25,
        health: 80,
        attack: 16,
        defense: 8,
    },
    {
        type: DenizenType.ORC,
        name: "Orc Brute",
        mark: "O",
        description: "Expensive frontline strength built to hold a chamber.",
        cost: 40,
        health: 125,
        attack: 24,
        defense: 12,
    },
] as const;

export function createDefender(offer: DefenderOffer, id: string): DenizenData {
    return {
        id,
        type: offer.type,
        role: DenizenRole.DEFENDER,
        status: DenizenStatus.ACTIVE,
        assignedRoomId: null,
        level: 1,
        health: offer.health,
        maxHealth: offer.health,
        attack: offer.attack,
        defense: offer.defense,
        experience: 0,
        gatheringPower: 0,
        recoveryRemainingMs: 0,
        position: { x: 0, y: 0 },
        size: { width: 24, height: 24 },
    };
}
