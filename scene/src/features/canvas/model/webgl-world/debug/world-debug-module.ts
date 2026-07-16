import { Pane } from 'tweakpane';
import type { World } from '../../World';
import { setupWorldTweakpane } from '../world-tweakpane';

export class WorldDebugModule {
    pane?: Pane;

    constructor(private readonly world: World) {}

    setup() {
        const w = this.world;
        const pane = new Pane({ title: 'Params' });

        this.pane = pane;

        setupWorldTweakpane({
            pane,
            renderer: w.renderer,
            rendererGui: w.rendererGui,
            scene: w.scene,
            sceneGui: w.sceneGui,
            envGui: w.envGui,
            spotLightParams: w.spotLightParams,
            spotLight: w.spotlight.getSpotLight(),
            volumetricPass: w.volumetricPass!,
            volumetricGui: w.volumetricGui,
            volumetricConeUniforms: w.spotlight.getVolumetricConeUniforms()!,
            emissiveBloomGui: w.emissiveBloomGui,
            emissiveBloom: w.emissiveBloom!,
            scrollTransitionGui: w.scrollTransitionGui,
            scrollTransitionTweakUniforms: w.scrollTransitionTweakUniforms!,
            waterGui: w.waterGui,
            syncWater: () => w.waterSurface.getWater()?.applyWaterMaterial(),
            invalidateRenderPipeline: () => w.postFx.markNeedsUpdate(),
            ...(w.syncCityMaterials
                ? {
                      cityGui: w.cityGui,
                      syncCity: () => w.syncCityMaterials?.(),
                  }
                : {}),
            particleRoadGui: w.particleRoadGui,
            syncParticleRoadFromGui: () => {
                w.particleRoads.syncMeshesFromGui();
                w.render();
            },
            rebuildParticleRoads: () => {
                w.particleRoads.rebuildRoadsKeepingOpacity(w.renderer);
                w.render();
            },
            onHdriFileSelected: (file: File) => {
                w.environment.applySceneHdriFromUploadedFile(file);
            },
            onWaterHdriFileSelected: (file: File) => {
                w.environment.applyWaterHdriFromUploadedFile(file);
            },
        });

        w.tweakPane = pane;
    }

    dispose() {
        this.pane?.dispose();
        this.pane = undefined;
    }
}
