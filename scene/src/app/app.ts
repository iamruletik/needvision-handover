import '@/app/css/app.scss';
import { setupHeaderLogoRectObserver } from '@/features/canvas/model/header-logo-rect-bridge';
import canvas from '@/features/canvas/ui/Canvas';

document.documentElement.classList.add('js-ready');

// Lenis intentionally NOT initialized here — the host site (needvision Webflow bundle)
// runs the single Lenis instance for the whole page.

canvas.init();

// Handle for the host site: Barba page transitions destroy/re-init the scene
// when navigating away from and back to the home page.
(window as any).needvisionScene = canvas;

const logo = document.querySelector<HTMLElement>('.js-header-logo');

if (logo) {
    setupHeaderLogoRectObserver(logo);
}
