import type { DungeonCoreSnapshot } from "../core/DungeonCoreManager";

export interface DungeonCoreStatusProps {
    core: DungeonCoreSnapshot;
    raidActive: boolean;
}

export function DungeonCoreStatus({
    core,
    raidActive,
}: DungeonCoreStatusProps) {
    const healthPercent = Math.max(
        0,
        Math.min(100, (core.health / core.maxHealth) * 100),
    );
    const capPercent = Math.round(core.regenerationCapPercent * 100);
    const breached = core.state === "breached";
    const barColor = breached
        ? "bg-[#b94a50]"
        : healthPercent <= 25
          ? "bg-[#d46550]"
          : healthPercent <= 60
            ? "bg-[#d5a54b]"
            : "bg-linear-to-r from-[#7d4ca6] to-[#b47ad5]";

    return (
        <section
            className={`mt-4 rounded-xl border p-3 ${
                breached
                    ? "border-[#d85b63]/35 bg-[#6f2028]/15"
                    : "border-[#a979c6]/20 bg-[#6b3a82]/8"
            }`}
            aria-label="Dungeon Core health"
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="m-0 text-[9px] font-extrabold tracking-[.14em] text-[#b991d1] uppercase">
                        Dungeon Core
                    </p>
                    <p className="mt-1 mb-0 text-[10px] text-[#948b99]">
                        {breached
                            ? "Breached — retry required"
                            : raidActive
                              ? `Regenerating up to ${capPercent}% during the raid`
                              : "Damage persists into the next raid"}
                    </p>
                </div>
                <strong
                    className={`shrink-0 font-serif text-lg ${
                        breached ? "text-[#ef8b91]" : "text-[#f5efe4]"
                    }`}
                >
                    {Math.ceil(core.health)} / {core.maxHealth}
                </strong>
            </div>

            <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-black/35">
                <div
                    className={`h-full rounded-full transition-[width] duration-200 ${barColor}`}
                    style={{ width: `${healthPercent}%` }}
                />
                <span
                    className="absolute top-0 h-full w-px bg-white/30"
                    style={{ left: `${capPercent}%` }}
                    title={`Raid regeneration cap: ${capPercent}%`}
                />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[9px] text-[#8f8793]">
                <span>DEF {core.defense}</span>
                <span>
                    Regen {core.regenerationPerSecond.toFixed(2)} HP/s · cap{" "}
                    {Math.round(core.regenerationCap)} HP
                </span>
                {core.lastAttackerCount > 0 && (
                    <span className="text-[#d8a37f]">
                        Last hit −{Math.round(core.lastDamage)} from{" "}
                        {core.lastAttackerCount}
                    </span>
                )}
                {breached && core.retryHealth !== null && (
                    <span className="w-full text-[#efb0b4]">
                        Retry restores the Core to {Math.ceil(core.retryHealth)}{" "}
                        HP.
                    </span>
                )}
            </div>
        </section>
    );
}
