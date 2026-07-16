import {
    abs,
    cameraFar,
    cameraNear,
    clamp,
    distance,
    dot,
    float,
    max,
    normalView,
    perspectiveDepthToViewZ,
    positionView,
    positionWorld,
    pow,
    smoothstep,
    uniform,
    vec3,
} from 'three/tsl';
import {
    AdditiveBlending,
    BufferGeometry,
    Color,
    CylinderGeometry,
    DoubleSide,
    Matrix4,
    MeshBasicNodeMaterial,
    type Node,
    Vector3,
} from 'three/webgpu';

export type SpotVolumetricConeUniformsJs = {
    spotPosition: { value: Vector3 };
    coneAxis: { value: Vector3 };
    coneLength: { value: number };
    attenuation: { value: number };
    anglePower: { value: number };
    depthContactSoftness: { value: number };
    coneBaseFade: { value: number };
    coneApexRadius: { value: number };
    lightColor: { value: Color };
};

export function createSpotConeUnitGeometry(params: {
    angleRad: number;
    apexRadiusWorld?: number;
    coneLengthWorld?: number;
    radialSegments?: number;
    heightSegments?: number;
}): BufferGeometry {
    const { angleRad, radialSegments = 64, heightSegments = 32 } = params;
    const height = 1;
    const tanA = Math.tan(angleRad);
    const apexRadiusWorld = params.apexRadiusWorld ?? 0;
    const coneLengthWorld = Math.max(params.coneLengthWorld ?? 1, 1e-3);

    let radiusTop: number;
    let radiusBottom: number;

    if (apexRadiusWorld > 0) {
        radiusTop = apexRadiusWorld / coneLengthWorld;
        radiusBottom = radiusTop + tanA * height;
    } else {
        radiusTop = 0;
        radiusBottom = tanA * height;
    }

    const geometry = new CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, true);
    const m = new Matrix4();

    geometry.applyMatrix4(m.makeTranslation(0, -height / 2, 0));
    geometry.applyMatrix4(m.makeRotationX(-Math.PI / 2));

    return geometry;
}

export function createSpotVolumetricConeMaterial(params: {
    sceneDepthSample: Node;
    attenuation: number;
    anglePower: number;
    depthContactSoftness: number;
    coneBaseFade: number;
    coneApexRadius: number;
    lightColor: string | number;
}): {
    material: MeshBasicNodeMaterial;
    uniforms: SpotVolumetricConeUniformsJs;
} {
    const spotPosition = uniform(new Vector3());
    const coneAxisUniform = uniform(new Vector3(0, -1, 0));
    const coneLengthUniform = uniform(1);
    const attenuationUniform = uniform(params.attenuation);
    const anglePowerUniform = uniform(params.anglePower);
    const depthContactSoftnessUniform = uniform(params.depthContactSoftness);
    const coneBaseFadeUniform = uniform(params.coneBaseFade);
    const coneApexRadiusUniform = uniform(params.coneApexRadius);
    const lightColorUniform = uniform(new Color(params.lightColor));

    const material = new MeshBasicNodeMaterial();

    material.transparent = true;
    material.depthWrite = false;
    material.side = DoubleSide;
    material.blending = AdditiveBlending;

    const fragDepth = (params.sceneDepthSample as Node<'vec4'>).r;
    const sceneViewZ = perspectiveDepthToViewZ(fragDepth, cameraNear, cameraFar);
    const vViewZ = positionView.z;
    const depthDelta = vViewZ.sub(sceneViewZ);
    const depthSoftRange = max(depthContactSoftnessUniform, float(0.05));
    const depthSoft = smoothstep(float(0), depthSoftRange, depthDelta);

    const distFromSpot = distance(positionWorld, spotPosition);
    const dist = max(distFromSpot.sub(coneApexRadiusUniform), float(0));
    const radialFalloff = float(1).sub(clamp(dist.div(attenuationUniform), float(0), float(1)));

    const toFrag = positionWorld.sub(spotPosition);
    const alongAxis = max(dot(toFrag, coneAxisUniform), float(0));
    const fadeLen = max(coneBaseFadeUniform, float(0.01));
    const fadeStart = max(coneLengthUniform.sub(fadeLen), float(0));
    const fadeEnd = coneLengthUniform;
    const baseFade = float(1).sub(smoothstep(fadeStart, fadeEnd, alongAxis));

    const nv = normalView;
    const n = vec3(nv.x, nv.y, abs(nv.z));
    const angleIntensity = pow(abs(dot(n, vec3(0, 0, 1))), anglePowerUniform);

    const intensity = radialFalloff.mul(angleIntensity).mul(depthSoft).mul(baseFade).toVar('spotIntensity');

    material.colorNode = lightColorUniform.mul(intensity);
    material.opacityNode = intensity;

    return {
        material,
        uniforms: {
            spotPosition,
            coneAxis: coneAxisUniform,
            coneLength: coneLengthUniform,
            attenuation: attenuationUniform,
            anglePower: anglePowerUniform,
            depthContactSoftness: depthContactSoftnessUniform,
            coneBaseFade: coneBaseFadeUniform,
            coneApexRadius: coneApexRadiusUniform,
            lightColor: lightColorUniform,
        } satisfies SpotVolumetricConeUniformsJs,
    };
}
