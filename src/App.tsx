import { useCallback, useEffect, useRef, useState } from "react";
import { PhaserGame, type IRefPhaserGame } from "./PhaserGame";
import type { DungeonRoom } from "./game/components/mapComponents/DungeonRoom";
import { getRoomTypeLabel } from "./game/components/mapComponents/DungeonRoom";
import { EventBus } from "./game/EventBus";
import type {
    RoomPopulationSnapshot,
    ResourceSlotType,
} from "./game/rooms/RoomPopulationManager";
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
    const dungeonSceneRef = useRef<DungeonScene | null>(null);

    useEffect(() => {
        const handleStatus = (status: WaveStatus): void => setWave(status);
        EventBus.on("wave-status-changed", handleStatus);
        return () => {
            EventBus.off("wave-status-changed", handleStatus);
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
        };
        const handlePopulation = (snapshot: RoomPopulationSnapshot): void => {
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
        setSceneReady(true);
    }, []);
    const getScene = (): DungeonScene | null => dungeonSceneRef.current;

    const upgradeRoom = (slot: ResourceSlotType | "defender"): void => {
        if (selectedRoom)
            getScene()?.upgradeSelectedRoom(selectedRoom.room.id, slot);
    };

    return (
        <main className="game-shell-react">
            <section className="game-viewport">
                <PhaserGame
                    ref={phaserRef}
                    currentActiveScene={handleSceneReady}
                />
                <div className="map-controls-hint">
                    <span>✥</span> Drag to pan <i /> Scroll to zoom
                </div>
            </section>

            <aside
                className={`command-panel ${panelOpen ? "is-open" : "is-closed"}`}
            >
                <button
                    type="button"
                    className="panel-toggle"
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
                    <div className="panel-inner">
                        <header className="command-header">
                            <div className="command-kicker">
                                <span className="command-rune">◆</span> Dungeon
                                command
                            </div>
                            <div className="wave-summary">
                                <div className="wave-title">
                                    <span
                                        className={`status-orb status-${wave.state}`}
                                    />
                                    <div>
                                        <h1>Wave {wave.waveNumber || "—"}</h1>
                                        <p>{wave.state}</p>
                                    </div>
                                </div>
                                <div className="wave-metrics">
                                    <div>
                                        <strong>
                                            {wave.remainingAdventurers}
                                        </strong>
                                        <span>of {wave.totalAdventurers}</span>
                                        <small>Adventurers</small>
                                    </div>
                                    <div>
                                        <strong>{wave.remainingParties}</strong>
                                        <span>of {wave.totalParties}</span>
                                        <small>Parties</small>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={!sceneReady || waveActive}
                                onClick={() => getScene()?.startNextWave()}
                                className="wave-action"
                            >
                                <span>
                                    {!sceneReady
                                        ? "Loading Dungeon…"
                                        : wave.waveNumber === 0
                                          ? "Start First Wave"
                                          : "Start Next Wave"}
                                </span>
                                <b>→</b>
                            </button>
                        </header>

                        <nav className="panel-tabs">
                            <button className="is-active">
                                <span>▦</span>Room
                            </button>
                            <button disabled>
                                <span>♟</span>Denizens
                            </button>
                            <button disabled>
                                <span>◇</span>Shop
                            </button>
                        </nav>

                        <div className="panel-content">
                            {selectedRoom ? (
                                <RoomDetailsPanel
                                    details={selectedRoom}
                                    onUpgrade={upgradeRoom}
                                    onClose={() => setSelectedRoom(null)}
                                />
                            ) : (
                                <div className="room-empty-state">
                                    <div className="empty-room-icon">
                                        <span>⌗</span>
                                    </div>
                                    <p className="eyebrow">Room inspection</p>
                                    <h2>Select a room</h2>
                                    <p>
                                        Click a room on the map to inspect its
                                        level, population, production, and
                                        available slot upgrades.
                                    </p>
                                    <div className="empty-state-tip">
                                        <span>✦</span> Choose any colored
                                        chamber
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

interface RoomDetailsPanelProps {
    details: RoomDetails;
    onUpgrade: (slot: ResourceSlotType | "defender") => void;
    onClose: () => void;
}

function RoomDetailsPanel({
    details,
    onUpgrade,
    onClose,
}: RoomDetailsPanelProps) {
    const { room, population } = details;
    const capacity = population?.capacity;
    return (
        <section className="room-details">
            <div className="room-details-heading">
                <div>
                    <p className="eyebrow">Selected room</p>
                    <h2>{getRoomTypeLabel(room.type)}</h2>
                    <div className="room-badges">
                        <span>Level {room.level}</span>
                        <span>
                            {room.deadEnd
                                ? "Dead end"
                                : room.terminal
                                  ? "Final room"
                                  : "Connected room"}
                        </span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="room-close"
                    aria-label="Close room details"
                >
                    ×
                </button>
            </div>

            {!population ? (
                <p className="room-notice">
                    This room does not support assigned denizens.
                </p>
            ) : (
                <>
                    <div className="room-stats">
                        {capacity?.kind === "resource" && (
                            <Stat
                                label="Production"
                                value={`${population.productionPerSecond.toFixed(1)}/sec`}
                            />
                        )}
                        {capacity?.kind === "resource" && (
                            <Stat
                                label="Gatherers"
                                value={`${population.assignedGatherers}/${capacity.gatherers} · max ${capacity.maxGatherers}`}
                            />
                        )}
                        <Stat
                            label="Defenders"
                            value={`${population.assignedDefenders}/${capacity?.defenders} · max ${capacity?.maxDefenders}`}
                        />
                        {population.recoveringGatherers > 0 && (
                            <Stat
                                label="Recovering"
                                value={`${population.recoveringGatherers} gatherers`}
                                warning
                            />
                        )}
                    </div>
                    <div className="upgrade-grid">
                        {capacity?.kind === "resource" && (
                            <UpgradeButton
                                disabled={
                                    capacity.gatherers >= capacity.maxGatherers
                                }
                                onClick={() => onUpgrade("gatherer")}
                            >
                                + Gatherer slot
                            </UpgradeButton>
                        )}
                        <UpgradeButton
                            disabled={
                                !capacity ||
                                capacity.defenders >= capacity.maxDefenders
                            }
                            onClick={() => onUpgrade("defender")}
                        >
                            + Defender slot
                        </UpgradeButton>
                    </div>
                    <h3 className="section-title">
                        <span>♟</span> Denizens
                    </h3>
                    {population.denizens.length === 0 ? (
                        <p className="denizen-empty">No denizens assigned.</p>
                    ) : (
                        population.denizens.map((denizen) => (
                            <button
                                key={denizen.id}
                                type="button"
                                className="denizen-row"
                            >
                                <span>
                                    {denizen.type} · {denizen.role}
                                </span>
                                <small>{denizen.status}</small>
                            </button>
                        ))
                    )}
                </>
            )}
        </section>
    );
}

function Stat({
    label,
    value,
    warning = false,
}: {
    label: string;
    value: string;
    warning?: boolean;
}) {
    return (
        <div className="stat-row">
            <span>{label}</span>
            <strong className={warning ? "is-warning" : ""}>{value}</strong>
        </div>
    );
}

function UpgradeButton({
    disabled,
    onClick,
    children,
}: {
    disabled: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="upgrade-button"
        >
            {children}
        </button>
    );
}

