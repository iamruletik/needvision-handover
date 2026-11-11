import { Module } from '../core/Module'

//Seamless marquee on any matching element: content is cloned once, CSS animation
//scrolls the strip by -50% of its own width — the clone lands exactly where the
//original started, so the loop has no seam. Animation runs on the compositor, no JS per frame.
//
//Requirements for a target element: children laid out in a row, parent clips overflow.
//Optional per-element tuning in Webflow:
//  data-marquee-speed="80"  — pixels per second (default below)
//  data-marquee-reverse     — scrolls the other way
//  data-marquee-media="(max-width: 991px)" — only runs when this matches

const TARGET_SELECTOR = '.marquee-wrapper, .menu_marquee-wrapper, [data-marquee]'
const DEFAULT_SPEED_PX_PER_SECOND = 50

export class Marquee extends Module {

    setup() {
        this.marqueeElements = [...document.querySelectorAll(TARGET_SELECTOR)]
        this.marqueeElements.forEach((element) => this.prepare(element))
    }

    prepare(element) {
        if (element.dataset.marqueeReady) return
        if (element.dataset.marqueeMedia && !window.matchMedia(element.dataset.marqueeMedia).matches) return

        element.innerHTML += element.innerHTML

        if (element.offsetWidth > 0) {
            this.start(element)
            return
        }

        //Hidden marquee (collapsed menu) — wait until it gets real width, then start
        const resizeObserver = new ResizeObserver((entries) => {
            if (entries[0].contentRect.width === 0) return
            resizeObserver.disconnect()
            this.start(element)
        })
        this.observe(resizeObserver).observe(element)
    }

    start(element) {
        this.writeDuration(element)
        element.dataset.marqueeReady = 'true'

        //Lazy images have no width until they load — speed stays right as the strip grows
        this.observe(new ResizeObserver(() => this.writeDuration(element))).observe(element)
    }

    writeDuration(element) {
        let speed = parseFloat(element.dataset.marqueeSpeed) || DEFAULT_SPEED_PX_PER_SECOND
        let contentWidth = element.scrollWidth / 2

        element.style.setProperty('--marquee-duration', `${(contentWidth / speed).toFixed(2)}s`)
    }
}
