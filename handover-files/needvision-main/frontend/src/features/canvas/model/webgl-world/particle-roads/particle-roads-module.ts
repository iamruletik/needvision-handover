import { MathUtils, type WebGPURenderer } from 'three/webgpu';
import type { World } from '../../World';
import { HOVER_FOG_REVEAL_DAMP_LAMBDA } from '../constants';
import type { WorldFrameContext } from '../core/world-frame-context';
import { PARTICLE_ROAD_WORLD_BINDINGS, createParticleRoad } from '../objects/ParticleRoad';

export type ParticleRoadEntry = {
    buildingId: number;
    road: ReturnType<typeof createParticleRoad>;
    opacity: number;
};

export class ParticleRoadsModule {
    private instances: ParticleRoadEntry[] = [];

    constructor(private readonly world: World) {}

    clear() {
        this.instances = [];
    }

    setInstances(next: ParticleRoadEntry[]) {
        this.instances = next;
    }

    getInstances(): readonly ParticleRoadEntry[] {
        return this.instances;
    }

    bootstrapFromCityBinding(renderer: WebGPURenderer) {
        const w = this.world;
        const next: ParticleRoadEntry[] = [];

        for (const { planeMeshName, create } of PARTICLE_ROAD_WORLD_BINDINGS) {
            const buildingId = w.cityHover.cityPlaneHoverBuildingIdByMeshName.get(planeMeshName) ?? -1;

            if (buildingId <= 0) {
                continue;
            }

            const road = create(renderer, w.particleRoadGui);

            w.scene.add(road.mesh);
            next.push({ buildingId, road, opacity: 0 });
        }

        this.instances = next;
    }

    syncMeshesFromGui() {
        const g = this.world.particleRoadGui;

        for (const entry of this.instances) {
            entry.road.syncParams({
                color: g.color,
                size: g.size,
                speed: g.speed,
                opacity: entry.opacity,
            });
        }
    }

    update(ctx: WorldFrameContext) {
        const hoverId = this.world.cityHover.rayTargetId;
        const { delta } = ctx;

        for (const entry of this.instances) {
            const targetOpacity = hoverId === entry.buildingId ? 1 : 0;
            const isHoverIn = targetOpacity === 1;

            if (isHoverIn) {
                const lambda = HOVER_FOG_REVEAL_DAMP_LAMBDA * (0.2 + entry.opacity * 3);

                entry.opacity = MathUtils.damp(entry.opacity, 1, lambda, delta);
            } else {
                entry.opacity = MathUtils.damp(entry.opacity, 0, HOVER_FOG_REVEAL_DAMP_LAMBDA * 5, delta);
            }
        }

        this.syncMeshesFromGui();
    }

    rebuildRoadsKeepingOpacity(renderer: WebGPURenderer) {
        const w = this.world;
        const opacityByBuilding = new Map(this.instances.map((e) => [e.buildingId, e.opacity]));

        for (const { road } of this.instances) {
            w.scene.remove(road.mesh);
            const material = road.mesh.material;

            if (Array.isArray(material)) {
                for (const m of material) {
                    m.dispose();
                }
            } else {
                material.dispose();
            }
        }

        this.instances = [];

        for (const { planeMeshName, create } of PARTICLE_ROAD_WORLD_BINDINGS) {
            const buildingId = w.cityHover.cityPlaneHoverBuildingIdByMeshName.get(planeMeshName) ?? -1;

            if (buildingId <= 0) {
                continue;
            }

            const road = create(renderer, w.particleRoadGui);
            const opacity = opacityByBuilding.get(buildingId) ?? 0;

            w.scene.add(road.mesh);
            this.instances.push({ buildingId, road, opacity });
        }

        this.syncMeshesFromGui();
        w.postFx.markNeedsUpdate();
    }

    dispose() {
        const w = this.world;

        for (const { road } of this.instances) {
            w.scene.remove(road.mesh);
            const material = road.mesh.material;

            if (Array.isArray(material)) {
                for (const m of material) {
                    m.dispose();
                }
            } else {
                material.dispose();
            }
        }

        this.instances = [];
    }
}
