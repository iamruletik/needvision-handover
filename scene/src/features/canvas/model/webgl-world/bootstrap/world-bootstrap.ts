import Stats, { StatsProfiler } from 'stats-gl';
import { uniform } from 'three/tsl';
import { Layers, Mesh, Plane, SRGBColorSpace, Texture, Vector2, Vector3 } from 'three/webgpu';
import { RendererStats } from '../../../lib/RendererStats';
import { Pointer } from '../../../utils/Pointer';
import type { World } from '../../World';
import { getActiveFrameConstructor } from '../../active-frame-types';
import type { CanvasData } from '../../types';
import { CITY_FLOOR_Y, LAYER_VOLUMETRIC_LIGHTING, SCROLL_WEBGL_COMPLETE_EPS } from '../constants';
import { createWorldPostProcessing } from '../create-post-processing';
import { createSpotConeUnitGeometry } from '../create-spot-volumetric-cone';
import { createWaterReflectorPlane } from '../create-water-reflector-plane';
import { loadCityGlb } from '../load-city-glb';
import { WATER_HDRI_URL, loadHdriEnvironmentMap } from '../load-hdri-environment';
import { loadScrollTransitionNoiseTexture } from '../load-scroll-transition-textures';
import { setupSceneLights } from '../setup-scene-lights';
import { applyParticleRoadGuiFromSearchParams } from '../world-tweak-url';

export async function runWorldBootstrap(world: World, options: CanvasData): Promise<void> {
    if (world.disposed) {
        return;
    }

    world.scrollTransitionUnderwaterCanvas = new OffscreenCanvas(1, 1);
    const uctx = world.scrollTransitionUnderwaterCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
    });

    if (!uctx) {
        throw new Error('[World] Failed to get 2D context for active-frame canvas');
    }

    world.scrollTransitionUnderwaterCtx = uctx;
    world.scrollTransitionUnderwaterTexture = new Texture(
        world.scrollTransitionUnderwaterCanvas as unknown as HTMLCanvasElement,
    );
    world.scrollTransitionUnderwaterTexture.colorSpace = SRGBColorSpace;
    world.scrollTransitionUnderwaterTexture.flipY = true;

    const [cityLoad, envMap, waterEnvMap, scrollNoiseTexture] = await Promise.all([
        loadCityGlb(
            world.renderer,
            world.cityGui,
            undefined,
            (camera) => {
                world.camera = camera;
                world.camera.near = 0.5;
                world.camera.far = 1000;
                world.cameraPositionInitial = world.camera.position.clone();

                world.pointerHandler = new Pointer(
                    options.width,
                    options.height,
                    world.camera,
                    new Plane(new Vector3(0, 0, 1), 0),
                );
            },
            () => ({
                map: world.environment.envMap!,
                envGui: world.envGui,
            }),
        ),
        loadHdriEnvironmentMap(world.renderer),
        loadHdriEnvironmentMap(world.renderer, WATER_HDRI_URL),
        loadScrollTransitionNoiseTexture(),
    ]);

    world.scrollTransitionNoiseTexture = scrollNoiseTexture;
    world.environment.setEnvMap(envMap);
    world.environment.setWaterEnvMap(waterEnvMap);

    if (world.disposed) {
        return;
    }

    if (cityLoad) {
        world.syncCityMaterials = cityLoad.syncCityMaterials;
        world.scene.add(cityLoad.group);
        world.syncCityMaterials?.();
        world.cityHover.applyCityLoad(cityLoad);
    }

    const water = createWaterReflectorPlane({
        scene: world.scene,
        waterEnvMap,
        floorY: CITY_FLOOR_Y,
        planeWidth: 40,
        planeDepth: 150,
        pointerHandler: world.pointerHandler,
        waterGui: world.waterGui,
        ...(cityLoad ? { filterReflectionByUserData: true } : {}),
    });

    world.waterSurface.setWater(water);

    if (!options.isWorker && typeof window !== 'undefined') {
        applyParticleRoadGuiFromSearchParams(new URLSearchParams(window.location.search), world.particleRoadGui);
    }

    world.particleRoads.bootstrapFromCityBinding(world.renderer);

    const spotLight = setupSceneLights({
        scene: world.scene,
        spotLightParams: world.spotLightParams,
        spotLightTargetSmooth: world.spotlight.spotLightTargetSmooth,
        pointerScenePointer: world.pointerHandler.scenePointer,
    });

    world.spotlight.syncFromHeaderLogo();

    if (world.disposed) {
        return;
    }

    const volumetricLightingIntensity = uniform(0.5);
    const volumetricLayer = new Layers();

    volumetricLayer.disableAll();
    volumetricLayer.enable(LAYER_VOLUMETRIC_LIGHTING);

    const {
        postProcessing,
        volumetricPass,
        volumetricMaterial,
        volumetricConeUniforms,
        scrollTransitionProgress,
        scrollTransitionTime,
        scrollTransitionTweakUniforms,
        scrollTransitionUnderwaterImageSize,
        scrollTransitionViewportPixelSize,
        experienceRevealUniforms,
        emissiveBloom,
    } = createWorldPostProcessing({
        renderer: world.renderer,
        scene: world.scene,
        camera: world.camera!,
        volumetricLayer,
        volumetricLightingIntensity,
        resolutionScale: world.volumetricGui.resolutionScale,
        volumetricAttenuation: world.volumetricGui.attenuation,
        volumetricAnglePower: world.volumetricGui.anglePower,
        volumetricDepthContactSoftness: world.volumetricGui.depthContactSoftness,
        volumetricConeBaseFade: world.volumetricGui.coneBaseFade,
        volumetricConeApexRadius: world.volumetricGui.coneApexRadius,
        volumetricLightColor: world.spotLightParams.color,
        emissiveBloomGui: world.emissiveBloomGui,
        underwaterTexture: world.scrollTransitionUnderwaterTexture,
        noiseTexture: world.scrollTransitionNoiseTexture,
        scrollTransitionGui: world.scrollTransitionGui,
    });

    world.postFx.setPostProcessing(postProcessing);
    world.volumetricPass = volumetricPass;
    world.scrollTransitionProgress = scrollTransitionProgress;
    world.scrollTransitionTime = scrollTransitionTime;
    world.scrollTransitionTweakUniforms = scrollTransitionTweakUniforms;
    world.scrollTransitionUnderwaterImageSize = scrollTransitionUnderwaterImageSize as { value: Vector2 };
    world.scrollTransitionViewportPixelSize = scrollTransitionViewportPixelSize as { value: Vector2 };
    world.volumetricMaterial = volumetricMaterial;
    world.experienceRevealUniforms = experienceRevealUniforms;
    world.emissiveBloom = emissiveBloom;

    const ActiveFrameCtor = getActiveFrameConstructor();
    let hardwareAcceleration: VideoDecoderConfig['hardwareAcceleration'] = 'prefer-hardware';

    if (typeof navigator !== 'undefined' && /\bAndroid\b/i.test(navigator.userAgent)) {
        hardwareAcceleration = 'prefer-software';
    }

    function checkSupport(codec: 'h264' | 'h265') {
        return VideoDecoder.isConfigSupported({
            codec: codec === 'h264' ? 'avc1.42c033' : 'hvc1.1.6.L120.90',
        });
    }

    let afSrc = options.afSrc.h264;

    if ((await checkSupport('h265')).supported && options.afSrc.h265) {
        afSrc = options.afSrc.h265;
    }

    world.afPlayer = new ActiveFrameCtor(afSrc, {
        hardwareAcceleration,
        closeFrameAfterProcess: true,
        process: (frame: VideoFrame) => {
            processActiveFrameIntoUnderwater(world, frame);
        },
    });

    await world.afPlayer.loading;

    if (world.disposed) {
        world.afPlayer?.destroy();
        world.afPlayer = undefined;

        return;
    }

    const manifest = world.afPlayer.manifest;

    if (manifest && world.scrollTransitionUnderwaterImageSize) {
        world.scrollTransitionUnderwaterImageSize.value.set(manifest.width, manifest.height);
    }

    world.afPlayer.setFrame(0);

    world.spotlight.primeVolumetricGuiUniforms(
        world.volumetricGui,
        world.spotLightParams.color,
        volumetricConeUniforms,
    );

    const coneGeometry = createSpotConeUnitGeometry({
        angleRad: spotLight.angle,
        apexRadiusWorld: world.volumetricGui.coneApexRadius,
        coneLengthWorld: volumetricConeUniforms.coneLength.value,
    });

    const volumetricMesh = new Mesh(coneGeometry, volumetricMaterial);

    volumetricMesh.layers.disableAll();
    volumetricMesh.layers.enable(LAYER_VOLUMETRIC_LIGHTING);
    world.scene.add(volumetricMesh);

    world.spotlight.finalizeBootstrap(spotLight, volumetricMesh, volumetricConeUniforms, {
        volumetricConeAngleRad: spotLight.angle,
        volumetricMeshGeomBakedLength: volumetricConeUniforms.coneLength.value,
        volumetricMeshGeomBakedApex: world.volumetricGui.coneApexRadius,
    });

    world.scrollTransition.resetAfFrameIndex();

    if (process.env.NODE_ENV === 'development') {
        const rs = world.runtimeStats;

        if (options.isWorker) {
            rs.statsProfiler = new StatsProfiler({
                trackGPU: true,
                trackCPT: true,
            });

            await rs.statsProfiler.init(world.renderer);

            if (world.disposed) {
                return;
            }
        } else {
            rs.stats = new Stats({
                trackGPU: true,
                trackCPT: true,
            });
            rs.stats.domElement.classList.add('stats-gl');
            rs.stats.init(world.renderer);
            document.body.appendChild(rs.stats.dom);

            rs.rendererStats = new RendererStats();
            document.body.appendChild(rs.rendererStats.element);
        }
    }

    if (!options.isWorker) {
        world.worldDebug.setup();
    }

    world.syncAnimationLoopWithScrollProgress();

    if (world.scrollProgress >= 1 - SCROLL_WEBGL_COMPLETE_EPS && !world.isAnimationLoopRunning) {
        world.render();
    }
    options.onInitialized?.();
}

function processActiveFrameIntoUnderwater(world: World, frame: VideoFrame) {
    const canvas = world.scrollTransitionUnderwaterCanvas;
    const tex = world.scrollTransitionUnderwaterTexture;
    const ct = world.scrollTransitionUnderwaterCtx;

    if (!canvas || !ct || !tex) {
        return;
    }

    const w = frame.displayWidth || frame.codedWidth;
    const h = frame.displayHeight || frame.codedHeight;

    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }

    ct.drawImage(frame, 0, 0, w, h);
    tex.needsUpdate = true;

    if (world.scrollTransitionUnderwaterImageSize) {
        world.scrollTransitionUnderwaterImageSize.value.set(w, h);
    }
}
