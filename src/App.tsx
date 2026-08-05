import { useCallback, useEffect, useRef, useState } from "react";
import { PhaserGame, type IRefPhaserGame } from "./PhaserGame";
import { EventBus } from "./game/EventBus";
import { DungeonScene } from "./game/scenes/DungeonScene";
import type { WaveStatus } from "./game/waves/WaveManager";
import type { DungeonRoom } from "./game/components/mapComponents/DungeonRoom";
import { getRoomTypeLabel } from "./game/components/mapComponents/DungeonRoom";
import type { RoomDetails } from "./game/scenes/DungeonScene";
import type { RoomPopulationSnapshot, ResourceSlotType } from "./game/rooms/RoomPopulationManager";

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
        const handleSelected = (room: DungeonRoom): void => refreshRoom(room.id);
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

    const startNextWave = (): void => {
        const scene = phaserRef.current?.scene;
        if (scene instanceof DungeonScene) scene.startNextWave();
    };

    const upgradeRoom = (slot: ResourceSlotType | "defender"): void => {
        const scene = phaserRef.current?.scene;
        if (!(scene instanceof DungeonScene) || !selectedRoom) return;
        scene.upgradeSelectedRoom(selectedRoom.room.id, slot);
    };

    return (
        <main id="app" style={{ position: "relative", width: "100vw", height: "100vh" }}>
            <PhaserGame ref={phaserRef} currentActiveScene={handleSceneReady} />
            <section
                style={{
                    position: "absolute",
                    left: 18,
                    top: 18,
                    zIndex: 20,
                    minWidth: 220,
                    padding: 16,
                    border: "1px solid #6d5c7d",
                    borderRadius: 12,
                    color: "#fff",
                    background: "rgba(20, 16, 27, 0.92)",
                    fontFamily: "Arial, sans-serif",
                }}
            >
                <strong>Wave {wave.waveNumber || "—"}</strong>
                <div style={{ margin: "8px 0 12px", color: "#d6cadd" }}>
                    {wave.state} · {wave.remainingAdventurers}/{wave.totalAdventurers} remaining
                </div>
                <div style={{ margin: "-6px 0 12px", color: "#a99bb2", fontSize: 14 }}>
                    {wave.remainingParties}/{wave.totalParties} parties remaining
                </div>
                <button
                    type="button"
                    disabled={!sceneReady || waveActive}
                    onClick={startNextWave}
                    style={{
                        width: "100%",
                        padding: "9px 12px",
                        border: 0,
                        borderRadius: 8,
                        color: "#17111e",
                        background: !sceneReady || waveActive ? "#766d7d" : "#ffd166",
                        cursor: !sceneReady || waveActive ? "not-allowed" : "pointer",
                        fontWeight: 700,
                    }}
                >
                    {!sceneReady
                        ? "Loading Dungeon…"
                        : wave.waveNumber === 0
                          ? "Start First Wave"
                          : "Start Next Wave"}
                </button>
            </section>
            {selectedRoom && (
                <RoomDetailsPanel details={selectedRoom} onUpgrade={upgradeRoom} onClose={() => setSelectedRoom(null)} />
            )}
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
        <aside style={{ position: "absolute", right: 18, top: 18, zIndex: 20, width: 300, padding: 18, border: "1px solid #6d5c7d", borderRadius: 12, color: "#fff", background: "rgba(20, 16, 27, 0.95)", fontFamily: "Arial, sans-serif" }}>
            <button type="button" onClick={onClose} aria-label="Close room details" style={{ position: "absolute", right: 12, top: 10, border: 0, color: "#d6cadd", background: "transparent", cursor: "pointer", fontSize: 20 }}>×</button>
            <div style={{ color: "#ffd166", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Selected room</div>
            <h2 style={{ margin: "5px 0 2px", fontSize: 22 }}>{getRoomTypeLabel(room.type)}</h2>
            <div style={{ color: "#a99bb2", fontSize: 13 }}>Level {room.level} · {room.deadEnd ? "Dead end" : room.terminal ? "Final room" : "Connected room"}</div>
            {!population ? (
                <p style={{ color: "#d6cadd" }}>This room does not support assigned denizens.</p>
            ) : (
                <>
                    <div style={{ marginTop: 16, padding: 12, borderRadius: 9, background: "rgba(255,255,255,0.05)" }}>
                        {capacity?.kind === "resource" && <div>Production: <strong>{population.productionPerSecond.toFixed(1)}/sec</strong></div>}
                        {capacity?.kind === "resource" && <div style={{ marginTop: 7 }}>Gatherers: {population.assignedGatherers}/{capacity.gatherers} <span style={{ color: "#8e8495" }}>(max {capacity.maxGatherers})</span></div>}
                        <div style={{ marginTop: 7 }}>Defenders: {population.assignedDefenders}/{capacity?.defenders} <span style={{ color: "#8e8495" }}>(max {capacity?.maxDefenders})</span></div>
                        {population.recoveringGatherers > 0 && <div style={{ marginTop: 7, color: "#f2b36b" }}>Recovering gatherers: {population.recoveringGatherers}</div>}
                    </div>
                    <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                        {capacity?.kind === "resource" && <button type="button" disabled={capacity.gatherers >= capacity.maxGatherers} onClick={() => onUpgrade("gatherer")} style={panelButtonStyle}>+ Gatherer slot</button>}
                        <button type="button" disabled={!capacity || capacity.defenders >= capacity.maxDefenders} onClick={() => onUpgrade("defender")} style={panelButtonStyle}>+ Defender slot</button>
                    </div>
                    <h3 style={{ margin: "18px 0 8px", fontSize: 14 }}>Denizens</h3>
                    {population.denizens.length === 0 ? <div style={{ color: "#8e8495", fontSize: 13 }}>No denizens assigned.</div> : population.denizens.map((denizen) => <div key={denizen.id} style={{ marginTop: 6, textTransform: "capitalize" }}>{denizen.type} · {denizen.role} · {denizen.status}</div>)}
                </>
            )}
        </aside>
    );
}

const panelButtonStyle: React.CSSProperties = { flex: 1, padding: "8px", border: "1px solid #766782", borderRadius: 7, color: "#fff", background: "#44344f", cursor: "pointer", fontSize: 12, fontWeight: 700 };
