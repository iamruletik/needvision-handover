/// <reference lib="webworker" />
import {
    Color,
    MathUtils,
    Mesh,
    type MeshBasicNodeMaterial,
    PerspectiveCamera,
    Scene,
    Texture,
    Timer,
    TimestampQuery,
    type ToneMapping,
    Vector2,
    Vector3,
    WebGPURenderer,
} from 'three/webgpu';
import type { Pane } from 'tweakpane';
import '../lib/active-frame';
import { Pointer } from '../utils/Pointer';
import type { ActiveFramePlayer } from './active-frame-types';
import type { CanvasData, ExperienceRevealParams, HeaderLogoRect, IWorld } from './types';
import {
    CameraRigModule,
    CityHoverModule,
    EnvironmentModule,
    ParticleRoadsModule,
    PostProcessingModule,
    ScrollTransitionModule,
    SpotlightModule,
    WaterSurfaceModule,
    WorldDebugModule,
    type WorldFrameContext,
    WorldStatsModule,
    runWorldBootstrap,
} from './webgl-world';
import { SCROLL_WEBGL_COMPLETE_EPS } from './webgl-world/constants';
import type { createWorldPostProcessing } from './webgl-world/create-post-processing';
import type { WaterGuiParams } from './webgl-world/create-water-reflector-plane';
import type { CityGuiParams } from './webgl-world/load-city-glb';
import type { ScrollTransitionTweaks } from './webgl-world/scroll-transition-post-tsl';
import { disposeCityMeshBvh } from './webgl-world/setup-city-mesh-bvh';
import { createWorldGuiState } from './webgl-world/world-tweak-url';

export class World implements IWorld {
    private static instance: World | null = null;

    static getInstance(): World {
        if (!World.instance) {
            throw new Error('[World] getInstance() called before initialization');
        }

        return World.instance;
    }

    canvas: HTMLCanvasElement | OffscreenCanvas;
    renderer: WebGPURenderer;
    camera: PerspectiveCamera | null = null;
    scene: Scene;
    clock = new Timer();
    prevTime = 0;
    pointerHandler!: Pointer;
    scrollProgress = 0;
    cameraPositionInitial = new Vector3();
    cameraPositionFinal = new Vector3(0, -7, 200);
    cameraLookAt = new Vector3();
    tweakPane?: Pane;

    volumetricMaterial!: MeshBasicNodeMaterial;

    volumetricGui!: {
        attenuation: number;
        anglePower: number;
        resolutionScale: number;
        depthContactSoftness: number;
        coneBaseFade: number;
        coneApexRadius: number;
    };

    spotLightParams!: {
        color: string;
        intensity: number;
        decay: number;
        angleDeg: number;
        penumbra: number;
    };

    waterGui!: WaterGuiParams;

    rendererGui!: {
        toneMapping: ToneMapping;
        toneMappingExposure: number;
    };

    cityGui!: CityGuiParams;
    sceneGui!: { background: string };
    envGui!: {
        intensity: number;
        rotationXDeg: number;
        rotationYDeg: number;
        rotationZDeg: number;
    };

    readonly emissiveBloomGui!: ReturnType<typeof createWorldGuiState>['emissiveBloomGui'];
    scrollTransitionGui!: ScrollTransitionTweaks;
    particleRoadGui!: ReturnType<typeof createWorldGuiState>['particleRoadGui'];

    volumetricPass?: ReturnType<typeof createWorldPostProcessing>['volumetricPass'];
    scrollTransitionProgress?: ReturnType<typeof createWorldPostProcessing>['scrollTransitionProgress'];
    scrollTransitionTime?: ReturnType<typeof createWorldPostProcessing>['scrollTransitionTime'];
    scrollTransitionTweakUniforms?: ReturnType<typeof createWorldPostProcessing>['scrollTransitionTweakUniforms'];
    scrollTransitionViewportPixelSize?: { value: Vector2 };
    scrollTransitionUnderwaterTexture?: Texture;
    scrollTransitionUnderwaterCanvas?: OffscreenCanvas;
    scrollTransitionUnderwaterCtx?: OffscreenCanvasRenderingContext2D;
    scrollTransitionNoiseTexture?: Texture;
    scrollTransitionUnderwaterImageSize?: { value: Vector2 };
    afPlayer?: ActiveFramePlayer;

    experienceRevealUniforms?: ReturnType<typeof createWorldPostProcessing>['experienceRevealUniforms'];
    experienceCameraRevealBlend = 0;

    emissiveBloom?: ReturnType<typeof createWorldPostProcessing>['emissiveBloom'];

    syncCityMaterials?: () => void;

    disposed = false;
    headerLogoRect: HeaderLogoRect | null = null;

    readonly cameraRig = new CameraRigModule(this);
    readonly scrollTransition = new ScrollTransitionModule(this);
    readonly cityHover = new CityHoverModule(this);
    readonly spotlight = new SpotlightModule(this);
    readonly waterSurface = new WaterSurfaceModule(this);
    readonly particleRoads = new ParticleRoadsModule(this);
    readonly postFx = new PostProcessingModule(this);
    readonly runtimeStats = new WorldStatsModule();
    readonly environment = new EnvironmentModule(this);
    readonly worldDebug = new WorldDebugModule(this);

    private isRendering = false;
    private disposeDone: Promise<void> | null = null;

    constructor(readonly options: CanvasData) {
        this.render = this.render.bind(this);

        if (World.instance) {
            throw new Error('[World] multiple instances forbidden (singleton)');
        }

        World.instance = this;

        const gui = createWorldGuiState();

        this.rendererGui = gui.rendererGui;
        this.envGui = gui.envGui;
        this.waterGui = gui.waterGui;
        this.spotLightParams = gui.spotLightParams;
        this.volumetricGui = gui.volumetricGui;
        this.cityGui = gui.cityGui;
        this.emissiveBloomGui = gui.emissiveBloomGui;
        this.sceneGui = gui.sceneGui;
        this.scrollTransitionGui = gui.scrollTransitionGui;
        this.particleRoadGui = gui.particleRoadGui;

        this.canvas = options.canvas;

        if (!('style' in this.canvas)) {
            (this.canvas as OffscreenCanvas & { style: { width: number; height: number } }).style = {
                width: options.width,
                height: options.height,
            };
        }

        this.canvas.width = options.width * options.dpr;
        this.canvas.height = options.height * options.dpr;

        this.renderer = new WebGPURenderer({
            canvas: this.canvas,
            antialias: false,
            powerPreference: 'high-performance',
        });
        this.renderer.toneMapping = this.rendererGui.toneMapping;
        this.renderer.toneMappingExposure = this.rendererGui.toneMappingExposure;
        this.renderer.setPixelRatio(this.options.dpr);
        this.renderer.setSize(options.width, options.height);

        this.scene = new Scene();
        this.scene.background = new Color(this.sceneGui.background);

        this.renderer.init().then(async () => {
            if (this.disposed) {
                return;
            }

            await runWorldBootstrap(this, options);
        });
    }

    get isAnimationLoopRunning(): boolean {
        return this.animationLoopRunning;
    }

    private animationLoopRunning = false;

    update(ctx: WorldFrameContext) {
        if (!this.camera || !this.pointerHandler || !this.renderer.hasInitialized() || this.disposed) {
            return;
        }

        this.cameraRig.update(ctx);
        this.spotlight.syncFromHeaderLogo();
        this.scrollTransition.update(ctx);
        this.pointerHandler.update(ctx.delta);
        this.cityHover.update(ctx);
        this.waterSurface.update(ctx);
        this.particleRoads.update(ctx);
        this.spotlight.update(ctx);
    }

    syncAnimationLoopWithScrollProgress() {
        if (!this.renderer.hasInitialized() || this.disposed || !this.pointerHandler) {
            return;
        }

        const complete = this.scrollProgress >= 1 - SCROLL_WEBGL_COMPLETE_EPS;

        if (complete) {
            if (this.animationLoopRunning) {
                this.renderer.setAnimationLoop(null);
                this.animationLoopRunning = false;
                this.render();
            }
        } else if (!this.animationLoopRunning) {
            this.renderer.setAnimationLoop(this.render);
            this.animationLoopRunning = true;
        }
    }

    setScrollProgress(progress: number) {
        this.scrollProgress = MathUtils.clamp(progress, 0, 1);
        this.syncAnimationLoopWithScrollProgress();
        this.spotlight.syncFromHeaderLogo();
    }

    revealExperience(params: ExperienceRevealParams) {
        const u = this.experienceRevealUniforms;

        if (!u) {
            return;
        }

        u.reveal.value = MathUtils.clamp(params.reveal, 0, 1);
        this.experienceCameraRevealBlend = MathUtils.clamp(
            params.cameraReveal !== undefined ? params.cameraReveal : params.reveal,
            0,
            1,
        );

        if (params.center) {
            (u.center.value as Vector2).set(params.center.x, params.center.y);
        }

        if (params.maxRadius !== undefined) {
            u.maxRadius.value = params.maxRadius;
        }

        if (params.edgeSoftness !== undefined) {
            u.edgeSoftness.value = params.edgeSoftness;
        }
    }

    setPointerPosition(x: number, y: number) {
        this.pointerHandler?.updatePosition(x, y);
    }

    setCityHoverColoringEnabled(enabled: boolean) {
        this.cityHover.setColoringActive(enabled);
    }

    setHeaderLogoRect(rect: HeaderLogoRect | null) {
        this.headerLogoRect = rect;
        this.spotlight.syncFromHeaderLogo();
    }

    getHeaderLogoRect(): HeaderLogoRect | null {
        return this.headerLogoRect;
    }

    onResize([width, height, dpr]: [width: number, height: number, dpr: number]) {
        const currentSize = this.renderer.getSize(new Vector2());

        if (currentSize.x !== width || currentSize.y !== height) {
            this.options.width = width;
            this.options.height = height;
            this.options.dpr = dpr;
            this.pointerHandler?.updateCanvasDomSize(width, height);
            this.renderer.setPixelRatio(dpr);
            this.renderer.setSize(width, height);

            if (this.camera) {
                this.camera.aspect = width / height;
                this.camera.updateProjectionMatrix();
            }

            this.scrollTransitionViewportPixelSize?.value.set(width, height);
        }

        this.spotlight.syncFromHeaderLogo();
    }

    async render() {
        if (
            this.disposed ||
            this.isRendering ||
            !this.renderer.hasInitialized() ||
            !this.camera ||
            !this.pointerHandler
        ) {
            return;
        }

        this.isRendering = true;
        const rs = this.runtimeStats;

        try {
            rs.beginProfilerFrame();

            this.clock.update();
            const elapsedTime = this.clock.getElapsed();
            const delta = Math.min(elapsedTime - this.prevTime, 0.1);

            this.prevTime = elapsedTime;

            if (process.env.NODE_ENV === 'development') {
                rs.updateStatsHud();
            }

            const frameCtx: WorldFrameContext = { delta, elapsedTime };

            this.update(frameCtx);

            this.postFx.render();

            rs.updateRendererStats(this.renderer, this.scene);

            if (process.env.NODE_ENV === 'development') {
                await this.renderer.resolveTimestampsAsync(TimestampQuery.COMPUTE);
                await this.renderer.resolveTimestampsAsync(TimestampQuery.RENDER);
            }
        } finally {
            this.isRendering = false;

            if (process.env.NODE_ENV === 'development') {
                rs.endProfilerFrame(this.options);
            }
        }
    }

    dispose(): void {
        this.beginDispose();
    }

    beginDispose(): Promise<void> {
        if (this.disposeDone) {
            return this.disposeDone;
        }

        this.disposed = true;
        World.instance = null;

        this.animationLoopRunning = false;
        this.renderer.setAnimationLoop(null);
        this.disposeDone = this.finishDisposeAsync();

        return this.disposeDone;
    }

    private async finishDisposeAsync() {
        const deadline = performance.now() + 5000;

        while (this.isRendering && performance.now() < deadline) {
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve());
            });
        }

        this.worldDebug.dispose();

        this.runtimeStats.disposeDom();

        this.scene.environment = null;
        this.scene.background = null;
        this.environment.disposeSharedEnv();

        this.afPlayer?.destroy();
        this.afPlayer = undefined;

        this.scrollTransitionUnderwaterTexture?.dispose();
        this.scrollTransitionUnderwaterTexture = undefined;
        this.scrollTransitionUnderwaterCanvas = undefined;
        this.scrollTransitionUnderwaterCtx = undefined;
        this.scrollTransitionNoiseTexture?.dispose();
        this.scrollTransitionNoiseTexture = undefined;

        this.waterSurface.dispose();

        disposeCityMeshBvh(this.cityHover.cityBatchedMesh);
        this.cityHover.cityBatchedMesh = null;

        this.spotlight.disposeVolumetricMeshFromScene({
            remove: (m: Mesh) => {
                this.scene.remove(m);
            },
        });

        this.particleRoads.dispose();

        if (!this.renderer.hasInitialized()) {
            return;
        }

        await this.flushGpuQueueBeforeRendererDispose();

        try {
            this.renderer.dispose();
        } catch (err) {
            const isAbort =
                (err instanceof DOMException && err.name === 'AbortError') ||
                (err instanceof Error && err.name === 'AbortError');

            if (!isAbort) {
                throw err;
            }
        }
    }

    private async flushGpuQueueBeforeRendererDispose() {
        try {
            const backend = this.renderer.backend as { device?: GPUDevice } | undefined;
            const queue = backend?.device?.queue;

            if (queue && typeof queue.onSubmittedWorkDone === 'function') {
                await queue.onSubmittedWorkDone();
            }
        } catch {
            /* ignore */
        }
    }
}
