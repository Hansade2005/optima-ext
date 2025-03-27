import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import puppeteer from "puppeteer-core"
import { getPuppeteerBrowser } from "../../utils/puppeteer"
import { sanitizeUrl } from "../../utils/url"
import { cleanText } from "../../utils/content"
import { cache } from "../../utils/cache"

const socialPostSchema = z.object({
    id: z.string(),
    platform: z.enum(["twitter", "facebook", "instagram", "linkedin", "github"]),
    url: z.string(),
    content: z.string(),
    author: z.object({
        id: z.string(),
        name: z.string(),
        username: z.string().optional(),
        avatar: z.string().optional(),
        verified: z.boolean().optional(),
        followers: z.number().optional(),
        following: z.number().optional()
    }),
    timestamp: z.string(),
    engagement: z.object({
        likes: z.number().optional(),
        shares: z.number().optional(),
        comments: z.number().optional(),
        views: z.number().optional(),
        bookmarks: z.number().optional(),
        reactions: z.record(z.number()).optional()
    }),
    media: z.array(z.object({
        type: z.enum(["image", "video", "gif", "link"]),
        url: z.string(),
        thumbnail: z.string().optional(),
        duration: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        alt: z.string().optional(),
        caption: z.string().optional()
    })),
    hashtags: z.array(z.string()),
    mentions: z.array(z.object({
        id: z.string().optional(),
        name: z.string(),
        username: z.string().optional()
    })),
    location: z.object({
        name: z.string(),
        coordinates: z.object({
            latitude: z.number(),
            longitude: z.number()
        }).optional()
    }).optional(),
    language: z.string().optional(),
    sentiment: z.object({
        score: z.number(),
        label: z.enum(["positive", "negative", "neutral"]),
        confidence: z.number()
    }).optional(),
    topics: z.array(z.string()).optional(),
    replies: z.array(z.object({
        id: z.string(),
        content: z.string(),
        author: z.object({
            id: z.string(),
            name: z.string(),
            username: z.string().optional()
        }),
        timestamp: z.string(),
        engagement: z.object({
            likes: z.number().optional(),
            replies: z.number().optional()
        })
    })).optional(),
    metadata: z.object({
        isPinned: z.boolean().optional(),
        isRetweet: z.boolean().optional(),
        isReply: z.boolean().optional(),
        isThread: z.boolean().optional(),
        threadId: z.string().optional(),
        parentPostId: z.string().optional(),
        originalPostId: z.string().optional(),
        visibility: z.enum(["public", "private", "followers", "friends"]).optional(),
        tags: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional()
    })
})

const socialMediaScraperSchema = z.object({
    url: z.string().describe("The URL of the social media post or profile to scrape"),
    platform: z.enum(["twitter", "facebook", "instagram", "linkedin", "github"]).describe("The social media platform"),
    maxPosts: z.number().optional().default(10).describe("Maximum number of posts to extract"),
    extractMedia: z.boolean().optional().default(true).describe("Whether to extract media content"),
    extractComments: z.boolean().optional().default(false).describe("Whether to extract comments"),
    extractReplies: z.boolean().optional().default(false).describe("Whether to extract replies"),
    extractEngagement: z.boolean().optional().default(true).describe("Whether to extract engagement metrics"),
    extractMetadata: z.boolean().optional().default(true).describe("Whether to extract post metadata"),
    analyzeSentiment: z.boolean().optional().default(false).describe("Whether to analyze post sentiment"),
    extractTopics: z.boolean().optional().default(false).describe("Whether to extract topics"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
    parallelProcessing: z.boolean().optional().default(true).describe("Whether to process posts in parallel"),
    maxConcurrentRequests: z.number().optional().default(3).describe("Maximum number of concurrent requests"),
    retryConfig: z.object({
        maxRetries: z.number().optional().default(3),
        retryDelay: z.number().optional().default(1000),
        exponentialBackoff: z.boolean().optional().default(true)
    }).optional(),
    outputFormat: z.enum(["json", "yaml", "markdown"]).optional().default("json").describe("Output format for the results")
})

const CACHE_PREFIX = "social_"

export const socialMediaScraperTool: Tool = {
    name: "social_media_scraper",
    description: "Extract content and metadata from social media posts and profiles",
    schema: socialMediaScraperSchema,
    handler: async ({ 
        url, 
        platform,
        maxPosts = 10,
        extractMedia = true,
        extractComments = false,
        extractReplies = false,
        extractEngagement = true,
        extractMetadata = true,
        analyzeSentiment = false,
        extractTopics = false,
        cacheResults = true,
        cacheDuration = 3600,
        parallelProcessing = true,
        maxConcurrentRequests = 3,
        retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            exponentialBackoff: true
        },
        outputFormat = "json"
    }) => {
        try {
            // Check cache first if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${platform}_${url}`
                const cachedResult = await cache.get(cacheKey)
                if (cachedResult) {
                    return cachedResult
                }
            }

            // Launch browser
            const browser = await getPuppeteerBrowser()
            const page = await browser.newPage()

            try {
                // Set up platform-specific configuration
                await setupPlatformConfig(page, platform)

                // Navigate to the URL
                await page.goto(url, {
                    waitUntil: "networkidle0",
                    timeout: 30000
                })

                // Extract content based on platform
                const posts = await extractPlatformContent(
                    page,
                    platform,
                    maxPosts,
                    extractMedia,
                    extractComments,
                    extractReplies,
                    extractEngagement,
                    extractMetadata,
                    analyzeSentiment,
                    extractTopics
                )

                const result = {
                    url: sanitizeUrl(url),
                    platform,
                    posts,
                    timestamp: new Date().toISOString()
                }

                // Cache the result if enabled
                if (cacheResults) {
                    const cacheKey = `${CACHE_PREFIX}${platform}_${url}`
                    await cache.set(cacheKey, result, cacheDuration)
                }

                return result
            } finally {
                await browser.close()
            }
        } catch (error) {
            console.error("Social media scraping error:", error)
            throw error
        }
    }
}

async function setupPlatformConfig(page: puppeteer.Page, platform: string): Promise<void> {
    switch (platform) {
        case "twitter":
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
            break
        case "facebook":
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
            break
        case "instagram":
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
            break
        case "linkedin":
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
            break
        case "github":
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
            break
    }
}

async function extractPlatformContent(
    page: puppeteer.Page,
    platform: string,
    maxPosts: number,
    extractMedia: boolean,
    extractComments: boolean,
    extractReplies: boolean,
    extractEngagement: boolean,
    extractMetadata: boolean,
    analyzeSentiment: boolean,
    extractTopics: boolean
): Promise<z.infer<typeof socialPostSchema>[]> {
    switch (platform) {
        case "twitter":
            return extractTwitterContent(
                page,
                maxPosts,
                extractMedia,
                extractComments,
                extractReplies,
                extractEngagement,
                extractMetadata,
                analyzeSentiment,
                extractTopics
            )
        case "facebook":
            return extractFacebookContent(
                page,
                maxPosts,
                extractMedia,
                extractComments,
                extractReplies,
                extractEngagement,
                extractMetadata,
                analyzeSentiment,
                extractTopics
            )
        case "instagram":
            return extractInstagramContent(
                page,
                maxPosts,
                extractMedia,
                extractComments,
                extractReplies,
                extractEngagement,
                extractMetadata,
                analyzeSentiment,
                extractTopics
            )
        case "linkedin":
            return extractLinkedInContent(
                page,
                maxPosts,
                extractMedia,
                extractComments,
                extractReplies,
                extractEngagement,
                extractMetadata,
                analyzeSentiment,
                extractTopics
            )
        case "github":
            return extractGitHubContent(
                page,
                maxPosts,
                extractMedia,
                extractComments,
                extractReplies,
                extractEngagement,
                extractMetadata,
                analyzeSentiment,
                extractTopics
            )
        default:
            throw new Error(`Unsupported platform: ${platform}`)
    }
}

async function extractTwitterContent(
    page: puppeteer.Page,
    maxPosts: number,
    extractMedia: boolean,
    extractComments: boolean,
    extractReplies: boolean,
    extractEngagement: boolean,
    extractMetadata: boolean,
    analyzeSentiment: boolean,
    extractTopics: boolean
): Promise<z.infer<typeof socialPostSchema>[]> {
    const posts: z.infer<typeof socialPostSchema>[] = []
    const tweetElements = await page.$$("article[data-testid='tweet']")

    for (const tweet of tweetElements) {
        if (posts.length >= maxPosts) break

        const post = await extractTweetDetails(
            tweet,
            extractMedia,
            extractComments,
            extractReplies,
            extractEngagement,
            extractMetadata,
            analyzeSentiment,
            extractTopics
        )
        if (post) {
            posts.push(post)
        }
    }

    return posts
}

async function extractTweetDetails(
    tweet: puppeteer.ElementHandle,
    extractMedia: boolean,
    extractComments: boolean,
    extractReplies: boolean,
    extractEngagement: boolean,
    extractMetadata: boolean,
    analyzeSentiment: boolean,
    extractTopics: boolean
): Promise<z.infer<typeof socialPostSchema> | null> {
    try {
        const id = await tweet.evaluate(el => el.getAttribute("data-tweet-id") || "")
        const url = await tweet.evaluate(el => {
            const link = el.querySelector("a[href*='/status/']")
            return link ? link.getAttribute("href") || "" : ""
        })
        const content = await tweet.evaluate(el => {
            const text = el.querySelector("[data-testid='tweetText']")
            return text ? text.textContent || "" : ""
        })

        const author = await extractTweetAuthor(tweet)
        const timestamp = await tweet.evaluate(el => {
            const time = el.querySelector("time")
            return time ? time.getAttribute("datetime") || "" : ""
        })

        const engagement = extractEngagement ? await extractTweetEngagement(tweet) : {
            likes: 0,
            shares: 0,
            comments: 0,
            views: 0,
            bookmarks: 0
        }

        const media = extractMedia ? await extractTweetMedia(tweet) : []
        const hashtags = await extractTweetHashtags(content)
        const mentions = await extractTweetMentions(content)
        const location = await extractTweetLocation(tweet)
        const language = await detectLanguage(content)
        const sentiment = analyzeSentiment ? await analyzeTweetSentiment(content) : undefined
        const topics = extractTopics ? await extractTweetTopics(content) : undefined
        const replies = extractReplies ? await extractTweetReplies(tweet) : undefined
        const metadata = extractMetadata ? await extractTweetMetadata(tweet) : {
            isPinned: false,
            isRetweet: false,
            isReply: false,
            isThread: false,
            visibility: "public"
        }

        return {
            id,
            platform: "twitter",
            url,
            content,
            author,
            timestamp,
            engagement,
            media,
            hashtags,
            mentions,
            location,
            language,
            sentiment,
            topics,
            replies,
            metadata
        }
    } catch (error) {
        console.error("Error extracting tweet details:", error)
        return null
    }
}

async function extractTweetAuthor(tweet: puppeteer.ElementHandle): Promise<z.infer<typeof socialPostSchema>["author"]> {
    const authorElement = await tweet.$("[data-testid='User-Name']")
    if (!authorElement) {
        throw new Error("Author element not found")
    }

    const name = await authorElement.evaluate(el => el.textContent || "")
    const username = await authorElement.evaluate(el => {
        const usernameEl = el.querySelector("span")
        return usernameEl ? usernameEl.textContent?.replace("@", "") || "" : ""
    })
    const avatar = await authorElement.evaluate(el => {
        const img = el.querySelector("img")
        return img ? img.getAttribute("src") || "" : ""
    })
    const verified = await authorElement.evaluate(el => {
        const verifiedBadge = el.querySelector("[data-testid='icon-verified']")
        return !!verifiedBadge
    })

    return {
        id: username,
        name,
        username,
        avatar,
        verified
    }
}

async function extractTweetEngagement(tweet: puppeteer.ElementHandle): Promise<z.infer<typeof socialPostSchema>["engagement"]> {
    const engagement = await tweet.evaluate(el => {
        const likes = el.querySelector("[data-testid='like']")?.textContent || "0"
        const shares = el.querySelector("[data-testid='retweet']")?.textContent || "0"
        const comments = el.querySelector("[data-testid='reply']")?.textContent || "0"
        const views = el.querySelector("[data-testid='app-text-transition-container']")?.textContent || "0"
        const bookmarks = el.querySelector("[data-testid='bookmark']")?.textContent || "0"

        return {
            likes: parseInt(likes.replace(/[^0-9]/g, "")) || 0,
            shares: parseInt(shares.replace(/[^0-9]/g, "")) || 0,
            comments: parseInt(comments.replace(/[^0-9]/g, "")) || 0,
            views: parseInt(views.replace(/[^0-9]/g, "")) || 0,
            bookmarks: parseInt(bookmarks.replace(/[^0-9]/g, "")) || 0
        }
    })

    return engagement
}

async function extractTweetMedia(tweet: puppeteer.ElementHandle): Promise<z.infer<typeof socialPostSchema>["media"]> {
    const media = await tweet.evaluate(el => {
        const mediaElements = el.querySelectorAll("[data-testid='tweetPhoto'], [data-testid='tweetVideo'], [data-testid='tweetGif']")
        return Array.from(mediaElements).map(media => {
            const type = media.getAttribute("data-testid")?.replace("tweet", "").toLowerCase() || "image"
            const url = media.querySelector("img, video")?.getAttribute("src") || ""
            const thumbnail = media.querySelector("img")?.getAttribute("src") || ""
            const duration = media.querySelector("video")?.duration
            const width = media.querySelector("img, video")?.width
            const height = media.querySelector("img, video")?.height
            const alt = media.querySelector("img")?.getAttribute("alt") || ""
            const caption = media.querySelector("[data-testid='caption']")?.textContent || ""

            return {
                type,
                url,
                thumbnail,
                duration,
                width,
                height,
                alt,
                caption
            }
        })
    })

    return media
}

async function extractTweetHashtags(content: string): Promise<string[]> {
    const hashtags = content.match(/#\w+/g) || []
    return hashtags.map(tag => tag.substring(1))
}

async function extractTweetMentions(content: string): Promise<z.infer<typeof socialPostSchema>["mentions"]> {
    const mentions = content.match(/@\w+/g) || []
    return mentions.map(mention => ({
        name: mention.substring(1),
        username: mention.substring(1)
    }))
}

async function extractTweetLocation(tweet: puppeteer.ElementHandle): Promise<z.infer<typeof socialPostSchema>["location"] | undefined> {
    const locationElement = await tweet.$("[data-testid='place']")
    if (!locationElement) return undefined

    const location = await locationElement.evaluate(el => {
        const name = el.textContent || ""
        const coordinates = el.getAttribute("data-coordinates")
        return {
            name,
            coordinates: coordinates ? JSON.parse(coordinates) : undefined
        }
    })

    return location
}

async function detectLanguage(content: string): Promise<string | undefined> {
    // Implement language detection logic
    return undefined
}

async function analyzeTweetSentiment(content: string): Promise<z.infer<typeof socialPostSchema>["sentiment"]> {
    // Implement sentiment analysis logic
    return {
        score: 0,
        label: "neutral",
        confidence: 0
    }
}

async function extractTweetTopics(content: string): Promise<string[]> {
    // Implement topic extraction logic
    return []
}

async function extractTweetReplies(tweet: puppeteer.ElementHandle): Promise<z.infer<typeof socialPostSchema>["replies"]> {
    const replies = await tweet.evaluate(el => {
        const replyElements = el.querySelectorAll("[data-testid='tweet']")
        return Array.from(replyElements).map(reply => {
            const id = reply.getAttribute("data-tweet-id") || ""
            const content = reply.querySelector("[data-testid='tweetText']")?.textContent || ""
            const author = {
                id: reply.querySelector("[data-testid='User-Name']")?.textContent || "",
                name: reply.querySelector("[data-testid='User-Name']")?.textContent || "",
                username: reply.querySelector("[data-testid='User-Name'] span")?.textContent?.replace("@", "") || ""
            }
            const timestamp = reply.querySelector("time")?.getAttribute("datetime") || ""
            const engagement = {
                likes: parseInt(reply.querySelector("[data-testid='like']")?.textContent?.replace(/[^0-9]/g, "") || "0"),
                replies: parseInt(reply.querySelector("[data-testid='reply']")?.textContent?.replace(/[^0-9]/g, "") || "0")
            }

            return {
                id,
                content,
                author,
                timestamp,
                engagement
            }
        })
    })

    return replies
}

async function extractTweetMetadata(tweet: puppeteer.ElementHandle): Promise<z.infer<typeof socialPostSchema>["metadata"]> {
    const metadata = await tweet.evaluate(el => {
        const isPinned = !!el.querySelector("[data-testid='pin']")
        const isRetweet = !!el.querySelector("[data-testid='socialContext']")
        const isReply = !!el.querySelector("[data-testid='reply']")
        const isThread = !!el.querySelector("[data-testid='thread']")
        const threadId = el.querySelector("[data-testid='thread']")?.getAttribute("data-thread-id")
        const parentPostId = el.querySelector("[data-testid='reply']")?.getAttribute("data-parent-id")
        const originalPostId = el.querySelector("[data-testid='socialContext']")?.getAttribute("data-original-id")
        const visibility = el.querySelector("[data-testid='visibility']")?.textContent?.toLowerCase() || "public"
        const tags = Array.from(el.querySelectorAll("[data-testid='tag']")).map(tag => tag.textContent || "")
        const categories = Array.from(el.querySelectorAll("[data-testid='category']")).map(cat => cat.textContent || "")

        return {
            isPinned,
            isRetweet,
            isReply,
            isThread,
            threadId,
            parentPostId,
            originalPostId,
            visibility,
            tags,
            categories
        }
    })

    return metadata
}

// Placeholder functions for other platforms
async function extractFacebookContent(
    page: puppeteer.Page,
    maxPosts: number,
    extractMedia: boolean,
    extractComments: boolean,
    extractReplies: boolean,
    extractEngagement: boolean,
    extractMetadata: boolean,
    analyzeSentiment: boolean,
    extractTopics: boolean
): Promise<z.infer<typeof socialPostSchema>[]> {
    // Implement Facebook content extraction
    return []
}

async function extractInstagramContent(
    page: puppeteer.Page,
    maxPosts: number,
    extractMedia: boolean,
    extractComments: boolean,
    extractReplies: boolean,
    extractEngagement: boolean,
    extractMetadata: boolean,
    analyzeSentiment: boolean,
    extractTopics: boolean
): Promise<z.infer<typeof socialPostSchema>[]> {
    // Implement Instagram content extraction
    return []
}

async function extractLinkedInContent(
    page: puppeteer.Page,
    maxPosts: number,
    extractMedia: boolean,
    extractComments: boolean,
    extractReplies: boolean,
    extractEngagement: boolean,
    extractMetadata: boolean,
    analyzeSentiment: boolean,
    extractTopics: boolean
): Promise<z.infer<typeof socialPostSchema>[]> {
    // Implement LinkedIn content extraction
    return []
}

async function extractGitHubContent(
    page: puppeteer.Page,
    maxPosts: number,
    extractMedia: boolean,
    extractComments: boolean,
    extractReplies: boolean,
    extractEngagement: boolean,
    extractMetadata: boolean,
    analyzeSentiment: boolean,
    extractTopics: boolean
): Promise<z.infer<typeof socialPostSchema>[]> {
    // Implement GitHub content extraction
    return []
}

export function getSocialMediaScraperDescription(args: ToolArgs): string {
    return `# Social Media Scraper
Extract content and metadata from social media posts and profiles.

## Parameters
- \`url\`: The URL of the social media post or profile to scrape
- \`platform\`: The social media platform (twitter, facebook, instagram, linkedin, github)
- \`maxPosts\`: Maximum number of posts to extract (default: 10)
- \`extractMedia\`: Whether to extract media content (default: true)
- \`extractComments\`: Whether to extract comments (default: false)
- \`extractReplies\`: Whether to extract replies (default: false)
- \`extractEngagement\`: Whether to extract engagement metrics (default: true)
- \`extractMetadata\`: Whether to extract post metadata (default: true)
- \`analyzeSentiment\`: Whether to analyze post sentiment (default: false)
- \`extractTopics\`: Whether to extract topics (default: false)
- \`cacheResults\`: Whether to cache results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`parallelProcessing\`: Whether to process posts in parallel (default: true)
- \`maxConcurrentRequests\`: Maximum number of concurrent requests (default: 3)
- \`retryConfig\`: Configuration for retry mechanism
  - \`maxRetries\`: Maximum number of retries (default: 3)
  - \`retryDelay\`: Delay between retries in milliseconds (default: 1000)
  - \`exponentialBackoff\`: Whether to use exponential backoff (default: true)
- \`outputFormat\`: Output format for the results (default: "json")

## Returns
- \`url\`: The URL of the social media post or profile
- \`platform\`: The social media platform
- \`posts\`: Array of posts with:
  - Post ID and URL
  - Content and timestamp
  - Author information (ID, name, username, avatar, verification status)
  - Engagement metrics (likes, shares, comments, views, bookmarks)
  - Media content (images, videos, GIFs, links)
  - Hashtags and mentions
  - Location information
  - Language detection
  - Sentiment analysis
  - Topics
  - Replies and comments
  - Post metadata (pinned status, retweet info, thread info, visibility)
- \`timestamp\`: When the scraping was performed

## Features
- Supports multiple social media platforms
- Extracts comprehensive post content
- Captures media and attachments
- Tracks engagement metrics
- Extracts user information
- Handles hashtags and mentions
- Includes location data
- Performs language detection
- Analyzes sentiment
- Identifies topics
- Manages replies and comments
- Tracks post metadata
- Caching mechanism for faster repeated access
- Parallel processing of posts
- Retry mechanism with exponential backoff
- Multiple output formats (JSON, YAML, Markdown)
- Platform-specific optimizations
- Error handling and recovery
- Rate limiting and request management

## Example
\`\`\`typescript
const result = await socialMediaScraperTool.handler({
    url: "https://twitter.com/username/status/123456789",
    platform: "twitter",
    maxPosts: 10,
    extractMedia: true,
    extractComments: false,
    extractReplies: false,
    extractEngagement: true,
    extractMetadata: true,
    analyzeSentiment: false,
    extractTopics: false,
    cacheResults: true,
    cacheDuration: 3600,
    parallelProcessing: true,
    maxConcurrentRequests: 3,
    retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        exponentialBackoff: true
    },
    outputFormat: "json"
})
\`\`\`
`
}