import { gsap } from '../core/gsap'

//Signature "written" by hand — inline SVG (Webflow embed) with two kinds of shapes:
//  ink   — the filled signature shapes, shown at their real thickness
//  route — stroke-only path(s) along the pen's route, marked id="route" / id="mask" (or any
//          stroked, unfilled shape). Never visible: they become a <mask> over the ink, and
//          drawing them with stroke-dashoffset uncovers the ink along the route.
//Several route paths draw one after another in DOM order, at one even speed; inside a path
//the draw follows its own d. Once drawn the mask comes off, so ink the route missed still
//ends up complete. No route in the SVG: the signature just fades in.
//
//  out — the current signature fades away
//  in  — the route draws, the ink appears along it
//swap(url) loads the next signature from its asset URL (fetched once, cached, sanitized —
//scripts / event handlers / foreignObject dropped) and replaces the inline <svg>, keeping the
//embed's class / style / size attributes so Webflow's styling still applies. Same URL as now:
//no fetch, just redraws. A newer swap cuts an older one off — the newest wins.
//Not a Module: it has no DOM setup of its own, the owner holds and destroys it.
//Safari: animating a mask's stroke repaints the masked group every frame — fine at this size.

const ROUTE_SELECTOR = '[id="route"], [id="mask"]'
const SHAPE_SELECTOR = 'path, polygon, polyline, line, circle, ellipse, rect'
const KEPT_SVG_ATTRIBUTES = ['class', 'style', 'width', 'height', 'preserveAspectRatio']
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

//Route width when the SVG doesn't author one (viewBox units)
const FALLBACK_ROUTE_WIDTH = 4

//Out
const FADE_OUT_DURATION = 0.3
const FADE_OUT_EASE = 'power2.in'

//Draw — whole signature, split between route paths by their length
const DRAW_DURATION = 2.6
const DRAW_EASE = 'none' //even pen speed

//No route — plain fade in
const FADE_IN_DURATION = 0.5

const markupCache = new Map()
let maskCounter = 0

export class SignatureDraw {

    //container — element holding the inline <svg> (the embed); currentUrl — what it shows now
    constructor(container, currentUrl = '') {
        this.container = container
        this.currentUrl = currentUrl
        this.swapId = 0
        this.timeline = null
        this.prepare() //the signature already on the page: masked, fully drawn
    }

    get svg() {
        return this.container?.querySelector('svg') ?? null
    }

    async swap(url) {
        if (!this.svg) return
        let swapId = ++this.swapId

        await this.fadeOut()
        if (swapId !== this.swapId) return

        if (url && url !== this.currentUrl) {
            let markup = await this.load(url)
            if (swapId !== this.swapId) return
            if (markup && this.replaceSvg(markup)) {
                this.currentUrl = url
                this.prepare()
            }
        }
        this.drawIn()
    }

    //Out of sight, no animation — e.g. waiting for a section intro; swap() brings it back drawn
    hide() {
        this.swapId++
        this.timeline?.kill()
        if (this.svg) gsap.set(this.svg, { opacity: 0 })
    }

    destroy() {
        this.swapId++
        this.timeline?.kill()
        this.timeline = null
        this.removeMask()
        if (this.svg) gsap.set(this.svg, { clearProps: 'opacity' })
    }

    //Helpers

    async load(url) {
        if (markupCache.has(url)) return markupCache.get(url)
        try {
            let response = await fetch(url)
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            let markup = await response.text()
            markupCache.set(url, markup)
            return markup
        } catch (error) {
            console.warn('SignatureDraw: signature failed to load', url, error)
            return null
        }
    }

    //Parsed as SVG, never as HTML; anything executable is stripped before it touches the page
    replaceSvg(markup) {
        let parsed = new DOMParser().parseFromString(markup, 'image/svg+xml')
        let incoming = parsed.documentElement
        if (!incoming || incoming.nodeName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) return false

        incoming.querySelectorAll('script, foreignObject').forEach((node) => node.remove())
        ;[incoming, ...incoming.querySelectorAll('*')].forEach((node) => {
            ;[...node.attributes].forEach((attribute) => {
                let name = attribute.name.toLowerCase()
                let isHandler = name.startsWith('on')
                let isScriptLink = (name === 'href' || name === 'xlink:href') && /^\s*javascript:/i.test(attribute.value)
                if (isHandler || isScriptLink) node.removeAttribute(attribute.name)
            })
        })

        let current = this.svg
        let next = document.importNode(incoming, true)
        KEPT_SVG_ATTRIBUTES.forEach((name) => {
            if (current.hasAttribute(name)) next.setAttribute(name, current.getAttribute(name))
        })
        current.replaceWith(next)
        return true
    }

    //Marked routes first; otherwise any stroked shape without a fill
    findRoutes(svg) {
        let marked = [...svg.querySelectorAll(ROUTE_SELECTOR)]
        if (marked.length) return marked
        return [...svg.querySelectorAll(SHAPE_SELECTOR)].filter((shape) => {
            let stroke = shape.getAttribute('stroke')
            return stroke && stroke !== 'none' && getComputedStyle(shape).fill === 'none'
        })
    }

    //Routes move into a <mask> (white, round caps), the ink into a group that uses it.
    //Unique mask id per build, the route's own id dropped — no duplicate ids on the page
    prepare() {
        let svg = this.svg
        this.routes = []
        this.maskedGroup = null
        if (!svg) return

        let routes = this.findRoutes(svg)
        if (routes.length === 0) return

        let maskId = `signature-route-${++maskCounter}`
        let defs = document.createElementNS(SVG_NAMESPACE, 'defs')
        let mask = document.createElementNS(SVG_NAMESPACE, 'mask')
        mask.setAttribute('id', maskId)
        mask.setAttribute('maskUnits', 'userSpaceOnUse')
        defs.appendChild(mask)

        let group = document.createElementNS(SVG_NAMESPACE, 'g')
        ;[...svg.childNodes]
            .filter((node) => !routes.includes(node) && node.nodeName.toLowerCase() !== 'defs')
            .forEach((node) => group.appendChild(node))

        routes.forEach((route) => {
            route.removeAttribute('id')
            route.setAttribute('fill', 'none')
            route.setAttribute('stroke', '#fff')
            route.setAttribute('stroke-opacity', '1') //authored invisible (to hide it in the Designer) must still mask
            route.removeAttribute('opacity')
            route.setAttribute('stroke-linecap', 'round')
            route.setAttribute('stroke-linejoin', 'round')
            if (!route.getAttribute('stroke-width')) route.setAttribute('stroke-width', String(FALLBACK_ROUTE_WIDTH))
            mask.appendChild(route)
        })

        group.setAttribute('mask', `url(#${maskId})`)
        svg.append(defs, group)

        this.maskedGroup = group
        this.routes = routes.map((route) => {
            let length = 0
            try {
                length = route.getTotalLength()
            } catch (error) {
                length = 0
            }
            return { route, length }
        }).filter(({ length }) => length > 0)

        //Fully drawn until a swap asks for a draw
        this.removeMask()
    }

    //Ink shown whole — the routes stay in the mask, ready for the next draw
    removeMask() {
        if (!this.maskedGroup) return
        this.maskedGroup.dataset.mask = this.maskedGroup.getAttribute('mask') || this.maskedGroup.dataset.mask || ''
        this.maskedGroup.removeAttribute('mask')
    }

    applyMask() {
        let mask = this.maskedGroup?.dataset.mask
        if (mask) this.maskedGroup.setAttribute('mask', mask)
    }

    //Animations

    fadeOut() {
        this.timeline?.kill()
        return new Promise((resolve) => {
            this.timeline = gsap.timeline({ onComplete: resolve, onInterrupt: resolve })
                .to(this.svg, { opacity: 0, duration: FADE_OUT_DURATION, ease: FADE_OUT_EASE })
        })
    }

    drawIn() {
        let svg = this.svg
        if (!svg) return
        this.timeline?.kill()

        //No route: nothing to write along — just come back
        if (!this.routes?.length) {
            this.timeline = gsap.timeline().to(svg, { opacity: 1, duration: FADE_IN_DURATION, ease: 'power2.out' })
            return
        }

        let totalLength = this.routes.reduce((sum, { length }) => sum + length, 0)
        this.routes.forEach(({ route, length }) => gsap.set(route, { strokeDasharray: length, strokeDashoffset: length }))
        this.applyMask()
        gsap.set(svg, { opacity: 1 })

        this.timeline = gsap.timeline({
            onComplete: () => {
                this.removeMask()
                this.routes.forEach(({ route }) => gsap.set(route, { clearProps: 'strokeDasharray,strokeDashoffset' }))
            },
        })
        this.routes.forEach(({ route, length }) => {
            this.timeline.to(route, { strokeDashoffset: 0, duration: DRAW_DURATION * (length / totalLength), ease: DRAW_EASE })
        })
    }
}
