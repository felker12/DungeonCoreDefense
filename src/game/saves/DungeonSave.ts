import type { DungeonMap } from "../components/mapComponents/DungeonMap";
import type { DungeonCorePersistentState } from "../core/DungeonCoreManager";
import type { ResourceManagerState } from "../resources/ResourceManager";
import type { RoomPopulationState } from "../rooms/RoomPopulationManager";

export const DUNGEON_SAVE_VERSION = 1 as const;
export const DUNGEON_SAVE_STORAGE_KEY = "dungeon-core-defense.save.v1";

export interface DungeonSaveCounters {
    nextDenizenId: number;
    nextRoomId: number;
    nextConnectionId: number;
}

export interface DungeonSaveData {
    version: typeof DUNGEON_SAVE_VERSION;
    savedAt: string;
    dungeon: DungeonMap;
    dungeonLevel: number;
    completedWaves: number;
    resources: ResourceManagerState;
    roomPopulation: RoomPopulationState;
    core: DungeonCorePersistentState;
    counters: DungeonSaveCounters;
}

export type DungeonSavePayload = Omit<
    DungeonSaveData,
    "version" | "savedAt"
>;

export type DungeonSaveParseResult =
    | { success: true; save: DungeonSaveData }
    | { success: false; message: string };

export function loadDungeonSave(): DungeonSaveData | null {
    const storage = getStorage();
    if (!storage) return null;

    try {
        const raw = storage.getItem(DUNGEON_SAVE_STORAGE_KEY);
        if (!raw) return null;

        const parsed = parseDungeonSave(raw);
        if (parsed.success) return parsed.save;

        storage.removeItem(DUNGEON_SAVE_STORAGE_KEY);
        return null;
    } catch (error) {
        console.warn("Unable to read the dungeon save.", error);
        return null;
    }
}

export function saveDungeonGame(
    payload: DungeonSavePayload,
): DungeonSaveData | null {
    return writeDungeonSave({
        version: DUNGEON_SAVE_VERSION,
        savedAt: new Date().toISOString(),
        ...payload,
    });
}

export function exportDungeonSave(): string | null {
    const save = loadDungeonSave();
    return save ? JSON.stringify(save, null, 2) : null;
}

export function parseDungeonSave(raw: string): DungeonSaveParseResult {
    try {
        const parsed: unknown = JSON.parse(raw);

        if (
            isRecord(parsed) &&
            "version" in parsed &&
            parsed.version !== DUNGEON_SAVE_VERSION
        ) {
            return {
                success: false,
                message: `This save uses unsupported version ${String(parsed.version)}.`,
            };
        }

        if (!isDungeonSaveData(parsed)) {
            return {
                success: false,
                message: "The selected file is not a valid dungeon save.",
            };
        }

        return { success: true, save: parsed };
    } catch {
        return {
            success: false,
            message: "The selected file does not contain valid JSON.",
        };
    }
}

export function replaceDungeonSave(
    importedSave: DungeonSaveData,
): DungeonSaveData | null {
    return writeDungeonSave({
        ...importedSave,
        version: DUNGEON_SAVE_VERSION,
        savedAt: new Date().toISOString(),
    });
}

export function clearDungeonSave(): boolean {
    const storage = getStorage();
    if (!storage) return false;

    try {
        storage.removeItem(DUNGEON_SAVE_STORAGE_KEY);
        return true;
    } catch (error) {
        console.warn("Unable to clear the dungeon save.", error);
        return false;
    }
}

function writeDungeonSave(save: DungeonSaveData): DungeonSaveData | null {
    const storage = getStorage();
    if (!storage) return null;

    try {
        storage.setItem(DUNGEON_SAVE_STORAGE_KEY, JSON.stringify(save));
        return save;
    } catch (error) {
        console.warn("Unable to write the dungeon save.", error);
        return null;
    }
}

function getStorage(): Storage | null {
    if (typeof window === "undefined") return null;

    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function isDungeonSaveData(value: unknown): value is DungeonSaveData {
    if (!isRecord(value) || value.version !== DUNGEON_SAVE_VERSION) {
        return false;
    }

    if (
        typeof value.savedAt !== "string" ||
        !isPositiveInteger(value.dungeonLevel) ||
        !isNonNegativeInteger(value.completedWaves) ||
        !isRecord(value.dungeon) ||
        !Array.isArray(value.dungeon.rooms) ||
        !Array.isArray(value.dungeon.connections) ||
        !isRecord(value.resources) ||
        !isRecord(value.roomPopulation) ||
        !isRecord(value.core) ||
        !isRecord(value.counters)
    ) {
        return false;
    }

    return (
        isPositiveInteger(value.counters.nextDenizenId) &&
        isPositiveInteger(value.counters.nextRoomId) &&
        isPositiveInteger(value.counters.nextConnectionId)
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
    return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
    return Number.isInteger(value) && Number(value) >= 0;
}
