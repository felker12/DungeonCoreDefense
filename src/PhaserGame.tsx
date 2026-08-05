import { forwardRef, useLayoutEffect, useRef } from "react";
import StartGame from "./game/main";
import { EventBus } from "./game/EventBus";

export interface IRefPhaserGame {
    game: Phaser.Game | null;
    scene: Phaser.Scene | null;
}

interface IProps {
    currentActiveScene?: (scene: Phaser.Scene) => void;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(
    function PhaserGame({ currentActiveScene }, ref) {
        const game = useRef<Phaser.Game | null>(null);

        useLayoutEffect(() => {
            const handleSceneReady = (scene: Phaser.Scene): void => {
                currentActiveScene?.(scene);

                if (typeof ref === "function") {
                    ref({ game: game.current, scene });
                } else if (ref) {
                    ref.current = { game: game.current, scene };
                }
            };

            // DungeonScene can finish creating synchronously while Phaser starts,
            // so subscribe before constructing the game.
            EventBus.on("current-scene-ready", handleSceneReady);
            game.current ??= StartGame("game-container");

            if (typeof ref === "function") {
                ref({ game: game.current, scene: null });
            } else if (ref) {
                ref.current = { game: game.current, scene: null };
            }

            return () => {
                EventBus.off("current-scene-ready", handleSceneReady);
                game.current?.destroy(true);
                game.current = null;

                if (typeof ref === "function") {
                    ref({ game: null, scene: null });
                } else if (ref) {
                    ref.current = { game: null, scene: null };
                }
            };
        }, [currentActiveScene, ref]);

        return <div id="game-container" className="h-full w-full" />;
    },
);
