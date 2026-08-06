import { useCallback, useEffect, useRef, useState } from "react";
import { RoomDetailsPanel } from "./game/components/RoomDetailsPanel";
import { ResourceBar } from "./game/components/ResourceBar";
import { DenizenPanel } from "./game/components/DenizenPanel";
import { PhaserGame, type IRefPhaserGame } from "./PhaserGame";
import type { DenizenType } from "./game/components/entityComponents/entityData";
import type { DungeonRoom } from "./game/components/mapComponents/DungeonRoom";
import { EventBus } from "./game/EventBus";
import type {
    DenizenRosterSnapshot,
    RoomPopulationSnapshot,
    ResourceSlotType,
} from "./game/rooms/RoomPopulationManager";
import {
    DungeonScene,
    type DenizenRoomOption,
    type DungeonProgressionSnapshot,
    type RoomDetails,
} from "./game/scenes/DungeonScene";
import type { WaveStatus } from "./game/waves/WaveManager";
import type { ResourceSnapshot } from "./game/resources/ResourceManager";
import { StatsPanel } from "./game/components/StatsPanel";

const INITIAL_STATUS: WaveStatus = {
    waveNumber: 0,
    state: "waiting",
    totalAdventurers: 0,
    remainingAdventurers: 0,
    totalParties: 0,
    remainingParties: 0,
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
    },
};

type PanelTab = "room" | "denizens" | "stats";

function App() {
    const [wave, setWave] = useState(INITIAL_STATUS);
    const [resourceState, setResourceState] = useState(INITIAL_RESOURCES);
    const [denizenRoster, setDenizenRoster] = useState(INITIAL_ROSTER);
    const [denizenRooms, setDenizenRooms] = useState<
        readonly DenizenRoomOption[]
    >([]);
    const [progression, setProgression] =
        useState<DungeonProgressionSnapshot>(INITIAL_PROGRESSION);
    const [sceneReady, setSceneReady] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<RoomDetails | null>(null);
    const [panelOpen, setPanelOpen] = useState(true);
    const phaserRef = useRef<IRefPhaserGame>(null);
    const dungeonSceneRef = useRef<DungeonScene | null>(null);
    const [activeTab, setActiveTab] = useState<PanelTab>("room");

    useEffect(() => {
        const handleStatus = (status: WaveStatus): void => setWave(status);
        EventBus.on("wave-status-changed", handleStatus);
        return () => {
            EventBus.off("wave-status-changed", handleStatus);
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
        const refreshRoom = (roomId: string): void => {
            const details =
                dungeonSceneRef.current?.getRoomDetails(roomId) ?? null;
            setSelectedRoom(details);
        };
        const handleSelected = (room: DungeonRoom): void => {
            refreshRoom(room.id);
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
        return () => {
            EventBus.off("room-selected", handleSelected);
            EventBus.off("room-population-changed", handlePopulation);
        };
    }, []);

    const waveActive = wave.state === "spawning" || wave.state === "advancing";
    const handleSceneReady = useCallback((scene: Phaser.Scene): void => {
        if (!(scene instanceof DungeonScene)) return;

        dungeonSceneRef.current = scene;
        setDenizenRoster(scene.getDenizenRoster());
        setDenizenRooms(scene.getDenizenRoomOptions());
        setProgression(scene.getDungeonProgression());
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

    const completedWaves = Math.max(0, wave.waveNumber - (waveActive ? 1 : 0));
    const expansion = progression.nextExpansion;

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
                    }}
                    expansionLocked={waveActive}
                    onExpandDungeon={() => getScene()?.expandDungeon()}
                />
                <section className="game-viewport">
                    <PhaserGame
                        ref={phaserRef}
                        currentActiveScene={handleSceneReady}
                    />
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
                    className={`absolute right-3.5 z-20 grid size-8.5 cursor-pointer place-items-center rounded-lg border border-white/10 bg-white/5 p-0 text-[22px] leading-none text-[#c8bdcd] transition hover:border-[#ddb966]/35 hover:bg-[#ddb966]/10 hover:text-[#fff7e6] ${panelOpen ? "top-3.5" : "top-1/2 -translate-y-1/2"}`}
                    onClick={() => setPanelOpen((open) => !open)}
                    aria-label={
                        panelOpen
                            ? "Collapse interface panel"
                            : "Expand interface panel"
                    }
                >
                    {panelOpen ? "›" : "‹"}
                </button>

                {panelOpen && (
                    <div className="relative z-1 flex min-h-0 flex-1 flex-col">
                        <header className="border-b border-white/8 py-5 pr-14 pl-5.5">
                            <div className="text-[11px] font-extrabold tracking-[.18em] text-[#d9b766] uppercase">
                                <span className="mr-2 text-[#8f61c8]">◆</span>{" "}
                                Dungeon command
                            </div>
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
                                        remaining={wave.remainingAdventurers}
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
                            <button
                                type="button"
                                disabled={!sceneReady || waveActive}
                                onClick={() => getScene()?.startNextWave()}
                                className="mt-4 flex w-full cursor-pointer items-center justify-between rounded-[10px] border border-[#f1cf78] bg-linear-to-br from-[#e3be64] to-[#c9953d] py-2.5 pr-3 pl-4 text-[13px] font-extrabold text-[#20170d] shadow-[0_8px_25px_rgba(180,126,38,.14),inset_0_1px_rgba(255,255,255,.35)] transition hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:border-[#37313b] disabled:bg-none disabled:bg-[#27222b] disabled:text-[#716b74] disabled:shadow-none"
                            >
                                <span>
                                    {!sceneReady
                                        ? "Loading Dungeon…"
                                        : wave.waveNumber === 0
                                          ? "Start First Wave"
                                          : "Start Next Wave"}
                                </span>
                                <b className="text-lg leading-none">→</b>
                            </button>
                        </header>

                        <nav className="grid grid-cols-4 border-b border-white/8 bg-black/15 px-3">
                            <button
                                type="button"
                                onClick={() => setActiveTab("room")}
                                className={`relative flex cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent px-1 py-3 text-[10px] font-bold ${
                                    activeTab === "room"
                                        ? "panel-tab-active text-[#e7cb89]"
                                        : "text-[#77707c]"
                                }`}
                            >
                                <span>▦</span>
                                Room
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("denizens")}
                                className={`relative flex cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent px-1 py-3 text-[10px] font-bold ${
                                    activeTab === "denizens"
                                        ? "panel-tab-active text-[#e7cb89]"
                                        : "text-[#77707c] hover:text-[#bcb2c0]"
                                }`}
                            >
                                <span>♟</span>
                                Denizens
                            </button>

                            <button
                                type="button"
                                className="flex cursor-not-allowed items-center justify-center gap-1.5 border-0 bg-transparent px-1 py-3 text-[10px] font-bold text-[#6f6874] opacity-50"
                                disabled
                            >
                                <span>◇</span>
                                Shop
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("stats")}
                                className={`relative flex cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent px-1 py-3 text-[10px] font-bold ${
                                    activeTab === "stats"
                                        ? "panel-tab-active text-[#e7cb89]"
                                        : "text-[#77707c] hover:text-[#bcb2c0]"
                                }`}
                            >
                                <span>▥</span>
                                Stats
                            </button>
                        </nav>

                        <div className="panel-content min-h-0 flex-1 overflow-y-auto p-5">
                            {activeTab === "stats" ? (
                                <StatsPanel
                                    resources={resourceState}
                                    waveActive={waveActive}
                                    completedWaves={completedWaves}
                                />
                            ) : activeTab === "denizens" ? (
                                <DenizenPanel
                                    roster={denizenRoster}
                                    rooms={denizenRooms}
                                    resources={resourceState.resources}
                                    assignmentLocked={waveActive}
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
                                    onUpgrade={upgradeRoom}
                                    onAssign={(denizenId) =>
                                        assignDenizen(
                                            denizenId,
                                            selectedRoom.room.id,
                                        )
                                    }
                                    onUnassign={unassignDenizen}
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
