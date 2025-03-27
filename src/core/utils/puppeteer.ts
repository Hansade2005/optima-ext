import puppeteer from "puppeteer-core"
import { getChromePath } from "puppeteer-chromium-resolver"

let browserInstance: puppeteer.Browser | null = null

export async function getPuppeteerBrowser(): Promise<puppeteer.Browser> {
    if (browserInstance) {
        return browserInstance
    }

    const { executablePath } = await getChromePath()
    
    browserInstance = await puppeteer.launch({
        executablePath,
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
            "--window-size=1920x1080"
        ],
        defaultViewport: {
            width: 1920,
            height: 1080
        }
    })

    return browserInstance
}

export async function closePuppeteerBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close()
        browserInstance = null
    }
} 