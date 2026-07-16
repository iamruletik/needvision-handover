import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'

//Navigation plate. Compresses on scroll, opens the dropdown menu on click,
//inverts colors over .stages. Two modes:
//  scroll   — timeline plays forward once past a threshold, reverses back at the top
//             (no scrub: scrubbing parks mid-frames with half-masked text)
//  static   — body[data-nav-mode="static"] in Webflow, plate starts compressed (inner pages)

//Compress Timeline — logo lands first, everything else follows after TOP_DELAY
const TOP_DELAY = 0.09
const COMPRESSED_WIDTH = '24vw'
const LOGO_SCALE = 0.47
const OVERLAY_RADIUS_OPEN = '0.8vw'
const OVERLAY_RADIUS_CLOSED = '1.5vw' //matches the Webflow radius — plate returns to its designed look
const COMPRESS_TRIGGER_START = '3.47vw top' //scroll depth that flips the plate

//Profit badge — must finish exactly when the plate is fully compressed (POSITION + DURATION = TOP_DELAY + 0.5)
const PROFIT_POSITION = 0.29
const PROFIT_DURATION = 0.3
const PROFIT_ITEM_DURATION = 0.2
const PROFIT_ITEM_STAGGER = 0.05

//Menu
const MENU_OPEN_DURATION = 1.1
const MENU_CLOSE_DURATION = 0.75
const MENU_COMPRESS_DURATION = 0.95

//Invert Zone — plate goes dark over .stages; opening the menu there overrides back to light
const INVERT_OVERRIDE_DURATION = 0.5
const INVERT_DARK = { background: '#040101', textColor: '#ffffff', logoFilter: 'invert(1)', iconFilter: 'invert(0)' }
const INVERT_LIGHT = { background: '#ffffff', textColor: '#000000', logoFilter: 'invert(0)', iconFilter: 'invert(1)' }

const MOBILE_MEDIA = '(max-width: 991px)'

//Pages where the plate starts compressed with no scroll animation.
//Keyed by Barba namespace — body attributes never update during Barba swaps.
const STATIC_NAV_NAMESPACES = ['cases']

function currentNamespace() {
    let container = document.querySelector('[data-barba="container"]')
    //Fallback until data-barba-namespace is set in Webflow
    return container?.dataset.barbaNamespace
        || (window.location.pathname.includes('cases') ? 'cases' : 'home')
}

export class NavScroll extends Module {

    setup() {
        this.overlay = document.querySelector('.menu_overlay-content')
        if (!this.overlay) return

        this.menuButton = document.querySelector('.nav-menu')
        this.menuPanel = document.querySelector('.menu_dropdown-list')
        this.menuText = document.querySelector('.nav-menu__txt')
        this.menuIcon = document.querySelector('.menu-icon')
        this.menuBackdrop = document.querySelector('.menu_backdrop')

        //Namespace only — body[data-nav-mode] is frozen at first load and lies after Barba swaps
        this.isStatic = STATIC_NAV_NAMESPACES.includes(currentNamespace())
        this.isMobile = window.matchMedia(MOBILE_MEDIA).matches
        this.menuOpen = false
        this.menuTimeline = null
        this.invertTimeline = null

        //Where the plate returns when the menu closes — scroll keeps this current
        this.compressState = { progress: this.isStatic ? 1 : 0 }

        this.setInitialStates()
        this.buildCompressTimeline()
        this.buildIconFade()
        this.bindScroll()
        this.bindMenu()
    }

    //Initial States

    setInitialStates() {
        gsap.set('.menu_profit-badge', { opacity: 0, width: 0, overflow: 'hidden', whiteSpace: 'nowrap' })
        gsap.set('.nav-profit-item', { opacity: 0, y: '1.39vw' })
        gsap.set('.menu_dropdown-list', { height: 0, opacity: 0 })
        gsap.set('.menu_backdrop', { opacity: 0, pointerEvents: 'none' })

        //Webflow gives the overlay no explicit background — transparent white so the tween interpolates alpha
        gsap.set(this.overlay, { backgroundColor: 'rgba(255,255,255,0)' })

        //Scale instead of width — composite only, no reflow, no <img> srcset re-pick
        gsap.set('.nav-logo_img', { transformOrigin: 'left center', force3D: true })
    }

    //Compress Timeline — one timeline serves scroll scrub AND the menu click (progress forced to 1)

    buildCompressTimeline() {
        this.compressTimeline = this.animate(gsap.timeline({ paused: true }))

        this.compressTimeline.to('.nav-logo_img', {
            scale: LOGO_SCALE,
            y: '2vw',
            marginLeft: '0.6vw',
            duration: 0.25,
            ease: 'power2.out',
        }, 0)

        //Wrapper lifts slightly with the logo so the plate hugs the top
        this.compressTimeline.to('.nav-wrapper', {
            marginTop: '-0.47vw',
            duration: 0.25,
            ease: 'power2.out',
        }, 0)

        this.compressTimeline.to(this.overlay, {
            width: COMPRESSED_WIDTH,
            backgroundColor: '#ffffff',
            duration: 0.5,
            ease: 'power2.out',
        }, TOP_DELAY)

        this.compressTimeline.to('.menu_control-bar *', {
            color: '#000000',
            duration: 0.5,
            ease: 'power2.out',
        }, TOP_DELAY)

        this.compressTimeline.to('.nav-icon', {
            filter: 'invert(1)',
            duration: 0.4,
            ease: 'power2.out',
        }, TOP_DELAY)

        this.compressTimeline.to('.menu_profit-badge', {
            width: 'auto',
            opacity: 1,
            margin: '0 0.5vw',
            duration: PROFIT_DURATION,
            ease: 'power2.out',
        }, PROFIT_POSITION)

        this.compressTimeline.to('.nav-profit-item', {
            opacity: 1,
            y: 0,
            duration: PROFIT_ITEM_DURATION,
            stagger: PROFIT_ITEM_STAGGER,
            ease: 'power2.out',
        }, PROFIT_POSITION)
    }

    //Icon Fade — side icons and timer fade out on first scroll down, back at the top. Opacity only.

    buildIconFade() {
        const iconFadeTimeline = this.animate(gsap.timeline({ paused: true }))
        iconFadeTimeline.to('.nav_left-icon, .nav_right-icon, .nav-timer', {
            opacity: 0,
            duration: 0.5,
            ease: 'power2.out',
        })

        this.animate(ScrollTrigger.create({
            trigger: 'body',
            start: 'top top-=20',
            onEnter: () => iconFadeTimeline.play(),
            onLeaveBack: () => iconFadeTimeline.reverse(),
        }))
    }

    //Scroll Modes

    bindScroll() {
        if (this.isStatic) {
            this.compressTimeline.progress(1)
            return
        }

        //Play/reverse over the timeline's own duration — every frame is a designed frame
        this.animate(ScrollTrigger.create({
            trigger: 'body',
            start: COMPRESS_TRIGGER_START,
            onEnter: () => {
                if (this.menuOpen) return
                this.compressTimeline.play()
                this.compressState.progress = 1
            },
            onLeaveBack: () => {
                if (this.menuOpen) return
                this.compressTimeline.reverse()
                this.compressState.progress = 0
            },
        }))

        if (!this.isMobile) this.buildInvertTimeline()
    }

    //Invert over .stages — .to() only, capturing current state instead of forcing from-values over the compress timeline

    buildInvertTimeline() {
        let stagesSection = document.querySelector('.stages')
        if (!stagesSection) return

        this.invertTimeline = this.animate(gsap.timeline({
            scrollTrigger: {
                trigger: stagesSection,
                start: 'top 85%',
                end: 'top 25%',
                scrub: true,
            },
        }))

        this.invertTimeline.to(this.overlay, { backgroundColor: INVERT_DARK.background, duration: 1, immediateRender: false }, 0)
        this.invertTimeline.to('.menu_control-bar *', { color: INVERT_DARK.textColor, duration: 1, immediateRender: false }, 0)
        this.invertTimeline.to('.nav-btm, .nav-btm *', { color: '#000000', duration: 1, immediateRender: false }, 0)
        this.invertTimeline.to('.nav-logo_img', { filter: INVERT_DARK.logoFilter, duration: 1, immediateRender: false }, 0)
        this.invertTimeline.to('.nav-icon', { filter: INVERT_DARK.iconFilter, duration: 1, immediateRender: false }, 0)
    }

    isInInvertZone() {
        return !!this.invertTimeline?.scrollTrigger && this.invertTimeline.scrollTrigger.progress > 0.5
    }

    applyInvertState(state) {
        const options = { duration: INVERT_OVERRIDE_DURATION, ease: 'power2.out', overwrite: 'auto' }
        this.animate(gsap.to(this.overlay, { ...options, backgroundColor: state.background }))
        this.animate(gsap.to('.menu_control-bar *', { ...options, color: state.textColor }))
        this.animate(gsap.to('.nav-logo_img', { ...options, filter: state.logoFilter }))
        this.animate(gsap.to('.nav-icon', { ...options, filter: state.iconFilter }))
    }

    //Menu

    bindMenu() {
        if (!this.menuButton || !this.menuPanel) return

        //stopImmediatePropagation — anything else bound to the same button never fires
        this.listen(this.menuButton, 'click', (event) => {
            event.preventDefault()
            event.stopImmediatePropagation()
            this.menuOpen ? this.closeMenu() : this.openMenu()
        })

        if (this.menuBackdrop) {
            this.listen(this.menuBackdrop, 'click', () => {
                if (this.menuOpen) this.closeMenu()
            })
        }

        this.listen(document, 'keydown', (event) => {
            if (event.key === 'Escape' && this.menuOpen) this.closeMenu()
        })

        //Any link inside the menu closes it — one delegated listener
        this.listen(this.menuPanel, 'click', (event) => {
            if (event.target.closest('.nav_menu-link')) this.closeMenu()
        })
    }

    openMenu() {
        this.menuOpen = true
        if (this.menuTimeline) this.menuTimeline.kill()

        //Opening over .stages — plate returns to its normal light compressed look
        if (this.isInInvertZone()) this.applyInvertState(INVERT_LIGHT)

        //Not compressed yet — compress first, then unfold the dropdown
        let needsCompress = this.compressTimeline.progress() < 0.99

        this.menuTimeline = this.animate(gsap.timeline())

        if (needsCompress) {
            this.menuTimeline.to(this.compressTimeline, {
                progress: 1,
                duration: MENU_COMPRESS_DURATION,
                ease: 'power2.inOut',
                overwrite: true,
            }, 0)
        }

        //-0.2 overlap — last quarter of the compress and first quarter of the unfold run together
        this.menuTimeline.addLabel('openStart', needsCompress ? '-=0.2' : 0)

        //Radius and panel move as one gesture — same start, duration and ease
        this.menuTimeline.to(this.overlay, {
            borderTopLeftRadius: OVERLAY_RADIUS_OPEN,
            borderTopRightRadius: OVERLAY_RADIUS_OPEN,
            duration: MENU_OPEN_DURATION,
            ease: 'power2.out',
            overwrite: 'auto',
        }, 'openStart')

        this.menuTimeline.to(this.menuPanel, {
            height: 'auto',
            opacity: 1,
            duration: MENU_OPEN_DURATION,
            ease: 'power2.out',
        }, 'openStart')

        if (this.menuBackdrop) {
            this.menuTimeline.to(this.menuBackdrop, {
                opacity: 1,
                pointerEvents: 'auto',
                duration: 0.9,
                ease: 'power2.out',
            }, '<')
        }

        if (this.menuIcon) {
            this.menuIcon.classList.add('is-open')
            this.menuIcon.setAttribute('aria-expanded', 'true')
        }

        this.swapMenuText('CLOSE')
    }

    closeMenu() {
        //Immediately, not in onComplete — rapid clicks otherwise loop the menu into "always closing"
        this.menuOpen = false
        if (this.menuTimeline) this.menuTimeline.kill()

        //Still over .stages — plate returns to dark
        if (this.isInInvertZone()) this.applyInvertState(INVERT_DARK)

        this.menuTimeline = this.animate(gsap.timeline())

        this.menuTimeline.to(this.overlay, {
            borderTopLeftRadius: OVERLAY_RADIUS_CLOSED,
            borderTopRightRadius: OVERLAY_RADIUS_CLOSED,
            duration: MENU_CLOSE_DURATION,
            ease: 'power2.in',
            overwrite: 'auto',
        }, 0)

        this.menuTimeline.to(this.menuPanel, {
            height: 0,
            opacity: 0,
            duration: MENU_CLOSE_DURATION,
            ease: 'power2.in',
        }, 0)

        if (this.menuBackdrop) {
            this.menuTimeline.to(this.menuBackdrop, {
                opacity: 0,
                pointerEvents: 'none',
                duration: 0.7,
                ease: 'power2.in',
            }, 0)
        }

        //Back to whatever the scroll position dictates; -0.3 overlap with the panel collapse
        this.menuTimeline.to(this.compressTimeline, {
            progress: this.compressState.progress,
            duration: MENU_COMPRESS_DURATION,
            ease: 'power2.inOut',
            overwrite: true,
        }, '-=0.3')

        if (this.menuIcon) {
            this.menuIcon.classList.remove('is-open')
            this.menuIcon.setAttribute('aria-expanded', 'false')
        }

        this.swapMenuText('Menu')
    }

    swapMenuText(text) {
        if (!this.menuText) return

        this.animate(gsap.to(this.menuText, {
            opacity: 0,
            duration: 0.2,
            ease: 'power2.in',
            overwrite: 'auto',
            onComplete: () => {
                this.menuText.textContent = text
                gsap.to(this.menuText, { opacity: 1, duration: 0.25, ease: 'power2.out' })
            },
        }))
    }
}
