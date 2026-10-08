import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Footer interactive image — .footer-interactive-light sits on top of the image with a
//radial-gradient background that fades to transparent: a feathered hole. The hole
//follows the cursor anywhere over the footer's box and drifts back to center when it
//leaves. Mouse only.
//
//The gradient stays authored in Webflow: JS reads it once and swaps only its position
//for `at var(--light-x) var(--light-y)` — colors, stops and size are untouched.
//Cost: moving a gradient repaints the layer each frame (no transform possible with
//inset: 0 — moving the element would expose its edges).

const FOOTER_SELECTOR = '.footer'
const CONTAINER_SELECTOR = '.footer-interactive-image'
const LIGHT_SELECTOR = '.footer-interactive-light'
const POINTER_MEDIA = '(hover: hover) and (pointer: fine)'

const REST_PERCENT = 50
const FOLLOW_DURATION = 0.6
const FOLLOW_EASE = 'power3.out'

export class FooterLight extends Module {

    setup() {
        if (!window.matchMedia(POINTER_MEDIA).matches) return

        this.footer = document.querySelector(FOOTER_SELECTOR)
        this.container = document.querySelector(CONTAINER_SELECTOR)
        this.light = this.container?.querySelector(LIGHT_SELECTOR)
        if (!this.footer || !this.container || !this.light) {
            console.warn('FooterLight: missing', { footer: !!this.footer, container: !!this.container, light: !!this.light })
            return
        }

        let backgroundImage = getComputedStyle(this.light).backgroundImage
        let movableGradient = this.toMovableGradient(backgroundImage)
        if (!movableGradient) {
            console.warn('FooterLight: background is not a single radial-gradient, skipping —', backgroundImage)
            return
        }

        //Plain object smoothed by quickTo, written to the CSS vars on every update
        this.position = { x: REST_PERCENT, y: REST_PERCENT }
        this.light.style.backgroundImage = movableGradient
        this.writePosition()

        let quickVars = { duration: FOLLOW_DURATION, ease: FOLLOW_EASE, onUpdate: () => this.writePosition() }
        this.moveX = gsap.quickTo(this.position, 'x', quickVars)
        this.moveY = gsap.quickTo(this.position, 'y', quickVars)

        //Rects cached — re-read only after scroll/resize
        this.footerRect = null
        this.lightRect = null
        let clearRects = () => {
            this.footerRect = null
            this.lightRect = null
        }
        this.listen(window, 'scroll', clearRects, { passive: true })
        this.listen(window, 'resize', clearRects)

        //Document, not the footer: the footer is fixed underneath the page, so whatever
        //uncovers it (and the pointer-events: none image) swallows events aimed at it.
        //Inside/outside is decided by the footer's box instead.
        this.isInside = false
        this.listen(document, 'mousemove', (event) => this.onMouseMove(event), { passive: true })
        this.listen(document.documentElement, 'mouseleave', () => this.leave())
    }

    //Helpers

    //"radial-gradient(circle at 50% 50%, a 0%, b 60%)" -> same with the position as vars.
    //Returns null for anything that isn't exactly one radial-gradient layer.
    toMovableGradient(backgroundImage) {
        if (!backgroundImage?.startsWith('radial-gradient(') || !backgroundImage.endsWith(')')) return null

        let inner = backgroundImage.slice('radial-gradient('.length, -1)
        let firstCommaIndex = this.topLevelCommaIndex(inner)
        if (firstCommaIndex === -1) return null

        let firstPart = inner.slice(0, firstCommaIndex).trim()
        let isShapePart = /^(circle|ellipse|closest|farthest|at\s|-?[\d.])/.test(firstPart)

        //Keep shape/size, drop the old "at …" position
        let shape = isShapePart ? firstPart.replace(/(^|\s)at\s.*$/, '').trim() : ''
        let stops = isShapePart ? inner.slice(firstCommaIndex + 1).trim() : inner

        let position = 'at var(--light-x) var(--light-y)'
        return `radial-gradient(${shape ? `${shape} ${position}` : position}, ${stops})`
    }

    //First comma outside parentheses — rgba(0, 0, 0, 0) has commas of its own
    topLevelCommaIndex(text) {
        let depth = 0
        for (let index = 0; index < text.length; index++) {
            let character = text[index]
            if (character === '(') depth++
            else if (character === ')') depth--
            else if (character === ',' && depth === 0) return index
        }
        return -1
    }

    writePosition() {
        this.light.style.setProperty('--light-x', `${this.position.x}%`)
        this.light.style.setProperty('--light-y', `${this.position.y}%`)
    }

    isOverFooter(event) {
        this.footerRect = this.footerRect || this.footer.getBoundingClientRect()
        let rect = this.footerRect
        return event.clientX >= rect.left && event.clientX <= rect.right
            && event.clientY >= rect.top && event.clientY <= rect.bottom
    }

    //Animations

    onMouseMove(event) {
        if (!this.isOverFooter(event)) {
            this.leave()
            return
        }
        this.isInside = true

        this.lightRect = this.lightRect || this.light.getBoundingClientRect()
        if (!this.lightRect.width || !this.lightRect.height) return

        this.moveX(((event.clientX - this.lightRect.left) / this.lightRect.width) * 100)
        this.moveY(((event.clientY - this.lightRect.top) / this.lightRect.height) * 100)
    }

    //Same quickTo as follow — a separate tween would fight it if the cursor comes back mid-return
    leave() {
        if (!this.isInside) return
        this.isInside = false
        this.moveX(REST_PERCENT)
        this.moveY(REST_PERCENT)
    }

    //Cleanup — hand the background back to Webflow

    destroy() {
        super.destroy()
        if (!this.light) return
        if (this.position) gsap.killTweensOf(this.position)
        this.light.style.backgroundImage = ''
        this.light.style.removeProperty('--light-x')
        this.light.style.removeProperty('--light-y')
    }
}
