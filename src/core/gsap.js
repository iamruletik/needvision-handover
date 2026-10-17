import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Observer } from 'gsap/Observer'
import { SplitText } from 'gsap/SplitText'
import { Flip } from 'gsap/Flip'

//Single registration point — import gsap from here, never from the package directly
gsap.registerPlugin(ScrollTrigger, Observer, SplitText, Flip)

export { gsap, ScrollTrigger, Observer, SplitText, Flip }
