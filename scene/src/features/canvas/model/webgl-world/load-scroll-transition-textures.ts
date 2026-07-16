import { ImageBitmapLoader, NoColorSpace, RepeatWrapping, Texture } from 'three/webgpu';
import { staticUrl } from '@/shared/lib/static-url';

export const GRADIENT_NOISE_TEXTURE_URL = staticUrl('/static/textures/gradient-noise.jpg');

export async function loadScrollTransitionNoiseTexture(): Promise<Texture> {
    const loader = new ImageBitmapLoader();

    loader.setOptions({ imageOrientation: 'flipY' });

    const noiseBitmap = await loader.loadAsync(GRADIENT_NOISE_TEXTURE_URL);

    const noise = new Texture(noiseBitmap);

    noise.wrapS = RepeatWrapping;
    noise.wrapT = RepeatWrapping;
    noise.colorSpace = NoColorSpace;
    noise.needsUpdate = true;

    return noise;
}
