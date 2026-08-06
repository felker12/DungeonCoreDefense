import type { EntityId } from "../components/DungeonData";
import type {
    AdventurerClass,
    AdventurerData,
} from "../components/entityComponents/entityData";
import type { DungeonRoom } from "../components/mapComponents/DungeonRoom";
import type { AdventurerParty } from "../waves/PartyData";

export type RoomCombatOutcome = "cleared" | "defeated";

export interface PartyCombatPresentation {
    getLivingMembers(): readonly AdventurerData[];
    setFighting(active: boolean): void;
    flashAdventurer(adventurerId: EntityId): void;
    defeatAdventurer(adventurerId: EntityId): void;
}

export type RoomEncounterResolver = (
    party: AdventurerParty,
    room: DungeonRoom,
    presentation: PartyCombatPresentation,
) => Promise<RoomCombatOutcome>;

export interface RoomAttackerSnapshot {
    id: EntityId;
    partyId: EntityId;
    waveNumber: number;
    class: AdventurerClass;
    level: number;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
}

export interface RoomAttackerPartySnapshot {
    partyId: EntityId;
    waveNumber: number;
    attackers: readonly RoomAttackerSnapshot[];
}

/**
 * Live read-only view of the adventurers currently held in combat inside a room.
 * An inactive snapshot with zero attackers is emitted when the encounter ends so
 * UI consumers can remove the room from their local state.
 */
export interface RoomAttackersSnapshot {
    roomId: EntityId;
    active: boolean;
    totalAttackers: number;
    parties: readonly RoomAttackerPartySnapshot[];
}
