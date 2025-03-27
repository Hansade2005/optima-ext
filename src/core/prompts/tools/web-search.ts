<<<<<<< HEAD
import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import puppeteer from "puppeteer-core"
import cheerio from "cheerio"
import { getPuppeteerBrowser } from "../../utils/puppeteer"
import { sanitizeUrl, isValidUrl } from "../../utils/url"
import { cleanText, extractMetadata } from "../../utils/content"
import { cache } from "../../utils/cache"

const searchResultSchema = z.object({
    title: z.string(),
    link: z.string(),
    snippet: z.string(),
    relevance: z.number().optional()
})

const webPageDataSchema = z.object({
    url: z.string(),
    title: z.string(),
    fullText: z.string(),
    summary: z.string(),
    images: z.array(z.object({
        src: z.string(),
        alt: z.string(),
        base64: z.string(),
        dimensions: z.object({
            width: z.number().optional(),
            height: z.number().optional()
        }).optional()
    })),
    html: z.string(),
    metadata: z.object({
        description: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        author: z.string().optional(),
        publishedDate: z.string().optional(),
        modifiedDate: z.string().optional(),
        language: z.string().optional(),
        robots: z.string().optional()
    }),
    navigationStatus: z.object({
        success: z.boolean(),
        error: z.string().optional(),
        statusCode: z.number().optional(),
        loadTime: z.number(),
        redirects: z.array(z.string()).optional()
    }),
    links: z.array(z.object({
        url: z.string(),
        text: z.string(),
        isInternal: z.boolean()
    }))
})

const webSearchSchema = z.object({
    query: z.string().describe("The search query to look up"),
    maxResults: z.number().optional().default(10).describe("Maximum number of search results to process (up to 10)"),
    extractImages: z.boolean().optional().default(true).describe("Whether to extract and convert images to base64"),
    navigationTimeout: z.number().optional().default(30000).describe("Timeout for each page navigation in milliseconds"),
    parallelProcessing: z.boolean().optional().default(true).describe("Whether to process pages in parallel"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache search results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
    minRelevance: z.number().optional().default(0.5).describe("Minimum relevance score for search results (0-1)")
})

// Rate limiting delay between requests (in milliseconds)
const RATE_LIMIT_DELAY = 2000
const MAX_RETRIES = 3
const MAX_PARALLEL_REQUESTS = 3
const CACHE_PREFIX = "web_search_"

export const webSearchTool: Tool = {
    name: "web_search",
    description: "Search the web and extract structured data from search results and web pages",
    schema: webSearchSchema,
    handler: async ({ 
        query, 
        maxResults = 10, 
        extractImages = true, 
        navigationTimeout = 30000,
        parallelProcessing = true,
        cacheResults = true,
        cacheDuration = 3600,
        minRelevance = 0.5
    }) => {
        // Ensure maxResults doesn't exceed 10
        const actualMaxResults = Math.min(maxResults, 10)
        
        try {
            // Check cache first if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${query}`
                const cachedResult = await cache.get(cacheKey)
                if (cachedResult) {
                    return cachedResult
                }
            }

            // Launch browser for search
            const browser = await getPuppeteerBrowser()
            const page = await browser.newPage()

            // Set a reasonable timeout for the search
            await page.setDefaultNavigationTimeout(navigationTimeout)

            // Navigate to Bing search
            await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
                waitUntil: "networkidle0"
            })

            // Get search results using Cheerio
            const $ = cheerio.load(await page.content())
            const searchResults: z.infer<typeof searchResultSchema>[] = []

            // Extract search results with relevance scoring
            $(".b_algo").each((_, element) => {
                if (searchResults.length >= actualMaxResults) return false

                const title = $(element).find("h2").text().trim()
                const link = $(element).find("h2 a").attr("href") || ""
                const snippet = $(element).find(".b_caption p").text().trim()

                if (title && link && snippet) {
                    // Calculate relevance score based on query match
                    const relevance = calculateRelevance(query, title, snippet)
                    if (relevance >= minRelevance) {
                        searchResults.push({ title, link, snippet, relevance })
                    }
                }
            })

            // Sort results by relevance
            searchResults.sort((a, b) => (b.relevance || 0) - (a.relevance || 0))

            // Process search results
            let webPagesData: z.infer<typeof webPageDataSchema>[] = []

            if (parallelProcessing) {
                // Process pages in parallel with rate limiting
                const chunks = chunkArray(searchResults, MAX_PARALLEL_REQUESTS)
                for (const chunk of chunks) {
                    const chunkResults = await Promise.all(
                        chunk.map(result => processSearchResult(result, extractImages, navigationTimeout))
                    )
                    webPagesData = webPagesData.concat(chunkResults.filter(Boolean))
                    // Add delay between chunks to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
                }
            } else {
                // Process pages sequentially
                for (const result of searchResults) {
                    const pageData = await processSearchResult(result, extractImages, navigationTimeout)
                    if (pageData) {
                        webPagesData.push(pageData)
                    }
                }
            }

            await browser.close()

            const result = {
                searchResults,
                webPagesData,
                totalResults: searchResults.length,
                processedResults: webPagesData.length,
                successfulNavigations: webPagesData.filter(page => page.navigationStatus.success).length,
                query,
                timestamp: new Date().toISOString()
            }

            // Cache the result if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${query}`
                await cache.set(cacheKey, result, cacheDuration)
            }

            return result
        } catch (error) {
            console.error("Web search error:", error)
            throw error
        }
    }
}

async function processSearchResult(
    result: z.infer<typeof searchResultSchema>,
    extractImages: boolean,
    navigationTimeout: number
): Promise<z.infer<typeof webPageDataSchema> | null> {
    let retryCount = 0
    let success = false

    while (!success && retryCount < MAX_RETRIES) {
        try {
            // Add delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
            
            const pageData = await processWebPage(result.link, extractImages, navigationTimeout)
            if (pageData) {
                return pageData
            }
            success = true
        } catch (error) {
            retryCount++
            console.error(`Error processing page ${result.link} (attempt ${retryCount}/${MAX_RETRIES}):`, error)
            
            if (retryCount < MAX_RETRIES) {
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY * Math.pow(2, retryCount)))
            }
        }
    }

    return null
}

async function processWebPage(url: string, extractImages: boolean, navigationTimeout: number): Promise<z.infer<typeof webPageDataSchema> | null> {
    const browser = await getPuppeteerBrowser()
    const page = await browser.newPage()
    const startTime = Date.now()
    const redirects: string[] = []

    try {
        // Set a reasonable timeout for page load
        await page.setDefaultNavigationTimeout(navigationTimeout)
        
        // Track redirects
        page.on('response', response => {
            if (response.status() === 301 || response.status() === 302) {
                redirects.push(response.url())
            }
        })

        // Enable request interception to block unnecessary resources
        await page.setRequestInterception(true)
        page.on('request', (request) => {
            const resourceType = request.resourceType()
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                request.abort()
            } else {
                request.continue()
            }
        })

        // Navigate to the page
        const response = await page.goto(url, { 
            waitUntil: "networkidle0",
            timeout: navigationTimeout
        })

        const statusCode = response?.status() || 0
        if (statusCode >= 400) {
            throw new Error(`HTTP ${statusCode}: Failed to load page`)
        }

        const content = await page.content()
        const $ = cheerio.load(content)

        // Extract and clean title
        const title = cleanText($("title").text().trim())

        // Extract and clean full text
        const fullText = cleanText($("body").text().trim())

        // Generate summary
        const summary = generateSummary(fullText)

        // Extract metadata
        const metadata = extractMetadata($)

        // Extract links
        const links = extractLinks($, url)

        // Extract images with rate limiting
        const images = []
        if (extractImages) {
            for (const img of $("img").toArray()) {
                const src = $(img).attr("src") || ""
                const alt = $(img).attr("alt") || ""
                
                if (src) {
                    try {
                        // Add delay between image processing
                        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
                        
                        // Convert image to base64 and get dimensions
                        const imageData = await page.evaluate(async (imgSrc) => {
                            const response = await fetch(imgSrc)
                            const blob = await response.blob()
                            const base64 = await new Promise((resolve) => {
                                const reader = new FileReader()
                                reader.onloadend = () => resolve(reader.result as string)
                                reader.readAsDataURL(blob)
                            })
                            
                            // Get image dimensions
                            const img = new Image()
                            img.src = imgSrc
                            await new Promise((resolve) => {
                                img.onload = resolve
                            })
                            
                            return {
                                base64,
                                width: img.width,
                                height: img.height
                            }
                        }, src)
                        
                        images.push({ 
                            src, 
                            alt, 
                            base64: imageData.base64,
                            dimensions: {
                                width: imageData.width,
                                height: imageData.height
                            }
                        })
                    } catch (error) {
                        console.error(`Error converting image to base64: ${src}`, error)
                    }
                }
            }
        }

        await browser.close()

        return {
            url: sanitizeUrl(url),
            title,
            fullText,
            summary,
            images,
            html: content,
            metadata,
            links,
            navigationStatus: {
                success: true,
                statusCode,
                loadTime: Date.now() - startTime,
                redirects
            }
        }
    } catch (error) {
        await browser.close()
        throw error
    }
}

function calculateRelevance(query: string, title: string, snippet: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/)
    let score = 0

    // Check title matches
    const titleLower = title.toLowerCase()
    queryTerms.forEach(term => {
        if (titleLower.includes(term)) {
            score += 0.5
        }
    })

    // Check snippet matches
    const snippetLower = snippet.toLowerCase()
    queryTerms.forEach(term => {
        if (snippetLower.includes(term)) {
            score += 0.3
        }
    })

    // Normalize score to 0-1 range
    return Math.min(score / queryTerms.length, 1)
}

function generateSummary(text: string, maxLength: number = 200): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || []
    let summary = ""
    
    for (const sentence of sentences) {
        if (summary.length + sentence.length > maxLength) {
            break
        }
        summary += sentence.trim() + " "
    }
    
    return summary.trim()
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string): { url: string; text: string; isInternal: boolean }[] {
    const links: { url: string; text: string; isInternal: boolean }[] = []
    const baseUrlObj = new URL(baseUrl)
    
    $("a").each((_, element) => {
        const href = $(element).attr("href") || ""
        const text = $(element).text().trim()
        
        if (href && text) {
            try {
                const url = new URL(href, baseUrl)
                links.push({
                    url: url.toString(),
                    text,
                    isInternal: url.hostname === baseUrlObj.hostname
                })
            } catch (error) {
                console.error(`Invalid URL: ${href}`)
            }
        }
    })
    
    return links
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size))
    }
    return chunks
}

export function getWebSearchDescription(args: ToolArgs): string {
    return `# Web Search
Search the web and extract structured data from search results and web pages.

## Parameters
- \`query\`: The search query to look up
- \`maxResults\`: Maximum number of search results to process (up to 10, default: 10)
- \`extractImages\`: Whether to extract and convert images to base64 (default: true)
- \`navigationTimeout\`: Timeout for each page navigation in milliseconds (default: 30000)
- \`parallelProcessing\`: Whether to process pages in parallel (default: true)
- \`cacheResults\`: Whether to cache search results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`minRelevance\`: Minimum relevance score for search results (0-1, default: 0.5)

## Returns
- \`searchResults\`: Array of search results with title, link, snippet, and relevance score
- \`webPagesData\`: Array of processed web pages with:
  - URL
  - Title
  - Full text content
  - Summary
  - Images (with base64 data and dimensions)
  - Full HTML structure
  - Metadata (description, keywords, author, dates, language, robots)
  - Links (internal and external)
  - Navigation status (success, error, status code, load time, redirects)
- \`totalResults\`: Total number of search results found
- \`processedResults\`: Number of results processed
- \`successfulNavigations\`: Number of successful page navigations
- \`query\`: Original search query
- \`timestamp\`: When the search was performed

## Features
- Handles up to 10 different URLs from search results
- Parallel processing of pages for faster results
- Relevance scoring for search results
- Content summarization
- Metadata extraction
- Link analysis (internal/external)
- Image dimension extraction
- Caching mechanism
- Retry mechanism with exponential backoff
- Rate limiting to avoid server overload
- Resource optimization (blocks unnecessary resources)
- URL sanitization and validation
- Content cleaning and formatting

## Example
\`\`\`typescript
const result = await webSearchTool.handler({
    query: "your search query",
    maxResults: 10,
    extractImages: true,
    navigationTimeout: 30000,
    parallelProcessing: true,
    cacheResults: true,
    cacheDuration: 3600,
    minRelevance: 0.5
})
\`\`\`
`
=======
/**
 * Web search tool description
 */
export function getWebSearchDescription(): string {
    return `## web_search

Search the web for real-time information and get structured content from web pages.

### Input:
\`\`\`json
{
    "query": "The search query to look up on the web",
    "maxResults": 5, // Optional, defaults to 5
    "useCache": true // Optional, defaults to true
}
\`\`\`

### Example:
\`\`\`json
{
    "query": "latest typescript features",
    "maxResults": 3
}
\`\`\`

### Results:
This tool returns structured data from web search results including:
- Title and URL of each result
- Clean extracted text content
- Links found on the page
- Images found on the page

You should use this tool when:
- You need current information that might not be in your training data
- You need to verify facts or get up-to-date documentation
- The user asks about recent events, technologies, or other time-sensitive information

The search uses Bing and returns the top results, visiting each page to extract useful content.`
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
} 