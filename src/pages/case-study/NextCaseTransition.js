import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'
import { CaseHeroReveal, logStageGeometry } from './CaseHeroReveal'
import { HEADER_TARGET, setZoneColor } from '../../modules/colorZoneTargets'

//Case study -> next case, by scrolling past the end.
//Webflow: .casepage_next (150vh runway, last in the container) carries data-next-case="/case-pages/…"
//and holds the keep-scrolling pill (fixed, bottom center — hidden by main.css until here).
//The next page is fetched on mount and its whole .casepage_hero is copied into a fixed "stage"
//on <body> — the same 100svh hero, image, gradient, texts and chips, so at full size it IS the
//next hero. The copy starts hidden (CaseHeroReveal) and plays its intro mid-scroll, once
//REVEAL_AT_VISIBLE of the stage is on screen.
//Scrubbed over the runway: first the content holds while the pill fades in and fills to half,
//then the content scrolls away, the stage rises from below the screen and grows, the pill fills up.
//At the end the stage is handed to NextCaseSwap (NEXT_CASE_EVENT: url, stage, ready — the copy's
//intro has landed, dispose — removes it). The swap keeps it up until then, so the real hero
//underneath can be shown as-is (no replay).

export const NEXT_CASE_EVENT = 'next-case-reached'

const RUNWAY_SELECTOR = '.casepage_next[data-next-case]'
const PILL_SELECTOR = '.keep-scrolling-content'
const FILL_SELECTOR = '.keep-scrolling-fill'
const NEXT_HERO_SELECTOR = '.casepage_hero'
const HERO_IMAGE_SELECTOR = '.casepage_hero-media'
const STAGE_CLASS = 'next-case-stage'
const STAGE_FULL_SIZE_CLASS = 'is-full-size' //drops will-change once grown — main.css
const PAGE_CONTEXT_CLASS = 'casepage_main' //the real hero's parent (the Barba container)
const PULLING_CLASS = 'is-next-case-pulling' //on <html> — main.css fades the floating CTA out

//Scrub Timeline (0 -> 1 over the runway, 200vh in Webflow) — two phases:
//  hold — the page content (.casepage_shell) stays put, the pill shows up and fills to half
//  pull — the content scrolls away, the stage rises and grows, the pill fills up and fades
const HOLD_END = 0.25 //of the runway — 50vh of 200
const PILL_IN_END = 0.05
const FILL_AT_HOLD_END = 0.5
const FILL_END = 0.9
const PILL_OUT_START = 0.9
const COMPLETE_PROGRESS = 0.999

//Rise and grow (pull phase) — the stage starts at half size, its top edge just at the bottom of
//the screen (center at 50 + 75 = 125% of the viewport, half height 25%). The growth finishes
//early, the rise takes the whole phase — so the move reads slower than the scale
const STAGE_START_SCALE = 0.5
const STAGE_START_Y_PERCENT = 75
const STAGE_SCALE_SHARE = 0.7 //of the pull phase, where the stage reaches full size
const STAGE_EASE = 'none'

//The page content held during the hold phase — the container's own shell (the hero has one inside)
const SHELL_SELECTOR = '[data-barba="container"] > .casepage_shell'

//Share of the stage's own height on screen when the copy's intro starts
const REVEAL_AT_VISIBLE = 0.85

//Header over the stage (its top edge past the header line) — white, like on the hero; back to
//the content's black when the stage drops below again (CaseHeaderColor owns the rest)
const HEADER_OVER_STAGE = { color: 'var(--main-colours--white)', inverted: 'var(--main-colours--black)' }
const HEADER_OVER_CONTENT = { color: 'var(--main-colours--black)', inverted: 'var(--main-colours--white)' }

export class NextCaseTransition extends Module {

    setup() {
        this.runway = document.querySelector(RUNWAY_SELECTOR)
        if (!this.runway) return

        let nextPath = this.runway.dataset.nextCase?.trim()
        if (!nextPath) return
        this.nextUrl = new URL(nextPath, window.location.href).href

        this.pill = this.runway.querySelector(PILL_SELECTOR)
        this.fill = this.runway.querySelector(FILL_SELECTOR)
        this.shell = document.querySelector(SHELL_SELECTOR)
        this.isHandedOff = false
        this.isArmed = false
        this.isHeaderOverStage = false
        this.heroReveal = null
        this.heroRevealDone = null

        this.stage = this.createStage()
        this.loadNextHero()
        this.createScrub()
    }

    //Helpers

    createStage() {
        let stage = document.createElement('div')
        stage.className = STAGE_CLASS
        stage.setAttribute('aria-hidden', 'true')
        document.body.appendChild(stage)
        return stage
    }

    //Next page's hero -> the stage. Failure leaves the stage as a plain dark panel
    async loadNextHero() {
        this.fetchController = new AbortController()
        try {
            let response = await fetch(this.nextUrl, { signal: this.fetchController.signal })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            let nextDocument = new DOMParser().parseFromString(await response.text(), 'text/html')
            let nextHero = nextDocument.querySelector(NEXT_HERO_SELECTOR)
            if (!nextHero || !this.stage) return

            let heroCopy = this.prepareCopy(document.importNode(nextHero, true))
            //Same parent class as the real hero — it inherits font / weight / color from casepage_main
            let pageContext = document.createElement('div')
            pageContext.className = PAGE_CONTEXT_CLASS
            pageContext.appendChild(heroCopy)
            this.stage.appendChild(pageContext)
            this.heroReveal = new CaseHeroReveal({ root: heroCopy, includeScrollHint: true }).mount()
            await heroCopy.querySelector(HERO_IMAGE_SELECTOR)?.decode?.()
        } catch (error) {
            if (error?.name !== 'AbortError') console.warn('NextCaseTransition: next hero not loaded', error)
        }
    }

    //A copy, not the page's element: no duplicate ids / Webflow interaction ids, images load now
    prepareCopy(hero) {
        [hero, ...hero.querySelectorAll('[id], [data-w-id]')].forEach((element) => {
            element.removeAttribute('id')
            element.removeAttribute('data-w-id')
        })
        hero.querySelectorAll('img').forEach((image) => { image.loading = 'eager' })
        return hero
    }

    createScrub() {
        let timeline = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
                trigger: this.runway,
                start: 'top bottom',
                end: 'max',
                scrub: true,
                onToggle: ({ isActive }) => document.documentElement.classList.toggle(PULLING_CLASS, isActive),
                onUpdate: ({ progress }) => this.onProgress(progress),
            },
        })

        //Pull phase — the stage sits invisible below the screen through the hold
        let pullDuration = 1 - HOLD_END
        timeline.fromTo(this.stage, { scale: STAGE_START_SCALE }, { scale: 1, duration: pullDuration * STAGE_SCALE_SHARE, ease: STAGE_EASE }, HOLD_END)
        timeline.fromTo(this.stage, { yPercent: STAGE_START_Y_PERCENT }, { yPercent: 0, duration: pullDuration, ease: STAGE_EASE }, HOLD_END)

        if (this.pill) {
            timeline.fromTo(this.pill, { autoAlpha: 0 }, { autoAlpha: 1, duration: PILL_IN_END }, 0)
            timeline.to(this.pill, { autoAlpha: 0, duration: 1 - PILL_OUT_START }, PILL_OUT_START)
        }
        if (this.fill) {
            timeline.fromTo(this.fill, { scaleX: 0 }, { scaleX: FILL_AT_HOLD_END, duration: HOLD_END }, 0)
            timeline.to(this.fill, { scaleX: 1, duration: FILL_END - HOLD_END }, HOLD_END)
        }

        this.timeline = this.animate(timeline)
    }

    //Hold phase — the shell is pushed down exactly as far as the page has scrolled into the
    //runway, so it reads as standing still; after the hold it keeps that offset and scrolls away.
    //Set by hand, not in the timeline: any transform on the shell breaks fixed children (the
    //gallery cursor), so it's cleared completely whenever the runway hasn't started
    holdShell(progress) {
        if (!this.shell) return
        if (progress <= 0) {
            gsap.set(this.shell, { clearProps: 'transform' })
            return
        }
        let heldDistance = Math.min(progress, HOLD_END) * this.runway.offsetHeight
        gsap.set(this.shell, { y: heldDistance })
    }

    //Share of the stage's (scaled) height inside the viewport
    visibleShare() {
        let rect = this.stage?.getBoundingClientRect()
        if (!rect?.height) return 0
        let visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
        return Math.max(0, visibleHeight) / rect.height
    }

    //Only on a change — CaseHeaderColor's zones write the same variables
    syncHeaderColor() {
        let rect = this.stage?.getBoundingClientRect()
        if (!rect) return
        let isOverStage = rect.height > 0 && rect.top <= parseFloat(HEADER_TARGET.line())
        if (isOverStage === this.isHeaderOverStage) return
        this.isHeaderOverStage = isOverStage
        setZoneColor(HEADER_TARGET, isOverStage ? HEADER_OVER_STAGE : HEADER_OVER_CONTENT)
    }

    //Copy's intro — once; scrolling back up leaves it revealed
    startHeroReveal() {
        if (this.heroRevealDone || !this.heroReveal) return
        this.heroRevealDone = this.heroReveal.reveal()
    }

    //Armed only once the end has been seen from below — landing at the very bottom (back button
    //restoring the old scroll) must not fire straight into the next case
    onProgress(progress) {
        this.holdShell(progress)
        this.syncHeaderColor()
        this.stage?.classList.toggle(STAGE_FULL_SIZE_CLASS, Number(gsap.getProperty(this.stage, 'scale')) >= 1)
        if (this.visibleShare() >= REVEAL_AT_VISIBLE) this.startHeroReveal()

        if (progress < COMPLETE_PROGRESS) {
            this.isArmed = true
            return
        }
        if (this.isArmed) this.complete()
    }

    //Animations

    complete() {
        if (this.isHandedOff) return
        this.isHandedOff = true

        this.timeline.scrollTrigger?.kill(false)
        this.timeline.progress(1)
        gsap.set(this.stage, { scale: 1, yPercent: 0 })
        //No transform at all for the swap — renders exactly like the real hero (inline, so the
        //CSS scale(0) start pose doesn't come back)
        this.stage.classList.add(STAGE_FULL_SIZE_CLASS)
        this.stage.style.transform = 'none'
        this.syncHeaderColor()
        this.startHeroReveal() //scrolled through faster than the threshold check — play it now
        logStageGeometry('complete (99.9%)', this.stage)

        let stage = this.stage
        let heroReveal = this.heroReveal
        document.dispatchEvent(new CustomEvent(NEXT_CASE_EVENT, {
            detail: {
                url: this.nextUrl,
                stage,
                ready: this.heroRevealDone ?? Promise.resolve(),
                dispose: () => {
                    stage?.remove() //first — the split revert below must not paint
                    heroReveal?.destroy()
                },
            },
        }))
    }

    destroy() {
        super.destroy()
        this.fetchController?.abort()
        document.documentElement.classList.remove(PULLING_CLASS)
        let animated = [this.pill, this.fill, this.shell].filter(Boolean)
        if (animated.length) gsap.set(animated, { clearProps: 'opacity,visibility,transform' })

        //Handed off: NextCaseSwap owns the stage (and its copy's reveal) now and disposes it after the swap
        if (!this.isHandedOff) {
            this.heroReveal?.destroy()
            this.stage?.remove()
        }
        this.heroReveal = null
        this.stage = null
    }
}
