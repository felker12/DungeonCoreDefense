import { useCallback, useEffect, useRef, useState } from "react";
import { RoomDetailsPanel } from "./game/components/RoomDetailsPanel";
import { ResourceBar } from "./game/components/ResourceBar";
import { DenizenPanel } from "./game/components/DenizenPanel";
import { PhaserGame, type IRefPhaserGame } from "./PhaserGame";
import type { DenizenType } from "./game/components/entityComponents/entityData";
import type { DungeonRoom } from "./game/components/mapComponents/DungeonRoom";
import type { CardinalDirection } from "./game/components/mapComponents/DungeonRoom";
import type { BuildableRoomType } from "./game/construction/DungeonConstruction";
import { EventBus } from "./game/EventBus";
import type { RoomAttackersSnapshot } from "./game/combat/CombatTypes";
import type {
    DenizenRosterSnapshot,
    RoomPopulationSnapshot,
    ResourceSlotType,
} from "./game/rooms/RoomPopulationManager";
import {
    DungeonScene,
    type DungeonConstructionSnapshot,
    type DenizenRoomOption,
    type DungeonProgressionSnapshot,
    type DungeonSaveOperationResult,
    type DungeonSaveStatus,
    type RoomDetails,
} from "./game/scenes/DungeonScene";
import type { WaveStatus } from "./game/waves/WaveManager";
import type { ResourceSnapshot } from "./game/resources/ResourceManager";
import { StatsPanel } from "./game/components/StatsPanel";
import { DungeonCoreStatus } from "./game/components/DungeonCoreStatus";
import { RoomAttackersPanel } from "./game/components/RoomAttackersPanel";
import type { DungeonCoreSnapshot } from "./game/core/DungeonCoreManager";

const INITIAL_STATUS: WaveStatus = {
    waveNumber: 0,
    completedWaves: 0,
    state: "waiting",
    totalAdventurers: 0,
    remainingAdventurers: 0,
    totalParties: 0,
    remainingParties: 0,
};

const INITIAL_CORE: DungeonCoreSnapshot = {
    health: 300,
    maxHealth: 300,
    defense: 5,
    state: "stable",
    raidStartHealth: null,
    regenerationPerSecond: 0.75,
    regenerationCap: 180,
    regenerationCapPercent: 0.6,
    retryHealth: null,
    lastDamage: 0,
    lastAttackerCount: 0,
};

const INITIAL_RESOURCES: ResourceSnapshot = {
    resources: {
        essence: { id: "essence", value: 148, capacity: 250 },
        stone: { id: "stone", value: 72, capacity: 150 },
        supplies: { id: "supplies", value: 34, capacity: 100 },
    },
    incomePerSecond: {
        essence: 0,
        stone: 0,
        supplies: 0,
    },
    totalEarned: {
        essence: 0,
        stone: 0,
        supplies: 0,
    },
};

const INITIAL_ROSTER: DenizenRosterSnapshot = {
    denizens: [],
    capacity: 8,
};

const INITIAL_PROGRESSION: DungeonProgressionSnapshot = {
    level: 1,
    nextExpansion: {
        level: 2,
        waveRequired: 3,
        costs: [
            { resource: "stone", amount: 150 },
            { resource: "essence", amount: 50 },
        ],
        denizenCapacityReward: 2,
        coreHealthReward: 75,
        resourceCapacityRewards: {
            essence: 75,
            stone: 50,
            supplies: 25,
        },
    },
};

const INITIAL_SAVE_STATUS: DungeonSaveStatus = {
    hasSave: false,
    lastSavedAt: null,
    canSave: false,
};

type PanelTab = "room" | "denizens" | "stats";

function App() {
    const [wave, setWave] = useState(INITIAL_STATUS);
    const [core, setCore] = useState(INITIAL_CORE);
    const [resourceState, setResourceState] = useState(INITIAL_RESOURCES);
    const [denizenRoster, setDenizenRoster] = useState(INITIAL_ROSTER);
    const [denizenRooms, setDenizenRooms] = useState<
        readonly DenizenRoomOption[]
    >([]);
    const [progression, setProgression] =
        useState<DungeonProgressionSnapshot>(INITIAL_PROGRESSION);
    const [sceneReady, setSceneReady] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<RoomDetails | null>(null);
    const [construction, setConstruction] =
        useState<DungeonConstructionSnapshot | null>(null);
    const [panelOpen, setPanelOpen] = useState(true);
    const phaserRef = useRef<IRefPhaserGame>(null);
    const dungeonSceneRef = useRef<DungeonScene | null>(null);
    const [activeTab, setActiveTab] = useState<PanelTab>("room");
    const [mobileRaidOpen, setMobileRaidOpen] = useState(false);
    const [saveStatus, setSaveStatus] =
        useState<DungeonSaveStatus>(INITIAL_SAVE_STATUS);
    const [focusedDenizenId, setFocusedDenizenId] = useState<string | null>(
        null,
    );
    const [roomAttackers, setRoomAttackers] = useState<
        Record<string, RoomAttackersSnapshot>
    >({});
    const [dismissedAttackerRoomId, setDismissedAttackerRoomId] = useState<
        string | null
    >(null);

    useEffect(() => {
        const handleStatus = (status: WaveStatus): void => setWave(status);
        EventBus.on("wave-status-changed", handleStatus);
        return () => {
            EventBus.off("wave-status-changed", handleStatus);
        };
    }, []);

    useEffect(() => {
        const handleCore = (snapshot: DungeonCoreSnapshot): void =>
            setCore(snapshot);
        EventBus.on("dungeon-core-changed", handleCore);
        return () => {
            EventBus.off("dungeon-core-changed", handleCore);
        };
    }, []);

    useEffect(() => {
        const handleRoster = (snapshot: DenizenRosterSnapshot): void => {
            setDenizenRoster(snapshot);
            setDenizenRooms(
                dungeonSceneRef.current?.getDenizenRoomOptions() ?? [],
            );
        };

        EventBus.on("denizen-roster-changed", handleRoster);

        return () => {
            EventBus.off("denizen-roster-changed", handleRoster);
        };
    }, []);

    useEffect(() => {
        const handleProgression = (
            snapshot: DungeonProgressionSnapshot,
        ): void => setProgression(snapshot);

        EventBus.on("dungeon-progression-changed", handleProgression);
        return () => {
            EventBus.off("dungeon-progression-changed", handleProgression);
        };
    }, []);

    useEffect(() => {
        const handleResources = (snapshot: ResourceSnapshot): void =>
            setResourceState(snapshot);
        EventBus.on("resources-changed", handleResources);
        return () => {
            EventBus.off("resources-changed", handleResources);
        };
    }, []);

    useEffect(() => {
        const handleSaveStatus = (status: DungeonSaveStatus): void =>
            setSaveStatus(status);
        EventBus.on("dungeon-save-changed", handleSaveStatus);
        return () => {
            EventBus.off("dungeon-save-changed", handleSaveStatus);
        };
    }, []);

    useEffect(() => {
        const handleRoomAttackers = (snapshot: RoomAttackersSnapshot): void => {
            setRoomAttackers((current) => {
                if (!snapshot.active || snapshot.totalAttackers === 0) {
                    if (!(snapshot.roomId in current)) return current;
                    const next = { ...current };
                    delete next[snapshot.roomId];
                    return next;
                }

                return { ...current, [snapshot.roomId]: snapshot };
            });
        };

        EventBus.on("room-attackers-changed", handleRoomAttackers);
        return () => {
            EventBus.off("room-attackers-changed", handleRoomAttackers);
        };
    }, []);

    useEffect(() => {
        const handleDenizenSelected = (payload: {
            denizenId: string;
            roomId: string;
        }): void => {
            setFocusedDenizenId(payload.denizenId);
            setPanelOpen(true);
            setActiveTab("denizens");
        };

        EventBus.on("denizen-selected", handleDenizenSelected);
        return () => {
            EventBus.off("denizen-selected", handleDenizenSelected);
        };
    }, []);

    useEffect(() => {
        const refreshRoom = (roomId: string): void => {
            const details =
                dungeonSceneRef.current?.getRoomDetails(roomId) ?? null;
            setSelectedRoom(details);
        };
        const handleSelected = (room: DungeonRoom): void => {
            refreshRoom(room.id);
            setConstruction(
                dungeonSceneRef.current?.getRoomConstructionSnapshot(room.id) ??
                    null,
            );
            const attackers =
                dungeonSceneRef.current?.getRoomAttackers(room.id) ?? null;
            if (attackers?.active && attackers.totalAttackers > 0) {
                setRoomAttackers((current) => ({
                    ...current,
                    [room.id]: attackers,
                }));
            }
            setDismissedAttackerRoomId(null);
            setPanelOpen(true);
            setActiveTab("room");
        };
        const handlePopulation = (snapshot: RoomPopulationSnapshot): void => {
            setDenizenRooms(
                dungeonSceneRef.current?.getDenizenRoomOptions() ?? [],
            );
            setSelectedRoom((current) => {
                if (!current || current.room.id !== snapshot.roomId)
                    return current;
                const scene = dungeonSceneRef.current;
                return scene
                    ? scene.getRoomDetails(snapshot.roomId)
                    : { room: { ...current.room }, population: snapshot };
            });
        };
        EventBus.on("room-selected", handleSelected);
        EventBus.on("room-population-changed", handlePopulation);
        const handleConstruction = (
            snapshot: DungeonConstructionSnapshot | null,
        ): void => {
            setConstruction((current) => {
                const roomId =
                    snapshot?.selectedRoomId ?? current?.selectedRoomId;
                return roomId
                    ? (dungeonSceneRef.current?.getRoomConstructionSnapshot(
                          roomId,
                      ) ?? null)
                    : null;
            });
            setSelectedRoom((current) =>
                current
                    ? (dungeonSceneRef.current?.getRoomDetails(
                          current.room.id,
                      ) ?? current)
                    : current,
            );
            setDenizenRooms(
                dungeonSceneRef.current?.getDenizenRoomOptions() ?? [],
            );
        };
        EventBus.on("dungeon-construction-changed", handleConstruction);
        return () => {
            EventBus.off("room-selected", handleSelected);
            EventBus.off("room-population-changed", handlePopulation);
            EventBus.off("dungeon-construction-changed", handleConstruction);
        };
    }, []);

    const waveActive = wave.state === "spawning" || wave.state === "advancing";
    const waveFailed = wave.state === "failed";
    const handleSceneReady = useCallback((scene: Phaser.Scene): void => {
        if (!(scene instanceof DungeonScene)) return;

        dungeonSceneRef.current = scene;
        setWave(scene.getWaveStatus());
        setCore(scene.getDungeonCoreStatus());
        setDenizenRoster(scene.getDenizenRoster());
        setDenizenRooms(scene.getDenizenRoomOptions());
        setProgression(scene.getDungeonProgression());
        setSaveStatus(scene.getSaveStatus());
        setSelectedRoom(null);
        setConstruction(null);
        setFocusedDenizenId(null);
        setRoomAttackers({});
        setDismissedAttackerRoomId(null);
        setSceneReady(true);
    }, []);
    const getScene = (): DungeonScene | null => dungeonSceneRef.current;

    const upgradeRoom = (slot: ResourceSlotType | "defender"): void => {
        if (selectedRoom)
            getScene()?.upgradeSelectedRoom(selectedRoom.room.id, slot);
    };

    const recruitDenizen = (type: DenizenType): boolean =>
        getScene()?.recruitDenizen(type) ?? false;

    const assignDenizen = (denizenId: string, roomId: string): boolean =>
        !waveActive &&
        (getScene()?.assignDenizenToRoom(denizenId, roomId) ?? false);

    const unassignDenizen = (denizenId: string): boolean =>
        !waveActive && (getScene()?.unassignDenizen(denizenId) ?? false);

    const buildRoom = (
        roomType: BuildableRoomType,
        direction: CardinalDirection,
    ): boolean =>
        Boolean(
            selectedRoom &&
            !waveActive &&
            getScene()?.buildRoom(selectedRoom.room.id, roomType, direction),
        );

    const addConnection = (roomId: string): boolean =>
        Boolean(
            selectedRoom &&
            !waveActive &&
            getScene()?.addConnectionBetweenRooms(selectedRoom.room.id, roomId),
        );

    const removeConnection = (connectionId: string): boolean =>
        !waveActive && (getScene()?.removeConnection(connectionId) ?? false);

    const moveCore = (): boolean =>
        Boolean(
            selectedRoom &&
            !waveActive &&
            getScene()?.moveCoreToRoom(selectedRoom.room.id),
        );

    const saveGame = (): boolean => getScene()?.saveGame() ?? false;

    const exportSave = (): string | null =>
        getScene()?.exportSavedGame() ?? null;

    const importSave = (serializedSave: string): DungeonSaveOperationResult =>
        getScene()?.importSavedGame(serializedSave) ?? {
            success: false,
            message: "The dungeon scene is not ready.",
        };

    const resetSave = (): boolean =>
        getScene()?.resetSavedGame() ?? false;

    const completedWaves = wave.completedWaves;
    const expansion = progression.nextExpansion;

    const runWaveAction = (): void => {
        if (waveFailed) {
            getScene()?.retryCurrentWave();
            return;
        }

        getScene()?.startNextWave();
    };

    const waveActionLabel = !sceneReady
        ? "Loading…"
        : waveFailed
          ? `Retry Wave ${wave.waveNumber}`
          : wave.waveNumber === 0
            ? "Start First Wave"
            : "Start Next Wave";

    const compactWaveActionLabel = !sceneReady
        ? "Loading"
        : waveFailed
          ? "Retry Wave"
          : wave.waveNumber === 0
            ? "Start Wave"
            : "Next Wave";

    const selectedRoomAttackers = selectedRoom
        ? (roomAttackers[selectedRoom.room.id] ?? null)
        : null;
    const showSelectedRoomAttackers = Boolean(
        selectedRoom &&
            selectedRoomAttackers?.active &&
            selectedRoomAttackers.totalAttackers > 0 &&
            dismissedAttackerRoomId !== selectedRoom.room.id,
    );

    return (
        <main className="game-shell-react">
            <div className="map-column">
                <ResourceBar
                    resources={[
                        {
                            ...resourceState.resources.essence,
                            label: "Essence",
                            icon: "✦",
                            tone: "violet",
                        },
                        {
                            ...resourceState.resources.stone,
                            label: "Stone",
                            icon: "◆",
                            tone: "slate",
                        },
                        {
                            ...resourceState.resources.supplies,
                            label: "Supplies",
                            icon: "●",
                            tone: "amber",
                        },
                    ]}
                    denizens={{
                        current: denizenRoster.denizens.length,
                        capacity: denizenRoster.capacity,
                    }}
                    dungeonPower={1240}
                    dungeonLevel={progression.level}
                    nextLevel={{
                        waveRequired: expansion.waveRequired,
                        waveDefeated: completedWaves >= expansion.waveRequired,
                        costs: expansion.costs.map((cost) => ({
                            resource:
                                cost.resource.charAt(0).toUpperCase() +
                                cost.resource.slice(1),
                            current:
                                resourceState.resources[cost.resource].value,
                            required: cost.amount,
                        })),
                        denizenCapacityReward: expansion.denizenCapacityReward,
                        coreHealthReward: expansion.coreHealthReward,
                        resourceCapacityRewards:
                            expansion.resourceCapacityRewards,
                    }}
                    expansionLocked={waveActive}
                    onExpandDungeon={() => getScene()?.expandDungeon()}
                />
                <section className="game-viewport">
                    <PhaserGame
                        ref={phaserRef}
                        currentActiveScene={handleSceneReady}
                    />
                    {showSelectedRoomAttackers &&
                        selectedRoom &&
                        selectedRoomAttackers && (
                            <RoomAttackersPanel
                                roomName={selectedRoom.room.name}
                                snapshot={selectedRoomAttackers}
                                onClose={() =>
                                    setDismissedAttackerRoomId(
                                        selectedRoom.room.id,
                                    )
                                }
                            />
                        )}
                    <div className="pointer-events-none absolute bottom-3.5 left-3.5 z-5 flex items-center gap-2 rounded-lg border border-white/8 bg-[#0d0a11]/70 px-3 py-2 text-[10px] text-[#99919e] backdrop-blur-sm">
                        <span className="text-[#b991d1]">✥</span> Drag to pan{" "}
                        <i className="h-3 w-px bg-white/15" /> Scroll to zoom
                    </div>
                </section>
            </div>

            <aside
                className={`command-panel relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-[#dab76c]/15 text-[#eee9df] shadow-[-18px_0_50px_rgba(0,0,0,.28)] ${panelOpen ? "is-open" : "is-closed"}`}
            >
                <button
                    type="button"
                    className={`command-panel-toggle absolute right-3.5 z-20 grid size-8.5 cursor-pointer place-items-center rounded-lg border border-white/10 bg-white/5 p-0 text-[22px] leading-none text-[#c8bdcd] transition hover:border-[#ddb966]/35 hover:bg-[#ddb966]/10 hover:text-[#fff7e6] ${panelOpen ? "top-3.5" : "top-1/2 -translate-y-1/2"}`}
                    onClick={() => setPanelOpen((open) => !open)}
                    aria-label={
                        panelOpen
                            ? "Collapse interface panel"
                            : "Expand interface panel"
                    }
                >
                    <span
                        className="command-panel-chevron"
                        aria-hidden="true"
                    />
                </button>

                {panelOpen && (
                    <div className="command-panel-inner relative z-1 flex min-h-0 flex-1 flex-col">
                        <header className="command-panel-header border-b border-white/8 py-5 pr-14 pl-5.5">
                            <div className="command-panel-heading-row">
                                <div className="flex min-w-0 items-center gap-2 text-[11px] font-extrabold tracking-[.18em] text-[#d9b766] uppercase">
                                    <span className="shrink-0 text-[#8f61c8]">
                                        ◆
                                    </span>
                                    <span className="truncate">Dungeon command</span>
                                    <span
                                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[8px] tracking-[.06em] ${saveStatus.hasSave ? "border-[#6f9f73]/28 bg-[#6f9f73]/9 text-[#91c796]" : "border-white/8 bg-white/3 text-[#716a75]"}`}
                                        title={
                                            saveStatus.lastSavedAt
                                                ? `Saved ${new Date(saveStatus.lastSavedAt).toLocaleString()}`
                                                : "No local save has been created yet"
                                        }
                                    >
                                        <i
                                            className={`size-1.5 rounded-full ${saveStatus.hasSave ? "bg-[#7fbd85] shadow-[0_0_7px_rgba(127,189,133,.65)]" : "bg-[#5d5661]"}`}
                                        />
                                        {saveStatus.hasSave ? "Saved" : "No save"}
                                    </span>
                                </div>

                                <div className="mobile-command-actions">
                                    {!mobileRaidOpen && (
                                        <button
                                            type="button"
                                            className="mobile-wave-action"
                                            disabled={!sceneReady || waveActive}
                                            onClick={runWaveAction}
                                            aria-label={waveActionLabel}
                                        >
                                            <span>
                                                {compactWaveActionLabel}
                                            </span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        className="mobile-raid-toggle"
                                        onClick={() =>
                                            setMobileRaidOpen((open) => !open)
                                        }
                                        aria-expanded={mobileRaidOpen}
                                        aria-controls="mobile-raid-controls"
                                    >
                                        <span className="mobile-raid-summary">
                                            <strong>
                                                Wave {wave.waveNumber || "—"}
                                            </strong>
                                            <span>
                                                Core {Math.ceil(core.health)}/
                                                {core.maxHealth}
                                            </span>
                                        </span>
                                        <span
                                            className="mobile-raid-chevron"
                                            aria-hidden="true"
                                        />
                                    </button>
                                </div>
                            </div>

                            <div
                                id="mobile-raid-controls"
                                className={`command-panel-raid-details ${mobileRaidOpen ? "is-open" : ""}`}
                            >
                                <div className="mt-4 flex items-end justify-between gap-4.5">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`status-orb size-2.5 shrink-0 rounded-full border-2 border-[#5d5264] bg-[#27212d] status-${wave.state}`}
                                        />
                                        <div>
                                            <h1 className="m-0 font-serif text-[25px] leading-none tracking-tight text-[#fbf7ee]">
                                                Wave {wave.waveNumber || "—"}
                                            </h1>
                                            <p className="mt-1.5 mb-0 text-xs text-[#908796] capitalize">
                                                {wave.state}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Metric
                                            remaining={
                                                wave.remainingAdventurers
                                            }
                                            total={wave.totalAdventurers}
                                            label="Adventurers"
                                        />
                                        <Metric
                                            remaining={wave.remainingParties}
                                            total={wave.totalParties}
                                            label="Parties"
                                        />
                                    </div>
                                </div>
                                <DungeonCoreStatus
                                    core={core}
                                    raidActive={waveActive}
                                />
                                <button
                                    type="button"
                                    disabled={!sceneReady || waveActive}
                                    onClick={runWaveAction}
                                    className="mt-4 flex w-full cursor-pointer items-center justify-between rounded-[10px] border border-[#f1cf78] bg-linear-to-br from-[#e3be64] to-[#c9953d] py-2.5 pr-3 pl-4 text-[13px] font-extrabold text-[#20170d] shadow-[0_8px_25px_rgba(180,126,38,.14),inset_0_1px_rgba(255,255,255,.35)] transition hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:border-[#37313b] disabled:bg-none disabled:bg-[#27222b] disabled:text-[#716b74] disabled:shadow-none"
                                >
                                    <span>{waveActionLabel}</span>
                                </button>
                            </div>
                        </header>

                        <nav className="command-tabs grid grid-cols-4 border-b border-white/8 bg-black/15 px-3">
                            <button
                                type="button"
                                onClick={() => setActiveTab("room")}
                                className={`command-tab relative flex cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent px-1 py-3 text-[10px] font-bold ${
                                    activeTab === "room"
                                        ? "panel-tab-active text-[#e7cb89]"
                                        : "text-[#77707c]"
                                }`}
                            >
                                <span className="command-tab-icon">▦</span>
                                <span>Room</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("denizens")}
                                className={`command-tab relative flex cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent px-1 py-3 text-[10px] font-bold ${
                                    activeTab === "denizens"
                                        ? "panel-tab-active text-[#e7cb89]"
                                        : "text-[#77707c] hover:text-[#bcb2c0]"
                                }`}
                            >
                                <span className="command-tab-icon">♟</span>
                                <span>Denizens</span>
                            </button>

                            <button
                                type="button"
                                className="command-tab flex cursor-not-allowed items-center justify-center gap-1.5 border-0 bg-transparent px-1 py-3 text-[10px] font-bold text-[#6f6874] opacity-50"
                                disabled
                            >
                                <span className="command-tab-icon">◇</span>
                                <span>Shop</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("stats")}
                                className={`command-tab relative flex cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent px-1 py-3 text-[10px] font-bold ${
                                    activeTab === "stats"
                                        ? "panel-tab-active text-[#e7cb89]"
                                        : "text-[#77707c] hover:text-[#bcb2c0]"
                                }`}
                            >
                                <span className="command-tab-icon">▥</span>
                                <span>Stats</span>
                            </button>
                        </nav>

                        <div className="panel-content min-h-0 flex-1 overflow-y-auto p-5">
                            {activeTab === "stats" ? (
                                <StatsPanel
                                    resources={resourceState}
                                    waveActive={waveActive}
                                    completedWaves={completedWaves}
                                    saveStatus={saveStatus}
                                    onSave={saveGame}
                                    onExportSave={exportSave}
                                    onImportSave={importSave}
                                    onResetSave={resetSave}
                                />
                            ) : activeTab === "denizens" ? (
                                <DenizenPanel
                                    roster={denizenRoster}
                                    rooms={denizenRooms}
                                    resources={resourceState.resources}
                                    assignmentLocked={waveActive}
                                    focusedDenizenId={focusedDenizenId}
                                    onRecruit={recruitDenizen}
                                    onAssign={assignDenizen}
                                    onUnassign={unassignDenizen}
                                />
                            ) : selectedRoom ? (
                                <RoomDetailsPanel
                                    details={selectedRoom}
                                    roster={denizenRoster}
                                    resources={resourceState.resources}
                                    assignmentLocked={waveActive}
                                    construction={construction}
                                    onUpgrade={upgradeRoom}
                                    onAssign={(denizenId) =>
                                        assignDenizen(
                                            denizenId,
                                            selectedRoom.room.id,
                                        )
                                    }
                                    onUnassign={unassignDenizen}
                                    onBuildRoom={buildRoom}
                                    onAddConnection={addConnection}
                                    onRemoveConnection={removeConnection}
                                    onMoveCore={moveCore}
                                    onClose={() => setSelectedRoom(null)}
                                />
                            ) : (
                                <div className="rounded-2xl border border-[#ddb966]/15 bg-linear-to-br from-white/4 to-white/1 p-6 text-center shadow-[inset_0_1px_rgba(255,255,255,.025)]">
                                    <div className="empty-room-icon mx-auto mb-5 grid size-16 place-items-center rounded-[18px] border border-[#c99b43]/30 bg-[radial-gradient(circle,rgba(161,107,45,.18),rgba(92,56,116,.09))] text-[29px] text-[#c5a45d]">
                                        <span>⌗</span>
                                    </div>

                                    <p className="m-0 text-[9px] font-extrabold tracking-[.18em] text-[#d9b766] uppercase">
                                        Room inspection
                                    </p>

                                    <h2 className="my-2 font-serif text-[22px] text-[#f5efe4]">
                                        Select a room
                                    </h2>

                                    <p className="mx-auto max-w-71.25 text-xs leading-relaxed text-[#948b99]">
                                        Click a room on the map to inspect its
                                        level, population, production, and
                                        available slot upgrades.
                                    </p>

                                    <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/7 bg-black/15 px-2.5 py-1.5 text-[9px] text-[#7e7484]">
                                        <span className="text-[#a979c6]">
                                            ✦
                                        </span>
                                        Choose any colored chamber
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </aside>
        </main>
    );
}

export default App;

function Metric({
    remaining,
    total,
    label,
}: {
    remaining: number;
    total: number;
    label: string;
}) {
    return (
        <div className="grid min-w-17 grid-cols-[auto_auto] items-baseline rounded-lg border border-white/8 bg-white/4 px-2 py-1.5">
            <strong className="text-base text-[#fff7e8]">{remaining}</strong>
            <span className="ml-1 text-[9px] text-[#716a76]">of {total}</span>
            <small className="col-span-2 mt-0.5 text-[8px] font-bold tracking-[.08em] text-[#9c929f] uppercase">
                {label}
            </small>
        </div>
    );
}
