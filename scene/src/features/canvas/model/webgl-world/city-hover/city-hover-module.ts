import { MathUtils, Mesh, Raycaster, Vector3 } from 'three/webgpu';
import type { World } from '../../World';
import { snapCityBuildingId } from '../batch-city-meshes';
import {
    CITY_HOVER_RADIAL_MASK_MAX,
    CITY_HOVER_RAY_STICKY_FRAMES,
    CITY_HOVER_TRANSITION_DAMP_LAMBDA,
    SCROLL_CITY_RAYCAST_MAX,
} from '../constants';
import type { WorldFrameContext } from '../core/world-frame-context';
import type { loadCityGlb } from '../load-city-glb';

export class CityHoverModule {
    private readonly cityHoverRaycaster = (() => {
        const r = new Raycaster();

        r.firstHitOnly = true;

        return r;
    })();

    cityBatchedMesh: Mesh | null = null;
    cityPlaneHoverMeshes: Mesh[] = [];
    cityPlaneHoverBuildingIdByMeshName: ReadonlyMap<string, number> = new Map();
    private hoverPrevIdUniform?: { get value(): number; set value(v: number) };
    private hoverCurrIdUniform?: { get value(): number; set value(v: number) };
    private hoverTransitionBlendUniform?: { get value(): number; set value(v: number) };
    private hoverFillPrevUniform?: { get value(): number; set value(v: number) };
    private hoverFillCurrUniform?: { get value(): number; set value(v: number) };
    private hoverFogCenterPrev?: { value: Vector3 };
    private hoverFogCenterCurr?: { value: Vector3 };
    private hoverRadialExtentPrev?: { value: number };
    private hoverRadialExtentCurr?: { value: number };
    private hoverColoringActiveUniform?: { value: number };
    rayTargetId = -1;
    private rayConsecutiveMissFrames = 0;
    private buildingCentersById?: ReadonlyMap<number, Vector3>;
    private buildingMaxRadiusById?: ReadonlyMap<number, number>;
    coloringActive = false;

    constructor(private readonly world: World) {}

    applyCityLoad(cityLoad: NonNullable<Awaited<ReturnType<typeof loadCityGlb>>>) {
        this.cityBatchedMesh = cityLoad.batchedCityMesh;
        this.hoverPrevIdUniform = cityLoad.hoverPrevIdUniform as typeof this.hoverPrevIdUniform;
        this.hoverCurrIdUniform = cityLoad.hoverCurrIdUniform as typeof this.hoverCurrIdUniform;
        this.hoverTransitionBlendUniform = cityLoad.hoverTransitionBlendUniform as typeof this.hoverTransitionBlendUniform;
        this.hoverFillPrevUniform = cityLoad.hoverFillPrevUniform as typeof this.hoverFillPrevUniform;
        this.hoverFillCurrUniform = cityLoad.hoverFillCurrUniform as typeof this.hoverFillCurrUniform;
        this.rayTargetId = -1;
        this.rayConsecutiveMissFrames = 0;
        this.buildingCentersById = cityLoad.buildingCentersById;
        this.buildingMaxRadiusById = cityLoad.buildingMaxRadiusById;
        this.hoverFogCenterPrev = cityLoad.hoverFogCenterPrev as typeof this.hoverFogCenterPrev;
        this.hoverFogCenterCurr = cityLoad.hoverFogCenterCurr as typeof this.hoverFogCenterCurr;
        this.hoverRadialExtentPrev = cityLoad.hoverRadialExtentPrev as typeof this.hoverRadialExtentPrev;
        this.hoverRadialExtentCurr = cityLoad.hoverRadialExtentCurr as typeof this.hoverRadialExtentCurr;
        this.hoverColoringActiveUniform = cityLoad.hoverColoringActiveUniform as typeof this.hoverColoringActiveUniform;

        if (this.hoverColoringActiveUniform) {
            this.hoverColoringActiveUniform.value = this.coloringActive ? 1 : 0;
        }

        this.cityPlaneHoverMeshes = cityLoad.cityPlaneHoverMeshes;
        this.cityPlaneHoverBuildingIdByMeshName = cityLoad.cityPlaneHoverBuildingIdByMeshName;
    }

    setColoringActive(enabled: boolean) {
        this.coloringActive = enabled;

        if (this.hoverColoringActiveUniform) {
            this.hoverColoringActiveUniform.value = enabled ? 1 : 0;
        }
    }

    clearCity() {
        this.cityBatchedMesh = null;
        this.cityPlaneHoverMeshes = [];
        this.cityPlaneHoverBuildingIdByMeshName = new Map();
        this.hoverPrevIdUniform = undefined;
        this.hoverCurrIdUniform = undefined;
        this.hoverTransitionBlendUniform = undefined;
        this.hoverFillPrevUniform = undefined;
        this.hoverFillCurrUniform = undefined;
        this.hoverFogCenterPrev = undefined;
        this.hoverFogCenterCurr = undefined;
        this.hoverRadialExtentPrev = undefined;
        this.hoverRadialExtentCurr = undefined;
        this.hoverColoringActiveUniform = undefined;
        this.rayTargetId = -1;
        this.rayConsecutiveMissFrames = 0;
        this.buildingCentersById = undefined;
        this.buildingMaxRadiusById = undefined;
    }

    update(ctx: WorldFrameContext) {
        const w = this.world;
        const delta = ctx.delta;

        if (
            !this.coloringActive ||
            (!this.cityBatchedMesh && this.cityPlaneHoverMeshes.length === 0) ||
            !this.hoverPrevIdUniform ||
            !this.hoverCurrIdUniform ||
            !this.hoverTransitionBlendUniform ||
            !this.hoverFillPrevUniform ||
            !this.hoverFillCurrUniform
        ) {
            return;
        }

        const camera = w.camera;
        const pointerHandler = w.pointerHandler;

        if (!camera || !pointerHandler) {
            return;
        }

        let rayBuildingId = -1;

        if (w.scrollProgress < SCROLL_CITY_RAYCAST_MAX) {
            camera.updateMatrixWorld(true);
            this.cityBatchedMesh?.updateMatrixWorld(true);
            this.cityHoverRaycaster.setFromCamera(pointerHandler.pointer, camera);

            let cityId = -1;
            let cityDist = Infinity;

            if (this.cityBatchedMesh) {
                const cityHits = this.cityHoverRaycaster.intersectObject(this.cityBatchedMesh, false);

                if (cityHits.length > 0) {
                    const hit = cityHits[0];
                    const geom = this.cityBatchedMesh.geometry;
                    const buildingAttr = geom.getAttribute('buildingId');
                    const indexBuf = geom.getIndex();

                    if (buildingAttr && indexBuf && hit.faceIndex != null) {
                        const vx = indexBuf.getX(hit.faceIndex * 3);

                        cityId = snapCityBuildingId(buildingAttr.getX(vx));

                        if (cityId > 0) {
                            cityDist = hit.distance;
                        }
                    }
                }
            }

            let planeId = -1;
            let planeDist = Infinity;

            if (this.cityPlaneHoverMeshes.length > 0) {
                const planeHits = this.cityHoverRaycaster.intersectObjects(this.cityPlaneHoverMeshes, false);

                if (planeHits.length > 0) {
                    const hit = planeHits[0];

                    if (hit.object instanceof Mesh) {
                        planeId = this.cityPlaneHoverBuildingIdByMeshName.get(hit.object.name) ?? -1;

                        if (planeId > 0) {
                            planeDist = hit.distance;
                        }
                    }
                }
            }

            let rawRayBuildingId = -1;

            if (cityId > 0 && planeId > 0) {
                rawRayBuildingId = cityDist <= planeDist ? cityId : planeId;
            } else if (cityId > 0) {
                rawRayBuildingId = cityId;
            } else if (planeId > 0) {
                rawRayBuildingId = planeId;
            }

            if (rawRayBuildingId > 0) {
                this.rayConsecutiveMissFrames = 0;
                rayBuildingId = rawRayBuildingId;
            } else {
                this.rayConsecutiveMissFrames++;

                if (this.rayConsecutiveMissFrames <= CITY_HOVER_RAY_STICKY_FRAMES && this.rayTargetId > 0) {
                    rayBuildingId = this.rayTargetId;
                }
            }
        } else {
            this.rayConsecutiveMissFrames = 0;
        }

        if (rayBuildingId !== this.rayTargetId) {
            const oldCurr = snapCityBuildingId(this.hoverCurrIdUniform.value);
            const oldFillCurr = this.hoverFillCurrUniform.value;
            const committedBefore = this.rayTargetId;

            this.hoverPrevIdUniform.value = committedBefore > 0 ? committedBefore : oldCurr;
            this.hoverCurrIdUniform.value = rayBuildingId;
            this.hoverTransitionBlendUniform.value = 0;

            if (rayBuildingId > 0) {
                this.hoverFillCurrUniform.value = 0;
            }

            if (committedBefore > 0 && committedBefore !== rayBuildingId) {
                this.hoverFillPrevUniform.value = oldFillCurr;
            }

            this.rayTargetId = rayBuildingId;
        }

        this.hoverTransitionBlendUniform.value = MathUtils.damp(
            this.hoverTransitionBlendUniform.value,
            1,
            CITY_HOVER_TRANSITION_DAMP_LAMBDA,
            delta,
        );

        const fillCurrTarget = rayBuildingId > 0 ? 1 : 0;

        this.hoverFillCurrUniform.value = MathUtils.damp(
            this.hoverFillCurrUniform.value,
            fillCurrTarget,
            CITY_HOVER_TRANSITION_DAMP_LAMBDA,
            delta,
        );

        const prevId = Math.round(this.hoverPrevIdUniform.value);

        if (prevId <= 0) {
            this.hoverFillPrevUniform.value = 0;
        } else {
            this.hoverFillPrevUniform.value = MathUtils.damp(
                this.hoverFillPrevUniform.value,
                0,
                CITY_HOVER_TRANSITION_DAMP_LAMBDA,
                delta,
            );
        }

        if (this.buildingCentersById && this.hoverFogCenterPrev && this.hoverFogCenterCurr) {
            const prevIdx = Math.round(this.hoverPrevIdUniform.value);
            const currIdx = Math.round(this.hoverCurrIdUniform.value);
            const cPrev = this.buildingCentersById.get(prevIdx);
            const cCurr = this.buildingCentersById.get(currIdx);

            if (cPrev) {
                this.hoverFogCenterPrev.value.copy(cPrev);
            }

            if (cCurr) {
                this.hoverFogCenterCurr.value.copy(cCurr);
            }

            if (this.buildingMaxRadiusById && this.hoverRadialExtentPrev && this.hoverRadialExtentCurr) {
                this.hoverRadialExtentPrev.value =
                    this.buildingMaxRadiusById.get(prevIdx) ?? CITY_HOVER_RADIAL_MASK_MAX;
                this.hoverRadialExtentCurr.value =
                    this.buildingMaxRadiusById.get(currIdx) ?? CITY_HOVER_RADIAL_MASK_MAX;
            }
        }
    }
}
