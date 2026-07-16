import barba from '@barba/core'
import 'lenis/dist/lenis.css'
import './styles/main.css'
import { ScrollTrigger } from './core/gsap'
import { SmoothScroll } from './core/SmoothScroll'
import { EyeTransition } from './core/EyeTransition'
import { Preloader } from './modules/Preloader'
import { Clock } from './modules/Clock'
import { NavScroll } from './modules/NavScroll'
import { NavCtaInvert } from './modules/NavCtaInvert'
import { AmountCounter } from './modules/AmountCounter'
import { Marquee } from './modules/Marquee'
import { ScrollReveal } from './modules/ScrollReveal'
import { TextReveal } from './modules/TextReveal'
import { HeroImageReveal } from './modules/HeroImageReveal'
import { HeroExit } from './modules/HeroExit'
import { BentoParallax } from './modules/BentoParallax'
import { Stages } from './modules/Stages'
import { FooterReveal } from './modules/FooterReveal'
import { PartnerSpotlight } from './modules/PartnerSpotlight'
import { LogoGridSwap } from './modules/LogoGridSwap'
import { CasesPage } from './modules/CasesPage'
import { CasesSlider } from './modules/CasesSlider'
import { TeamSlider } from './modules/TeamSlider'
import { SceneLoader } from './modules/SceneLoader'

//Persistent Layer — survives every page swap

const smoothScroll = new SmoothScroll()
const eyeTransition = new EyeTransition()
const preloader = new Preloader(smoothScroll).mount() //first load only, Barba uses the eye

//Page Modules — destroyed and rebuilt on every Barba transition.
//Each receives smoothScroll (most ignore it); each skips silently when its elements are missing.

const PAGE_MODULE_CLASSES = [
    Clock,
    NavScroll,
    NavCtaInvert,
    AmountCounter,
    Marquee,
    ScrollReveal,
    TextReveal,
    HeroImageReveal,
    HeroExit,
    BentoParallax,
    Stages,
    FooterReveal,
    PartnerSpotlight,
    LogoGridSwap,
    CasesPage,
    CasesSlider,
    TeamSlider,
    SceneLoader,
]

let activeModules = []

function mountPageModules() {
    activeModules = PAGE_MODULE_CLASSES.map((ModuleClass) => new ModuleClass(smoothScroll).mount())
}

function destroyPageModules() {
    activeModules.forEach((module) => module.destroy())
    activeModules = []
}

//Webflow re-init — Webflow's own JS (forms etc.) binds once per full load;
//after a container swap it must be reset against the new DOM
function reinitWebflow(nextHtml) {
    let webflow = window.Webflow
    if (!webflow) return

    //data-wf-page on <html> must match the incoming page for Webflow bindings
    let pageIdMatch = nextHtml.match(/data-wf-page="([^"]+)"/)
    if (pageIdMatch) document.documentElement.setAttribute('data-wf-page', pageIdMatch[1])

    try {
        webflow.destroy()
        webflow.ready()
        webflow.require?.('ix2')?.init?.()
    } catch (error) {
        console.warn('Webflow re-init failed', error)
    }
}

//Barba — eye blinks shut, page swaps under black, eye opens

barba.init({
    prevent: ({ el }) => el?.closest?.('[data-transition="off"]'),
    transitions: [{
        name: 'eye-blink',

        async leave() {
            await eyeTransition.close()
            destroyPageModules()
        },

        async enter({ next }) {
            reinitWebflow(next.html)

            //Land at the top while the screen is still black
            smoothScroll.lenis.scrollTo(0, { immediate: true, force: true })

            mountPageModules()
            ScrollTrigger.refresh()

            await eyeTransition.wait()
            await eyeTransition.open()
        },
    }],
})

//First Load

mountPageModules()

//Debug handle — poke around from the browser console via window.app
window.app = { smoothScroll, eyeTransition, preloader, get modules() { return activeModules } }
console.log('[main] loaded — barba active, modules:', activeModules.map((module) => module.constructor.name).join(', '))
