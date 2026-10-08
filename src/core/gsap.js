import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Observer } from 'gsap/Observer'
import { SplitText } from 'gsap/SplitText'

//Single registration point — import gsap from here, never from the package directly
gsap.registerPlugin(ScrollTrigger, Observer, SplitText)

export { gsap, ScrollTrigger, Observer, SplitText }
