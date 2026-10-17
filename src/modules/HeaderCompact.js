import { gsap, ScrollTrigger, Flip } from '../core/gsap'
import { Module } from '../core/Module'
import { ProfitCounter } from './ProfitCounter'
import { MenuReveal } from './MenuReveal'

//Header compacts on scroll. Persistent — the header lives outside the Barba container,
//so main.js creates this once (Barba's scroll reset to 0 un-compacts it on every page).
//
//Webflow holds a design-time mirror of the compact state (#…-mirror elements);
//setup() strips those and prepares the real elements:
//  1-3. remove #header-logo-mirror, #header-cases-link-mirror, #header-menu-link-mirror
//  4.   #menu-counter-text wrapped in a JS mask; ProfitCounter turns it into letters +
//       live digit drums, all pushed below the mask (they rise in one by one when compact)
//  5.   .header-content-links-placer fill at 0 (fades to header-color when compact, --placer-fill).
//       Its left/right also animate: compacting starts the pill stretched over the links
//       where they are (+ PLACER_LINK_PADDING_REM each side) and shrinks it to its Webflow
//       left/right as they fly in; spreading stretches it out to where they land.
//Compact (past COMPACT_SCROLL_PX), each move a real DOM change:
//  6-7. #header-cases-link prepended, #header-menu-link appended into
//       .header-content-links-placer (around #menu-counter-text), both get .is-inverted
//       (color fades via CSS transition). No Flip for the links — they ride the pill's
//       left/right animation; on the way back they stay in the pill until it's done
//  8-9. #header-logo-actual into .small-header-placer + .is-small (Webflow's small size);
//       .header-content-logo-container-feature gets FEATURE_COMPACT_CLASS (+1.5rem top
//       padding, main.css) to make up the height the big logo stops reserving, and
//       .descriptor-svg rides the same Flip so it glides instead of jumping
//Back at the top everything returns to its original parent / position.
//#header-menu-link toggles the menu (MenuReveal): opening compacts the header first if it's
//spread and the menu drops once the pill has landed; scroll is locked out (isMenuLocked).
//Closing reverses the menu, then spreads the header back at the top of the page, or keeps
//it compact when scrolled. Clicks while the pill moves are ignored; clicks while the menu
//itself animates turn it around from wherever it is.
//Both states are real layouts — Flip only animates the difference, so they stay
//responsive and can be tuned in Webflow without touching this file.

const COMPACT_SCROLL_PX = 80

//Pages where the header is always compact — no spread state, no scroll switching; the menu
//closes back to compact. Switched instantly on arrival (main.js → setNamespace())
const PINNED_COMPACT_NAMESPACES = ['cases', 'contacts']

//Fired on document when the menu opens / closes — anything in the menu can react
export const MENU_OPEN_EVENT = 'header-menu-open'
export const MENU_CLOSE_EVENT = 'header-menu-close'

//Links Flip
const LINKS_DURATION = 0.9
const LINKS_EASE = 'power3.inOut'

//Logo Flip
const LOGO_DURATION = 0.6
const LOGO_EASE = 'power3.inOut'

//Logo Spread — on the way back the logo holds small until the pill's fill is nearly gone
//(~90% at 0.65s of LINKS_DURATION's power3.inOut), then snaps home — never crosses a
//visible pill. Delay + duration stays within LINKS_DURATION, so the click lock is unchanged
const LOGO_SPREAD_DELAY = 0.55
const LOGO_SPREAD_DURATION = 0.6
const LOGO_SPREAD_EASE = 'power3.out'

//Whole compact / spread transition — clicks wait it out, the menu drops after it
const PILL_TRANSITION_DURATION = Math.max(LINKS_DURATION, LOGO_DURATION)
const LOGO_SMALL_CLASS = 'is-small'
const FEATURE_COMPACT_CLASS = 'is-header-compact'
const LINK_INVERTED_CLASS = 'is-inverted'
const TRANSITIONING_CLASS = 'is-header-transitioning' //on <html> while a compact / spread runs
const MENU_LINE_SELECTOR = '.menu-line-divider'

//Menu Icon — the two lines cross into a close icon while the menu is open.
//Padding is pinned to Webflow's base (2px / 3px) so the hover padding can't bend the ×
const MENU_LINES_LAYOUT_SELECTOR = '.menu-lines-layout'
const MENU_ICON_BASE_PADDING_TOP = 2
const MENU_ICON_BASE_PADDING_BOTTOM = 3
const MENU_ICON_ROTATION = 25
const MENU_ICON_DURATION = 0.5
const MENU_ICON_EASE = 'power3.inOut'

//Menu Icon Hover — while the × is showing, hover spreads it a few degrees with a springy settle
const MENU_ICON_HOVER_EXTRA_ROTATION = 8
const MENU_ICON_HOVER_DURATION = 0.8
const MENU_ICON_HOVER_EASE = 'elastic.out(1, 0.4)'

//Counter Text — split into letters; they rise out of the mask one by one after the pill
//starts fading in, and drop back fast (last letter first) on exit
const COUNTER_MASK_CLASS = 'menu-counter-mask'
const COUNTER_OFFSET_PERCENT = 110
const COUNTER_ENTER_DURATION = 0.45
const COUNTER_ENTER_STAGGER = 0.015
const COUNTER_ENTER_DELAY = 0.3
const COUNTER_ENTER_EASE = 'power3.out'
const COUNTER_EXIT_DURATION = 0.3
const COUNTER_EXIT_STAGGER = 0.006
const COUNTER_EXIT_EASE = 'power3.in'

//Links Placer Background — fades the share of header-color, so the pill always takes the page's color
const PLACER_FILL_PROPERTY = '--placer-fill' //0..1 share of header-color in the pill (main.css "Header Pill Fill")
const PLACER_FILL_HIDDEN = 0
const PLACER_FILL_VISIBLE = 1
const PLACER_LINK_PADDING_REM = 0.5 //pill reaches this far past the outer link edges

export class HeaderCompact extends Module {

    setup() {
        this.casesLink = document.getElementById('header-cases-link')
        this.menuLink = document.getElementById('header-menu-link')
        this.logo = document.getElementById('header-logo-actual')
        this.linksPlacer = document.querySelector('.header-content-links-placer')
        this.smallLogoPlacer = document.querySelector('.small-header-placer')
        this.featureContainer = document.querySelector('.header-content-logo-container-feature')
        this.descriptor = document.querySelector('.descriptor-svg')
        this.counterText = document.getElementById('menu-counter-text')
        this.counterWrapper = document.querySelector('.header-counter-wrapper')
        this.menuContent = document.querySelector('.header-menu-content')

        if (!this.casesLink || !this.menuLink || !this.logo || !this.linksPlacer || !this.smallLogoPlacer) {
            console.warn('HeaderCompact: header elements missing, skipping')
            return
        }

        //1-3 Design-time mirrors out
        ;['header-logo-mirror', 'header-cases-link-mirror', 'header-menu-link-mirror']
            .forEach((id) => document.getElementById(id)?.remove())

        //4-5 Compact-state extras start hidden
        this.counterMask = this.counterText ? this.wrapInMask(this.counterText) : null
        this.profitCounter = this.counterText ? new ProfitCounter(this.counterText).mount() : null
        if (this.profitCounter?.units?.length) gsap.set(this.profitCounter.units, { yPercent: COUNTER_OFFSET_PERCENT })
        gsap.set(this.linksPlacer, { [PLACER_FILL_PROPERTY]: PLACER_FILL_HIDDEN })

        //Spread-state homes, to put everything back at the top
        this.homes = [this.casesLink, this.menuLink, this.logo].map((element) => ({
            element,
            parent: element.parentElement,
            nextSibling: element.nextSibling,
        }))

        this.isCompact = false
        this.logoFlip = null
        this.placerTween = null
        this.counterTween = null

        //isAnimating — a compact/spread transition is running, menu clicks are ignored.
        //isMenuOpen — the menu's direction: true from the open click, false from the close click.
        //isMenuLocked — scroll stops driving the header: from the open click until the menu
        //has fully closed (releaseMenuLock()), so the pill can't spread under a closing menu.
        this.isAnimating = false
        this.isMenuOpen = false
        this.isMenuLocked = false
        this.isPinnedCompact = false
        this.animationLock = null
        this.menuReveal = new MenuReveal().mount()

        this.scrollTrigger = this.animate(ScrollTrigger.create({
            start: COMPACT_SCROLL_PX,
            end: 'max',
            onEnter: () => this.onScrollThreshold(true),
            onLeaveBack: () => this.onScrollThreshold(false),
        }))

        this.isMenuIconOpen = false
        this.listen(this.menuLink, 'click', (event) => this.onMenuClick(event))
        this.listen(this.menuLink, 'mouseenter', () => this.bounceMenuIcon(true))
        this.listen(this.menuLink, 'mouseleave', () => this.bounceMenuIcon(false))

        //Viewport changes move the pill — keep the menu content level with it while open
        this.listen(window, 'resize', () => {
            if (this.isMenuLocked) this.updateMenuContentPadding()
        })
    }

    //Triggers

    onScrollThreshold(isPastThreshold) {
        if (this.isMenuLocked || this.isPinnedCompact) return
        this.setCompact(isPastThreshold)
    }

    //Called by main.js on first load and every Barba page change (screen covered by then).
    //Pinned pages go compact instantly; leaving one goes back to what the scroll says, also
    //instantly. Other page changes keep their normal (animated) scroll behaviour
    setNamespace(namespace) {
        let wasPinned = this.isPinnedCompact
        this.isPinnedCompact = PINNED_COMPACT_NAMESPACES.includes(namespace)
        if (!this.homes || this.isMenuLocked) return

        if (this.isPinnedCompact) this.setCompact(true, { instant: true })
        else if (wasPinned) this.setCompact(this.shouldBeCompact(), { instant: true })
    }

    //Where the header rests when nothing else holds it
    shouldBeCompact() {
        return this.isPinnedCompact || Boolean(this.scrollTrigger?.isActive)
    }

    //Toggle. Opening: compact first if the header is spread, menu drops after the pill.
    //Closing: menu reverses, then releaseMenuLock() spreads the header back if we're at the
    //top. Pill mid-transition: ignored. Menu mid-animation: turns around (MenuReveal).
    onMenuClick(event) {
        event.preventDefault()
        if (this.isAnimating) return

        if (this.isMenuOpen) {
            this.closeMenu()
            return
        }

        let needsCompact = !this.isCompact
        this.isMenuOpen = true
        this.isMenuLocked = true
        this.setCompact(true) //no-op when already compact from scrolling, or still compact from a close in progress
        this.openMenu(needsCompact ? PILL_TRANSITION_DURATION : 0)
    }

    //revealDelay — seconds until the menu starts dropping; MoneyGauge syncs its fill to it
    openMenu(revealDelay) {
        this.updateMenuContentPadding()
        this.setMenuIcon(true)
        this.menuReveal?.open(revealDelay)
        document.dispatchEvent(new CustomEvent(MENU_OPEN_EVENT, { detail: { revealDelay } }))
    }

    //.header-menu-content's padding-top = the pill's vertical center, so the menu's content
    //starts level with the middle of the pill. Measured from the menu content's own top;
    //if it isn't laid out yet (display: none before opening) its top is the viewport top.
    //The pill's top is final the moment setCompact runs (only left/right animate), so this
    //is right even while the header is still compacting.
    updateMenuContentPadding() {
        let menuContent = this.menuContent
        if (!menuContent) return

        let placerRect = this.linksPlacer.getBoundingClientRect()
        let menuContentRect = menuContent.getBoundingClientRect()
        let referenceTop = menuContentRect.height ? menuContentRect.top : 0

        let paddingTop = placerRect.top - referenceTop + placerRect.height / 2
        menuContent.style.paddingTop = `${Math.max(0, paddingTop)}px`
    }

    //Pill waits for the menu — the lock is released only once it's fully shut
    closeMenu() {
        this.isMenuOpen = false
        this.setMenuIcon(false)
        document.dispatchEvent(new CustomEvent(MENU_CLOSE_EVENT))
        if (this.menuReveal) this.menuReveal.close(() => this.releaseMenuLock())
        else this.releaseMenuLock()
    }

    //Called by main.js when a page change starts (menu link or any other): the menu plays its
    //close in full, the eye waits for it. The lock is kept — the header holds still until
    //snapMenuClosed() under the covered screen. Resolves at once if the menu isn't up
    closeMenuBeforeLeave() {
        if (!this.isMenuLocked || !this.menuReveal) return Promise.resolve()

        if (this.isMenuOpen) {
            this.isMenuOpen = false
            this.setMenuIcon(false)
            document.dispatchEvent(new CustomEvent(MENU_CLOSE_EVENT))
        }
        //Takes over a close already running — its releaseMenuLock() is replaced by this resolve
        return new Promise((resolve) => this.menuReveal.close(resolve))
    }

    //Called by main.js while the eye transition covers the screen: whatever the menu is doing,
    //it ends shut and the header is handed back to scroll before the new page shows
    snapMenuClosed() {
        if (!this.isMenuLocked) return
        if (this.isMenuOpen) this.closeMenu()
        this.menuReveal?.snapClosed() //a pending close's onClosed may release the lock here
        if (this.isMenuLocked) this.releaseMenuLock()
    }

    //Lines meet in the middle of the layout and rotate into ×. Distance is computed for the
    //pinned base padding: the layout's height is fixed, so its content area (where the lines
    //sit, space-between) is clientHeight minus the padding — whatever the hover is doing now.
    setMenuIcon(isOpen) {
        let layout = this.menuLink.querySelector(MENU_LINES_LAYOUT_SELECTOR)
        let lines = [...this.menuLink.querySelectorAll(MENU_LINE_SELECTOR)]
        if (!layout || lines.length < 2) return

        this.isMenuIconOpen = isOpen
        this.menuIconTimeline?.kill()
        gsap.killTweensOf(lines, 'rotation') //a hover bounce still springing would fight the timeline
        let timeline = gsap.timeline({ defaults: { duration: MENU_ICON_DURATION, ease: MENU_ICON_EASE } })

        if (isOpen) {
            let contentHeight = layout.clientHeight - MENU_ICON_BASE_PADDING_TOP - MENU_ICON_BASE_PADDING_BOTTOM
            let halfDistance = (contentHeight - lines[0].offsetHeight) / 2

            timeline
                .to(layout, { paddingTop: MENU_ICON_BASE_PADDING_TOP, paddingBottom: MENU_ICON_BASE_PADDING_BOTTOM }, 0)
                .to(lines[0], { y: halfDistance, rotation: MENU_ICON_ROTATION }, 0)
                .to(lines[lines.length - 1], { y: -halfDistance, rotation: -MENU_ICON_ROTATION }, 0)
        } else {
            timeline
                .to(lines, { y: 0, rotation: 0 }, 0)
                //Unpin — hover padding works again
                .add(() => gsap.set(layout, { clearProps: 'padding' }))
        }

        this.menuIconTimeline = this.animate(timeline)
    }

    //Only while the × is showing (closed state has the CSS padding hover instead).
    //Rotation only — y stays where setMenuIcon put it; overwrite hands the rotation over
    //cleanly if the open/close timeline is still running
    bounceMenuIcon(isHovered) {
        if (!this.isMenuIconOpen) return
        let lines = [...this.menuLink.querySelectorAll(MENU_LINE_SELECTOR)]
        if (lines.length < 2) return

        let rotation = MENU_ICON_ROTATION + (isHovered ? MENU_ICON_HOVER_EXTRA_ROTATION : 0)
        let bounceVars = { duration: MENU_ICON_HOVER_DURATION, ease: MENU_ICON_HOVER_EASE, overwrite: 'auto' }

        this.animate(gsap.to(lines[0], { rotation, ...bounceVars }))
        this.animate(gsap.to(lines[lines.length - 1], { rotation: -rotation, ...bounceVars }))
    }

    //Menu fully closed: scroll drives the header again, starting from where it is now.
    //Pinned pages stay compact
    releaseMenuLock() {
        this.isMenuLocked = false
        this.setCompact(this.shouldBeCompact())
    }

    //Takes the element's place in the placer flex row, clips the rise
    wrapInMask(element) {
        let mask = document.createElement('div')
        mask.className = COUNTER_MASK_CLASS
        mask.style.overflow = 'hidden'
        element.parentNode.insertBefore(mask, element)
        mask.appendChild(element)
        return mask
    }

    //Both links + the menu icon's divider lines — all flip to .is-inverted together
    invertedTargets() {
        let lines = [this.casesLink, this.menuLink].flatMap((link) => [...link.querySelectorAll(MENU_LINE_SELECTOR)])
        return [this.casesLink, this.menuLink, ...lines]
    }

    //Logo + whatever shifts because of it — measured and animated together
    logoFlipTargets() {
        return [this.logo, this.descriptor].filter(Boolean)
    }

    //Animations

    //instant — jump to the end state (pinned pages, screen covered): every tween below is
    //built as usual, then finished on the spot; no click lock, links' color snaps
    setCompact(isCompact, { instant = false } = {}) {
        if (isCompact === this.isCompact) return
        this.isCompact = isCompact
        if (instant) this.unlockClicks()
        else this.lockClicksDuringTransition()

        //States first — captures mid-animation positions, so a reversal mid-way is smooth
        let logoState = Flip.getState(this.logoFlipTargets())
        let placerStartEdges = this.placerEdgesFromCurrent()
        this.logoFlip?.kill()
        this.placerTween?.kill()

        //Links ride the pill: inside it they sit at its padded edges (space-between), so
        //animating the pill's left/right carries them — no separate links animation.
        //Compacting: into the pill first, pill starts stretched over where they were.
        //Spreading: they stay in the pill while it stretches out to their landing spots,
        //and only go home when it finishes (see the pill tween's onComplete).
        let placerEdges
        if (isCompact) {
            let isLinksHome = this.casesLink.parentElement !== this.linksPlacer
            let linksStartEdges = this.placerEdgesAroundLinks() //measured before any move
            let casesHomeTop = this.casesLink.getBoundingClientRect().top
            this.moveLinksIntoPlacer()
            //Mid-spread reversal: links never left the pill, its top is already aligned
            if (isLinksHome) this.alignPlacerTop(casesHomeTop)
            this.smallLogoPlacer.appendChild(this.logo)
            placerEdges = { from: linksStartEdges, to: this.placerEdgesFromCss() }
        } else {
            this.restoreHomes([this.logo])
            //Landing spots — home just long enough to measure, back in the pill the same
            //frame, so it's never painted
            this.restoreHomes([this.casesLink, this.menuLink])
            let linksEndEdges = this.placerEdgesAroundLinks()
            let casesHomeTop = this.casesLink.getBoundingClientRect().top
            this.moveLinksIntoPlacer()
            this.alignPlacerTop(casesHomeTop)
            placerEdges = { from: placerStartEdges, to: linksEndEdges }
        }

        //Color: CSS transition on the links (main.css "Header Compact") fades .is-inverted both ways
        this.invertedTargets().forEach((element) => element.classList.toggle(LINK_INVERTED_CLASS, isCompact))
        this.logo.classList.toggle(LOGO_SMALL_CLASS, isCompact)
        this.featureContainer?.classList.toggle(FEATURE_COMPACT_CLASS, isCompact)

        //9 — logo (+ descriptor), size change as scale so it stays a transform.
        //Spreading: held at its small spot (Flip renders the start state right away) until
        //the pill has nearly faded, then snaps home
        this.logoFlip = this.animate(Flip.from(logoState, isCompact
            ? { duration: LOGO_DURATION, ease: LOGO_EASE, scale: true }
            : { duration: LOGO_SPREAD_DURATION, delay: LOGO_SPREAD_DELAY, ease: LOGO_SPREAD_EASE, scale: true }
        ))

        //Placer pill fades in under the links, its edges carry them
        this.placerTween = this.animate(gsap.fromTo(this.linksPlacer,
            { left: placerEdges.from.left, right: placerEdges.from.right },
            {
                left: placerEdges.to.left,
                right: placerEdges.to.right,
                [PLACER_FILL_PROPERTY]: isCompact ? PLACER_FILL_VISIBLE : PLACER_FILL_HIDDEN,
                duration: LINKS_DURATION,
                ease: LINKS_EASE,
                //Spreading done — links go home now. Edges back to CSS either way,
                //keeps the pill responsive at rest. (Interrupted tweens never get here.)
                onComplete: () => {
                    if (!isCompact) this.restoreHomes([this.casesLink, this.menuLink])
                    gsap.set(this.linksPlacer, { clearProps: 'left,right' })
                },
            }
        ))

        //Counter letters rise out of the mask once the pill is coming in, drop back out on exit
        if (this.profitCounter?.units?.length) {
            this.counterTween?.kill()
            this.counterTween = this.animate(gsap.to(this.profitCounter.units, isCompact
                ? {
                    yPercent: 0,
                    duration: COUNTER_ENTER_DURATION,
                    stagger: COUNTER_ENTER_STAGGER,
                    delay: COUNTER_ENTER_DELAY,
                    ease: COUNTER_ENTER_EASE,
                }
                : {
                    yPercent: COUNTER_OFFSET_PERCENT,
                    duration: COUNTER_EXIT_DURATION,
                    stagger: { each: COUNTER_EXIT_STAGGER, from: 'end' },
                    ease: COUNTER_EXIT_EASE,
                }
            ))
        }

        //Instant: straight to the end — onCompletes still run (links home, edges back to CSS)
        if (instant) [this.logoFlip, this.placerTween, this.counterTween].forEach((tween) => tween?.progress(1))
    }

    //Placer Edges — { left, right } in px, relative to the pill's containing block

    placerContainingRect() {
        let containingBlock = this.linksPlacer.offsetParent || this.linksPlacer.parentElement
        return containingBlock.getBoundingClientRect()
    }

    //Pill stretched over both links as they currently render, plus padding each side
    placerEdgesAroundLinks() {
        let containingRect = this.placerContainingRect()
        let rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
        let padding = PLACER_LINK_PADDING_REM * rootFontSize
        let casesRect = this.casesLink.getBoundingClientRect()
        let menuRect = this.menuLink.getBoundingClientRect()

        return {
            left: casesRect.left - padding - containingRect.left,
            right: containingRect.right - (menuRect.right + padding),
        }
    }

    //Where the pill is right now — mid-tween inline values or the CSS ones
    placerEdgesFromCurrent() {
        let style = getComputedStyle(this.linksPlacer)
        return { left: parseFloat(style.left) || 0, right: parseFloat(style.right) || 0 }
    }

    //Webflow's left/right for the compact pill — inline values cleared to read them
    placerEdgesFromCss() {
        gsap.set(this.linksPlacer, { clearProps: 'left,right' })
        return this.placerEdgesFromCurrent()
    }

    //Clicks stay off for the pill / logo transition — the longest of the two
    //Also the window for the links' CSS color fade (main.css "Header Compact") — outside it,
    //color changes (company color zones) snap like the rest of the header
    lockClicksDuringTransition() {
        this.isAnimating = true
        document.documentElement.classList.add(TRANSITIONING_CLASS)
        this.animationLock?.kill()
        this.animationLock = this.animate(gsap.delayedCall(PILL_TRANSITION_DURATION, () => this.unlockClicks()))
    }

    //Also cuts a running lock short — an instant switch has nothing to wait for
    unlockClicks() {
        this.animationLock?.kill()
        this.animationLock = null
        this.isAnimating = false
        document.documentElement.classList.remove(TRANSITIONING_CLASS)
    }

    //Replaces Webflow's fixed top (-0.5rem): shifts the pill so #header-cases-link sits at
    //exactly the height it has at home — no vertical jump moving in or out, any viewport.
    //Call with the link's home top, after it has been moved into the pill.
    alignPlacerTop(casesHomeTop) {
        let casesInPlacerTop = this.casesLink.getBoundingClientRect().top
        let currentTop = parseFloat(getComputedStyle(this.linksPlacer).top) || 0
        gsap.set(this.linksPlacer, { top: currentTop + (casesHomeTop - casesInPlacerTop) })
        this.alignCounterWrapperTop()
    }

    //.header-counter-wrapper is positioned on its own (stays centered while the pill's
    //width animates) — line its top up with the pill's. Measured on screen rather than
    //copying the value, so it holds even if its containing block differs from the pill's.
    alignCounterWrapperTop() {
        if (!this.counterWrapper) return
        let placerTop = this.linksPlacer.getBoundingClientRect().top
        let wrapperTop = this.counterWrapper.getBoundingClientRect().top
        let currentTop = parseFloat(getComputedStyle(this.counterWrapper).top) || 0
        gsap.set(this.counterWrapper, { top: currentTop + (placerTop - wrapperTop) })
    }

    //Around #menu-counter-text's mask — prepend/append are no-ops position-wise if already there
    moveLinksIntoPlacer() {
        this.linksPlacer.prepend(this.casesLink)
        this.linksPlacer.append(this.menuLink)
    }

    //Puts the given elements (default: all moved ones) back in their spread-state parents
    restoreHomes(elements = null) {
        this.homes
            ?.filter(({ element }) => !elements || elements.includes(element))
            .forEach(({ element, parent, nextSibling }) => {
                //nextSibling may itself have moved — fall back to appending
                if (nextSibling && nextSibling.parentNode === parent) parent.insertBefore(element, nextSibling)
                else parent.appendChild(element)
            })
    }

    //Cleanup — back to the spread layout, inline Flip styles cleared

    destroy() {
        super.destroy()
        if (!this.homes) return
        this.restoreHomes()
        this.logo.classList.remove(LOGO_SMALL_CLASS)
        this.invertedTargets().forEach((element) => element.classList.remove(LINK_INVERTED_CLASS))

        //Menu icon back to two lines, padding unpinned
        this.menuIconTimeline?.kill()
        gsap.set(this.menuLink.querySelectorAll(MENU_LINE_SELECTOR), { clearProps: 'transform' })
        let menuLinesLayout = this.menuLink.querySelector(MENU_LINES_LAYOUT_SELECTOR)
        if (menuLinesLayout) gsap.set(menuLinesLayout, { clearProps: 'padding' })
        this.featureContainer?.classList.remove(FEATURE_COMPACT_CLASS)

        this.menuReveal?.destroy()
        this.menuReveal = null
        this.isMenuOpen = false
        document.documentElement.classList.remove(TRANSITIONING_CLASS)

        //Counter: live drums back to the Webflow text, then out of its mask
        this.profitCounter?.destroy()
        this.profitCounter = null
        if (this.counterMask && this.counterText) {
            this.counterMask.parentNode?.insertBefore(this.counterText, this.counterMask)
            this.counterMask.remove()
        }
        gsap.set([this.casesLink, this.menuLink, ...this.logoFlipTargets()], { clearProps: 'all' })
        gsap.set(this.linksPlacer, { clearProps: 'left,right,top' })
        this.linksPlacer.style.removeProperty(PLACER_FILL_PROPERTY)
        if (this.counterWrapper) gsap.set(this.counterWrapper, { clearProps: 'top' })
        if (this.menuContent) this.menuContent.style.paddingTop = ''
        this.isCompact = false
    }
}
