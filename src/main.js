import barba from '@barba/core'
import 'lenis/dist/lenis.css'
import './styles/main.css'
import { ScrollTrigger } from './core/gsap'
import { SmoothScroll } from './core/SmoothScroll'
import { EyeTransition } from './core/EyeTransition'
import { Preloader } from './modules/Preloader'
import { HeaderCompact } from './modules/HeaderCompact'
import { MenuLinks } from './modules/MenuLinks'
import { MenuMoney } from './modules/MenuMoney'
import { IconRoll } from './modules/IconRoll'
import { HeaderReveal } from './modules/HeaderReveal'
import { LogoArc } from './modules/LogoArc'
import { LayoutRefresh } from './modules/LayoutRefresh'
import { Clock } from './modules/Clock'
//Navbar disabled — uncomment the imports and list entries below to bring it back
// import { NavScroll } from './modules/NavScroll'
// import { NavCtaInvert } from './modules/NavCtaInvert'
import { AmountCounter } from './modules/AmountCounter'
import { Marquee } from './modules/Marquee'
import { ScrollReveal } from './modules/ScrollReveal'
import { HeroImageReveal } from './modules/HeroImageReveal'
import { BentoParallax } from './modules/BentoParallax'
import { Stages } from './modules/Stages'
import { PartnerSpotlight } from './modules/PartnerSpotlight'
import { LogoGridSwap } from './modules/LogoGridSwap'
import { CasesPage } from './modules/CasesPage'
import { CasesSlider } from './modules/CasesSlider'
import { GallerySlider } from './modules/GallerySlider'
import { TeamSlider } from './modules/TeamSlider'
import { SceneLoader } from './modules/SceneLoader'
import { ScrollArrow } from './modules/ScrollArrow'
import { HeroScrollReveal } from './modules/HeroScrollReveal'
import { FooterIntro } from './modules/FooterIntro'
import { FooterLight } from './modules/FooterLight'
import { FooterHeaderColor } from './modules/FooterHeaderColor'
import { ArrowDownloadIcon } from './modules/ArrowDownloadIcon'
import { ProgressiveBlur } from './modules/ProgressiveBlur'
import { FloatingButtonReveal } from './modules/FloatingButtonReveal'
import { FooterCtaMorph } from './modules/FooterCtaMorph'
import { SectionMarkerReveal } from './modules/SectionMarkerReveal'
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
const headerCompact = new HeaderCompact().mount() //header lives outside the Barba container
const menuLinks = new MenuLinks().mount() //menu lives in the header — told the page on every swap
const menuMoney = new MenuMoney().mount() //live counters + speedometer in the menu
const casesLinkArrow = new IconRoll('#header-cases-link .arrow-line', 'header-arrow-roll').mount() //hover drum on the header arrow
const logoArc = new LogoArc().mount() //arc above the logo dot, leans toward the mouse
const headerReveal = new HeaderReveal(headerCompact).mount() //header intro, first reveal only — after HeaderCompact strips the mirrors
new LayoutRefresh().mount() //lazy images grow the page after a refresh — re-measures the triggers

//Page Modules — destroyed and rebuilt on every Barba transition.
//Each receives smoothScroll (most ignore it); each skips silently when its elements are missing.

const PAGE_MODULE_CLASSES = [
    Clock,
    // NavScroll,
    // NavCtaInvert,
    AmountCounter,
    Marquee,
    ScrollReveal,
    HeroImageReveal,
    BentoParallax,
    Stages,
    PartnerSpotlight,
    LogoGridSwap,
    CasesPage,
    CasesSlider,
    GallerySlider, //before TeamSlider — it reads the gallery's first state on mount
    TeamSlider,
    SceneLoader,
    ScrollArrow,
    HeroScrollReveal,
    FooterIntro, //after Clock — Clock writes the time text it masks
    FooterLight,
    FooterHeaderColor,
    ArrowDownloadIcon,
    ProgressiveBlur,
    FloatingButtonReveal,
    FooterCtaMorph, //after FooterIntro + FloatingButtonReveal — follows the form's rise, morphs the floating pill
    SectionMarkerReveal,
]

//Page modules left out on specific namespaces
const SKIPPED_MODULES_BY_NAMESPACE = {
    'case-study': [FooterIntro, FooterLight], //testing: back-navigation scroll jump on case pages
}

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
    menuLinks.setCurrentNamespace(namespace)
    headerCompact.setNamespace(namespace) //cases / contacts: header pinned compact
    let skippedModules = SKIPPED_MODULES_BY_NAMESPACE[namespace] ?? []
    activeModules = PAGE_MODULE_CLASSES
        .filter((ModuleClass) => !skippedModules.includes(ModuleClass))
        .map((ModuleClass) => new ModuleClass(smoothScroll).mount())

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
    setSiteRevealed(true)
    headerReveal.reveal() //no-op after the first time
    activeModules.forEach((module) => module.reveal?.())
    activePage?.reveal?.()
}

//The 3D scene (separate bundle) holds its fade-in until the page is visible: it reads
//html[data-site-revealed] when it's ready, or waits for this event (scene experience.ts)
const SITE_REVEALED_EVENT = 'site-revealed'

function setSiteRevealed(isRevealed) {
    document.documentElement.dataset.siteRevealed = String(isRevealed)
    if (isRevealed) document.dispatchEvent(new Event(SITE_REVEALED_EVENT))
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

//Body Classes — Barba swaps only the container, so <body> would keep the first page's Webflow
//classes (e.g. cases-body's background) forever. Each swap trades the current page's markup
//classes for the incoming page's; classes added at runtime by scripts are left alone
let webflowBodyClasses = [...document.body.classList]

function syncBodyClasses(nextHtml) {
    let bodyTagMatch = nextHtml?.match(/<body\b[^>]*>/i)
    if (!bodyTagMatch) return
    let classMatch = bodyTagMatch[0].match(/\bclass="([^"]*)"/i)
    let nextClasses = classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : []

    document.body.classList.remove(...webflowBodyClasses)
    document.body.classList.add(...nextClasses)
    webflowBodyClasses = nextClasses
}

//Scroll Memory — the browser's own restoration would jump the still-visible old page to the
//new page's saved position on back / forward (the "fast scroll" before the eye closes), and
//the swap then sent everything to the top. Taken over: each page's scroll is saved when it's
//left; back / forward lands there, any other navigation starts at the top
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

const HISTORY_TRIGGERS = ['back', 'forward', 'popstate']
const savedScrollByUrl = new Map()

function scrollKey(url) {
    return url?.href?.split('#')[0] ?? ''
}

function isHistoryNavigation(trigger) {
    return HISTORY_TRIGGERS.includes(trigger)
}

//Debug — scroll at each transition step: native window.scrollY vs what Lenis thinks
const IS_SCROLL_DEBUG = true

function logScroll(step) {
    if (!IS_SCROLL_DEBUG) return
    console.log(`[scroll] ${step} — window: ${Math.round(window.scrollY)}, lenis: ${Math.round(smoothScroll.lenis.scroll)}, restoration: ${history.scrollRestoration}`)
}

//Barba — eye blinks shut, page swaps under black, eye opens

barba.init({
    prevent: ({ el }) => el?.closest?.('[data-transition="off"]'),
    transitions: [{
        name: 'eye-blink',

        async leave({ current, trigger }) {
            logScroll(`leave start (${current.namespace}, trigger: ${typeof trigger === 'string' ? trigger : 'click'})`)
            savedScrollByUrl.set(scrollKey(current.url), smoothScroll.lenis.scroll)
            setSiteRevealed(false) //next page's scene waits for the eye to open
            await headerCompact.closeMenuBeforeLeave() //menu up (e.g. a menu link) — it closes first, then the eye
            await eyeTransition.close()
            logScroll('leave — eye closed')
            headerCompact.snapMenuClosed() //safety net — new page always opens with the menu shut
            destroyPageModules()
            //Barba keeps the old container in the DOM until the transition ends
            //(stacked above the new one) — remove it now, while the screen is black
            current.container.remove()
        },

        async enter({ next, trigger }) {
            logScroll(`enter start (${next.namespace})`)
            reinitWebflow(next.html)
            syncBodyClasses(next.html)

            //Start at the top while the screen is still black — modules mount and measure there
            smoothScroll.lenis.scrollTo(0, { immediate: true, force: true })

            mountPageModules(next.namespace)
            ScrollTrigger.refresh()

            //Back / forward: return to where this page was left, after the triggers know the layout
            let savedScroll = isHistoryNavigation(trigger) ? savedScrollByUrl.get(scrollKey(next.url)) : null
            if (savedScroll) {
                smoothScroll.lenis.resize() //limit is still the old page's height until Lenis re-measures — it would clamp the jump
                smoothScroll.lenis.scrollTo(savedScroll, { immediate: true, force: true })
                ScrollTrigger.update()
            }
            logScroll(`enter — modules mounted (saved: ${savedScroll ?? 'none'})`)

            await eyeTransition.wait()
            await eyeTransition.open()
            logScroll('enter — eye open')
            revealPageModules()
        },
    }],
})

//Every history entry Barba adds must be manual too — otherwise Chrome restores its scroll on
//back / forward and jumps the old page while the eye closes
barba.hooks.after(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
})

//First Load

setSiteRevealed(false) //before the scene loads — it waits for the preloader to fade
mountPageModules()
preloader.revealed.then(revealPageModules)

//Debug handle — poke around from the browser console via window.app
window.app = { smoothScroll, eyeTransition, preloader, headerCompact, menuLinks, menuMoney, casesLinkArrow, get modules() { return activeModules }, get page() { return activePage } }