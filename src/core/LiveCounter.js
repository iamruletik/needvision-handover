//Shared live numbers — every visitor sees the same value at the same moment, and it keeps
//growing between visits. Nothing is stored: each value is a pure function of time, so any
//device computes it on its own.
//
//  value = startAmount + AVERAGE_INCREMENT * seconds + wobble(seconds) - wobble(0)
//
//wobble is a seeded hash of the second (0..WOBBLE_RANGE-1), identical everywhere; each
//counter gets its own seed so they don't tick in lockstep. Per-second growth =
//AVERAGE_INCREMENT + wobble(s) - wobble(s-1) → 2..98, looks random, never negative.
//~50/s average: +200 000 000 takes ~46 days.
//
//"Now" comes from the server: the page's own Date header (same-origin HEAD, no-store),
//stored as an offset from the local clock — one sync shared by every counter. Visitors
//with a wrong system clock still get the right numbers; if the header can't be read,
//the local clock is the fallback. Timezones never matter — Date.now() is absolute UTC.

const DEFAULT_START_DATE = Date.UTC(2026, 9, 8, 11, 0, 0) //2026-10-08 11:00 UTC — values equal their startAmount here
const AVERAGE_INCREMENT = 50
const WOBBLE_RANGE = 49 //wobble 0..48 → per-second increment 2..98
const SEED_MULTIPLIER = 0x9e3779b9 //spreads small seeds (1, 2, …) across the hash input

//Server Clock — one sync for every counter

class ServerClock {

    constructor() {
        this.offsetMs = 0
        this.isSynced = false
        this.syncPromise = this.sync()
    }

    //The CDN stamps Date at send time, even on cache hits
    async sync() {
        try {
            let response = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
            let serverTime = Date.parse(response.headers.get('Date'))
            if (!Number.isFinite(serverTime)) return
            this.offsetMs = serverTime - Date.now()
            this.isSynced = true
        } catch (error) {
            console.warn('LiveCounter: no server time, using the local clock', error)
        }
    }

    now() {
        return Date.now() + this.offsetMs
    }

    //Milliseconds until the next whole second — lets tickers update on the boundary
    msUntilNextSecond() {
        return 1000 - (this.now() % 1000)
    }
}

export const serverClock = new ServerClock()

//Live Counter

export class LiveCounter {

    constructor({ startAmount, startDate = DEFAULT_START_DATE, seed = 0 }) {
        this.startAmount = startAmount
        this.startDate = startDate
        this.seed = seed
    }

    secondsAt(timeMs) {
        return Math.max(0, Math.floor((timeMs - this.startDate) / 1000))
    }

    valueAt(timeMs) {
        let seconds = this.secondsAt(timeMs)
        return this.startAmount + AVERAGE_INCREMENT * seconds + this.wobble(seconds) - this.wobble(0)
    }

    current() {
        return this.valueAt(serverClock.now())
    }

    //Growth during the last whole second (2..98) — same for everyone at that moment
    currentStep() {
        let seconds = this.secondsAt(serverClock.now())
        if (seconds < 1) return AVERAGE_INCREMENT
        return AVERAGE_INCREMENT + this.wobble(seconds) - this.wobble(seconds - 1)
    }

    msUntilNextSecond() {
        return serverClock.msUntilNextSecond()
    }

    //Integer hash (lowbias32) → 0..WOBBLE_RANGE-1; same input + seed, same output, every device
    wobble(seconds) {
        let hash = (seconds ^ Math.imul(this.seed, SEED_MULTIPLIER)) | 0
        hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d)
        hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b)
        hash ^= hash >>> 16
        return (hash >>> 0) % WOBBLE_RANGE
    }
}

//"400800374" → "400 800 374"
export function formatAmount(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

const NUMBER_PATTERN = /\d[\d\s]*\d/ //"400 800 374" — digits with group spaces (incl. nbsp)

//The text node inside `element` that holds the number, plus its text before / after it.
//Displays replace only this node, so sibling elements (icons, a separate $ sign) are left alone.
export function findNumberTextNode(element) {
    let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        let match = node.data.match(NUMBER_PATTERN)
        if (!match) continue
        return {
            node,
            prefix: node.data.slice(0, match.index),
            suffix: node.data.slice(match.index + match[0].length),
        }
    }
    return null
}

//Site counters — one instance each, every display of the same number reads the same one
export const liveProfit = new LiveCounter({ startAmount: 400_000_000 })
export const liveMenuLargeCounter = new LiveCounter({ startAmount: 900_000_000, seed: 1 })
export const liveMenuSmallCounter = new LiveCounter({ startAmount: 1_000_000_000, seed: 2 })
