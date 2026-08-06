import { GameObjects, Scene } from "phaser";
import type { AdventurerData } from "../components/entityComponents/entityData";
import { AdventurerClass } from "../components/entityComponents/entityData";

const CLASS_COLORS: Record<AdventurerData["class"], number> = {
    [AdventurerClass.WARRIOR]: 0xdc2626,
    [AdventurerClass.ROGUE]: 0x16a34a,
    [AdventurerClass.CLERIC]: 0xfacc15,
    [AdventurerClass.ARCANIST]: 0x2563eb,
};

const CLASS_LABELS: Record<AdventurerData["class"], string> = {
    [AdventurerClass.WARRIOR]: "W",
    [AdventurerClass.ROGUE]: "R",
    [AdventurerClass.CLERIC]: "C",
    [AdventurerClass.ARCANIST]: "A",
};

export class AdventurerView extends GameObjects.Container {
    private readonly body: GameObjects.Container;
    private defeated = false;

    constructor(scene: Scene, adventurer: AdventurerData) {
        super(scene, adventurer.position.x, adventurer.position.y);
        const marker = new GameObjects.Arc(
            scene,
            0,
            0,
            15,
            0,
            360,
            false,
            CLASS_COLORS[adventurer.class],
        ).setStrokeStyle(3, 0xffffff);
        const label = new GameObjects.Text(
            scene,
            0,
            0,
            CLASS_LABELS[adventurer.class],
            {
                color: "#ffffff",
                fontFamily: "Arial, sans-serif",
                fontSize: "15px",
                fontStyle: "bold",
            },
        ).setOrigin(0.5);

        this.body = new GameObjects.Container(scene, 0, 0, [marker, label]);
        this.add(this.body);
        this.setDepth(10);
        scene.add.existing(this);
    }

    setFighting(active: boolean): void {
        if (this.defeated) return;

        this.scene.tweens.killTweensOf(this.body);
        this.body.setPosition(0, 0).setScale(1).setAlpha(1);
        if (!active) return;

        this.scene.tweens.add({
            targets: this.body,
            y: -4,
            duration: 170,
            ease: "Sine.InOut",
            yoyo: true,
            repeat: -1,
        });
    }

    flashHit(): void {
        if (this.defeated) return;

        this.scene.tweens.add({
            targets: this.body,
            scaleX: 1.22,
            scaleY: 1.22,
            alpha: 0.45,
            duration: 80,
            ease: "Quad.Out",
            yoyo: true,
        });
    }

    defeat(): void {
        if (this.defeated) return;
        this.defeated = true;
        this.scene.tweens.killTweensOf(this.body);
        this.body.setPosition(0, 0);
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            scaleX: 0.55,
            scaleY: 0.55,
            duration: 220,
            ease: "Quad.In",
            onComplete: () => this.setVisible(false),
        });
    }
}
