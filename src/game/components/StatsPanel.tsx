import type {
    DungeonResourceId,
    ResourceSnapshot,
} from "../resources/ResourceManager";

interface StatsPanelProps {
    resources: ResourceSnapshot;
    waveActive: boolean;
    completedWaves: number;
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

export function StatsPanel({
    resources,
    waveActive,
    completedWaves,
}: StatsPanelProps) {
    const resourceIds = Object.keys(RESOURCE_META) as DungeonResourceId[];
    const totalEarned = resourceIds.reduce(
        (total, id) => total + resources.totalEarned[id],
        0,
    );

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

