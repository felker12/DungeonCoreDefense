import { AUTO, Game } from "phaser";
import { DungeonScene } from "./scenes/DungeonScene";

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    parent: "game-container",
    width: 1024,
    height: 768,
    backgroundColor: "#111018",
    scene: [DungeonScene],
};

const StartGame = (parent: string): Phaser.Game => {
    return new Game({
        ...config,
        parent,
    });
};

export default StartGame;
