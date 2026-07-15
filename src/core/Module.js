//Base class for all page modules.
//Tracks everything a module creates (listeners, timers, observers, animations, frames)
//so destroy() can wipe it all — required for Barba page swaps later.
//mount() never throws: one broken module should not take the whole site down.

export class Module {

    constructor() {
        this.listeners = []
        this.timers = []
        this.observers = []
        this.animations = []
        this.frames = []
    }

    mount() {
        try {
            this.setup()
        } catch (error) {
            console.warn(`${this.constructor.name} failed to mount`, error)
            this.destroy()
        }
        return this
    }

    //Override in subclass — query elements, early return if page has none
    setup() {}

    //Tracked Helpers

    listen(target, event, handler, options) {
        target.addEventListener(event, handler, options)
        this.listeners.push({ target, event, handler, options })
    }

    every(callback, intervalMs) {
        this.timers.push(setInterval(callback, intervalMs))
    }

    later(callback, delayMs) {
        this.timers.push(setTimeout(callback, delayMs))
    }

    observe(observer) {
        this.observers.push(observer)
        return observer
    }

    //Accepts GSAP tweens, timelines and ScrollTriggers — anything with kill()
    animate(animation) {
        this.animations.push(animation)
        return animation
    }

    frame(callback) {
        this.frames.push(requestAnimationFrame(callback))
    }

    //Continuous rAF loop — one tracked id slot, cancelled on destroy
    loop(callback) {
        let handle = { id: 0 }
        const step = (time) => {
            callback(time)
            handle.id = requestAnimationFrame(step)
        }
        handle.id = requestAnimationFrame(step)
        this.loops = this.loops || []
        this.loops.push(handle)
    }

    //Cleanup

    destroy() {
        this.listeners.forEach(({ target, event, handler, options }) => target.removeEventListener(event, handler, options))
        this.timers.forEach((id) => clearTimeout(id))
        this.observers.forEach((observer) => observer.disconnect())
        this.animations.forEach((animation) => animation.kill?.())
        this.frames.forEach((id) => cancelAnimationFrame(id))
        this.loops?.forEach((handle) => cancelAnimationFrame(handle.id))

        this.listeners = []
        this.timers = []
        this.observers = []
        this.animations = []
        this.frames = []
        this.loops = []
    }
}
