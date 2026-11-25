import { Module } from '../../core/Module'

//Case hero "scroll to explore" hint (.page_hero-scroll) — click scrolls to just past the hero;
//hover rolls the arrow down through the circle (main.css "Hero Scroll Arrow").
//The icon svg holds a <rect> (the circle) and a <path> (the arrow). JS clips the arrow to the
//rect's shape and puts it in a track with a copy one rect-height above: hovering drops the
//track by that height — the arrow leaves through the bottom, the copy lands where it was.
//Page hint only; the next-case stage's copy is decoration.

const ROOT_SELECTOR = '[data-barba="container"] .page_hero-scroll'
const HERO_SELECTOR = '.casepage_hero'
const ICON_SVG_SELECTOR = '.scroll-to-icon svg, svg'

const TRACK_CLASS = 'hero-scroll-arrow__track'
const CLIP_ID_PREFIX = 'hero-scroll-arrow-clip'
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

//Space between the arrow and its copy, share of the rect's height
const ROLL_GAP_SHARE = 0.1

let clipIdCounter = 0

export class CaseHeroScroll extends Module {

    constructor(smoothScroll) {
        super()
        this.smoothScroll = smoothScroll
    }

    setup() {
        this.root = document.querySelector(ROOT_SELECTOR)
        if (!this.root) return

        this.hero = this.root.closest(HERO_SELECTOR)
        this.listen(this.root, 'click', (event) => {
            event.preventDefault()
            this.scrollPastHero()
        })
        this.buildArrowRoll()
    }

    //Helpers

    scrollPastHero() {
        if (!this.hero) return
        let target = this.hero.getBoundingClientRect().bottom + window.scrollY
        let lenis = this.smoothScroll?.lenis
        if (lenis) lenis.scrollTo(target)
        else window.scrollTo({ top: target, behavior: 'smooth' })
    }

    buildArrowRoll() {
        let svg = this.root.querySelector(ICON_SVG_SELECTOR)
        let rect = svg?.querySelector('rect')
        let arrow = svg?.querySelector('path')
        if (!rect || !arrow) return

        let rectBox
        try {
            rectBox = rect.getBBox()
        } catch (error) {
            console.warn('CaseHeroScroll: icon not measurable, no hover roll', error)
            return
        }
        let rollDistance = rectBox.height * (1 + ROLL_GAP_SHARE)

        let clipId = `${CLIP_ID_PREFIX}-${++clipIdCounter}`
        let defs = document.createElementNS(SVG_NAMESPACE, 'defs')
        let clipPath = document.createElementNS(SVG_NAMESPACE, 'clipPath')
        clipPath.id = clipId
        clipPath.appendChild(rect.cloneNode(false))
        defs.appendChild(clipPath)

        let clipGroup = document.createElementNS(SVG_NAMESPACE, 'g')
        clipGroup.setAttribute('clip-path', `url(#${clipId})`)
        let track = document.createElementNS(SVG_NAMESPACE, 'g')
        track.setAttribute('class', TRACK_CLASS)
        track.style.setProperty('--hero-scroll-roll', `${rollDistance}px`)

        //Offset on a wrapper — the path may carry its own transform
        let arrowCopy = document.createElementNS(SVG_NAMESPACE, 'g')
        arrowCopy.setAttribute('transform', `translate(0 ${-rollDistance})`)
        let arrowClone = arrow.cloneNode(true)
        arrowClone.removeAttribute('id')
        arrowCopy.appendChild(arrowClone)

        arrow.parentNode.insertBefore(clipGroup, arrow)
        track.append(arrow, arrowCopy)
        clipGroup.appendChild(track)
        svg.prepend(defs)

        this.build = { svg, arrow, arrowCopy, clipGroup, defs }
    }

    //Cleanup — arrow back in place, clip and copy gone

    destroy() {
        super.destroy()
        if (this.build) {
            let { arrow, arrowCopy, clipGroup, defs } = this.build
            clipGroup.parentNode?.insertBefore(arrow, clipGroup)
            arrowCopy.remove()
            clipGroup.remove()
            defs.remove()
        }
        this.build = null
    }
}
