import { Math as PhaserMath, type Input, type Scene } from "phaser";

interface DungeonCameraOptions {
    minZoom?: number;
    maxZoom?: number;
    zoomStep?: number;
    worldPadding?: number;
}

export class DungeonCameraController {
    private readonly minZoom: number;
    private readonly maxZoom: number;
    private readonly zoomStep: number;
    private readonly worldBounds: Phaser.Geom.Rectangle;
    private isDragging = false;

    constructor(
        private readonly scene: Scene,
        focusBounds: Phaser.Geom.Rectangle,
        options: DungeonCameraOptions = {},
    ) {
        this.minZoom = options.minZoom ?? 0.5;
        this.maxZoom = options.maxZoom ?? 2;
        this.zoomStep = options.zoomStep ?? 0.12;

        const padding = options.worldPadding ?? 320;
        this.worldBounds = new Phaser.Geom.Rectangle(
            focusBounds.x - padding,
            focusBounds.y - padding,
            focusBounds.width + padding * 2,
            focusBounds.height + padding * 2,
        );

        this.configureCamera(focusBounds);
        this.bindInput();
    }

    destroy(): void {
        this.scene.input.off("pointerdown", this.handlePointerDown, this);
        this.scene.input.off("pointermove", this.handlePointerMove, this);
        this.scene.input.off("pointerup", this.handlePointerUp, this);
        this.scene.input.off("pointerupoutside", this.handlePointerUp, this);
        this.scene.input.off("wheel", this.handleWheel, this);
        this.scene.scale.off("resize", this.handleResize, this);
        this.setCursor("default");
    }

    private configureCamera(focusBounds: Phaser.Geom.Rectangle): void {
        const camera = this.scene.cameras.main;
        camera.setBounds(
            this.worldBounds.x,
            this.worldBounds.y,
            this.worldBounds.width,
            this.worldBounds.height,
        );

        const fitZoom = Math.min(
            camera.width / this.worldBounds.width,
            camera.height / this.worldBounds.height,
            1,
        );

        camera.setZoom(PhaserMath.Clamp(fitZoom, this.minZoom, this.maxZoom));
        camera.centerOn(focusBounds.centerX, focusBounds.centerY);
    }

    private bindInput(): void {
        this.scene.input.mouse?.disableContextMenu();
        this.scene.input.on("pointerdown", this.handlePointerDown, this);
        this.scene.input.on("pointermove", this.handlePointerMove, this);
        this.scene.input.on("pointerup", this.handlePointerUp, this);
        this.scene.input.on("pointerupoutside", this.handlePointerUp, this);
        this.scene.input.on("wheel", this.handleWheel, this);
        this.scene.scale.on("resize", this.handleResize, this);
        this.setCursor("grab");
    }

    private handlePointerDown(pointer: Input.Pointer): void {
        if (pointer.leftButtonDown() || pointer.middleButtonDown()) {
            this.isDragging = true;
            this.setCursor("grabbing");
        }
    }

    private handlePointerMove(pointer: Input.Pointer): void {
        if (!this.isDragging || !pointer.isDown) {
            return;
        }

        const camera = this.scene.cameras.main;
        camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
        camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
    }

    private handlePointerUp(): void {
        this.isDragging = false;
        this.setCursor("grab");
    }

    private handleWheel(
        pointer: Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
    ): void {
        const camera = this.scene.cameras.main;
        const worldBeforeZoom = camera.getWorldPoint(pointer.x, pointer.y);
        const direction = deltaY > 0 ? -1 : 1;
        const nextZoom = PhaserMath.Clamp(
            camera.zoom + direction * this.zoomStep,
            this.minZoom,
            this.maxZoom,
        );

        if (nextZoom === camera.zoom) {
            return;
        }

        camera.setZoom(nextZoom);

        const worldAfterZoom = camera.getWorldPoint(pointer.x, pointer.y);
        camera.scrollX += worldBeforeZoom.x - worldAfterZoom.x;
        camera.scrollY += worldBeforeZoom.y - worldAfterZoom.y;
    }

    private handleResize(): void {
        const camera = this.scene.cameras.main;
        camera.setSize(this.scene.scale.width, this.scene.scale.height);
        camera.setBounds(
            this.worldBounds.x,
            this.worldBounds.y,
            this.worldBounds.width,
            this.worldBounds.height,
        );
    }

    private setCursor(cursor: "default" | "grab" | "grabbing"): void {
        this.scene.game.canvas.style.cursor = cursor;
    }
}
