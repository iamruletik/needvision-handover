import { ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'

//Page height changed after the last ScrollTrigger refresh — re-measure every trigger.
//Webflow images are loading="lazy": they load as you scroll toward them, after the load-event
//refresh (and Barba swaps never get one), so the page grows under triggers that still hold the
//old positions (footer clip stuck mid-way, zones firing early). Watches <body>, not the Barba
//container: the privacy footer sits outside it. Persistent — one observer for the whole visit.

const REFRESH_DEBOUNCE_MS = 200
const MIN_HEIGHT_CHANGE_PX = 1

export class LayoutRefresh extends Module {

    setup() {
        if (typeof ResizeObserver === 'undefined') return

        this.lastHeight = document.body.offsetHeight
        this.refreshTimer = null

        let observer = new ResizeObserver(() => {
            let height = document.body.offsetHeight
            if (Math.abs(height - this.lastHeight) < MIN_HEIGHT_CHANGE_PX) return
            this.lastHeight = height
            this.scheduleRefresh()
        })
        observer.observe(document.body)
        this.observe(observer)
    }

    scheduleRefresh() {
        clearTimeout(this.refreshTimer)
        this.refreshTimer = setTimeout(() => ScrollTrigger.refresh(), REFRESH_DEBOUNCE_MS)
    }

    destroy() {
        clearTimeout(this.refreshTimer)
        super.destroy()
    }
}
