import {
    Geom,
    Math as PhaserMath,
    type GameObjects,
    type Input,
    type Scene,
} from "phaser";

interface DungeonCameraOptions {
    minZoom?: number;
    maxZoom?: number;
    zoomStep?: number;
    worldPadding?: number;
    initialFitPadding?: number;
    keyboardPanSpeed?: number;
}

export class DungeonCameraController {
    private readonly minZoom: number;
    private readonly maxZoom: number;
    private readonly zoomStep: number;
    private readonly focusBounds: Geom.Rectangle;
    private readonly worldPadding: number;
    private readonly initialFitPadding: number;
    private readonly keyboardPanSpeed: number;
    private readonly movementKeys: Record<"up" | "left" | "down" | "right", Input.Keyboard.Key>;
    private worldBounds = new Geom.Rectangle();
    private isDragging = false;

    constructor(
        private readonly scene: Scene,
        focusBounds: Geom.Rectangle,
        options: DungeonCameraOptions = {},
    ) {
        this.minZoom = options.minZoom ?? 0.25;
        this.maxZoom = options.maxZoom ?? 2;
        this.zoomStep = options.zoomStep ?? 0.12;

        this.focusBounds = new Geom.Rectangle(
            focusBounds.x,
            focusBounds.y,
            focusBounds.width,
            focusBounds.height,
        );
        // Reserve ample build space around the current dungeon so future map
        // branches do not immediately collide with the camera boundary.
        this.worldPadding = options.worldPadding ?? 1400;
        this.initialFitPadding = options.initialFitPadding ?? 140;
        this.keyboardPanSpeed = options.keyboardPanSpeed ?? 650;
        this.movementKeys = this.scene.input.keyboard!.addKeys({
            up: "W",
            left: "A",
            down: "S",
            right: "D",
        }) as Record<"up" | "left" | "down" | "right", Input.Keyboard.Key>;

        this.configureCamera();
        this.bindInput();
    }

    destroy(): void {
        this.scene.input.off("pointerdown", this.handlePointerDown, this);
        this.scene.input.off("pointermove", this.handlePointerMove, this);
        this.scene.input.off("pointerup", this.handlePointerUp, this);
        this.scene.input.off("pointerupoutside", this.handlePointerUp, this);
        this.scene.input.off("wheel", this.handleWheel, this);
        this.scene.scale.off("resize", this.handleResize, this);
        this.scene.events.off("update", this.handleUpdate, this);
        for (const key of Object.values(this.movementKeys)) key.destroy();
        this.setCursor("default");
    }

    private configureCamera(): void {
        const camera = this.scene.cameras.main;
        const fitZoom = Math.min(
            camera.width / (this.focusBounds.width + this.initialFitPadding * 2),
            camera.height / (this.focusBounds.height + this.initialFitPadding * 2),
            1,
        );

        camera.setZoom(PhaserMath.Clamp(fitZoom, this.minZoom, this.maxZoom));
        this.refreshWorldBounds();
        camera.centerOn(this.focusBounds.centerX, this.focusBounds.centerY);
    }

    private bindInput(): void {
        this.scene.input.mouse?.disableContextMenu();
        this.scene.input.on("pointerdown", this.handlePointerDown, this);
        this.scene.input.on("pointermove", this.handlePointerMove, this);
        this.scene.input.on("pointerup", this.handlePointerUp, this);
        this.scene.input.on("pointerupoutside", this.handlePointerUp, this);
        this.scene.input.on("wheel", this.handleWheel, this);
        this.scene.scale.on("resize", this.handleResize, this);
        this.scene.events.on("update", this.handleUpdate, this);
        this.setCursor("grab");
    }

    private handleUpdate(_time: number, delta: number): void {
        const horizontal =
            (this.movementKeys.right.isDown ? 1 : 0) -
            (this.movementKeys.left.isDown ? 1 : 0);
        const vertical =
            (this.movementKeys.down.isDown ? 1 : 0) -
            (this.movementKeys.up.isDown ? 1 : 0);

        if (horizontal === 0 && vertical === 0) return;

        const camera = this.scene.cameras.main;
        const length = Math.hypot(horizontal, vertical);
        const distance =
            (this.keyboardPanSpeed * Math.min(delta, 50)) / 1000 / camera.zoom;

        camera.scrollX += (horizontal / length) * distance;
        camera.scrollY += (vertical / length) * distance;
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
        _gameObjects: GameObjects.GameObject[],
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
        this.refreshWorldBounds();

        const worldAfterZoom = camera.getWorldPoint(pointer.x, pointer.y);
        camera.scrollX += worldBeforeZoom.x - worldAfterZoom.x;
        camera.scrollY += worldBeforeZoom.y - worldAfterZoom.y;
    }

    private handleResize(): void {
        const camera = this.scene.cameras.main;
        camera.setSize(this.scene.scale.width, this.scene.scale.height);
        this.refreshWorldBounds();
    }

    private refreshWorldBounds(): void {
        const camera = this.scene.cameras.main;
        const paddedWidth = this.focusBounds.width + this.worldPadding * 2;
        const paddedHeight = this.focusBounds.height + this.worldPadding * 2;

        // Camera bounds must never be smaller than the visible world-space
        // viewport. If they are, Phaser can clamp the camera away from the map
        // on large screens or at the minimum zoom level.
        const minimumWidth = camera.width / camera.zoom;
        const minimumHeight = camera.height / camera.zoom;
        const width = Math.max(paddedWidth, minimumWidth);
        const height = Math.max(paddedHeight, minimumHeight);

        this.worldBounds.setTo(
            this.focusBounds.centerX - width / 2,
            this.focusBounds.centerY - height / 2,
            width,
            height,
        );

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
