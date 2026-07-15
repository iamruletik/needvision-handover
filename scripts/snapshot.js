//Downloads published Webflow pages into webflow-snapshots/ so code can be
//written against the real markup without hitting the network every time.
//Run after publishing structural changes in Webflow: npm run snapshot

import { writeFile, mkdir } from 'node:fs/promises'

const SITE = 'https://need-vision-test.webflow.io'
const PAGES = {
    'home.html': '/',
    'cases.html': '/cases',
}

await mkdir('webflow-snapshots', { recursive: true })

for (let [file, path] of Object.entries(PAGES)) {
    let response = await fetch(SITE + path)
    if (!response.ok) {
        console.error(`${path} -> ${response.status}, skipped`)
        continue
    }
    await writeFile(`webflow-snapshots/${file}`, await response.text())
    console.log(`${path} -> webflow-snapshots/${file}`)
}
