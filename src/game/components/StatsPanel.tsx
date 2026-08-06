import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type {
    DungeonResourceId,
    ResourceSnapshot,
} from "../resources/ResourceManager";
import type {
    DungeonSaveOperationResult,
    DungeonSaveStatus,
} from "../scenes/DungeonScene";

interface StatsPanelProps {
    resources: ResourceSnapshot;
    waveActive: boolean;
    completedWaves: number;
    saveStatus: DungeonSaveStatus;
    onSave: () => boolean;
    onExportSave: () => string | null;
    onImportSave: (serializedSave: string) => DungeonSaveOperationResult;
    onResetSave: () => boolean;
}

type NoticeTone = "success" | "error" | "info";

interface Notice {
    tone: NoticeTone;
    message: string;
}

interface PendingImport {
    fileName: string;
    contents: string;
}

const RESOURCE_META: Record<
    DungeonResourceId,
    { label: string; icon: string; color: string }
> = {
    essence: { label: "Essence", icon: "✦", color: "text-[#b886dc]" },
    stone: { label: "Stone", icon: "◆", color: "text-[#a8b3c4]" },
    supplies: { label: "Supplies", icon: "●", color: "text-[#d9ad59]" },
};

const formatNumber = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
});

const savedAtFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

export function StatsPanel({
    resources,
    waveActive,
    completedWaves,
    saveStatus,
    onSave,
    onExportSave,
    onImportSave,
    onResetSave,
}: StatsPanelProps) {
    const resourceIds = Object.keys(RESOURCE_META) as DungeonResourceId[];
    const totalEarned = resourceIds.reduce(
        (total, id) => total + resources.totalEarned[id],
        0,
    );
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [pendingImport, setPendingImport] = useState<PendingImport | null>(
        null,
    );
    const [confirmingReset, setConfirmingReset] = useState(false);

    const lastSavedLabel = saveStatus.lastSavedAt
        ? formatSavedAt(saveStatus.lastSavedAt)
        : "No local save yet";

    const handleManualSave = (): void => {
        const saved = onSave();
        setNotice({
            tone: saved ? "success" : "error",
            message: saved
                ? "Dungeon saved locally."
                : "The dungeon could not be saved in its current state.",
        });
    };

    const handleExport = (): void => {
        const serializedSave = onExportSave();
        if (!serializedSave) {
            setNotice({
                tone: "error",
                message: "There is no valid local save to export.",
            });
            return;
        }

        const blob = new Blob([serializedSave], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = createExportFileName();
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);

        setNotice({
            tone: "success",
            message: "Save exported as a JSON file.",
        });
    };

    const handleFileSelected = async (
        event: ChangeEvent<HTMLInputElement>,
    ): Promise<void> => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        if (file.size > 5_000_000) {
            setNotice({
                tone: "error",
                message: "That save file is unexpectedly large and was not opened.",
            });
            return;
        }

        try {
            setPendingImport({
                fileName: file.name,
                contents: await file.text(),
            });
            setConfirmingReset(false);
            setNotice({
                tone: "info",
                message: "Review the selected file before replacing this dungeon.",
            });
        } catch {
            setNotice({
                tone: "error",
                message: "The selected save file could not be read.",
            });
        }
    };

    const confirmImport = (): void => {
        if (!pendingImport) return;

        const result = onImportSave(pendingImport.contents);
        setNotice({
            tone: result.success ? "success" : "error",
            message: result.message,
        });
        if (result.success) setPendingImport(null);
    };

    const confirmReset = (): void => {
        const reset = onResetSave();
        setNotice({
            tone: reset ? "success" : "error",
            message: reset
                ? "Local save cleared. Reloading the starting dungeon."
                : "The local save could not be reset.",
        });
        if (reset) setConfirmingReset(false);
    };

    return (
        <section aria-labelledby="dungeon-statistics-title">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <p className="m-0 text-[9px] font-extrabold tracking-[.18em] text-[#d9b766] uppercase">
                        Dungeon ledger
                    </p>
                    <h2
                        id="dungeon-statistics-title"
                        className="mt-1.5 mb-0 font-serif text-[24px] text-[#f5efe4]"
                    >
                        Statistics
                    </h2>
                </div>
                <span
                    className={`rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-[.08em] uppercase ${waveActive ? "border-[#d8aa4f]/35 bg-[#d8aa4f]/10 text-[#e7cb89]" : "border-white/8 bg-white/3 text-[#77707c]"}`}
                >
                    {waveActive ? "Producing" : "Idle"}
                </span>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2.5">
                <SummaryCard
                    label="Total resources earned"
                    value={totalEarned}
                />
                <SummaryCard label="Waves completed" value={completedWaves} />
            </div>

            <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/8 px-3.5 py-2.5 text-[8px] font-extrabold tracking-[.12em] text-[#776f7b] uppercase">
                    <span>Resource</span>
                    <span>Income</span>
                    <span className="min-w-16 text-right">All time</span>
                </div>
                {resourceIds.map((id) => {
                    const meta = RESOURCE_META[id];
                    const income = waveActive
                        ? resources.incomePerSecond[id]
                        : 0;

                    return (
                        <div
                            key={id}
                            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/6 px-3.5 py-3 last:border-b-0"
                        >
                            <span className="flex items-center gap-2 text-xs font-bold text-[#d8d0da]">
                                <i className={`not-italic ${meta.color}`}>
                                    {meta.icon}
                                </i>
                                {meta.label}
                            </span>
                            <strong
                                className={
                                    waveActive
                                        ? "text-[#82c99a]"
                                        : "text-[#68616c]"
                                }
                            >
                                +{formatNumber.format(income)}/s
                            </strong>
                            <strong className="min-w-16 text-right text-[#f0e9df]">
                                {formatNumber.format(resources.totalEarned[id])}
                            </strong>
                        </div>
                    );
                })}
            </div>

            <p className="mt-3 mb-0 text-[10px] leading-relaxed text-[#77707c]">
                Income is generated only while a wave is active. Paused waves
                and downtime do not contribute to these totals.
            </p>

            <div className="mt-5 border-t border-white/8 pt-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <p className="m-0 text-[9px] font-extrabold tracking-[.15em] text-[#9b719f] uppercase">
                            Save management
                        </p>
                        <h3 className="mt-1.5 mb-0 font-serif text-[20px] text-[#eee7dc]">
                            Local dungeon save
                        </h3>
                    </div>
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-extrabold tracking-[.07em] uppercase ${saveStatus.hasSave ? "border-[#6f9f73]/30 bg-[#6f9f73]/10 text-[#91c796]" : "border-white/8 bg-white/3 text-[#77707c]"}`}
                    >
                        <i
                            className={`size-1.5 rounded-full ${saveStatus.hasSave ? "bg-[#7fbd85] shadow-[0_0_8px_rgba(127,189,133,.65)]" : "bg-[#625b66]"}`}
                        />
                        {saveStatus.hasSave ? "Saved" : "No save"}
                    </span>
                </div>

                <div className="rounded-xl border border-[#a979c6]/16 bg-[#6b3a82]/7 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <small className="block text-[8px] font-extrabold tracking-[.11em] text-[#8f8592] uppercase">
                                Last local save
                            </small>
                            <strong className="mt-1 block text-[12px] text-[#ddd4df]">
                                {lastSavedLabel}
                            </strong>
                        </div>
                        <button
                            type="button"
                            disabled={!saveStatus.canSave}
                            onClick={handleManualSave}
                            className="cursor-pointer rounded-lg border border-[#ddb966]/28 bg-[#ddb966]/9 px-3 py-2 text-[9px] font-extrabold tracking-[.07em] text-[#e3c578] uppercase transition hover:border-[#ddb966]/45 hover:bg-[#ddb966]/14 disabled:cursor-not-allowed disabled:border-white/7 disabled:bg-white/3 disabled:text-[#6f6873]"
                        >
                            Save now
                        </button>
                    </div>
                    {!saveStatus.canSave && (
                        <p className="mt-2.5 mb-0 text-[9px] leading-relaxed text-[#a67d78]">
                            Manual saving is unavailable during an active or
                            failed raid. The last safe between-wave save is
                            preserved.
                        </p>
                    )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        disabled={!saveStatus.hasSave}
                        onClick={handleExport}
                        className="cursor-pointer rounded-lg border border-white/10 bg-white/4 px-3 py-2.5 text-[9px] font-extrabold tracking-[.07em] text-[#c8becb] uppercase transition hover:border-[#a979c6]/28 hover:bg-[#a979c6]/9 hover:text-[#d8b7e8] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                        Export save
                    </button>
                    <button
                        type="button"
                        disabled={waveActive}
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer rounded-lg border border-white/10 bg-white/4 px-3 py-2.5 text-[9px] font-extrabold tracking-[.07em] text-[#c8becb] uppercase transition hover:border-[#a979c6]/28 hover:bg-[#a979c6]/9 hover:text-[#d8b7e8] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                        Import save
                    </button>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleFileSelected}
                />

                {pendingImport && (
                    <div className="mt-3 rounded-xl border border-[#d8aa4f]/22 bg-[#d8aa4f]/7 p-3.5">
                        <p className="m-0 text-[9px] font-extrabold tracking-[.1em] text-[#dabb72] uppercase">
                            Replace current dungeon?
                        </p>
                        <p className="mt-2 mb-0 break-all text-[10px] leading-relaxed text-[#a99da9]">
                            Import <strong>{pendingImport.fileName}</strong> and
                            reload the game. Your current local save will be
                            replaced.
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setPendingImport(null)}
                                className="cursor-pointer rounded-lg border border-white/10 bg-white/4 py-2 text-[9px] font-extrabold text-[#aaa0ae] uppercase"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmImport}
                                className="cursor-pointer rounded-lg border border-[#d8aa4f]/35 bg-[#d8aa4f]/12 py-2 text-[9px] font-extrabold text-[#e4c87d] uppercase"
                            >
                                Import and reload
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-4 border-t border-white/7 pt-4">
                    {!confirmingReset ? (
                        <button
                            type="button"
                            disabled={!saveStatus.hasSave || waveActive}
                            onClick={() => {
                                setConfirmingReset(true);
                                setPendingImport(null);
                            }}
                            className="w-full cursor-pointer rounded-lg border border-[#bd615b]/18 bg-[#bd615b]/6 py-2.5 text-[9px] font-extrabold tracking-[.08em] text-[#c98681] uppercase transition hover:border-[#bd615b]/34 hover:bg-[#bd615b]/10 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            Reset local save
                        </button>
                    ) : (
                        <div className="rounded-xl border border-[#bd615b]/26 bg-[#bd615b]/8 p-3.5">
                            <p className="m-0 text-[10px] leading-relaxed text-[#d2a19d]">
                                This permanently clears the browser save and
                                reloads the original dungeon.
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setConfirmingReset(false)}
                                    className="cursor-pointer rounded-lg border border-white/10 bg-white/4 py-2 text-[9px] font-extrabold text-[#aaa0ae] uppercase"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmReset}
                                    className="cursor-pointer rounded-lg border border-[#bd615b]/38 bg-[#bd615b]/14 py-2 text-[9px] font-extrabold text-[#e39a94] uppercase"
                                >
                                    Clear and restart
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {notice && (
                    <p
                        className={`mt-3 mb-0 rounded-lg border px-3 py-2.5 text-[10px] leading-relaxed ${getNoticeClassName(notice.tone)}`}
                        aria-live="polite"
                    >
                        {notice.message}
                    </p>
                )}
            </div>
        </section>
    );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-[#ddb966]/12 bg-linear-to-br from-[#ddb966]/6 to-white/2 p-3.5">
            <small className="block text-[8px] font-extrabold tracking-[.11em] text-[#8f8592] uppercase">
                {label}
            </small>
            <strong className="mt-1.5 block font-serif text-[22px] text-[#f3eadb]">
                {formatNumber.format(value)}
            </strong>
        </div>
    );
}

function formatSavedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Saved locally"
        : savedAtFormatter.format(date);
}

function createExportFileName(): string {
    const date = new Date();
    const stamp = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
    return `dungeon-core-defense-save-${stamp}.json`;
}

function getNoticeClassName(tone: NoticeTone): string {
    switch (tone) {
        case "success":
            return "border-[#6f9f73]/22 bg-[#6f9f73]/8 text-[#9ac99e]";
        case "error":
            return "border-[#bd615b]/24 bg-[#bd615b]/8 text-[#d99a95]";
        default:
            return "border-[#a979c6]/20 bg-[#a979c6]/7 text-[#b9a5c3]";
    }
}
