import { AdventurerClass } from "./entityComponents/entityData";
import type {
    RoomAttackerSnapshot,
    RoomAttackersSnapshot,
} from "../combat/CombatTypes";

interface RoomAttackersPanelProps {
    roomName: string;
    snapshot: RoomAttackersSnapshot;
    onClose: () => void;
}

const CLASS_META: Record<
    RoomAttackerSnapshot["class"],
    { label: string; mark: string; classes: string }
> = {
    [AdventurerClass.WARRIOR]: {
        label: "Warrior",
        mark: "W",
        classes: "border-[#d86464]/35 bg-[#a93434]/18 text-[#ef9999]",
    },
    [AdventurerClass.ROGUE]: {
        label: "Rogue",
        mark: "R",
        classes: "border-[#65b879]/35 bg-[#3d874e]/18 text-[#95d8a5]",
    },
    [AdventurerClass.CLERIC]: {
        label: "Cleric",
        mark: "C",
        classes: "border-[#d9bd62]/35 bg-[#9b7e2f]/18 text-[#ecd78e]",
    },
    [AdventurerClass.ARCANIST]: {
        label: "Arcanist",
        mark: "A",
        classes: "border-[#6d8fd8]/35 bg-[#385b9e]/18 text-[#9db7ec]",
    },
};

export function RoomAttackersPanel({
    roomName,
    snapshot,
    onClose,
}: RoomAttackersPanelProps) {
    const partyCount = snapshot.parties.length;

    return (
        <aside
            className="pointer-events-auto absolute top-3.5 left-3.5 z-20 flex max-h-[min(520px,calc(100%-28px))] w-[min(390px,calc(100%-28px))] flex-col overflow-hidden rounded-2xl border border-[#c98f65]/30 bg-[linear-gradient(155deg,rgba(35,22,29,.97),rgba(14,11,17,.96))] text-[#eee7df] shadow-[0_22px_65px_rgba(0,0,0,.48),inset_0_1px_rgba(255,255,255,.04)] backdrop-blur-md"
            aria-label={`Attackers fighting in ${roomName}`}
        >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/8 px-4 py-3.5">
                <div className="min-w-0">
                    <p className="m-0 text-[8px] font-extrabold tracking-[.18em] text-[#dc986e] uppercase">
                        Room assault
                    </p>
                    <h2 className="mt-1 mb-0 truncate font-serif text-[19px] text-[#fff4e8]">
                        {roomName}
                    </h2>
                    <p className="mt-1 mb-0 text-[9px] text-[#9e9098]">
                        {snapshot.totalAttackers}{" "}
                        {snapshot.totalAttackers === 1
                            ? "attacker"
                            : "attackers"}
                        {" · "}
                        {partyCount} {partyCount === 1 ? "party" : "parties"}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="grid size-7.5 shrink-0 cursor-pointer place-items-center rounded-lg border border-white/8 bg-white/4 p-0 text-[18px] text-[#8f818b] transition hover:border-white/15 hover:bg-white/8 hover:text-white"
                    aria-label="Close room assault details"
                >
                    ×
                </button>
            </header>

            <div className="min-h-0 overflow-y-auto p-3.5">
                <div className="grid gap-3">
                    {snapshot.parties.map((party, partyIndex) => (
                        <section
                            key={party.partyId}
                            className="overflow-hidden rounded-xl border border-white/8 bg-black/18"
                        >
                            <div className="flex items-center justify-between gap-3 border-b border-white/7 bg-white/3 px-3 py-2">
                                <strong className="text-[9px] font-extrabold tracking-widest text-[#cbbdca] uppercase">
                                    {getPartyLabel(party.partyId, partyIndex)}
                                </strong>
                                <span className="text-[8px] font-bold text-[#776d77]">
                                    Wave {party.waveNumber} ·{" "}
                                    {party.attackers.length}
                                </span>
                            </div>

                            <div className="divide-y divide-white/6">
                                {party.attackers.map((attacker) => (
                                    <AttackerRow
                                        key={attacker.id}
                                        attacker={attacker}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </aside>
    );
}

function AttackerRow({ attacker }: { attacker: RoomAttackerSnapshot }) {
    const meta = CLASS_META[attacker.class];
    const healthPercent = Math.max(
        0,
        Math.min(100, (attacker.health / attacker.maxHealth) * 100),
    );
    const healthTone =
        healthPercent <= 25
            ? "from-[#b7474d] to-[#d96458]"
            : healthPercent <= 60
              ? "from-[#bd7b3d] to-[#d6a34e]"
              : "from-[#8a4eb2] to-[#b873d1]";

    return (
        <div className="px-3 py-2.5">
            <div className="flex items-center gap-2.5">
                <span
                    className={`grid size-7.5 shrink-0 place-items-center rounded-lg border text-[10px] font-black ${meta.classes}`}
                >
                    {meta.mark}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                        <strong className="truncate text-[11px] text-[#e8dfe7]">
                            {meta.label}
                        </strong>
                        <span className="shrink-0 text-[10px] font-bold text-[#f1e8e0]">
                            {Math.ceil(attacker.health)} / {attacker.maxHealth}{" "}
                            HP
                        </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40">
                        <div
                            className={`h-full rounded-full bg-linear-to-r ${healthTone} transition-[width] duration-150`}
                            style={{ width: `${healthPercent}%` }}
                        />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3 text-[8px] font-bold tracking-[.04em] text-[#847985] uppercase">
                        <span>Level {attacker.level}</span>
                        <span>
                            ATK {attacker.attack} · DEF {attacker.defense}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getPartyLabel(partyId: string, fallbackIndex: number): string {
    const match = partyId.match(/party-(\d+)$/i);
    return `Party ${match?.[1] ?? fallbackIndex + 1}`;
}

