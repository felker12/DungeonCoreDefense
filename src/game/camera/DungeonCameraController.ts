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
    southWorldPadding?: number;
    initialFitPadding?: number;
    keyboardPanSpeed?: number;
}

export class DungeonCameraController {
    private readonly minZoom: number;
    private readonly maxZoom: number;
    private readonly zoomStep: number;
    private readonly focusBounds: Geom.Rectangle;
    private readonly worldPadding: number;
    private readonly southWorldPadding: number;
    private readonly initialFitPadding: number;
    private readonly keyboardPanSpeed: number;
    private readonly movementKeys: Record<"up" | "left" | "down" | "right", Input.Keyboard.Key>;
    private worldBounds = new Geom.Rectangle();
    private isDragging = false;
    private targetZoom = 1;
    private isZooming = false;
    private zoomAnchorX: number | null = null;
    private zoomAnchorY: number | null = null;

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
        // Keep extra navigable space beneath the dungeon. At low zoom levels
        // the viewport covers far more world units, so a symmetric boundary
        // can make the dungeon appear pinned near the southern edge.
        this.southWorldPadding = options.southWorldPadding ?? 2800;
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

        this.targetZoom = PhaserMath.Clamp(fitZoom, this.minZoom, this.maxZoom);
        camera.setZoom(this.targetZoom);
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
        this.updateSmoothZoom(delta);

        const horizontal =
            (this.movementKeys.right.isDown ? 1 : 0) -
            (this.movementKeys.left.isDown ? 1 : 0);
        const vertical =
            (this.movementKeys.down.isDown ? 1 : 0) -
            (this.movementKeys.up.isDown ? 1 : 0);

        if (horizontal === 0 && vertical === 0) return;

        this.cancelSmoothZoom();

        const camera = this.scene.cameras.main;
        const length = Math.hypot(horizontal, vertical);
        const distance =
            (this.keyboardPanSpeed * Math.min(delta, 50)) / 1000 / camera.zoom;

        camera.scrollX += (horizontal / length) * distance;
        camera.scrollY += (vertical / length) * distance;
    }

    private handlePointerDown(pointer: Input.Pointer): void {
        if (pointer.leftButtonDown() || pointer.middleButtonDown()) {
            this.cancelSmoothZoom();
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
        _pointer: Input.Pointer,
        _gameObjects: GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
    ): void {
        if (deltaY === 0) return;

        const camera = this.scene.cameras.main;

        // Capture the world point at the viewport center once per zoom gesture.
        // Repeated wheel events update the target zoom without moving the anchor.
        if (!this.isZooming) {
            this.zoomAnchorX = camera.midPoint.x;
            this.zoomAnchorY = camera.midPoint.y;
        }

        const direction = deltaY > 0 ? -1 : 1;
        this.targetZoom = PhaserMath.Clamp(
            this.targetZoom + direction * this.zoomStep,
            this.minZoom,
            this.maxZoom,
        );
        this.isZooming = Math.abs(this.targetZoom - camera.zoom) > 0.001;
    }

    private handleResize(): void {
        const camera = this.scene.cameras.main;
        const centerX = camera.midPoint.x;
        const centerY = camera.midPoint.y;

        this.cancelSmoothZoom();
        camera.setSize(this.scene.scale.width, this.scene.scale.height);
        this.refreshWorldBounds();
        camera.centerOn(centerX, centerY);
    }

    private refreshWorldBounds(): void {
        const camera = this.scene.cameras.main;
        const paddedWidth = this.focusBounds.width + this.worldPadding * 2;
        const paddedHeight =
            this.focusBounds.height +
            this.worldPadding +
            this.southWorldPadding;

        // Keep a complete navigable margin outside the visible viewport even
        // at minimum zoom. Merely matching the viewport size removes all pan
        // range and can leave the dungeon unreachable after a resize or zoom.
        const viewportWidth = camera.width / camera.zoom;
        const viewportHeight = camera.height / camera.zoom;
        const minimumWidth = viewportWidth + this.worldPadding * 2;
        const minimumHeight =
            viewportHeight + this.worldPadding + this.southWorldPadding;
        const width = Math.max(paddedWidth, minimumWidth);
        const height = Math.max(paddedHeight, minimumHeight);

        this.worldBounds.setTo(
            this.focusBounds.centerX - width / 2,
            this.focusBounds.y - this.worldPadding,
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

    private updateSmoothZoom(delta: number): void {
        if (!this.isZooming) return;

        const camera = this.scene.cameras.main;
        const anchorX = this.zoomAnchorX ?? camera.midPoint.x;
        const anchorY = this.zoomAnchorY ?? camera.midPoint.y;
        const frameSeconds = Math.min(delta, 50) / 1000;
        const easing = 1 - Math.exp(-10 * frameSeconds);
        const nextZoom = PhaserMath.Linear(camera.zoom, this.targetZoom, easing);

        camera.setZoom(nextZoom);
        this.refreshWorldBounds();
        camera.centerOn(anchorX, anchorY);

        const zoomSettled = Math.abs(camera.zoom - this.targetZoom) < 0.001;

        if (zoomSettled) {
            camera.setZoom(this.targetZoom);
            this.refreshWorldBounds();
            camera.centerOn(anchorX, anchorY);
            this.isZooming = false;
            this.zoomAnchorX = null;
            this.zoomAnchorY = null;
        }
    }

    private cancelSmoothZoom(): void {
        const camera = this.scene.cameras.main;
        this.targetZoom = camera.zoom;
        this.isZooming = false;
        this.zoomAnchorX = null;
        this.zoomAnchorY = null;
    }

    private setCursor(cursor: "default" | "grab" | "grabbing"): void {
        this.scene.game.canvas.style.cursor = cursor;
    }
}
