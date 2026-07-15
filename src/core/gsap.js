import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Observer } from 'gsap/Observer'

//Single registration point — import gsap from here, never from the package directly
gsap.registerPlugin(ScrollTrigger, Observer)

export { gsap, ScrollTrigger, Observer }
