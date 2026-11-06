import barba from '@barba/core'
import { ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'
import { NEXT_CASE_EVENT } from './NextCaseTransition'
import { logCaseTiming, logStageGeometry } from './CaseHeroReveal'

//Next Case swap — persistent, the Barba side of NextCaseTransition. A case study scrolled past
//its end hands over a fixed copy of the next hero (the "stage", its intro already playing);
//this runs the Barba transition for it. No eye: the stage covers the container swap and the
//jump to the top. It's dropped once the real hero image is ready AND the copy's intro has
//landed — the real hero is set to its revealed state first (reveal({ isInstant: true })), so
//stage and page are the same picture at the drop, nothing replays.
//main.js owns the page lifecycle and passes it in (page: saveScroll / setSiteRevealed /
//destroyModules / applyNextHtml / mountModules / revealModules); `transition` goes into
//barba.init, ahead of the default transition.

const NEXT_CASE_TRIGGER = 'next-case'
const SWAPPING_CLASS = 'is-next-case-swapping' //on <html> — undoes Lenis's stopped clip, so the scrollbar stays (main.css)
const HERO_IMAGE_SELECTOR = '.casepage_hero-media'
const HERO_IMAGE_TIMEOUT_MS = 3000

//Debug — skip the Lenis jump to the top in enter, to test whether the hand-off jump comes from it
const IS_SCROLL_RESET_DISABLED = false
//Debug — hold the stage this long before dropping it, to tell the scroll reset and the drop apart (0 = off)
const DEBUG_DROP_DELAY_MS = 0
//Debug — pause between swap steps (old container out / Webflow re-init / modules mount), 0 = off
const DEBUG_STEP_DELAY_MS = 0

function debugPause() {
    return DEBUG_STEP_DELAY_MS > 0 ? new Promise((resolve) => setTimeout(resolve, DEBUG_STEP_DELAY_MS)) : Promise.resolve()
}

export class NextCaseSwap extends Module {

    constructor({ smoothScroll, headerCompact, page }) {
        super()
        this.smoothScroll = smoothScroll
        this.headerCompact = headerCompact
        this.page = page
        this.handoff = null
    }

    setup() {
        this.listen(document, NEXT_CASE_EVENT, (event) => {
            let { url, stage, ready, dispose } = event.detail ?? {}
            if (!url || barba.transitions?.isRunning) return
            this.handoff = { stage, ready: ready ?? Promise.resolve(), dispose: dispose ?? (() => {}) }
            logStageGeometry('handoff received', stage)
            barba.go(url, NEXT_CASE_TRIGGER)
        })
    }

    get transition() {
        return {
            name: 'next-case',
            custom: ({ trigger }) => trigger === NEXT_CASE_TRIGGER,
            leave: (data) => this.leave(data),
            enter: (data) => this.enter(data),
        }
    }

    //Helpers

    //Webflow ships the hero lazy — forced eager, then loaded + decoded (or given up on after the timeout)
    waitForImage(image) {
        if (!image) return Promise.resolve()
        image.loading = 'eager'
        let loaded = image.complete && image.naturalWidth > 0
            ? Promise.resolve()
            : new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true })
                image.addEventListener('error', resolve, { once: true })
            })
        let decoded = loaded.then(() => image.decode?.()).catch(() => {})
        let timeout = new Promise((resolve) => setTimeout(resolve, HERO_IMAGE_TIMEOUT_MS))
        return Promise.race([decoded, timeout])
    }

    dropStage() {
        this.handoff?.dispose()
        this.handoff = null
    }

    //Transition

    async leave({ current }) {
        logStageGeometry('leave start', this.handoff?.stage)
        this.page.saveScroll(current.url)
        //Page stays as tall as it is while the old container is out — a short page would lose its
        //scrollbar and widen the viewport
        document.body.style.minHeight = `${document.documentElement.scrollHeight}px`
        document.documentElement.classList.add(SWAPPING_CLASS)
        this.smoothScroll.stop()
        this.page.setSiteRevealed(false)
        this.headerCompact?.snapMenuClosed()
        this.page.destroyModules()
        current.container.remove()
        logStageGeometry('STEP 1 — old container removed', this.handoff?.stage)
        await debugPause()
    }

    async enter({ next }) {
        let stage = this.handoff?.stage
        logStageGeometry('enter start', stage)
        this.page.applyNextHtml(next.html)
        if (!IS_SCROLL_RESET_DISABLED) this.smoothScroll.lenis.scrollTo(0, { immediate: true, force: true })
        logStageGeometry('STEP 2 — Webflow re-init + body classes', stage)
        await debugPause()

        this.page.mountModules(next.namespace)
        ScrollTrigger.refresh()
        logStageGeometry('STEP 3 — modules mounted + refresh', stage)
        requestAnimationFrame(() => logStageGeometry('enter — next frame', stage))

        await Promise.all([
            this.waitForImage(next.container.querySelector(HERO_IMAGE_SELECTOR)),
            this.handoff?.ready.catch(() => {}),
        ])
        logStageGeometry('enter — image ready + stage intro landed', stage)
        let realHero = next.container.querySelector('.casepage_hero')
        logStageGeometry('enter — REAL hero for comparison', realHero)

        if (DEBUG_DROP_DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, DEBUG_DROP_DELAY_MS))

        //Real hero to its revealed state under the stage, then the stage goes
        this.page.revealModules({ isInstant: true })
        logStageGeometry('dropping stage now', stage)
        this.dropStage()
        this.releasePage()
    }

    //Swap over — scrolling back on, body height back to its content
    releasePage() {
        document.body.style.minHeight = ''
        this.smoothScroll.start()
        document.documentElement.classList.remove(SWAPPING_CLASS)
        this.smoothScroll.lenis.resize()
    }

    destroy() {
        super.destroy()
        this.dropStage()
        document.body.style.minHeight = ''
        document.documentElement.classList.remove(SWAPPING_CLASS)
    }
}
