import 'lenis/dist/lenis.css'
import './styles/main.css'
import { SmoothScroll } from './core/SmoothScroll'
import { Clock } from './modules/Clock'
import { AmountCounter } from './modules/AmountCounter'
import { Marquee } from './modules/Marquee'
import { ScrollReveal } from './modules/ScrollReveal'

//Single Lenis for the whole site — modules that need scroll position import nothing, they get it from here
export const smoothScroll = new SmoothScroll()

//Page modules — each mounts safely and skips silently when its elements are missing
export const modules = [
    new Clock(),
    new AmountCounter(),
    new Marquee(),
    new ScrollReveal(),
].map((module) => module.mount())

//Debug handle — poke around from the browser console via window.app
window.app = { smoothScroll, modules }
console.log('[main] script loaded, modules mounted:', modules.map((module) => module.constructor.name).join(', '))
