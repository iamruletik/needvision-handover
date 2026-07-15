import 'lenis/dist/lenis.css'
import './styles/main.css'
import { SmoothScroll } from './core/SmoothScroll'
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

//Single Lenis for the whole site — modules that need scroll position import nothing, they get it from here
export const smoothScroll = new SmoothScroll()

//Page modules — each mounts safely and skips silently when its elements are missing
export const modules = [
    new Clock(),
    new NavScroll(),
    new NavCtaInvert(),
    new AmountCounter(),
    new Marquee(),
    new ScrollReveal(),
    new TextReveal(),
    new HeroImageReveal(),
    new HeroExit(smoothScroll),
    new BentoParallax(),
    new Stages(),
    new FooterReveal(),
    new PartnerSpotlight(),
    new LogoGridSwap(),
    new CasesPage(),
    new CasesSlider(),
    new TeamSlider(),
].map((module) => module.mount())

//Debug handle — poke around from the browser console via window.app
window.app = { smoothScroll, modules }
console.log('[main] script loaded, modules mounted:', modules.map((module) => module.constructor.name).join(', '))
