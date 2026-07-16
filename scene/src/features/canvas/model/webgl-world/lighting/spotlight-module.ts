import { Mesh, type PerspectiveCamera, Plane, Raycaster, SpotLight, Vector2, Vector3 } from 'three/webgpu';
import type { World } from '../../World';
import {
    HEADER_LOGO_SPOT_SCREEN_ANCHOR_X,
    HEADER_LOGO_SPOT_SCREEN_ANCHOR_Y,
    SCROLL_SPOT_TARGET_END,
    SCROLL_SPOT_TARGET_START,
    SPOTLIGHT_POSITION,
    SPOTLIGHT_TARGET_ABOVE_WATER_Y,
    SPOTLIGHT_TARGET_POINTER_DAMP_LAMBDA,
    SPOTLIGHT_VOLUMETRIC_MAX_DISTANCE,
} from '../constants';
import type { WorldFrameContext } from '../core/world-frame-context';
import { type SpotVolumetricConeUniformsJs, createSpotConeUnitGeometry } from '../create-spot-volumetric-cone';
import { getScrollSpotRampT, getSpotAngleDecayForScroll, getSpotConeStaticBlendT } from '../setup-scene-lights';

export class SpotlightModule {
    private spotLight?: SpotLight;
    private volumetricMesh?: Mesh;
    private volumetricConeUniforms?: SpotVolumetricConeUniformsJs;

    readonly spotLightTargetSmooth = new Vector3();
    readonly spotLightTargetDesired = new Vector3();
    readonly volumetricConeAxisDir = new Vector3();
    volumetricConeAngleRad = -1;
    volumetricMeshGeomBakedLength = -1;
    volumetricMeshGeomBakedApex = -1;

    readonly logoSpotRaycaster = new Raycaster();
    readonly logoSpotNdc = new Vector2();
    readonly logoSpotHit = new Vector3();
    readonly logoSpotPlaneZ0 = new Plane(new Vector3(0, 0, 1), 0);

    readonly spotConeBlendPointerScratch = new Vector3();
    readonly spotConeBlendScrollScratch = new Vector3();

    constructor(private readonly world: World) {}

    finalizeBootstrap(
        spotLight: SpotLight,
        volumetricMesh: Mesh,
        volumetricConeUniforms: SpotVolumetricConeUniformsJs,
        bakedGeom: {
            volumetricConeAngleRad: number;
            volumetricMeshGeomBakedLength: number;
            volumetricMeshGeomBakedApex: number;
        },
    ) {
        this.spotLight = spotLight;
        this.volumetricMesh = volumetricMesh;
        this.volumetricConeUniforms = volumetricConeUniforms;
        this.volumetricConeAngleRad = bakedGeom.volumetricConeAngleRad;
        this.volumetricMeshGeomBakedLength = bakedGeom.volumetricMeshGeomBakedLength;
        this.volumetricMeshGeomBakedApex = bakedGeom.volumetricMeshGeomBakedApex;
    }

    primeVolumetricGuiUniforms(
        volumetricGui: {
            attenuation: number;
            anglePower: number;
            depthContactSoftness: number;
            coneBaseFade: number;
            coneApexRadius: number;
        },
        spotLightParamsColor: string,
        volumetricConeUniforms: SpotVolumetricConeUniformsJs,
    ) {
        volumetricConeUniforms.attenuation.value = volumetricGui.attenuation;
        volumetricConeUniforms.anglePower.value = volumetricGui.anglePower;
        volumetricConeUniforms.depthContactSoftness.value = volumetricGui.depthContactSoftness;
        volumetricConeUniforms.coneBaseFade.value = volumetricGui.coneBaseFade;
        volumetricConeUniforms.coneApexRadius.value = volumetricGui.coneApexRadius;
        volumetricConeUniforms.lightColor.value.set(spotLightParamsColor);
        volumetricConeUniforms.spotPosition.value.copy(SPOTLIGHT_POSITION);
        this.volumetricConeAxisDir.subVectors(this.spotLightTargetSmooth, SPOTLIGHT_POSITION);

        if (this.volumetricConeAxisDir.lengthSq() > 1e-10) {
            this.volumetricConeAxisDir.normalize();
        } else {
            this.volumetricConeAxisDir.set(0, -1, 0);
        }
        volumetricConeUniforms.coneAxis.value.copy(this.volumetricConeAxisDir);
        volumetricConeUniforms.coneLength.value = Math.min(
            Math.max(SPOTLIGHT_POSITION.distanceTo(this.spotLightTargetSmooth), 0.05),
            SPOTLIGHT_VOLUMETRIC_MAX_DISTANCE,
        );
        this.volumetricConeUniforms = volumetricConeUniforms;
    }

    getSpotLight(): SpotLight | undefined {
        return this.spotLight;
    }

    getVolumetricConeUniforms(): SpotVolumetricConeUniformsJs | undefined {
        return this.volumetricConeUniforms;
    }

    disposeVolumetricMeshFromScene(removeFromScene?: { remove: (o: Mesh) => void }) {
        const m = this.volumetricMesh;

        if (!m) {
            return;
        }

        removeFromScene?.remove(m);
        m.geometry.dispose();
        this.volumetricMesh = undefined;
    }

    projectLogoAnchorToPlaneZ0(anchorX: number, anchorY: number, cam: PerspectiveCamera, hitOut: Vector3): boolean {
        const rect = this.world.headerLogoRect;

        if (!rect) {
            return false;
        }

        const { x: lx, y: ly, width: lw, height: lh } = rect;
        const cx = lx + lw * anchorX;
        const cy = ly + lh * anchorY;
        const cw = this.world.options.width;
        const ch = this.world.options.height;

        this.logoSpotNdc.x = (cx / cw) * 2 - 1;
        this.logoSpotNdc.y = -((cy / ch) * 2 - 1);
        cam.updateMatrixWorld(true);
        this.logoSpotRaycaster.setFromCamera(this.logoSpotNdc, cam);

        return this.logoSpotRaycaster.ray.intersectPlane(this.logoSpotPlaneZ0, hitOut) !== null;
    }

    syncFromHeaderLogo() {
        const rect = this.world.headerLogoRect;
        const camera = this.world.camera;
        const spot = this.spotLight;

        if (!rect || !camera || !spot) {
            return;
        }

        const ok = this.projectLogoAnchorToPlaneZ0(
            HEADER_LOGO_SPOT_SCREEN_ANCHOR_X,
            HEADER_LOGO_SPOT_SCREEN_ANCHOR_Y,
            camera,
            this.logoSpotHit,
        );

        if (ok) {
            SPOTLIGHT_POSITION.copy(this.logoSpotHit);
            SPOTLIGHT_POSITION.z = 0;
            spot.position.copy(SPOTLIGHT_POSITION);
        }
    }

    update(ctx: WorldFrameContext) {
        const w = this.world;
        const spot = this.spotLight;
        const delta = ctx.delta;

        if (!spot || !w.pointerHandler) {
            return;
        }

        const { angleRad, decay } = getSpotAngleDecayForScroll(
            w.scrollProgress,
            w.spotLightParams.angleDeg,
            w.spotLightParams.decay,
        );

        spot.angle = angleRad;
        spot.decay = decay;

        const waterY =
            this.world.waterSurface.getWater()?.mesh.position.y ?? this.world.pointerHandler?.scenePointer.y ?? 0;

        const coneBlend = getSpotConeStaticBlendT(w.scrollProgress);

        this.spotConeBlendPointerScratch.set(
            w.pointerHandler.scenePointer.x,
            waterY + SPOTLIGHT_TARGET_ABOVE_WATER_Y,
            w.pointerHandler.scenePointer.z,
        );
        this.spotConeBlendScrollScratch.lerpVectors(
            SCROLL_SPOT_TARGET_START,
            SCROLL_SPOT_TARGET_END,
            getScrollSpotRampT(w.scrollProgress),
        );
        this.spotLightTargetDesired.lerpVectors(
            this.spotConeBlendPointerScratch,
            this.spotConeBlendScrollScratch,
            coneBlend,
        );

        const spotTargetAlpha = 1 - Math.exp(-SPOTLIGHT_TARGET_POINTER_DAMP_LAMBDA * delta);

        this.spotLightTargetSmooth.lerp(this.spotLightTargetDesired, spotTargetAlpha);

        spot.target.position.copy(this.spotLightTargetSmooth);
        spot.target.updateMatrixWorld();

        const volMesh = this.volumetricMesh;
        const volUniforms = this.volumetricConeUniforms;

        if (!volMesh || !volUniforms) {
            return;
        }

        const distAlong = SPOTLIGHT_POSITION.distanceTo(this.spotLightTargetSmooth);
        const d = Math.min(Math.max(distAlong, 0.05), SPOTLIGHT_VOLUMETRIC_MAX_DISTANCE);
        const apex = w.volumetricGui.coneApexRadius;
        const angle = spot.angle;
        const geomRebuild =
            Math.abs(angle - this.volumetricConeAngleRad) > 1e-5 ||
            apex !== this.volumetricMeshGeomBakedApex ||
            (apex > 0 && Math.abs(d - this.volumetricMeshGeomBakedLength) > 0.04);

        if (geomRebuild) {
            volMesh.geometry.dispose();
            volMesh.geometry = createSpotConeUnitGeometry({
                angleRad: angle,
                apexRadiusWorld: apex,
                coneLengthWorld: d,
            });
            this.volumetricConeAngleRad = angle;
            this.volumetricMeshGeomBakedLength = d;
            this.volumetricMeshGeomBakedApex = apex;
        }
        volMesh.position.copy(SPOTLIGHT_POSITION);
        volMesh.lookAt(this.spotLightTargetSmooth);
        volMesh.scale.setScalar(d);
        volUniforms.spotPosition.value.copy(SPOTLIGHT_POSITION);
        volUniforms.lightColor.value.copy(spot.color);
        this.volumetricConeAxisDir.subVectors(this.spotLightTargetSmooth, SPOTLIGHT_POSITION);

        if (this.volumetricConeAxisDir.lengthSq() > 1e-10) {
            this.volumetricConeAxisDir.normalize();
        } else {
            this.volumetricConeAxisDir.set(0, -1, 0);
        }
        volUniforms.coneAxis.value.copy(this.volumetricConeAxisDir);
        volUniforms.coneLength.value = d;
        volUniforms.coneBaseFade.value = w.volumetricGui.coneBaseFade;
        volUniforms.coneApexRadius.value = w.volumetricGui.coneApexRadius;
    }
}
