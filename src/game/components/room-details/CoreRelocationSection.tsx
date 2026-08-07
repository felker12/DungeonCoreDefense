import type { DungeonConstructionSnapshot } from "../../scenes/DungeonScene";

interface CoreRelocationSectionProps {
    construction: DungeonConstructionSnapshot;
    onMoveCore: () => boolean;
}

export function CoreRelocationSection({
    construction,
    onMoveCore,
}: CoreRelocationSectionProps) {
    return (
        <div className="rounded-xl border border-[#a979c6]/20 bg-[#a979c6]/7 p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="m-0 text-[10px] font-extrabold tracking-[.12em] text-[#d2afe1] uppercase">
                        Core relocation
                    </h3>
                    <p className="mt-1.5 mb-0 text-[9px] leading-relaxed text-[#97889e]">
                        Swap this room with the Dungeon Core while preserving
                        both locations, all corridors, and this room&apos;s
                        upgrades.
                    </p>
                </div>

                <button
                    type="button"
                    disabled={!construction.coreRelocation.available}
                    title={
                        construction.coreRelocation.reason ??
                        "Move the Dungeon Core to this room."
                    }
                    onClick={onMoveCore}
                    className="shrink-0 cursor-pointer rounded-md border border-[#a979c6]/35 bg-[#a979c6]/12 px-2.5 py-1.5 text-[8px] font-extrabold text-[#d8b5e7] uppercase hover:bg-[#a979c6]/22 disabled:cursor-not-allowed disabled:opacity-35"
                >
                    Move Core Here
                </button>
            </div>

            {construction.coreRelocation.reason && (
                <p className="mt-2 mb-0 text-[9px] leading-relaxed text-[#776c7c]">
                    {construction.coreRelocation.reason}
                </p>
            )}
        </div>
    );
}
