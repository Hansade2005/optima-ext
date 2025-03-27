import * as path from "path";
import * as fsExtra from "fs-extra";
import * as crypto from "crypto";
import TurndownService from "turndown";
import * as cheerio from "cheerio";
export class WebSearchService {
    context;
    browserSession;
    cacheDir;
    constructor(context, browserSession) {
        this.context = context;
        this.browserSession = browserSession;
        this.cacheDir = path.join(context.globalStorageUri.fsPath, "web-search-cache");
        fsExtra.ensureDirSync(this.cacheDir);
    }
    /**
     * Search the web for a query and return structured results
     * @param query The search query
     * @param maxResults Maximum number of results to return (default: 5)
     * @param useCache Whether to use cached results if available (default: true)
     * @returns Structured search results with content from each page
     */
    async searchWeb(query, maxResults = 5, useCache = true) {
        // Generate a cache key based on the query
        const cacheKey = this.generateCacheKey(query);
        const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
        // Check cache first if enabled
        if (useCache && fsExtra.existsSync(cacheFile)) {
            try {
                const cacheData = await fsExtra.readJson(cacheFile);
                const cacheAge = Date.now() - cacheData.timestamp;
                // Cache is valid for 24 hours (86400000 ms)
                if (cacheAge < 86400000) {
                    console.log(`Using cached search results for: ${query}`);
                    return cacheData;
                }
            }
            catch (error) {
                console.error("Error reading cache:", error);
                // Continue with live search if cache read fails
            }
        }
        // No valid cache, perform a live search
        console.log(`Performing web search for: ${query}`);
        // Launch browser if not already running
        await this.browserSession.launchBrowser();
        // Search Bing
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        const searchResults = await this.browserSession.doAction(async (page) => {
            await page.goto(searchUrl, { timeout: 10000, waitUntil: "domcontentloaded" });
            // Wait for search results to load
            await page.waitForSelector('.b_algo', { timeout: 5000 }).catch(() => { });
            // Extract URLs from search results
            const urls = await page.evaluate(() => {
                const results = Array.from(document.querySelectorAll('.b_algo h2 a'));
                return results.map(result => {
                    const link = result;
                    return {
                        title: link.innerText,
                        url: link.href
                    };
                }).filter(item => item.url && !item.url.includes('bing.com'))
                    .slice(0, 10); // Get more than we need in case some fail
            });
            return urls;
        });
        // Process the top results
        const results = [];
        let processedCount = 0;
        for (const result of searchResults) {
            if (processedCount >= maxResults)
                break;
            try {
                // Visit each page and extract content
                const pageContent = await this.extractPageContent(result.url);
                results.push({
                    title: result.title,
                    url: result.url,
                    ...pageContent
                });
                processedCount++;
            }
            catch (error) {
                console.error(`Error processing ${result.url}:`, error);
                // Continue with next result
            }
        }
        // Close browser when done
        await this.browserSession.closeBrowser();
        // Create the final result
        const webSearchResult = {
            query,
            timestamp: Date.now(),
            results
        };
        // Cache the results
        try {
            await fsExtra.writeJson(cacheFile, webSearchResult);
        }
        catch (error) {
            console.error("Error writing cache:", error);
        }
        return webSearchResult;
    }
    /**
     * Extract content from a web page
     * @param url URL to extract content from
     * @returns Structured content from the page
     */
    async extractPageContent(url) {
        try {
            const result = await this.browserSession.doAction(async (page) => {
                // Navigate to the URL
                await page.goto(url, {
                    timeout: 15000,
                    waitUntil: ["domcontentloaded", "networkidle2"]
                });
                // Extract page content
                return await page.evaluate(() => {
                    // Get HTML
                    const html = document.documentElement.outerHTML;
                    // Get CSS
                    const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
                        .map(link => link.href)
                        .filter(href => href);
                    // Get JS
                    const jsScripts = Array.from(document.querySelectorAll('script[src]'))
                        .map(script => script.src)
                        .filter(src => src);
                    // Get Links
                    const links = Array.from(document.querySelectorAll('a[href]'))
                        .map(a => a.href)
                        .filter(href => href && !href.startsWith('javascript:'));
                    // Get Images
                    const images = Array.from(document.querySelectorAll('img[src]'))
                        .map(img => img.src)
                        .filter(src => src);
                    return {
                        html,
                        cssLinks,
                        jsScripts,
                        links,
                        images
                    };
                });
            });
            // Extract clean text content using Cheerio
            const $ = cheerio.load(result.html || "");
            // Remove script, style, and non-content elements
            $('script, style, nav, footer, header, [role="banner"], [role="navigation"], iframe, noscript').remove();
            // Convert to readable text format
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                codeBlockStyle: 'fenced'
            });
            const text = turndownService.turndown($.html());
            return {
                html: result.html,
                css: result.cssLinks,
                js: result.jsScripts,
                text,
                links: result.links,
                images: result.images
            };
        }
        catch (error) {
            console.error(`Error extracting content from ${url}:`, error);
            throw error;
        }
    }
    /**
     * Generate a cache key from a search query
     * @param query The search query
     * @returns A sanitized, hashed string for use as a cache key
     */
    generateCacheKey(query) {
        // Create a hash of the query to use as the filename
        return crypto
            .createHash("md5")
            .update(query.toLowerCase().trim())
            .digest("hex");
    }
    async search(query) {
        const searchResults = await this.browserSession.doAction(async (page) => {
            // Implementation
            return [{ title: "Test Result", url: "https://example.com" }];
        });
        return searchResults;
    }
    async scrape(url) {
        const result = await this.browserSession.doAction(async (page) => {
            // Implementation
            return {
                html: "",
                cssLinks: [],
                jsScripts: [],
                links: [],
                images: []
            };
        });
        return result;
    }
}
//# sourceMappingURL=WebSearchService.js.map