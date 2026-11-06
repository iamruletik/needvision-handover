import { Experience } from '../model';

// Parked scene (host page left home): the experience and its worker stay built, the <canvas>
// element is held detached — the worker still owns it, so it can't be swapped for a new one.
// init() on the next home page moves it into the new wrapper and resumes. Not back within
// PARK_EXPIRY_MS → destroyed for real (frees the GPU memory it was holding).
const PARK_EXPIRY_MS = 5 * 60 * 1000;

let experience: Experience | null = null;
let isInitialized = false;
let mediaQueryList: MediaQueryList | null = null;
let onMediaChange: (() => void) | null = null;
let parkedCanvas: HTMLCanvasElement | null = null;
let parkExpiryTimer = 0;

function findWrapper(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.js-canvas-wrapper');
}

function findCanvas(): HTMLCanvasElement | null {
    return findWrapper()?.querySelector<HTMLCanvasElement>('canvas.js-canvas') ?? null;
}

function ensureCanvas(wrapper: HTMLElement): HTMLCanvasElement {
    let el = wrapper.querySelector<HTMLCanvasElement>('canvas.js-canvas');

    if (!el) {
        el = document.createElement('canvas');
        el.className = 'canvas js-canvas';
        wrapper.appendChild(el);
    }

    return el;
}

function recycleCanvasElement(stale: HTMLCanvasElement) {
    const parent = stale.parentElement;

    if (!parent) {
        return;
    }

    const fresh = document.createElement('canvas');

    fresh.className = 'canvas js-canvas';

    parent.replaceChild(fresh, stale);
}

function clearParked() {
    window.clearTimeout(parkExpiryTimer);
    parkExpiryTimer = 0;
    parkedCanvas = null;
}

function mount(canvas: HTMLCanvasElement) {
    if (experience) {
        return;
    }

    experience = new Experience(canvas);
}

// The parked canvas takes the place of any canvas the new wrapper came with
function resumeInto(wrapper: HTMLElement) {
    if (!experience || !parkedCanvas) {
        return;
    }

    const canvas = parkedCanvas;
    const placeholder = wrapper.querySelector<HTMLCanvasElement>('canvas.js-canvas');

    if (placeholder) {
        placeholder.replaceWith(canvas);
    } else {
        wrapper.appendChild(canvas);
    }

    clearParked();
    experience.resume(canvas);
}

function unmount() {
    clearParked();

    if (!experience) {
        return;
    }

    experience.dispose();
    experience = null;

    const stale = findCanvas();

    if (stale) {
        recycleCanvasElement(stale);
    }
}

function syncMedia(matches: boolean) {
    const wrapper = findWrapper();

    if (!wrapper) {
        return;
    }

    if (!matches) {
        unmount();

        return;
    }

    if (parkedCanvas) {
        resumeInto(wrapper);
    } else {
        mount(ensureCanvas(wrapper));
    }
}

function stopMediaTracking() {
    if (mediaQueryList && onMediaChange) {
        mediaQueryList.removeEventListener('change', onMediaChange);
    }

    mediaQueryList = null;
    onMediaChange = null;
}

function init() {
    if (isInitialized) {
        return;
    }

    const wrapper = findWrapper();

    if (!wrapper) {
        return;
    }

    isInitialized = true;

    const media = wrapper.dataset.media?.trim();

    if (!media) {
        syncMedia(true);

        return;
    }

    const mql = window.matchMedia(media);

    mediaQueryList = mql;
    const handler = () => syncMedia(mql.matches);

    onMediaChange = handler;
    syncMedia(mql.matches);
    mql.addEventListener('change', handler);
}

// Host page leaving home — keep the scene, drop the page. Nothing running → plain destroy
function park() {
    const canvas = findCanvas();

    if (!experience || !canvas) {
        destroy();

        return;
    }

    stopMediaTracking();
    isInitialized = false;
    experience.park();
    canvas.remove();
    parkedCanvas = canvas;
    parkExpiryTimer = window.setTimeout(destroy, PARK_EXPIRY_MS);
}

function isReady() {
    return experience?.isReady ?? false;
}

function destroy() {
    stopMediaTracking();
    unmount();
    findCanvas()?.remove();
    isInitialized = false;
}

export default { init, park, destroy, isReady };
