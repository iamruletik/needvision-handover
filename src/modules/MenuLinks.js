import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Header menu large links. Persistent — the header lives outside the Barba container;
//main.js calls setCurrentNamespace() on first load and on every page change.
//
//Current page: its link gets CURRENT_CLASS (main.css: 0.2 opacity, no pointer events)
//and aria-current. Links are matched to namespaces by order (LINK_NAMESPACES) while their
//hrefs are still "#". Pages without a menu entry (case-study, privacy) dim nothing.
//
//Hover: a fill (the link's own text color) wipes in from the edge the cursor entered
//through and collapses into the edge the cursor leaves through. Text flips to black or
//white, whichever contrasts with the fill. clip-path inset, not top/bottom — no layout work per frame.
//Each hover owns its own fill: created on enter, removed when its leave finishes. Re-entering
//while one is still wiping out leaves that one to finish and starts a fresh one.

const LINK_SELECTOR = '.header-menu-container .menu-large-link'
const LINK_NAMESPACES = ['home', 'company', 'cases', 'contacts']
const CURRENT_CLASS = 'is-current'
const FILL_CLASS = 'menu-large-link__fill'

const FILL_DURATION = 0.5
const FILL_EASE = 'power3.out'
//Leave matches the enter but starts late — without the offset a leaving fill and the
//neighbour's entering one move in lockstep and read as one fill sliding across
const FILL_LEAVE_DURATION = FILL_DURATION
const FILL_LEAVE_EASE = FILL_EASE
const FILL_LEAVE_DELAY = 0.15

//Clip states — inset(top right bottom left)
const CLIP_FULL = 'inset(0% 0% 0% 0%)'
const CLIP_COLLAPSED_AT_TOP = 'inset(0% 0% 100% 0%)'
const CLIP_COLLAPSED_AT_BOTTOM = 'inset(100% 0% 0% 0%)'

//Inverted text — the site's own black / white
const DARK_TEXT_VARIABLE = '--main-colours--black'
const LIGHT_TEXT_VARIABLE = '--main-colours--white'
const LUMINANCE_THRESHOLD = 0.5

export class MenuLinks extends Module {

    setup() {
        this.enterTweens = new WeakMap() //fill -> its wipe-in, so a leave can wait for it
        this.links =[...document.querySelectorAll(LINK_SELECTOR)].map((element, index) => this.setupLink(element, index))
    }

    setupLink(element, index) {
        //activeFill — the fill of the current hover; leaving ones live only in their own tweens
        let link = { element, namespace: LINK_NAMESPACES[index], activeFill: null, enteredFromTop: true, colorTween: null }
        this.listen(element, 'mouseenter', (event) => this.enter(link, event))
        this.listen(element, 'mouseleave', (event) => this.leave(link, event))
        return link
    }

    //Called by main.js on first load and every Barba page change
    setCurrentNamespace(namespace) {
        this.links?.forEach((link) => {
            let isCurrent = link.namespace === namespace
            link.element.classList.toggle(CURRENT_CLASS, isCurrent)
            if (isCurrent) link.element.setAttribute('aria-current', 'page')
            else link.element.removeAttribute('aria-current')
            if (isCurrent) this.reset(link) //no fill stuck on a link that just went inert
        })
    }

    //Helpers

    //Text color without our inline override — the fill takes this color
    baseColor(link) {
        let inlineColor = link.element.style.color
        link.element.style.color = ''
        let color = getComputedStyle(link.element).color
        link.element.style.color = inlineColor
        return color
    }

    contrastingTextColor(color) {
        let channels = color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0]
        let [red, green, blue] = channels
        let luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
        let variable = luminance > LUMINANCE_THRESHOLD ? DARK_TEXT_VARIABLE : LIGHT_TEXT_VARIABLE
        let rootStyle = getComputedStyle(document.documentElement)
        return rootStyle.getPropertyValue(variable).trim() || (luminance > LUMINANCE_THRESHOLD ? '#000' : '#fff')
    }

    createFill(link, color) {
        let fill = document.createElement('span')
        fill.className = FILL_CLASS
        fill.setAttribute('aria-hidden', 'true')
        fill.style.backgroundColor = color
        link.element.prepend(fill)
        return fill
    }

    //Every fill this link still has — the active one and any still wiping out
    allFills(link) {
        return [...link.element.querySelectorAll(`:scope > .${FILL_CLASS}`)]
    }

    reset(link) {
        link.colorTween?.kill()
        this.allFills(link).forEach((fill) => {
            gsap.killTweensOf(fill)
            fill.remove()
        })
        link.activeFill = null
        gsap.set(link.element, { clearProps: 'color' })
    }

    //Animations

    enter(link, event) {
        //Enter without a leave in between (menu / page changed under the cursor, doubled
        //mouseenter) — send the fill that's still showing out, never orphan it
        let rect = link.element.getBoundingClientRect()
        let enteredFromTop = event.clientY < rect.top + rect.height / 2
        if (link.activeFill) this.collapseFill(link.activeFill, enteredFromTop)
        link.enteredFromTop = enteredFromTop

        let fillColor = this.baseColor(link)
        let fill = this.createFill(link, fillColor)
        link.activeFill = fill

        //Untracked on purpose — this module lives all session; reset() kills these by target,
        //so this.animate() would only grow its list on every hover
        let enterTween = gsap.fromTo(fill,
            { clipPath: link.enteredFromTop ? CLIP_COLLAPSED_AT_TOP : CLIP_COLLAPSED_AT_BOTTOM },
            { clipPath: CLIP_FULL, duration: FILL_DURATION, ease: FILL_EASE }
        )
        this.enterTweens.set(fill, enterTween)

        link.colorTween?.kill()
        link.colorTween = gsap.to(link.element, {
            color: this.contrastingTextColor(fillColor),
            duration: FILL_DURATION,
            ease: FILL_EASE,
        })
    }

    //Fill exits through the edge the cursor leaves by. Handed off — it finishes and
    //removes itself, whatever happens next
    leave(link, event) {
        let rect = link.element.getBoundingClientRect()
        let exitedTop = event.clientY < rect.top + rect.height / 2
        let leaveDelay = link.activeFill ? this.collapseFill(link.activeFill, exitedTop) : FILL_LEAVE_DELAY

        //Text returns on the fill's schedule — after a short hover, once its enter has finished.
        //The fade-in isn't killed: it ends exactly when this one starts
        link.colorTween = gsap.to(link.element, {
            color: this.baseColor(link),
            duration: FILL_LEAVE_DURATION,
            delay: leaveDelay,
            ease: FILL_LEAVE_EASE,
            onComplete: () => gsap.set(link.element, { clearProps: 'color' }),
        })
    }

    //Hands a fill off: it collapses into the given edge and removes itself, whatever
    //happens to the link afterwards. Every fill starts and finishes on its own link.
    //A fill still wiping in is never cut short: the enter plays out, the leave follows
    //straight after (no extra delay). A finished fill leaves after FILL_LEAVE_DELAY.
    //Returns the delay before the collapse starts.
    collapseFill(fill, toTop) {
        let link = this.links?.find((candidate) => candidate.activeFill === fill)
        if (link) link.activeFill = null

        let enterTween = this.enterTweens.get(fill)
        this.enterTweens.delete(fill)
        let enterRemaining = enterTween?.isActive() ? enterTween.duration() - enterTween.time() : 0
        let leaveDelay = enterRemaining > 0 ? enterRemaining : FILL_LEAVE_DELAY

        //Enter keeps running; the collapse is queued behind it, so nothing gets killed mid-wipe
        gsap.to(fill, {
            clipPath: toTop ? CLIP_COLLAPSED_AT_TOP : CLIP_COLLAPSED_AT_BOTTOM,
            duration: FILL_LEAVE_DURATION,
            delay: leaveDelay,
            ease: FILL_LEAVE_EASE,
            immediateRender: false,
            onComplete: () => fill.remove(),
        })
        return leaveDelay
    }

    //Cleanup

    destroy() {
        this.links?.forEach((link) => {
            this.reset(link)
            link.element.classList.remove(CURRENT_CLASS)
            link.element.removeAttribute('aria-current')
        })
        this.links = []
        super.destroy()
    }
}
