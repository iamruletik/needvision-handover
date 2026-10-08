import barba from '@barba/core'
import 'lenis/dist/lenis.css'
import './styles/main.css'
import { ScrollTrigger } from './core/gsap'
import { SmoothScroll } from './core/SmoothScroll'
import { EyeTransition } from './core/EyeTransition'
import { Preloader } from './modules/Preloader'
import { Clock } from './modules/Clock'
//Navbar disabled — uncomment the imports and list entries below to bring it back
// import { NavScroll } from './modules/NavScroll'
// import { NavCtaInvert } from './modules/NavCtaInvert'
import { AmountCounter } from './modules/AmountCounter'
import { Marquee } from './modules/Marquee'
import { ScrollReveal } from './modules/ScrollReveal'
import { TextReveal } from './modules/TextReveal'
import { HeroImageReveal } from './modules/HeroImageReveal'
import { HeroExit } from './modules/HeroExit'
import { BentoParallax } from './modules/BentoParallax'
import { Stages } from './modules/Stages'
import { PartnerSpotlight } from './modules/PartnerSpotlight'
import { LogoGridSwap } from './modules/LogoGridSwap'
import { CasesPage } from './modules/CasesPage'
import { CasesSlider } from './modules/CasesSlider'
import { CaseGallerySlider } from './modules/CaseGallerySlider'
import { TeamSlider } from './modules/TeamSlider'
import { SceneLoader } from './modules/SceneLoader'
import { ScrollArrow } from './modules/ScrollArrow'
import { HeroScrollReveal } from './modules/HeroScrollReveal'
import { FooterIntro } from './modules/FooterIntro'
import { FooterLight } from './modules/FooterLight'
import { ArrowDownloadIcon } from './modules/ArrowDownloadIcon'
import { HomePage } from './pages/home'
import { CasesPageScript } from './pages/cases'
import { CaseStudyPage } from './pages/case-study'
import { CompanyPage } from './pages/company'
import { ContactsPage } from './pages/contacts'
import { PrivacyPage } from './pages/privacy'

//Persistent Layer — survives every page swap

const smoothScroll = new SmoothScroll()
const eyeTransition = new EyeTransition()
const preloader = new Preloader(smoothScroll).mount() //first load only, Barba uses the eye

//Page Modules — destroyed and rebuilt on every Barba transition.
//Each receives smoothScroll (most ignore it); each skips silently when its elements are missing.

const PAGE_MODULE_CLASSES = [
    Clock,
    // NavScroll,
    // NavCtaInvert,
    AmountCounter,
    Marquee,
    ScrollReveal,
    TextReveal,
    HeroImageReveal,
    HeroExit,
    BentoParallax,
    Stages,
    PartnerSpotlight,
    LogoGridSwap,
    CasesPage,
    CasesSlider,
    CaseGallerySlider,
    TeamSlider,
    SceneLoader,
    ScrollArrow,
    HeroScrollReveal,
    FooterIntro, //after Clock — Clock writes the time text it masks
    FooterLight,
    ArrowDownloadIcon,
]

//Page Scripts — one per Barba namespace (data-barba-namespace on the container in Webflow)

const PAGE_CLASSES_BY_NAMESPACE = {
    'home': HomePage,
    'cases': CasesPageScript,
    'case-study': CaseStudyPage,
    'company': CompanyPage,
    'contacts': ContactsPage,
    'privacy': PrivacyPage,
}

let activeModules = []
let activePage = null

function currentNamespace() {
    return document.querySelector('[data-barba="container"]')?.dataset.barbaNamespace
}

function mountPageModules(namespace = currentNamespace()) {
    activeModules = PAGE_MODULE_CLASSES.map((ModuleClass) => new ModuleClass(smoothScroll).mount())

    let PageClass = PAGE_CLASSES_BY_NAMESPACE[namespace]
    if (!PageClass) console.warn(`[main] no page script for namespace "${namespace}"`)
    activePage = PageClass ? new PageClass(smoothScroll).mount() : null
}

function destroyPageModules() {
    activeModules.forEach((module) => module.destroy())
    activeModules = []

    activePage?.destroy()
    activePage = null
}

//Screen just became visible (preloader faded / eye opened) — modules with intro animations play them
function revealPageModules() {
    activeModules.forEach((module) => module.reveal?.())
    activePage?.reveal?.()
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

        async leave({ current }) {
            await eyeTransition.close()
            destroyPageModules()
            //Barba keeps the old container in the DOM until the transition ends
            //(stacked above the new one) — remove it now, while the screen is black
            current.container.remove()
        },

        async enter({ next }) {
            reinitWebflow(next.html)

            //Land at the top while the screen is still black
            smoothScroll.lenis.scrollTo(0, { immediate: true, force: true })

            mountPageModules(next.namespace)
            ScrollTrigger.refresh()

            await eyeTransition.wait()
            await eyeTransition.open()
            revealPageModules()
        },
    }],
})

//First Load

mountPageModules()
preloader.revealed.then(revealPageModules)

//Debug handle — poke around from the browser console via window.app
window.app = { smoothScroll, eyeTransition, preloader, get modules() { return activeModules }, get page() { return activePage } }
console.log('[main] loaded — barba active, modules:', activeModules.map((module) => module.constructor.name).join(', '))
