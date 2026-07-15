import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {
    EquirectangularReflectionMapping,
    ImageBitmapLoader,
    PMREMGenerator,
    SRGBColorSpace,
    Texture,
    WebGPURenderer,
} from 'three/webgpu';

const ldrEquirectBitmapLoader = new ImageBitmapLoader();

ldrEquirectBitmapLoader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });

export const HDRI_URL = '/static/textures/hdri/sunset_in_the_chalk_quarry_1k.hdr';

export const WATER_HDRI_URL = '/static/textures/hdri/ferndale_studio_08_1k.hdr';

export const HDRI_ENV_FILE_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'avif',
    'gif',
    'bmp',
    'hdr',
    'exr',
    'tif',
    'tiff',
] as const;

export function fileExtensionFromName(filename: string): string {
    const i = filename.lastIndexOf('.');

    return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

export function isHdriEnvironmentFileExtension(ext: string): boolean {
    const e = ext.replace(/^\./, '').toLowerCase();

    return (HDRI_ENV_FILE_EXTENSIONS as readonly string[]).includes(e);
}

function extensionForLoad(url: string, filenameHint?: string): string {
    if (filenameHint) {
        return fileExtensionFromName(filenameHint);
    }

    try {
        const path = new URL(url, 'https://placeholder.local').pathname;

        return fileExtensionFromName(path);
    } catch {
        return '';
    }
}

async function loadEquirectangularTexture(url: string, ext: string): Promise<Texture> {
    const e = ext.toLowerCase();

    if (e === 'exr') {
        const tex = await new EXRLoader().loadAsync(url);

        tex.mapping = EquirectangularReflectionMapping;

        return tex;
    }

    if (e === 'hdr') {
        const tex = await new HDRLoader().loadAsync(url);

        tex.mapping = EquirectangularReflectionMapping;

        return tex;
    }

    if (
        e === 'jpg' ||
        e === 'jpeg' ||
        e === 'png' ||
        e === 'webp' ||
        e === 'avif' ||
        e === 'gif' ||
        e === 'bmp' ||
        e === 'tif' ||
        e === 'tiff'
    ) {
        const imageBitmap = await ldrEquirectBitmapLoader.loadAsync(url);
        const tex = new Texture(imageBitmap);

        tex.flipY = false;
        tex.colorSpace = SRGBColorSpace;
        tex.needsUpdate = true;
        tex.mapping = EquirectangularReflectionMapping;

        return tex;
    }

    throw new Error(`Unsupported HDRI / env map extension: .${e || '?'}`);
}

export async function loadHdriEnvironmentMap(
    renderer: WebGPURenderer,
    url: string = HDRI_URL,
    filenameHint?: string,
): Promise<Texture> {
    const ext = extensionForLoad(url, filenameHint);

    if (!isHdriEnvironmentFileExtension(ext)) {
        throw new Error(`Not an allowed env map extension: .${ext || '?'}`);
    }

    const pmrem = new PMREMGenerator(renderer);
    const tex = await loadEquirectangularTexture(url, ext);
    const envMap = pmrem.fromEquirectangular(tex).texture;

    tex.dispose();
    pmrem.dispose();

    return envMap;
}
