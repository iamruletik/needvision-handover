import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'

//Black pill behind the active sort tab (.filter-tabs). Built here — an animation artifact, not
//layout. moveTo() slides it to a tab with a stretch: the leading edge goes first, the trailing
//edge follows a beat later, so the pill elongates in transit and settles to the tab's size.
//Edges are tweened on a plain object and written as x + width; height / top follow the tab.
//Tab text color (black <-> white) is the Webflow combo filter-tabs_btn.is-active, crossfaded by
//main.css "Cases Sort Tabs". Viewport changes re-place it instantly (vw-sized tabs).

const INDICATOR_CLASS = 'filter-tabs_indicator'

const LEAD_DURATION = 0.5
const TRAIL_DURATION = 0.6
const TRAIL_DELAY = 0.08
const MOVE_EASE = 'expo.out'

export class SortTabIndicator extends Module {

    constructor(container) {
        super()
        this.container = container
    }

    setup() {
        if (!this.container) return

        this.indicator = document.createElement('span')
        this.indicator.className = INDICATOR_CLASS
        this.indicator.setAttribute('aria-hidden', 'true')
        this.container.prepend(this.indicator)

        this.edges = { left: 0, right: 0 }
        this.activeTab = null
        this.listen(window, 'resize', () => {
            if (this.activeTab) this.moveTo(this.activeTab, { instant: true })
        })
    }

    //Helpers

    //Tab box relative to the container (its offsetParent — main.css sets position: relative)
    tabBox(tab) {
        return {
            left: tab.offsetLeft,
            right: tab.offsetLeft + tab.offsetWidth,
            top: tab.offsetTop,
            height: tab.offsetHeight,
        }
    }

    applyEdges() {
        gsap.set(this.indicator, { x: this.edges.left, width: Math.max(0, this.edges.right - this.edges.left) })
    }

    //Animations

    moveTo(tab, { instant = false } = {}) {
        if (!this.indicator || !tab) return
        let isFirstPlacement = !this.activeTab
        this.activeTab = tab

        let box = this.tabBox(tab)
        gsap.set(this.indicator, { y: box.top, height: box.height })

        this.leadTween?.kill()
        this.trailTween?.kill()

        if (instant || isFirstPlacement) {
            this.edges.left = box.left
            this.edges.right = box.right
            this.applyEdges()
            return
        }

        //Moving right: the right edge leads; moving left: the left edge leads
        let isMovingRight = box.left > this.edges.left
        let leadEdge = isMovingRight ? 'right' : 'left'
        let trailEdge = isMovingRight ? 'left' : 'right'

        this.leadTween = this.animate(gsap.to(this.edges, {
            [leadEdge]: box[leadEdge],
            duration: LEAD_DURATION,
            ease: MOVE_EASE,
            onUpdate: () => this.applyEdges(),
        }))
        this.trailTween = this.animate(gsap.to(this.edges, {
            [trailEdge]: box[trailEdge],
            duration: TRAIL_DURATION,
            delay: TRAIL_DELAY,
            ease: MOVE_EASE,
            onUpdate: () => this.applyEdges(),
        }))
    }

    destroy() {
        super.destroy()
        this.indicator?.remove()
        this.indicator = null
        this.activeTab = null
    }
}
