/* eslint-disable */
import type { Texture } from 'three';
import {
    DepthTexture,
    HalfFloatType,
    LinearMipMapLinearFilter,
    Matrix4,
    Object3D,
    Plane,
    RenderTarget,
    Vector2,
    Vector3,
    Vector4,
    WebGPUCoordinateSystem,
    warnOnce,
} from 'three';
import { NodeUpdateType, screenUV } from 'three/tsl';
import {
    type Camera,
    Node,
    type NodeBuilder,
    type NodeFrame,
    type Scene,
    TextureNode,
    type WebGPURenderer,
} from 'three/webgpu';
import { LAYER_REFLECTION_CONTENT } from '../constants';

type DrawableFlags = Object3D & {
    isMesh?: boolean;
    isLine?: boolean;
    isPoints?: boolean;
    isSprite?: boolean;
};

function isReflectionDrawable(object: Object3D): boolean {
    const o = object as DrawableFlags;

    return !!(o.isMesh || o.isLine || o.isPoints || o.isSprite);
}

function isLightObject(object: Object3D): boolean {
    return (object as Object3D & { isLight?: boolean }).isLight === true;
}

/** Учитывает пометку на предке (как помеченные по имени группы в GLTF). */
function drawableMarkedForReflection(object: Object3D): boolean {
    let o: Object3D | null = object;

    while (o !== null) {
        if ((o.userData as { reflection?: boolean }).reflection === true) {
            return true;
        }
        o = o.parent;
    }

    return false;
}

const _reflectorPlane = new Plane();
const _normal = new Vector3();
const _reflectorWorldPosition = new Vector3();
const _cameraWorldPosition = new Vector3();
const _rotationMatrix = new Matrix4();
const _lookAtPosition = new Vector3(0, 0, -1);
const clipPlane = new Vector4();

const _view = new Vector3();
const _target = new Vector3();
const _q = new Vector4();

const _size = new Vector2();

const _defaultRT = new RenderTarget();
const _defaultUV = screenUV.flipX();

_defaultRT.depthTexture = new DepthTexture(1, 1);

let _inReflector = false;

/** Parameters shared with {@link ReflectorBaseNode} (no texture / reflector handle). */
export type ReflectorBaseNodeParameters = {
    target?: Object3D;
    /**
     * Если true — в RT отражения попадают только drawable под узлами с `userData.reflection === true`
     * (включая потомков помеченной группы), плюс источники света сцены; виртуальная камера смотрит только слой `reflectionLayer`.
     */
    filterReflectionByUserData?: boolean;
    /** Индекс слоя для отражаемой геометрии и связанных источников света. */
    reflectionLayer?: number;
    resolutionScale?: number;
    /** @deprecated renamed to resolutionScale */
    resolution?: number;
    generateMipmaps?: boolean;
    bounces?: boolean;
    depth?: boolean;
    samples?: number;
};

type CameraWithClippingPlanes = Camera & { near: number; far: number };

/**
 * Holds the actual implementation of the reflector.
 *
 * TODO: Explain why `ReflectorBaseNode`. Originally the entire logic was implemented
 * in `ReflectorNode`, see #29619.
 *
 * @private
 * @augments Node
 */
class ReflectorBaseNode extends Node {
    static get type() {
        return 'ReflectorBaseNode';
    }

    textureNode: TextureNode;

    target: Object3D;

    resolutionScale: number;

    generateMipmaps: boolean;

    bounces: boolean;

    depth: boolean;

    samples: number;

    updateBeforeType: (typeof NodeUpdateType)[keyof typeof NodeUpdateType];

    virtualCameras: WeakMap<Camera, Camera>;

    renderTargets: Map<Camera, RenderTarget>;

    forceUpdate: boolean;

    hasOutput: boolean;

    filterReflectionByUserData: boolean;

    reflectionLayerIndex: number;

    private _reflectionLayersSynced = false;

    /**
     * Constructs a new reflector base node.
     *
     * @param textureNode - Represents the rendered reflections as a texture node.
     * @param parameters - An object holding configuration parameters.
     */
    constructor(textureNode: TextureNode, parameters: ReflectorBaseNodeParameters = {}) {
        super();

        const {
            target = new Object3D(),
            resolutionScale = 1,
            generateMipmaps = false,
            bounces = true,
            depth = false,
            samples = 0,
        } = parameters;

        this.textureNode = textureNode;

        this.target = target;

        this.filterReflectionByUserData = parameters.filterReflectionByUserData === true;

        this.reflectionLayerIndex = parameters.reflectionLayer ?? LAYER_REFLECTION_CONTENT;

        this.resolutionScale = resolutionScale;

        if (parameters.resolution !== undefined) {
            warnOnce('ReflectorNode: The "resolution" parameter has been renamed to "resolutionScale".'); // @deprecated r180

            this.resolutionScale = parameters.resolution;
        }

        this.generateMipmaps = generateMipmaps;

        this.bounces = bounces;

        this.depth = depth;

        this.samples = samples;

        this.updateBeforeType = bounces ? NodeUpdateType.RENDER : NodeUpdateType.FRAME;

        this.virtualCameras = new WeakMap();

        this.renderTargets = new Map();

        this.forceUpdate = false;

        this.hasOutput = false;
    }

    /**
     * Включает слой отражения для drawable с `userData.reflection` и источников света сцены.
     * После асинхронного добавления помеченных мешей вызови для повторной синхронизации.
     */
    syncReflectionLayers(scene: Scene): void {
        if (this.filterReflectionByUserData === false) return;

        this._syncReflectionLayerMembership(scene);

        this._reflectionLayersSynced = true;
    }

    private _syncReflectionLayerMembership(scene: Scene): void {
        const layer = this.reflectionLayerIndex;

        scene.traverse((object) => {
            if (isReflectionDrawable(object)) {
                if (drawableMarkedForReflection(object)) {
                    object.layers.enable(layer);
                }
            } else if (isLightObject(object)) {
                object.layers.enable(layer);
            }
        });
    }

    /**
     * Updates the resolution of the internal render target.
     */
    _updateResolution(renderTarget: RenderTarget, renderer: WebGPURenderer) {
        const resolution = this.resolutionScale;

        renderer.getDrawingBufferSize(_size);

        renderTarget.setSize(Math.round(_size.width * resolution), Math.round(_size.height * resolution));
    }

    setup(builder: NodeBuilder) {
        this._updateResolution(_defaultRT, builder.renderer as unknown as WebGPURenderer);

        return super.setup(builder);
    }

    /**
     * Frees internal resources. Should be called when the node is no longer in use.
     */
    dispose() {
        super.dispose();

        for (const renderTarget of this.renderTargets.values()) {
            renderTarget.dispose();
        }
    }

    /**
     * Returns a virtual camera for the given camera. The virtual camera is used to
     * render the scene from the reflector's view so correct reflections can be produced.
     */
    getVirtualCamera(camera: Camera): Camera {
        let virtualCamera = this.virtualCameras.get(camera);

        if (virtualCamera === undefined) {
            virtualCamera = camera.clone();

            this.virtualCameras.set(camera, virtualCamera);
        }

        return virtualCamera;
    }

    /**
     * Returns a render target for the given camera. The reflections are rendered
     * into this render target.
     */
    getRenderTarget(camera: Camera): RenderTarget {
        let renderTarget = this.renderTargets.get(camera);

        if (renderTarget === undefined) {
            renderTarget = new RenderTarget(0, 0, { type: HalfFloatType, samples: this.samples });

            if (this.generateMipmaps === true) {
                renderTarget.texture.minFilter = LinearMipMapLinearFilter;
                renderTarget.texture.generateMipmaps = true;
            }

            if (this.depth === true) {
                renderTarget.depthTexture = new DepthTexture(1, 1);
            }

            this.renderTargets.set(camera, renderTarget);
        }

        return renderTarget;
    }

    updateBefore(frame: NodeFrame): boolean | undefined {
        if (this.bounces === false && _inReflector) return false;

        _inReflector = true;

        const { scene, camera, renderer, material } = frame;

        if (scene === null || camera === null || renderer === null || material === null) {
            _inReflector = false;

            return undefined;
        }

        const { target } = this;

        const virtualCamera = this.getVirtualCamera(camera);
        const renderTarget = this.getRenderTarget(virtualCamera);

        renderer.getDrawingBufferSize(_size);

        this._updateResolution(renderTarget, renderer as unknown as WebGPURenderer);

        const clipSourceCamera = camera as CameraWithClippingPlanes;

        //

        _reflectorWorldPosition.setFromMatrixPosition(target.matrixWorld);
        _cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

        _rotationMatrix.extractRotation(target.matrixWorld);

        _normal.set(0, 0, 1);
        _normal.applyMatrix4(_rotationMatrix);

        _view.subVectors(_reflectorWorldPosition, _cameraWorldPosition);

        // Avoid rendering when reflector is facing away unless forcing an update
        const isFacingAway = _view.dot(_normal) > 0;

        let needsClear = false;

        if (isFacingAway === true && this.forceUpdate === false) {
            if (this.hasOutput === false) {
                _inReflector = false;

                return undefined;
            }

            needsClear = true;
        }

        _view.reflect(_normal).negate();
        _view.add(_reflectorWorldPosition);

        _rotationMatrix.extractRotation(camera.matrixWorld);

        _lookAtPosition.set(0, 0, -1);
        _lookAtPosition.applyMatrix4(_rotationMatrix);
        _lookAtPosition.add(_cameraWorldPosition);

        _target.subVectors(_reflectorWorldPosition, _lookAtPosition);
        _target.reflect(_normal).negate();
        _target.add(_reflectorWorldPosition);

        //

        virtualCamera.coordinateSystem = camera.coordinateSystem;
        virtualCamera.position.copy(_view);
        virtualCamera.up.set(0, 1, 0);
        virtualCamera.up.applyMatrix4(_rotationMatrix);
        virtualCamera.up.reflect(_normal);
        virtualCamera.lookAt(_target);

        const clipVirtualCamera = virtualCamera as CameraWithClippingPlanes;

        clipVirtualCamera.near = clipSourceCamera.near;
        clipVirtualCamera.far = clipSourceCamera.far;

        virtualCamera.updateMatrixWorld();
        virtualCamera.projectionMatrix.copy(camera.projectionMatrix);

        // Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
        // Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
        _reflectorPlane.setFromNormalAndCoplanarPoint(_normal, _reflectorWorldPosition);
        _reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);

        clipPlane.set(
            _reflectorPlane.normal.x,
            _reflectorPlane.normal.y,
            _reflectorPlane.normal.z,
            _reflectorPlane.constant,
        );

        const projectionMatrix = virtualCamera.projectionMatrix;

        _q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
        _q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
        _q.z = -1.0;
        _q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

        // Calculate the scaled plane vector
        clipPlane.multiplyScalar(1.0 / clipPlane.dot(_q));

        const clipBias = 0;

        // Replacing the third row of the projection matrix
        projectionMatrix.elements[2] = clipPlane.x;
        projectionMatrix.elements[6] = clipPlane.y;
        projectionMatrix.elements[10] =
            renderer.coordinateSystem === WebGPUCoordinateSystem
                ? clipPlane.z - clipBias
                : clipPlane.z + 1.0 - clipBias;
        projectionMatrix.elements[14] = clipPlane.w;

        //

        this.textureNode.value = renderTarget.texture;

        if (this.depth === true && renderTarget.depthTexture !== null) {
            (this.textureNode as ReflectorNode).getDepthNode().value = renderTarget.depthTexture;
        }

        material.visible = false;

        const currentRenderTarget = renderer.getRenderTarget();
        const currentMRT = renderer.getMRT();
        const currentAutoClear = renderer.autoClear;

        renderer.setMRT(null);
        renderer.setRenderTarget(renderTarget);
        renderer.autoClear = true;

        const previousName = scene.name;

        scene.name = (scene.name || 'Scene') + ' [ Reflector ]'; // TODO: Add bounce index

        if (needsClear) {
            renderer.clear();

            this.hasOutput = false;
        } else {
            let previousVirtualCameraLayersMask: number | undefined;

            if (this.filterReflectionByUserData) {
                if (this._reflectionLayersSynced === false) {
                    this._syncReflectionLayerMembership(scene as Scene);

                    this._reflectionLayersSynced = true;
                }

                previousVirtualCameraLayersMask = virtualCamera.layers.mask;

                virtualCamera.layers.disableAll();
                virtualCamera.layers.enable(this.reflectionLayerIndex);
            }

            renderer.render(scene, virtualCamera);

            if (previousVirtualCameraLayersMask !== undefined) {
                virtualCamera.layers.mask = previousVirtualCameraLayersMask;
            }

            this.hasOutput = true;
        }

        scene.name = previousName;

        renderer.setMRT(currentMRT);
        renderer.setRenderTarget(currentRenderTarget);
        renderer.autoClear = currentAutoClear;

        material.visible = true;

        _inReflector = false;

        this.forceUpdate = false;
    }

    /**
     * The resolution scale.
     *
     * @deprecated
     */
    get resolution(): number {
        warnOnce('ReflectorNode: The "resolution" property has been renamed to "resolutionScale".'); // @deprecated r180

        return this.resolutionScale;
    }

    set resolution(value: number) {
        warnOnce('ReflectorNode: The "resolution" property has been renamed to "resolutionScale".'); // @deprecated r180

        this.resolutionScale = value;
    }
}

export type ReflectorNodeParameters = ReflectorBaseNodeParameters & {
    defaultTexture?: Texture | TextureNode;
    reflector?: ReflectorBaseNode;
};

/**
 * This node can be used to implement mirror-like flat reflective surfaces.
 *
 * ```js
 * const groundReflector = reflector();
 * material.colorNode = groundReflector;
 *
 * const plane = new Mesh( geometry, material );
 * plane.add( groundReflector.target );
 * ```
 *
 * @augments TextureNode
 */
class ReflectorNode extends TextureNode {
    static get type() {
        return 'ReflectorNode';
    }

    private _reflectorBaseNode: ReflectorBaseNode;

    private _depthNode: ReflectorNode | null = null;

    /**
     * Constructs a new reflector node.
     *
     * @param parameters - An object holding configuration parameters.
     */
    constructor(parameters: ReflectorNodeParameters = {}) {
        super(
            (parameters.defaultTexture ?? _defaultRT.texture) as ConstructorParameters<typeof TextureNode>[0],
            _defaultUV,
        );

        this._reflectorBaseNode =
            parameters.reflector ?? new ReflectorBaseNode(this, parameters as ReflectorBaseNodeParameters);

        (this as unknown as TextureNode & { setUpdateMatrix(needsUpdate: boolean): void }).setUpdateMatrix(false);
    }

    /**
     * A reference to the internal reflector node.
     */
    get reflector(): ReflectorBaseNode {
        return this._reflectorBaseNode;
    }

    /**
     * A reference to 3D object the reflector is linked to.
     */
    get target(): Object3D {
        return this._reflectorBaseNode.target;
    }

    syncReflectionLayers(scene: Scene): void {
        this._reflectorBaseNode.syncReflectionLayers(scene);
    }

    /**
     * Returns a node representing the mirror's depth. That can be used
     * to implement more advanced reflection effects like distance attenuation.
     */
    getDepthNode(): ReflectorNode {
        if (this._depthNode === null) {
            if (this._reflectorBaseNode.depth !== true) {
                throw new Error(
                    'THREE.ReflectorNode: Depth node can only be requested when the reflector is created with { depth: true }. ',
                );
            }

            this._depthNode = new ReflectorNode({
                defaultTexture: _defaultRT.depthTexture as unknown as Texture,
                reflector: this._reflectorBaseNode,
            });
        }

        return this._depthNode;
    }

    setup(builder: NodeBuilder) {
        // ignore if used in post-processing
        if (!(builder.object as Object3D & { isQuadMesh?: boolean }).isQuadMesh) {
            this._reflectorBaseNode.build(builder);
        }

        return super.setup(builder);
    }

    clone(): this {
        const newNode = new ReflectorNode(
            (this as ReflectorNode & { reflectorNode?: ReflectorNodeParameters }).reflectorNode,
        );

        newNode.uvNode = this.uvNode;
        newNode.levelNode = this.levelNode;
        newNode.biasNode = this.biasNode;
        newNode.sampler = this.sampler;
        newNode.depthNode = this.depthNode;
        newNode.compareNode = this.compareNode;
        newNode.gradNode = this.gradNode;
        const tn = this as unknown as TextureNode & { offsetNode: unknown };

        (newNode as unknown as TextureNode & { offsetNode: unknown }).offsetNode = tn.offsetNode;

        newNode._reflectorBaseNode = this._reflectorBaseNode;

        return newNode as this;
    }

    /**
     * Frees internal resources. Should be called when the node is no longer in use.
     */
    dispose() {
        super.dispose();

        this._reflectorBaseNode.dispose();
    }
}

/**
 * TSL function for creating a reflector node.
 */
export const reflector = (parameters?: ReflectorNodeParameters): ReflectorNode => new ReflectorNode(parameters);

export default ReflectorNode;
