import { useCallback, useEffect, useRef, useState } from "react";
import { PhaserGame, type IRefPhaserGame } from "./PhaserGame";
import type { DungeonRoom } from "./game/components/mapComponents/DungeonRoom";
import { getRoomTypeLabel } from "./game/components/mapComponents/DungeonRoom";
import { EventBus } from "./game/EventBus";
import type { RoomPopulationSnapshot, ResourceSlotType } from "./game/rooms/RoomPopulationManager";
import { DungeonScene, type RoomDetails } from "./game/scenes/DungeonScene";
import type { WaveStatus } from "./game/waves/WaveManager";

const INITIAL_STATUS: WaveStatus = {
    waveNumber: 0,
    state: "waiting",
    totalAdventurers: 0,
    remainingAdventurers: 0,
    totalParties: 0,
    remainingParties: 0,
};

function App() {
    const [wave, setWave] = useState(INITIAL_STATUS);
    const [sceneReady, setSceneReady] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<RoomDetails | null>(null);
    const [panelOpen, setPanelOpen] = useState(true);
    const phaserRef = useRef<IRefPhaserGame>(null);

    useEffect(() => {
        const handleStatus = (status: WaveStatus): void => setWave(status);
        EventBus.on("wave-status-changed", handleStatus);
        return () => {
            EventBus.off("wave-status-changed", handleStatus);
        };
    }, []);

    useEffect(() => {
        const refreshRoom = (roomId: string): void => {
            const scene = phaserRef.current?.scene;
            if (scene instanceof DungeonScene) setSelectedRoom(scene.getRoomDetails(roomId));
        };
        const handleSelected = (room: DungeonRoom): void => {
            refreshRoom(room.id);
            setPanelOpen(true);
        };
        const handlePopulation = (snapshot: RoomPopulationSnapshot): void => {
            setSelectedRoom((current) => {
                if (!current || current.room.id !== snapshot.roomId) return current;
                const scene = phaserRef.current?.scene;
                return scene instanceof DungeonScene
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
    const handleSceneReady = useCallback((): void => setSceneReady(true), []);
    const getScene = (): DungeonScene | null => {
        const scene = phaserRef.current?.scene;
        return scene instanceof DungeonScene ? scene : null;
    };

    const upgradeRoom = (slot: ResourceSlotType | "defender"): void => {
        if (selectedRoom) getScene()?.upgradeSelectedRoom(selectedRoom.room.id, slot);
    };

    return (
        <main className="game-shell-react bg-stone-950 text-stone-100">
            <section className="game-viewport border-b border-violet-300/10 lg:border-r lg:border-b-0">
                <PhaserGame ref={phaserRef} currentActiveScene={handleSceneReady} />
                <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-white/10 bg-stone-950/75 px-3 py-2 text-xs text-stone-400 backdrop-blur">
                    Drag to pan · Scroll to zoom
                </div>
            </section>

            <aside className={`command-panel relative flex shrink-0 flex-col bg-[#15111c] transition-[width] duration-200 ${panelOpen ? "is-open" : "is-closed"}`}>
                <button
                    type="button"
                    className="absolute top-3 right-3 z-20 grid size-8 place-items-center rounded-md border border-white/10 bg-white/5 text-lg text-stone-300 hover:bg-white/10 hover:text-white"
                    onClick={() => setPanelOpen((open) => !open)}
                    aria-label={panelOpen ? "Collapse interface panel" : "Expand interface panel"}
                >
                    {panelOpen ? "›" : "‹"}
                </button>

                {panelOpen && (
                    <div className="flex min-h-0 flex-1 flex-col">
                        <header className="border-b border-white/10 px-5 pt-5 pb-4 pr-14">
                            <p className="text-xs font-bold tracking-[0.18em] text-amber-300 uppercase">Dungeon command</p>
                            <div className="mt-3 flex items-end justify-between gap-3">
                                <div>
                                    <h1 className="text-xl font-bold">Wave {wave.waveNumber || "—"}</h1>
                                    <p className="mt-1 text-sm capitalize text-stone-400">{wave.state}</p>
                                </div>
                                <div className="text-right text-xs text-stone-400">
                                    <div><strong className="text-stone-200">{wave.remainingAdventurers}</strong> / {wave.totalAdventurers} adventurers</div>
                                    <div className="mt-1"><strong className="text-stone-200">{wave.remainingParties}</strong> / {wave.totalParties} parties</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={!sceneReady || waveActive}
                                onClick={() => getScene()?.startNextWave()}
                                className="mt-4 w-full rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
                            >
                                {!sceneReady ? "Loading Dungeon…" : wave.waveNumber === 0 ? "Start First Wave" : "Start Next Wave"}
                            </button>
                        </header>

                        <nav className="grid grid-cols-3 border-b border-white/10 px-3 pt-2 text-xs font-semibold">
                            <button className="border-b-2 border-amber-300 px-2 py-3 text-amber-200">Room</button>
                            <button disabled className="cursor-not-allowed px-2 py-3 text-stone-600">Denizens</button>
                            <button disabled className="cursor-not-allowed px-2 py-3 text-stone-600">Shop</button>
                        </nav>

                        <div className="min-h-0 flex-1 overflow-y-auto p-5">
                            {selectedRoom ? (
                                <RoomDetailsPanel details={selectedRoom} onUpgrade={upgradeRoom} onClose={() => setSelectedRoom(null)} />
                            ) : (
                                <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.025] p-5 text-sm text-stone-400">
                                    <h2 className="font-semibold text-stone-200">Select a room</h2>
                                    <p className="mt-2 leading-6">Click a room on the map to inspect its level, population, production, and available slot upgrades.</p>
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

interface RoomDetailsPanelProps {
    details: RoomDetails;
    onUpgrade: (slot: ResourceSlotType | "defender") => void;
    onClose: () => void;
}

function RoomDetailsPanel({ details, onUpgrade, onClose }: RoomDetailsPanelProps) {
    const { room, population } = details;
    const capacity = population?.capacity;
    return (
        <section>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold tracking-wider text-amber-300 uppercase">Selected room</p>
                    <h2 className="mt-1 text-2xl font-bold">{getRoomTypeLabel(room.type)}</h2>
                    <p className="mt-1 text-xs text-stone-500">Level {room.level} · {room.deadEnd ? "Dead end" : room.terminal ? "Final room" : "Connected room"}</p>
                </div>
                <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xl text-stone-500 hover:bg-white/5 hover:text-white" aria-label="Close room details">×</button>
            </div>

            {!population ? (
                <p className="mt-5 rounded-lg bg-white/5 p-4 text-sm text-stone-400">This room does not support assigned denizens.</p>
            ) : (
                <>
                    <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm">
                        {capacity?.kind === "resource" && <Stat label="Production" value={`${population.productionPerSecond.toFixed(1)}/sec`} />}
                        {capacity?.kind === "resource" && <Stat label="Gatherers" value={`${population.assignedGatherers}/${capacity.gatherers} · max ${capacity.maxGatherers}`} />}
                        <Stat label="Defenders" value={`${population.assignedDefenders}/${capacity?.defenders} · max ${capacity?.maxDefenders}`} />
                        {population.recoveringGatherers > 0 && <Stat label="Recovering" value={`${population.recoveringGatherers} gatherers`} warning />}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        {capacity?.kind === "resource" && <UpgradeButton disabled={capacity.gatherers >= capacity.maxGatherers} onClick={() => onUpgrade("gatherer")}>+ Gatherer slot</UpgradeButton>}
                        <UpgradeButton disabled={!capacity || capacity.defenders >= capacity.maxDefenders} onClick={() => onUpgrade("defender")}>+ Defender slot</UpgradeButton>
                    </div>
                    <h3 className="mt-6 text-sm font-bold">Denizens</h3>
                    {population.denizens.length === 0 ? (
                        <p className="mt-2 text-sm text-stone-500">No denizens assigned.</p>
                    ) : population.denizens.map((denizen) => (
                        <button key={denizen.id} type="button" className="mt-2 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-left text-sm capitalize hover:bg-white/5">
                            <span>{denizen.type} · {denizen.role}</span>
                            <span className="text-xs text-stone-500">{denizen.status}</span>
                        </button>
                    ))}
                </>
            )}
        </section>
    );
}

function Stat({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
    return <div className="flex justify-between gap-4"><span className="text-stone-400">{label}</span><strong className={warning ? "text-orange-300" : "text-stone-100"}>{value}</strong></div>;
}

function UpgradeButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
    return <button type="button" disabled={disabled} onClick={onClick} className="rounded-lg border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-300/20 disabled:cursor-not-allowed disabled:opacity-35">{children}</button>;
}
