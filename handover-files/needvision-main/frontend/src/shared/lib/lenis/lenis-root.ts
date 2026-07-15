import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { registerLenis } from './window-scroll-y';

export function initLenis() {
    const lenis = new Lenis({
        autoRaf: true,
    });

    registerLenis(lenis);

    return lenis;
}
