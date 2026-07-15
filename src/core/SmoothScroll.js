import Lenis from 'lenis'
import { ScrollTrigger } from './gsap'

//Scroll feel — values user-tested on the previous site
const SCROLL_DURATION = 2.5
const WHEEL_MULTIPLIER = 0.6
const ANCHOR_DURATION = 1.4

function expoOut(t) {
    return Math.min(1, 1.001 - Math.pow(2, -10 * t))
}

//The one and only Lenis on the site. Survives Barba page swaps — never destroyed.
export class SmoothScroll {

    constructor() {
        //We decide where the user lands on load — always the top
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

        this.lenis = new Lenis({
            duration: SCROLL_DURATION,
            easing: expoOut,
            wheelMultiplier: WHEEL_MULTIPLIER,
            smoothTouch: false,
        })

        //Without this scrub animations lag one frame behind the scroll position
        this.lenis.on('scroll', ScrollTrigger.update)

        //Own rAF, not gsap.ticker — the ticker sleeps between tweens and Lenis would stall mid-glide
        const tick = (time) => {
            this.lenis.raf(time)
            this.rafId = requestAnimationFrame(tick)
        }
        this.rafId = requestAnimationFrame(tick)

        this.interceptAnchorLinks()
    }

    //Anchor clicks glide through Lenis instead of the browser's instant jump
    interceptAnchorLinks() {
        document.addEventListener('click', (event) => {
            let link = event.target.closest('a[href^="#"]')
            if (!link) return

            let href = link.getAttribute('href')
            if (!href || href === '#') return

            let target = document.querySelector(href)
            if (!target) return

            event.preventDefault()
            this.lenis.scrollTo(target, { duration: ANCHOR_DURATION, easing: expoOut })
        })
    }

    stop() {
        this.lenis.stop()
    }

    start() {
        this.lenis.start()
    }

    get position() {
        return this.lenis.scroll
    }
}
