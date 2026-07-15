import '@/app/css/app.scss';
import { setupHeaderLogoRectObserver } from '@/features/canvas/model/header-logo-rect-bridge';
import canvas from '@/features/canvas/ui/Canvas';
import { initLenis } from '@/shared/lib/lenis/lenis-root';

document.documentElement.classList.add('js-ready');

initLenis();
canvas.init();

const logo = document.querySelector<HTMLElement>('.js-header-logo');

if (logo) {
    setupHeaderLogoRectObserver(logo);
}
