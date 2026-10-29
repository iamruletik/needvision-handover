import { gsap } from '../core/gsap'
import { Module } from '../core/Module'
import { styleLineMasks } from './lineMasks'

//Header menu open / close. One timeline: open() plays it, close() reverses it from wherever
//it is — a click mid-animation just turns it around. snapClosed() jumps straight to shut
//(page change under the eye transition). HeaderCompact owns this and decides when.
//  .header-menu-content-container — drops open through a clip-path (bottom edge moves down,
//      rounded corners ride with it, nothing stretches). The CTA at the bottom is uncovered
//      by that same edge.
//  .menu-large-link text   — drops in from above out of a JS mask, link by link
//  .link-counter-label     — fades in, trailing its link
//  .money-counter-label / -small-number / -svg, $ sign — fade in
//  .money-counter-large-number — letters + drums rise out of a JS mask, like #menu-counter-text
//Built lazily on the first open — the large number is turned into drums by MenuMoney, which
//mounts after the header. While closed the container is clipped shut and visibility: hidden
//(no focusable links). Webflow head CSS should hold the same closed state, or the menu
//flashes open until this script runs.

const CONTAINER_SELECTOR = '.header-menu-content-container'
const LINK_TEXT_CONTAINER_SELECTOR = '.menu-large-link-text-container'
const LINK_LABEL_SELECTOR = '.link-counter-label'
const MONEY_LABEL_SELECTOR = '.money-counter-label'
const LARGE_NUMBER_SELECTOR = '.money-counter-large-number'
const DOLLAR_SIGN_SELECTOR = '.money-counter-dollar-sign'
const SMALL_NUMBER_SELECTOR = '.money-counter-small-number'
const GAUGE_SELECTOR = '.money-counter-svg'

const LINK_MASK_CLASS = 'menu-large-link-mask'
const NUMBER_MASK_CLASS = 'money-counter-large-number-mask'

//Container Drop
const CONTAINER_DURATION = 1
const CONTAINER_EASE = 'power3.out'

//Link Text — drops from above. Offset must clear the mask bleed: 0.9 line-height + 0.2em bleed
const LINK_AT = 0.15
const LINK_OFFSET_PERCENT = -150
const LINK_DURATION = 0.8
const LINK_STAGGER = 0.06
const LINK_EASE = 'power3.out'
const LINK_MASK_BLEED = '0.2em' //Й breve and glyph overhang at line-height 0.9

//Link Labels
const LINK_LABEL_AT = 0.45
const LINK_LABEL_DURATION = 0.5
const LINK_LABEL_STAGGER = LINK_STAGGER

//Large Number — same rise as the header counter
const NUMBER_AT = 0.4
const NUMBER_OFFSET_PERCENT = 110
const NUMBER_DURATION = 0.45
const NUMBER_STAGGER = 0.015
const NUMBER_EASE = 'power3.out'

//Fades
const FADE_DURATION = 0.5
const FADE_EASE = 'power2.out'
const MONEY_LABEL_AT = 0.35
const SMALL_NUMBER_AT = 0.5
//MoneyGauge starts its needle fill this long after the reveal starts — in sync with the fade
export const GAUGE_FADE_AT = 0.55

export class MenuReveal extends Module {

    setup() {
        this.container = document.querySelector(CONTAINER_SELECTOR)
        if (!this.container) return

        this.timeline = null
        this.pendingPlay = null
        this.onClosed = null
        this.masks = []

        this.applyClosedState()
    }

    //Public

    //delay — seconds to wait first (the header pill compacting)
    open(delay = 0) {
        if (!this.container) return
        if (!this.timeline) this.build()

        this.pendingPlay?.kill()
        this.onClosed = null
        this.timeline.eventCallback('onReverseComplete', null)
        this.container.style.visibility = 'visible'

        if (delay > 0 && this.timeline.progress() === 0) {
            this.pendingPlay = gsap.delayedCall(delay, () => this.timeline.play())
            return
        }
        this.timeline.play()
    }

    //onClosed — runs once the menu is fully shut; skipped if open() turns it around first
    close(onClosed) {
        if (!this.container) return

        this.pendingPlay?.kill()
        this.onClosed = onClosed
        if (!this.timeline || this.timeline.progress() === 0) {
            this.onFullyClosed()
            return
        }

        this.timeline.eventCallback('onReverseComplete', () => this.onFullyClosed())
        this.timeline.reverse()
    }

    //Straight to shut, no animation — for when the screen is covered (page change).
    //A close in progress still gets its onClosed
    snapClosed() {
        if (!this.container) return
        this.pendingPlay?.kill()
        this.timeline?.eventCallback('onReverseComplete', null)
        this.timeline?.pause(0)
        this.onFullyClosed()
    }

    //Helpers

    applyClosedState() {
        gsap.set(this.container, { clipPath: this.clipPath(100), visibility: 'hidden' })
    }

    onFullyClosed() {
        this.container.style.visibility = 'hidden'
        let onClosed = this.onClosed
        this.onClosed = null
        onClosed?.()
    }

    //inset(top right bottom left round …) — bottom value 100% = shut, 0% = open.
    //Bottom corners match the container's own radius so the clip edge looks like its edge
    clipPath(bottomPercent) {
        let radius = this.bottomRadius ?? (this.bottomRadius = getComputedStyle(this.container).borderBottomLeftRadius || '0px')
        return `inset(0% 0% ${bottomPercent}% 0% round 0px 0px ${radius} ${radius})`
    }

    wrapInMask(element, className) {
        let mask = document.createElement('div')
        mask.className = className
        element.parentNode.insertBefore(mask, element)
        mask.appendChild(element)
        this.masks.push(mask)
        return mask
    }

    //Text of each link (not its absolute counter label) in its own bled mask
    collectLinkParts() {
        let texts = []
        let labels = []

        this.container.querySelectorAll(LINK_TEXT_CONTAINER_SELECTOR).forEach((textContainer) => {
            let label = textContainer.querySelector(LINK_LABEL_SELECTOR)
            let text = [...textContainer.children].find((child) => child !== label)
            if (label) labels.push(label)
            if (!text) return

            let mask = this.wrapInMask(text, LINK_MASK_CLASS)
            styleLineMasks([mask], LINK_MASK_BLEED)
            texts.push(text)
        })

        return { texts, labels }
    }

    //Letters + drum slots of the large number, masked like #menu-counter-text
    collectNumberUnits() {
        let host = this.container.querySelector(`${LARGE_NUMBER_SELECTOR} .profit-counter`)
        let numberBlock = host?.parentElement
        if (!numberBlock) return []

        let mask = this.wrapInMask(numberBlock, NUMBER_MASK_CLASS)
        mask.style.overflow = 'hidden'
        return [...host.children]
    }

    //Animations

    build() {
        let { texts, labels } = this.collectLinkParts()
        let numberUnits = this.collectNumberUnits()
        let query = (selector) => [...this.container.querySelectorAll(selector)]
        let moneyLabels = query(MONEY_LABEL_SELECTOR)
        let dollarSigns = query(DOLLAR_SIGN_SELECTOR)
        let smallNumbers = query(SMALL_NUMBER_SELECTOR)
        let gauges = query(GAUGE_SELECTOR)

        this.animatedElements = [...texts, ...labels, ...numberUnits, ...moneyLabels, ...dollarSigns, ...smallNumbers, ...gauges]

        this.timeline = gsap.timeline({ paused: true })

        this.timeline.fromTo(this.container,
            { clipPath: this.clipPath(100) },
            { clipPath: this.clipPath(0), duration: CONTAINER_DURATION, ease: CONTAINER_EASE },
            0
        )

        if (texts.length) {
            this.timeline.fromTo(texts,
                { yPercent: LINK_OFFSET_PERCENT },
                { yPercent: 0, duration: LINK_DURATION, stagger: LINK_STAGGER, ease: LINK_EASE },
                LINK_AT
            )
        }

        if (labels.length) {
            this.timeline.fromTo(labels,
                { autoAlpha: 0 },
                { autoAlpha: 1, duration: LINK_LABEL_DURATION, stagger: LINK_LABEL_STAGGER, ease: FADE_EASE },
                LINK_LABEL_AT
            )
        }

        if (numberUnits.length) {
            this.timeline.fromTo(numberUnits,
                { yPercent: NUMBER_OFFSET_PERCENT },
                { yPercent: 0, duration: NUMBER_DURATION, stagger: NUMBER_STAGGER, ease: NUMBER_EASE },
                NUMBER_AT
            )
        }

        this.addFade(moneyLabels, MONEY_LABEL_AT)
        this.addFade(dollarSigns, NUMBER_AT)
        this.addFade(smallNumbers, SMALL_NUMBER_AT)
        this.addFade(gauges, GAUGE_FADE_AT)
    }

    addFade(elements, at) {
        if (!elements.length) return
        this.timeline.fromTo(elements,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: FADE_DURATION, ease: FADE_EASE },
            at
        )
    }

    //Cleanup — masks unwrapped, inline states cleared, container back to Webflow's look

    destroy() {
        this.onClosed = null
        this.pendingPlay?.kill()
        this.timeline?.kill()
        this.timeline = null
        super.destroy()

        if (this.animatedElements?.length) gsap.set(this.animatedElements, { clearProps: 'transform,opacity,visibility' })
        this.animatedElements = []

        this.masks?.forEach((mask) => {
            let element = mask.firstElementChild
            if (element) mask.parentNode?.insertBefore(element, mask)
            mask.remove()
        })
        this.masks = []

        if (this.container) gsap.set(this.container, { clearProps: 'clipPath,visibility' })
    }
}
