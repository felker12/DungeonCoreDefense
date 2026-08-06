import type { DenizenType } from "./entityComponents/entityData";
import type { DenizenRosterSnapshot } from "../rooms/RoomPopulationManager";
import {
    DEFENDER_OFFERS,
    type DefenderOffer,
} from "../denizens/DenizenRecruitment";

interface DenizenPanelProps {
    roster: DenizenRosterSnapshot;
    supplies: number;
    onRecruit: (type: DenizenType) => boolean;
}

const formatNumber = new Intl.NumberFormat("en-US");

export function DenizenPanel({ roster, supplies, onRecruit }: DenizenPanelProps) {
    const full = roster.denizens.length >= roster.capacity;

    return (
        <section aria-labelledby="denizen-roster-title">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <p className="m-0 text-[9px] font-extrabold tracking-[.18em] text-[#d9b766] uppercase">
                        Permanent roster
                    </p>
                    <h2 id="denizen-roster-title" className="mt-1.5 mb-0 font-serif text-[24px] text-[#f5efe4]">
                        Recruit defenders
                    </h2>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${full ? "border-[#bd615b]/35 bg-[#bd615b]/10 text-[#db8982]" : "border-[#d8aa4f]/30 bg-[#d8aa4f]/8 text-[#e7cb89]"}`}>
                    {roster.denizens.length} / {roster.capacity}
                </span>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-3.5 py-3">
                <span className="text-[10px] font-bold tracking-[.08em] text-[#958b99] uppercase">Available supplies</span>
                <strong className="text-sm text-[#e6be67]">● {formatNumber.format(supplies)}</strong>
            </div>

            <div className="grid gap-3">
                {DEFENDER_OFFERS.map((offer) => (
                    <RecruitCard
                        key={offer.type}
                        offer={offer}
                        disabled={full || supplies < offer.cost}
                        reason={full ? "Roster full" : supplies < offer.cost ? "Need more supplies" : null}
                        onRecruit={() => onRecruit(offer.type)}
                    />
                ))}
            </div>

            {roster.denizens.length > 0 && (
                <div className="mt-5 border-t border-white/8 pt-4">
                    <h3 className="m-0 text-[9px] font-extrabold tracking-[.14em] text-[#8f8592] uppercase">Owned defenders</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {roster.denizens.map((denizen) => (
                            <span key={denizen.id} className="rounded-lg border border-white/8 bg-black/15 px-2.5 py-1.5 text-[10px] font-bold text-[#cfc5d2] capitalize">
                                {denizen.type} · ATK {denizen.attack}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

function RecruitCard({ offer, disabled, reason, onRecruit }: { offer: DefenderOffer; disabled: boolean; reason: string | null; onRecruit: () => void }) {
    return (
        <article className="rounded-xl border border-white/8 bg-linear-to-br from-white/4 to-white/1 p-3.5">
            <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#a979c6]/25 bg-[#a979c6]/10 font-serif text-lg text-[#c79be1]">{offer.mark}</span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <strong className="text-[13px] text-[#f0e9df]">{offer.name}</strong>
                        <span className="shrink-0 text-[11px] font-bold text-[#d9ad59]">● {offer.cost}</span>
                    </div>
                    <p className="mt-1 mb-2 text-[10px] leading-relaxed text-[#8e8592]">{offer.description}</p>
                    <div className="flex gap-3 text-[9px] font-bold text-[#9d94a1]">
                        <span>HP {offer.health}</span><span>ATK {offer.attack}</span><span>DEF {offer.defense}</span>
                    </div>
                </div>
            </div>
            <button type="button" disabled={disabled} onClick={onRecruit} className="mt-3 w-full cursor-pointer rounded-lg border border-[#d8aa4f]/35 bg-[#d8aa4f]/10 py-2 text-[10px] font-extrabold tracking-[.08em] text-[#e7cb89] uppercase transition hover:bg-[#d8aa4f]/18 disabled:cursor-not-allowed disabled:border-white/7 disabled:bg-white/3 disabled:text-[#6f6874]">
                {reason ?? "Recruit defender"}
            </button>
        </article>
    );
}
