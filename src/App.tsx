import { useEffect, useState } from "react";
import { PhaserGame } from "./PhaserGame";
import { EventBus } from "./game/EventBus";
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

    useEffect(() => {
        const handleStatus = (status: WaveStatus): void => setWave(status);
        EventBus.on("wave-status-changed", handleStatus);
        return () => {
            EventBus.off("wave-status-changed", handleStatus);
        };
    }, []);

    const waveActive = wave.state === "spawning" || wave.state === "advancing";

    return (
        <main id="app" style={{ position: "relative", width: "100vw", height: "100vh" }}>
            <PhaserGame />
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
                    disabled={waveActive}
                    onClick={() => EventBus.emit("start-next-wave")}
                    style={{
                        width: "100%",
                        padding: "9px 12px",
                        border: 0,
                        borderRadius: 8,
                        color: "#17111e",
                        background: waveActive ? "#766d7d" : "#ffd166",
                        cursor: waveActive ? "not-allowed" : "pointer",
                        fontWeight: 700,
                    }}
                >
                    {wave.waveNumber === 0 ? "Start First Wave" : "Start Next Wave"}
                </button>
            </section>
        </main>
    );
}

export default App;
