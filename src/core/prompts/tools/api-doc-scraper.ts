import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import puppeteer from "puppeteer-core"
import cheerio from "cheerio"
import { getPuppeteerBrowser } from "../../utils/puppeteer"
import { sanitizeUrl } from "../../utils/url"
import { cleanText, extractMetadata } from "../../utils/content"
import { cache } from "../../utils/cache"

const apiEndpointSchema = z.object({
    name: z.string(),
    path: z.string(),
    method: z.string(),
    description: z.string(),
    parameters: z.array(z.object({
        name: z.string(),
        type: z.string(),
        required: z.boolean(),
        description: z.string(),
        defaultValue: z.string().optional(),
        enum: z.array(z.string()).optional(),
        format: z.string().optional(),
        minimum: z.number().optional(),
        maximum: z.number().optional(),
        pattern: z.string().optional(),
        items: z.object({
            type: z.string(),
            format: z.string().optional()
        }).optional()
    })),
    responses: z.array(z.object({
        status: z.string(),
        description: z.string(),
        schema: z.string().optional(),
        examples: z.array(z.object({
            description: z.string(),
            value: z.any()
        })).optional(),
        headers: z.array(z.object({
            name: z.string(),
            type: z.string(),
            description: z.string()
        })).optional()
    })),
    examples: z.array(z.object({
        language: z.string(),
        code: z.string(),
        description: z.string().optional(),
        curl: z.string().optional(),
        response: z.string().optional()
    })),
    rateLimit: z.object({
        requests: z.number(),
        period: z.string()
    }).optional(),
    deprecated: z.boolean().optional(),
    security: z.array(z.object({
        type: z.string(),
        scopes: z.array(z.string()).optional()
    })).optional(),
    tags: z.array(z.string()).optional(),
    operationId: z.string().optional(),
    summary: z.string().optional(),
    externalDocs: z.object({
        description: z.string(),
        url: z.string()
    }).optional()
})

const apiDocSchema = z.object({
    url: z.string(),
    title: z.string(),
    description: z.string(),
    version: z.string().optional(),
    baseUrl: z.string().optional(),
    endpoints: z.array(apiEndpointSchema),
    authentication: z.object({
        type: z.string().optional(),
        description: z.string().optional(),
        examples: z.array(z.object({
            language: z.string(),
            code: z.string(),
            description: z.string().optional()
        })).optional(),
        securitySchemes: z.array(z.object({
            type: z.string(),
            name: z.string(),
            in: z.string(),
            description: z.string().optional()
        })).optional()
    }).optional(),
    metadata: z.object({
        description: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        author: z.string().optional(),
        publishedDate: z.string().optional(),
        modifiedDate: z.string().optional(),
        language: z.string().optional(),
        robots: z.string().optional(),
        license: z.string().optional(),
        termsOfService: z.string().optional(),
        contact: z.object({
            name: z.string().optional(),
            email: z.string().optional(),
            url: z.string().optional()
        }).optional()
    }),
    navigationStatus: z.object({
        success: z.boolean(),
        error: z.string().optional(),
        statusCode: z.number().optional(),
        loadTime: z.number(),
        redirects: z.array(z.string()).optional(),
        cacheStatus: z.string().optional(),
        lastCached: z.string().optional()
    }),
    rateLimits: z.object({
        global: z.object({
            requests: z.number(),
            period: z.string()
        }).optional(),
        endpoints: z.record(z.object({
            requests: z.number(),
            period: z.string()
        })).optional()
    }).optional(),
    serverInfo: z.object({
        environments: z.array(z.object({
            name: z.string(),
            url: z.string(),
            description: z.string().optional()
        })).optional(),
        regions: z.array(z.string()).optional(),
        status: z.string().optional(),
        uptime: z.number().optional()
    }).optional(),
    sdkInfo: z.object({
        available: z.array(z.object({
            language: z.string(),
            url: z.string(),
            version: z.string().optional()
        })).optional(),
        examples: z.array(z.object({
            language: z.string(),
            code: z.string(),
            description: z.string().optional()
        })).optional()
    }).optional()
})

const apiDocScraperSchema = z.object({
    url: z.string().describe("The URL of the API documentation to scrape"),
    extractExamples: z.boolean().optional().default(true).describe("Whether to extract code examples"),
    extractSchemas: z.boolean().optional().default(true).describe("Whether to extract API schemas"),
    maxEndpoints: z.number().optional().default(50).describe("Maximum number of endpoints to extract"),
    navigationTimeout: z.number().optional().default(30000).describe("Timeout for navigation in milliseconds"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
    extractRateLimits: z.boolean().optional().default(true).describe("Whether to extract rate limit information"),
    extractServerInfo: z.boolean().optional().default(true).describe("Whether to extract server information"),
    extractSDKInfo: z.boolean().optional().default(true).describe("Whether to extract SDK information"),
    validateEndpoints: z.boolean().optional().default(false).describe("Whether to validate endpoints with test requests"),
    parallelProcessing: z.boolean().optional().default(true).describe("Whether to process endpoints in parallel"),
    maxConcurrentRequests: z.number().optional().default(3).describe("Maximum number of concurrent requests"),
    retryConfig: z.object({
        maxRetries: z.number().optional().default(3),
        retryDelay: z.number().optional().default(1000),
        exponentialBackoff: z.boolean().optional().default(true)
    }).optional(),
    outputFormat: z.enum(["json", "yaml", "markdown"]).optional().default("json").describe("Output format for the results")
})

// Rate limiting delay between requests (in milliseconds)
const RATE_LIMIT_DELAY = 2000
const MAX_RETRIES = 3
const CACHE_PREFIX = "api_doc_"

export const apiDocScraperTool: Tool = {
    name: "api_doc_scraper",
    description: "Scrape API documentation and extract endpoints, parameters, responses, and code examples",
    schema: apiDocScraperSchema,
    handler: async ({ 
        url, 
        extractExamples = true, 
        extractSchemas = true,
        maxEndpoints = 50,
        navigationTimeout = 30000,
        cacheResults = true,
        cacheDuration = 3600,
        extractRateLimits = true,
        extractServerInfo = true,
        extractSDKInfo = true,
        validateEndpoints = false,
        parallelProcessing = true,
        maxConcurrentRequests = 3,
        retryConfig,
        outputFormat = "json"
    }) => {
        try {
            // Check cache first if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${url}`
                const cachedResult = await cache.get(cacheKey)
                if (cachedResult) {
                    return cachedResult
                }
            }

            // Launch browser
            const browser = await getPuppeteerBrowser()
            const page = await browser.newPage()
            const startTime = Date.now()
            const redirects: string[] = []

            try {
                // Set timeout and track redirects
                await page.setDefaultNavigationTimeout(navigationTimeout)
                page.on('response', response => {
                    if (response.status() === 301 || response.status() === 302) {
                        redirects.push(response.url())
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

                // Extract basic information
                const title = cleanText($("title").text().trim())
                const description = cleanText($("meta[name='description']").attr("content") || "")
                const version = extractVersion($)
                const baseUrl = extractBaseUrl($)

                // Extract endpoints
                const endpoints = await extractEndpoints($, page, extractExamples, extractSchemas, maxEndpoints)

                // Extract authentication information
                const authentication = extractAuthentication($)

                // Extract metadata
                const metadata = extractMetadata($)

                const result = {
                    url: sanitizeUrl(url),
                    title,
                    description,
                    version,
                    baseUrl,
                    endpoints,
                    authentication,
                    metadata,
                    navigationStatus: {
                        success: true,
                        statusCode,
                        loadTime: Date.now() - startTime,
                        redirects
                    }
                }

                // Cache the result if enabled
                if (cacheResults) {
                    const cacheKey = `${CACHE_PREFIX}${url}`
                    await cache.set(cacheKey, result, cacheDuration)
                }

                return result
            } finally {
                await browser.close()
            }
        } catch (error) {
            console.error("API documentation scraping error:", error)
            throw error
        }
    }
}

function extractVersion($: cheerio.CheerioAPI): string | undefined {
    // Try to find version in common locations
    const versionSelectors = [
        "meta[name='version']",
        "meta[name='api-version']",
        ".version",
        "#version",
        "h1:contains('Version')",
        "h2:contains('Version')"
    ]

    for (const selector of versionSelectors) {
        const version = $(selector).text().trim()
        if (version) {
            return version
        }
    }

    return undefined
}

function extractBaseUrl($: cheerio.CheerioAPI): string | undefined {
    // Try to find base URL in common locations
    const baseUrlSelectors = [
        "meta[name='base-url']",
        "meta[name='api-base-url']",
        ".base-url",
        "#base-url",
        "code:contains('baseUrl')",
        "pre:contains('baseUrl')"
    ]

    for (const selector of baseUrlSelectors) {
        const baseUrl = $(selector).text().trim()
        if (baseUrl) {
            return baseUrl
        }
    }

    return undefined
}

async function extractEndpoints(
    $: cheerio.CheerioAPI,
    page: puppeteer.Page,
    extractExamples: boolean,
    extractSchemas: boolean,
    maxEndpoints: number
): Promise<z.infer<typeof apiEndpointSchema>[]> {
    const endpoints: z.infer<typeof apiEndpointSchema>[] = []
    const endpointSelectors = [
        ".endpoint",
        ".api-endpoint",
        ".method",
        ".route",
        "h2:contains('API')",
        "h3:contains('API')"
    ]

    for (const selector of endpointSelectors) {
        $(selector).each((_, element) => {
            if (endpoints.length >= maxEndpoints) return false

            const endpoint = extractEndpointDetails($, element, extractExamples, extractSchemas)
            if (endpoint) {
                endpoints.push(endpoint)
            }
        })
    }

    return endpoints
}

async function extractEndpointDetails(
    $: cheerio.CheerioAPI,
    element: cheerio.Element,
    extractExamples: boolean,
    extractSchemas: boolean
): Promise<z.infer<typeof apiEndpointSchema> | null> {
    const $element = $(element)
    const name = $element.find(".name, .endpoint-name").text().trim()
    const path = $element.find(".path, .endpoint-path").text().trim()
    const method = $element.find(".method, .http-method").text().trim()
    const description = $element.find(".description, .endpoint-description").text().trim()
    const operationId = $element.find(".operation-id").text().trim()
    const summary = $element.find(".summary").text().trim()
    const deprecated = $element.find(".deprecated").length > 0
    const tags = $element.find(".tags .tag").map((_, el) => $(el).text().trim()).get()

    if (!name || !path || !method) {
        return null
    }

    const parameters = extractParameters($element)
    const responses = extractResponses($element, extractSchemas)
    const examples = extractExamples ? extractCodeExamples($element) : []
    const rateLimit = extractRateLimit($element)
    const security = extractSecurity($element)
    const externalDocs = extractExternalDocs($element)

    return {
        name,
        path,
        method,
        description,
        parameters,
        responses,
        examples,
        rateLimit,
        security,
        tags,
        operationId,
        summary,
        deprecated,
        externalDocs
    }
}

function extractParameters($element: cheerio.Cheerio): z.infer<typeof apiEndpointSchema>["parameters"] {
    const parameters: z.infer<typeof apiEndpointSchema>["parameters"] = []
    
    $element.find(".parameter, .param").each((_, param) => {
        const $param = $(param)
        const name = $param.find(".name, .param-name").text().trim()
        const type = $param.find(".type, .param-type").text().trim()
        const required = $param.find(".required").text().trim().toLowerCase() === "true"
        const description = $param.find(".description, .param-description").text().trim()
        const defaultValue = $param.find(".default-value").text().trim()
        const enumValues = $param.find(".enum").text().trim().split(",").map(v => v.trim())
        const format = $param.find(".format").text().trim()
        const minimum = $param.find(".minimum").text().trim() ? parseFloat($param.find(".minimum").text().trim()) : undefined
        const maximum = $param.find(".maximum").text().trim() ? parseFloat($param.find(".maximum").text().trim()) : undefined
        const pattern = $param.find(".pattern").text().trim()
        const items = $param.find(".items").text().trim() ? {
            type: $param.find(".items").text().trim(),
            format: $param.find(".items").attr("format")
        } : undefined

        if (name && type) {
            parameters.push({
                name,
                type,
                required,
                description,
                defaultValue,
                enum: enumValues,
                format,
                minimum,
                maximum,
                pattern,
                items
            })
        }
    })

    return parameters
}

function extractResponses(
    $element: cheerio.Cheerio,
    extractSchemas: boolean
): z.infer<typeof apiEndpointSchema>["responses"] {
    const responses: z.infer<typeof apiEndpointSchema>["responses"] = []
    
    $element.find(".response, .result").each((_, response) => {
        const $response = $(response)
        const status = $response.find(".status, .code").text().trim()
        const description = $response.find(".description, .response-description").text().trim()
        const schema = extractSchemas ? $response.find(".schema, .response-schema").text().trim() : undefined
        const examples = $response.find(".examples").map((_, el) => {
            const $el = $(el)
            return {
                description: $el.find(".description").text().trim(),
                value: $el.find(".value").text().trim()
            }
        }).get()
        const headers = $response.find(".headers").map((_, el) => {
            const $el = $(el)
            return {
                name: $el.find(".name").text().trim(),
                type: $el.find(".type").text().trim(),
                description: $el.find(".description").text().trim()
            }
        }).get()

        if (status && description) {
            responses.push({
                status,
                description,
                schema,
                examples,
                headers
            })
        }
    })

    return responses
}

function extractCodeExamples($element: cheerio.Cheerio): z.infer<typeof apiEndpointSchema>["examples"] {
    const examples: z.infer<typeof apiEndpointSchema>["examples"] = []
    
    $element.find("pre code, .example, .code-example").each((_, example) => {
        const $example = $(example)
        const language = $example.attr("class")?.match(/language-(\w+)/)?.[1] || "text"
        const code = $example.text().trim()
        const description = $example.prev(".description, .example-description").text().trim()
        const curl = $example.find(".curl").text().trim()
        const response = $example.find(".response").text().trim()

        if (code) {
            examples.push({
                language,
                code,
                description: description || undefined,
                curl,
                response: response || undefined
            })
        }
    })

    return examples
}

function extractAuthentication($: cheerio.CheerioAPI): z.infer<typeof apiDocSchema>["authentication"] {
    const authSection = $("h1:contains('Authentication'), h2:contains('Authentication'), h3:contains('Authentication')")
    if (!authSection.length) {
        return undefined
    }

    const type = authSection.next().find(".type, .auth-type").text().trim()
    const description = authSection.next().find(".description, .auth-description").text().trim()
    const examples = extractCodeExamples(authSection.next())

    return {
        type: type || undefined,
        description: description || undefined,
        examples: examples.length > 0 ? examples : undefined
    }
}

function extractRateLimit($element: cheerio.Cheerio): z.infer<typeof apiEndpointSchema>["rateLimit"] | undefined {
    const rateLimitText = $element.find(".rate-limit").text().trim()
    if (!rateLimitText) return undefined

    const match = rateLimitText.match(/(\d+)\s+requests\s+per\s+(\w+)/i)
    if (!match) return undefined

    return {
        requests: parseInt(match[1]),
        period: match[2]
    }
}

function extractSecurity($element: cheerio.Cheerio): z.infer<typeof apiEndpointSchema>["security"] | undefined {
    const securityElements = $element.find(".security")
    if (!securityElements.length) return undefined

    return securityElements.map((_, el) => {
        const $el = $(el)
        return {
            type: $el.find(".type").text().trim(),
            scopes: $el.find(".scope").map((_, scope) => $(scope).text().trim()).get()
        }
    }).get()
}

function extractExternalDocs($element: cheerio.Cheerio): z.infer<typeof apiEndpointSchema>["externalDocs"] | undefined {
    const docsElement = $element.find(".external-docs")
    if (!docsElement.length) return undefined

    return {
        description: docsElement.find(".description").text().trim(),
        url: docsElement.find(".url").text().trim()
    }
}

async function extractServerInfo($: cheerio.CheerioAPI): Promise<z.infer<typeof apiDocSchema>["serverInfo"] | undefined> {
    const serverSection = $("h1:contains('Server'), h2:contains('Server'), h3:contains('Server')")
    if (!serverSection.length) return undefined

    const environments = serverSection.next().find(".environment").map((_, el) => {
        const $el = $(el)
        return {
            name: $el.find(".name").text().trim(),
            url: $el.find(".url").text().trim(),
            description: $el.find(".description").text().trim()
        }
    }).get()

    const regions = serverSection.next().find(".region").map((_, el) => $(el).text().trim()).get()
    const status = serverSection.next().find(".status").text().trim()
    const uptime = parseFloat(serverSection.next().find(".uptime").text().trim())

    return {
        environments: environments.length > 0 ? environments : undefined,
        regions: regions.length > 0 ? regions : undefined,
        status: status || undefined,
        uptime: isNaN(uptime) ? undefined : uptime
    }
}

async function extractSDKInfo($: cheerio.CheerioAPI): Promise<z.infer<typeof apiDocSchema>["sdkInfo"] | undefined> {
    const sdkSection = $("h1:contains('SDK'), h2:contains('SDK'), h3:contains('SDK')")
    if (!sdkSection.length) return undefined

    const available = sdkSection.next().find(".sdk").map((_, el) => {
        const $el = $(el)
        return {
            language: $el.find(".language").text().trim(),
            url: $el.find(".url").text().trim(),
            version: $el.find(".version").text().trim()
        }
    }).get()

    const examples = sdkSection.next().find(".example").map((_, el) => {
        const $el = $(el)
        return {
            language: $el.find(".language").text().trim(),
            code: $el.find(".code").text().trim(),
            description: $el.find(".description").text().trim()
        }
    }).get()

    return {
        available: available.length > 0 ? available : undefined,
        examples: examples.length > 0 ? examples : undefined
    }
}

async function validateEndpoint(
    endpoint: z.infer<typeof apiEndpointSchema>,
    baseUrl: string
): Promise<boolean> {
    try {
        const url = `${baseUrl}${endpoint.path}`
        const response = await fetch(url, {
            method: endpoint.method,
            headers: {
                "Accept": "application/json"
            }
        })
        return response.status < 400
    } catch (error) {
        console.error(`Error validating endpoint ${endpoint.path}:`, error)
        return false
    }
}

export function getApiDocScraperDescription(args: ToolArgs): string {
    return `# API Documentation Scraper
Scrape API documentation and extract endpoints, parameters, responses, and code examples.

## Parameters
- \`url\`: The URL of the API documentation to scrape
- \`extractExamples\`: Whether to extract code examples (default: true)
- \`extractSchemas\`: Whether to extract API schemas (default: true)
- \`maxEndpoints\`: Maximum number of endpoints to extract (default: 50)
- \`navigationTimeout\`: Timeout for navigation in milliseconds (default: 30000)
- \`cacheResults\`: Whether to cache results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`extractRateLimits\`: Whether to extract rate limit information (default: true)
- \`extractServerInfo\`: Whether to extract server information (default: true)
- \`extractSDKInfo\`: Whether to extract SDK information (default: true)
- \`validateEndpoints\`: Whether to validate endpoints with test requests (default: false)
- \`parallelProcessing\`: Whether to process endpoints in parallel (default: true)
- \`maxConcurrentRequests\`: Maximum number of concurrent requests (default: 3)
- \`retryConfig\`: Configuration for retry mechanism
  - \`maxRetries\`: Maximum number of retries (default: 3)
  - \`retryDelay\`: Delay between retries in milliseconds (default: 1000)
  - \`exponentialBackoff\`: Whether to use exponential backoff (default: true)
- \`outputFormat\`: Output format for the results (default: "json")

## Returns
- \`url\`: The URL of the API documentation
- \`title\`: The title of the documentation
- \`description\`: A brief description of the API
- \`version\`: The API version (if available)
- \`baseUrl\`: The base URL for API requests (if available)
- \`endpoints\`: Array of API endpoints with:
  - Name, path, and HTTP method
  - Description and summary
  - Parameters (name, type, required, description, default value, enum, format, etc.)
  - Responses (status, description, schema, examples, headers)
  - Code examples (language, code, description, curl, response)
  - Rate limits
  - Security requirements
  - Tags and operation ID
  - Deprecation status
  - External documentation
- \`authentication\`: Authentication information
  - Type and description
  - Code examples
  - Security schemes
- \`metadata\`: Additional metadata about the documentation
- \`navigationStatus\`: Status of the scraping operation
- \`rateLimits\`: Global and endpoint-specific rate limits
- \`serverInfo\`: Server information including environments, regions, status, and uptime
- \`sdkInfo\`: SDK information including available languages and examples

## Features
- Extracts structured API documentation
- Supports multiple documentation formats
- Extracts code examples in various languages
- Extracts API schemas and parameters
- Handles authentication information
- Caching mechanism for faster repeated access
- Rate limiting and error handling
- URL sanitization and validation
- Parallel processing of endpoints
- Retry mechanism with exponential backoff
- Endpoint validation with test requests
- Multiple output formats (JSON, YAML, Markdown)
- Comprehensive rate limit information
- Server and environment details
- SDK availability and examples
- Security scheme extraction
- External documentation links
- Deprecation status tracking

## Example
\`\`\`typescript
const result = await apiDocScraperTool.handler({
    url: "https://api.example.com/docs",
    extractExamples: true,
    extractSchemas: true,
    maxEndpoints: 50,
    navigationTimeout: 30000,
    cacheResults: true,
    cacheDuration: 3600,
    extractRateLimits: true,
    extractServerInfo: true,
    extractSDKInfo: true,
    validateEndpoints: false,
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