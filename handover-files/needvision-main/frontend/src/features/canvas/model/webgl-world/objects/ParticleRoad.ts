import { AdditiveBlending, CatmullRomCurve3, Color, PlaneGeometry, Vector3 } from 'three';
import { Fn, float, hash, instanceIndex, instancedArray, mix, smoothstep, time, uniform, uv, vec2 } from 'three/tsl';
import { type CurveType, InstancedMesh, SpriteNodeMaterial, type WebGPURenderer } from 'three/webgpu';

export type ParticleRoadParams = {
    color: string;
    size: number;
    speed: number;
    spacing: number;
    opacity: number;
};

export type ParticleRoadTweakGui = Pick<ParticleRoadParams, 'color' | 'size' | 'speed' | 'spacing'>;

export const DEFAULT_ROAD_PARAMS: ParticleRoadParams = {
    color: '#ac7531',
    size: 1,
    speed: 0.05,
    spacing: 0.13,
    opacity: 0,
};

const geometry = new PlaneGeometry();

const PATH_START_TO_END_FADE = 0.8;

export function createParticleRoad(
    _renderer: WebGPURenderer,
    paths: CatmullRomCurve3[],
    params?: Partial<ParticleRoadParams>,
) {
    const merged = { ...DEFAULT_ROAD_PARAMS, ...params };
    const spacing = Math.max(0.025, merged.spacing);
    const particlesCounts = paths.map((path) => Math.max(1, Math.floor(path.getLength() / spacing)));
    const totalParticles = particlesCounts.reduce((sum, count) => sum + count, 0);

    const samplesPerPath = 128;
    const pathData = new Float32Array(paths.length * samplesPerPath * 3);

    for (let i = 0; i < paths.length; i++) {
        for (let j = 0; j < samplesPerPath; j++) {
            const u = j / (samplesPerPath - 1);
            const p = paths[i].getPointAt(u);
            const idx = (i * samplesPerPath + j) * 3;

            pathData[idx] = p.x;
            pathData[idx + 1] = p.y;
            pathData[idx + 2] = p.z;
        }
    }

    const pathBuffer = instancedArray(pathData, 'vec3').setPBO(true);

    const pathIndexData = new Float32Array(totalParticles);
    const offsetData = new Float32Array(totalParticles);

    let particleIdx = 0;

    for (let i = 0; i < paths.length; i++) {
        const count = particlesCounts[i];

        for (let j = 0; j < count; j++) {
            pathIndexData[particleIdx] = i;
            offsetData[particleIdx] = j / count;
            particleIdx++;
        }
    }

    const pathIndexBuffer = instancedArray(pathIndexData, 'float').setPBO(true);
    const offsetBuffer = instancedArray(offsetData, 'float').setPBO(true);

    const speedUniform = uniform(merged.speed);
    const sizeUniform = uniform(merged.size);
    const colorUniform = uniform(new Color(merged.color));
    const opacityParamUniform = uniform(merged.opacity);

    const material = new SpriteNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
    });

    material.positionNode = Fn(() => {
        const pathIdx = pathIndexBuffer.element(instanceIndex);
        const offset = offsetBuffer.element(instanceIndex);

        const t = time.mul(speedUniform).add(offset).mod(1);

        const sampleIdx = t.mul(float(samplesPerPath - 1));
        const i0 = sampleIdx.floor();
        const i1 = i0.add(1).min(samplesPerPath - 1);
        const f = sampleIdx.fract();

        const baseIdx = pathIdx.mul(samplesPerPath);
        const p0 = pathBuffer.element(baseIdx.add(i0));
        const p1 = pathBuffer.element(baseIdx.add(i1));

        return mix(p0, p1, f);
    })();

    material.scaleNode = Fn(() => {
        const offset = offsetBuffer.element(instanceIndex);
        const t = time.mul(speedUniform).add(offset).mod(1);
        const alongPath = smoothstep(float(0), float(PATH_START_TO_END_FADE), t);

        const h = hash(instanceIndex);

        return sizeUniform.mul(h.mul(0.4).add(0.6)).mul(alongPath);
    })();

    material.colorNode = colorUniform;

    material.opacityNode = Fn(() => {
        const offset = offsetBuffer.element(instanceIndex);
        const t = time.mul(speedUniform).add(offset).mod(1);
        const pathFade = smoothstep(0, 0.1, t).mul(smoothstep(1, 0.9, t));
        const alongPath = smoothstep(float(0), float(PATH_START_TO_END_FADE), t);

        const dist = vec2(0.5).distance(uv());
        const v = float(0.02);
        const glow = v.div(dist.max(0.001)).sub(v.mul(2));

        return glow
            .mul(smoothstep(0.5, 0.4, dist))
            .mul(pathFade)
            .mul(alongPath)
            .mul(opacityParamUniform);
    })();

    const mesh = new InstancedMesh(geometry, material, totalParticles);

    mesh.name = 'ParticleRoad';
    mesh.frustumCulled = false;

    return {
        mesh,
        syncParams: (newParams: Partial<ParticleRoadParams>) => {
            if (newParams.color !== undefined) colorUniform.value.set(newParams.color);

            if (newParams.size !== undefined) sizeUniform.value = newParams.size;

            if (newParams.speed !== undefined) speedUniform.value = newParams.speed;

            if (newParams.opacity !== undefined) opacityParamUniform.value = newParams.opacity;
        },
    };
}

const y = 0.1;
const closed = false;
const curveType: CurveType = 'catmullrom';
const tension = 0.1;

export const createPlane001ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [
                    new Vector3(-6, y, -14.5),
                    new Vector3(-5.2, y, -11.2),
                    new Vector3(-3.87, y, -10.5),
                    new Vector3(0.27, y, -0.14),
                    new Vector3(4.73, y, -0.81),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [
                    new Vector3(-10.5, y, -11.3),
                    new Vector3(-10.2, y, -6.9),
                    new Vector3(-8.12, y, -8.23),
                    new Vector3(-3.09, y, -0.06),
                    new Vector3(0.27, y, -0.14),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [
                    new Vector3(-0.15, y, -14.15),
                    new Vector3(5.2, y, -8.99),
                    new Vector3(4.78, y, -0.93),
                    new Vector3(4.73, y, -0.81),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(13.6, y, -4.2), new Vector3(10.36, y, -0.92), new Vector3(4.73, y, -0.81)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-11.5, y, 5.87), new Vector3(5.5, y, 5.65), new Vector3(5.42, y, 4.71)],
                closed,
                curveType,
                tension,
            ),
        ],
        params,
    );
};

export const createPlane002ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [
                    new Vector3(-5.2, y, -11.2),
                    new Vector3(-3.87, y, -10.5),
                    new Vector3(0.27, y, -0.14),
                    new Vector3(-2.93, y, 0.26),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-8.12, y, -8.23), new Vector3(-2.93, y, 0.26)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [
                    new Vector3(5.2, y, -8.99),
                    new Vector3(4.78, y, -0.93),
                    new Vector3(4.73, y, -0.81),
                    new Vector3(0.27, y, -0.14),
                    new Vector3(0.23, y, 2.73),
                    new Vector3(-0.75, y, 2.66),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-12.6, y, 1.7), new Vector3(-11.5, y, 5.87), new Vector3(-5.6, y, 6)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-13.9, y, -5.7), new Vector3(-12.4, y, 2), new Vector3(-7.7, y, 1.7)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(10.2, y, 5.8), new Vector3(-5.6, y, 6), new Vector3(-6.1, y, 5.15)],
                closed,
                curveType,
                tension,
            ),
        ],
        params,
    );
};

export const createPlane003ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [
                    new Vector3(-10.6, y, -10.9),
                    new Vector3(-10.18, y, -7.1),
                    new Vector3(-7.98, y, -7.99),
                    new Vector3(-5.27, y, -3.5),
                    new Vector3(-6.46, y, -3.54),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(0.33, y, -0.16), new Vector3(-3.25, y, -0.16), new Vector3(-5.27, y, -3.5)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3([new Vector3(0.45, y, 5.89), new Vector3(-5.27, y, -3.5)], closed, curveType, tension),
            new CatmullRomCurve3(
                [new Vector3(-11.89, y, 5.83), new Vector3(-12.45, y, 2.08), new Vector3(-8.18, y, 1.69)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-14.4, y, -6.96), new Vector3(-12.45, y, 2.08)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-6.15, y, -14.9), new Vector3(-5.2, y, -11.2), new Vector3(-8, y, -8.55)],
                closed,
                curveType,
                tension,
            ),
        ],
        params,
    );
};

export const createPlane004ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [new Vector3(0.55, y, 5.82), new Vector3(-11.8, y, 5.8), new Vector3(-12.5, y, 2.07)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(0.25, y, -0.08), new Vector3(-12.5, y, 2.07), new Vector3(-14, y, 1.77)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-14.3, y, -6.8), new Vector3(-12.5, y, 2.07)],
                closed,
                curveType,
                tension,
            ),
        ],
        params,
    );
};

export const createPlane005ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [new Vector3(-13.3, y, -1.58), new Vector3(-14.4, y, -7), new Vector3(-14.15, y, -7.9)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-5, y, -11), new Vector3(-10.43, y, -7.4), new Vector3(-10.7, y, -9.6)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3([new Vector3(-5.38, y, -3.6), new Vector3(-8.5, y, -8.2)], closed, curveType, tension),
        ],
        params,
    );
};

export const createPlane006ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [new Vector3(-6.15, y, -14.9), new Vector3(-5.2, y, -11.2), new Vector3(-7.26, y, -9.18)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(1.94, y, -16.3), new Vector3(-3.84, y, -10.46), new Vector3(-5.2, y, -11.2)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-13.95, y, -5.57), new Vector3(-10.26, y, -7.13), new Vector3(-7.26, y, -9.18)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-3.45, y, -0.35), new Vector3(-8.24, y, -8.15)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(0.24, y, -0.56), new Vector3(-3.84, y, -10.46)],
                closed,
                curveType,
                tension,
            ),
        ],
        params,
    );
};

export const createPlane007ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [new Vector3(9.96, y, -8.2), new Vector3(5.23, y, -9), new Vector3(-1.46, y, -15.73)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [
                    new Vector3(-6.15, y, -14.9),
                    new Vector3(-5.2, y, -11.2),
                    new Vector3(-3.77, y, -10.4),
                    new Vector3(0.11, y, -14.2),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(0.26, y, -0.42), new Vector3(-3.77, y, -10.4)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3([new Vector3(4.91, y, -1.13), new Vector3(5.23, y, -9)], closed, curveType, tension),
            new CatmullRomCurve3(
                [
                    new Vector3(-10.6, y, -10.9),
                    new Vector3(-10.18, y, -7.1),
                    new Vector3(-7.98, y, -7.99),
                    new Vector3(-5.02, y, -11.17),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(1.91, y, -16.72), new Vector3(0.11, y, -14.2)],
                closed,
                curveType,
                tension,
            ),
        ],
        params,
    );
};

export const createPlane008ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [new Vector3(9.96, y, -8.2), new Vector3(5.23, y, -9), new Vector3(2.36, y, -11.78)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [
                    new Vector3(-6.15, y, -14.9),
                    new Vector3(-5.2, y, -11.2),
                    new Vector3(-3.77, y, -10.4),
                    new Vector3(-0.08, y, -14.1),
                    new Vector3(2.36, y, -11.78),
                    new Vector3(2.77, y, -12.55),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3([new Vector3(5.07, y, -1.18), new Vector3(5.23, y, -9)], closed, curveType, tension),
            new CatmullRomCurve3(
                [new Vector3(1.91, y, -16.72), new Vector3(0.11, y, -14.2)],
                closed,
                curveType,
                tension,
            ),
        ],
        params,
    );
};

export const createPlane009ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [
                    new Vector3(-6.15, y, -14.9),
                    new Vector3(-5.2, y, -11.2),
                    new Vector3(-3.77, y, -10.4),
                    new Vector3(-1.79, y, -5.69),
                    new Vector3(-0.95, y, -5.9),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-3.46, y, -0.16), new Vector3(0.29, y, -0.5), new Vector3(-1.79, y, -5.69)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(1.98, y, -16.63), new Vector3(-0.12, y, -14.18), new Vector3(-1.95, y, -12.37)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3([new Vector3(-0.12, y, -14.18), new Vector3(5.2, y, -9)], closed, curveType, tension),
            new CatmullRomCurve3(
                [
                    new Vector3(10, y, -8.23),
                    new Vector3(5.2, y, -9),
                    new Vector3(5, y, -5.13),
                    new Vector3(3.73, y, -5.44),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3([new Vector3(13.6, y, -4.45), new Vector3(10.4, y, -1)], closed, curveType, tension),
            new CatmullRomCurve3(
                [
                    new Vector3(10.64, y, 5.91),
                    new Vector3(10.4, y, -1),
                    new Vector3(2.12, y, -0.7),
                    new Vector3(1.17, y, -2.57),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3([new Vector3(0.48, y, 5.77), new Vector3(0.13, y, -0.61)], closed, curveType, tension),
        ],
        params,
    );
};

export const createPlane010ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [
                    new Vector3(-0.18, y, -14.2),
                    new Vector3(5.3, y, -8.8),
                    new Vector3(5.15, y, -5.86),
                    new Vector3(5.85, y, -5.42),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3([new Vector3(10, y, -8.3), new Vector3(5.3, y, -8.8)], closed, curveType, tension),
            new CatmullRomCurve3(
                [
                    new Vector3(5.25, y, 5.79),
                    new Vector3(10.6, y, 5.8),
                    new Vector3(10.45, y, -0.97),
                    new Vector3(13.5, y, -4.3),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(-4.68, y, -2.53), new Vector3(-3, y, 0), new Vector3(10.45, y, -0.97)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3([new Vector3(-3.4, y, -9.7), new Vector3(0.23, y, -0.44)], closed, curveType, tension),
        ],
        params,
    );
};

export const createPlane011ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [new Vector3(-5, y, 5.93), new Vector3(10.64, y, 6), new Vector3(10.77, y, 2.28)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3([new Vector3(13.6, y, -4.4), new Vector3(10.4, y, -1)], closed, curveType, tension),
            new CatmullRomCurve3(
                [new Vector3(-3.2, y, -0.16), new Vector3(10.4, y, -1), new Vector3(10.77, y, 2.28)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3([new Vector3(5.2, y, -8.8), new Vector3(5.24, y, -1.13)], closed, curveType, tension),
        ],
        params,
    );
};

export const createPlane012ParticleRoad = (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => {
    return createParticleRoad(
        renderer,
        [
            new CatmullRomCurve3(
                [
                    new Vector3(-6.15, y, -14.9),
                    new Vector3(-5.2, y, -11.2),
                    new Vector3(-3.77, y, -10.4),
                    new Vector3(-1.79, y, -5.69),
                    new Vector3(-2.84, y, -5.78),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(1.9, y, -16.45), new Vector3(-3.77, y, -10.4)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [
                    new Vector3(-10.6, y, -10.9),
                    new Vector3(-10.18, y, -7.1),
                    new Vector3(-7.98, y, -7.99),
                    new Vector3(-5.27, y, -3.5),
                    new Vector3(-4.8, y, -3.9),
                ],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [new Vector3(10.3, y, -1), new Vector3(0.31, y, -0.53), new Vector3(-1.79, y, -5.69)],
                closed,
                curveType,
                tension,
            ),
            new CatmullRomCurve3(
                [
                    new Vector3(0.45, y, 5.89),
                    new Vector3(0.26, y, -0.18),
                    new Vector3(-3.35, y, -0.19),
                    new Vector3(-5.27, y, -3.5),
                ],
                closed,
                curveType,
                tension,
            ),
        ],
        params,
    );
};

export type ParticleRoadWorldBinding = {
    planeMeshName: string;
    create: (renderer: WebGPURenderer, params?: Partial<ParticleRoadParams>) => ReturnType<typeof createParticleRoad>;
};

export const PARTICLE_ROAD_WORLD_BINDINGS: readonly ParticleRoadWorldBinding[] = [
    { planeMeshName: 'Plane', create: createPlane001ParticleRoad },
    { planeMeshName: 'Plane002', create: createPlane002ParticleRoad },
    { planeMeshName: 'Plane003', create: createPlane003ParticleRoad },
    { planeMeshName: 'Plane004', create: createPlane004ParticleRoad },
    { planeMeshName: 'Plane005', create: createPlane005ParticleRoad },
    { planeMeshName: 'Plane006', create: createPlane006ParticleRoad },
    { planeMeshName: 'Plane007', create: createPlane007ParticleRoad },
    { planeMeshName: 'Plane008', create: createPlane008ParticleRoad },
    { planeMeshName: 'Plane009', create: createPlane009ParticleRoad },
    { planeMeshName: 'Plane010', create: createPlane010ParticleRoad },
    { planeMeshName: 'Plane011', create: createPlane011ParticleRoad },
    { planeMeshName: 'Plane012', create: createPlane012ParticleRoad },
];
