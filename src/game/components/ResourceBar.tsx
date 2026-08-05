import { useState } from "react";

type ResourceTone = "violet" | "slate" | "amber";

export interface ResourceDisplay {
    id: string;
    label: string;
    icon: string;
    value: number;
    capacity: number;
    tone: ResourceTone;
}

interface NextDungeonLevel {
    waveRequired: number;
    waveDefeated: boolean;
    costs: { resource: string; current: number; required: number }[];
    roomCapacityReward: number;
}

interface ResourceBarProps {
    resources: ResourceDisplay[];
    denizens: { current: number; capacity: number };
    dungeonPower: number;
    dungeonLevel: number;
    nextLevel: NextDungeonLevel;
    onExpandDungeon?: () => void;
}

const formatNumber = new Intl.NumberFormat("en-US");

export function ResourceBar({ resources, denizens, dungeonPower, dungeonLevel, nextLevel, onExpandDungeon }: ResourceBarProps) {
    const [levelOpen, setLevelOpen] = useState(false);
    const canAfford = nextLevel.costs.every((cost) => cost.current >= cost.required);
    const canExpand = canAfford && nextLevel.waveDefeated;

    return (
        <header className="resource-bar" aria-label="Dungeon resources">
            <div className="resource-bar-scroll">
                <div className="resource-group">
                    {resources.map((resource) => <ResourceCell key={resource.id} resource={resource} />)}
                </div>
                <div className="resource-bar-spacer" />
                <div className="resource-group">
                    <ProgressCell icon="♟" label="Denizens" value={`${denizens.current} / ${denizens.capacity}`} className="resource-cell-denizens" />
                    <ProgressCell icon="⚔" label="Dungeon Power" value={formatNumber.format(dungeonPower)} className="resource-cell-power" />
                    <div className="level-control">
                        <button type="button" className={`resource-cell resource-cell-level ${levelOpen ? "is-active" : ""}`} onClick={() => setLevelOpen((open) => !open)} aria-expanded={levelOpen}>
                            <span className="resource-icon">◆</span>
                            <span className="resource-copy"><small>Dungeon Level</small><strong>{dungeonLevel}</strong></span>
                            <span className="level-chevron">⌄</span>
                        </button>
                        {levelOpen && (
                            <div className="level-popover">
                                <div className="level-popover-heading">
                                    <div><small>Next expansion</small><strong>Dungeon Level {dungeonLevel + 1}</strong></div>
                                    <span className={nextLevel.waveDefeated ? "requirement-ready" : ""}>Wave {nextLevel.waveRequired}</span>
                                </div>
                                <div className="level-requirements">
                                    {nextLevel.costs.map((cost) => (
                                        <div className="level-cost" key={cost.resource}>
                                            <span>{cost.resource}</span>
                                            <strong className={cost.current >= cost.required ? "requirement-ready" : ""}>{cost.current} / {cost.required}</strong>
                                        </div>
                                    ))}
                                </div>
                                <p className="level-reward">Reward: +{nextLevel.roomCapacityReward} room capacity</p>
                                <button type="button" className="expand-dungeon-button" disabled={!canExpand || !onExpandDungeon} onClick={onExpandDungeon}>
                                    {!nextLevel.waveDefeated ? `Defeat Wave ${nextLevel.waveRequired}` : !canAfford ? "Gather materials" : "Expand Dungeon"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

function ResourceCell({ resource }: { resource: ResourceDisplay }) {
    const nearCapacity = resource.value / resource.capacity >= 0.85;
    return (
        <div className={`resource-cell resource-tone-${resource.tone} ${nearCapacity ? "is-near-capacity" : ""}`} title={`${resource.value} stored out of ${resource.capacity}`}>
            <span className="resource-icon">{resource.icon}</span>
            <span className="resource-copy"><small>{resource.label}</small><strong>{formatNumber.format(resource.value)} <em>/ {formatNumber.format(resource.capacity)}</em></strong></span>
        </div>
    );
}

function ProgressCell({ icon, label, value, className }: { icon: string; label: string; value: string; className: string }) {
    return <div className={`resource-cell ${className}`}><span className="resource-icon">{icon}</span><span className="resource-copy"><small>{label}</small><strong>{value}</strong></span></div>;
}
