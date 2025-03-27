import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import puppeteer from "puppeteer-core"
import { getPuppeteerBrowser } from "../../utils/puppeteer"
import { sanitizeUrl } from "../../utils/url"
import { cleanText } from "../../utils/content"
import { cache } from "../../utils/cache"

const codeFileSchema = z.object({
    path: z.string(),
    name: z.string(),
    type: z.string(),
    content: z.string(),
    language: z.string(),
    size: z.number(),
    lastModified: z.string(),
    lines: z.number(),
    dependencies: z.array(z.string()),
    imports: z.array(z.string()),
    exports: z.array(z.string()),
    functions: z.array(z.object({
        name: z.string(),
        type: z.string(),
        parameters: z.array(z.string()),
        returnType: z.string().optional(),
        description: z.string().optional()
    })),
    classes: z.array(z.object({
        name: z.string(),
        extends: z.string().optional(),
        implements: z.array(z.string()).optional(),
        methods: z.array(z.object({
            name: z.string(),
            type: z.string(),
            parameters: z.array(z.string()),
            returnType: z.string().optional(),
            description: z.string().optional()
        })),
        properties: z.array(z.object({
            name: z.string(),
            type: z.string(),
            description: z.string().optional()
        }))
    }))
})

const repositorySchema = z.object({
    url: z.string(),
    name: z.string(),
    description: z.string(),
    owner: z.string(),
    stars: z.number(),
    forks: z.number(),
    issues: z.number(),
    lastUpdated: z.string(),
    license: z.string().optional(),
    topics: z.array(z.string()),
    languages: z.array(z.string()),
    files: z.array(codeFileSchema),
    dependencies: z.array(z.object({
        name: z.string(),
        version: z.string(),
        type: z.enum(["dependencies", "devDependencies", "peerDependencies"])
    })),
    readme: z.object({
        content: z.string(),
        html: z.string()
    })
})

const repoScraperSchema = z.object({
    url: z.string().describe("The URL of the repository to scrape"),
    extractCode: z.boolean().optional().default(true).describe("Whether to extract code content"),
    extractDependencies: z.boolean().optional().default(true).describe("Whether to extract dependencies"),
    maxFiles: z.number().optional().default(50).describe("Maximum number of files to extract"),
    fileTypes: z.array(z.string()).optional().default(["js", "ts", "py", "java", "cpp", "cs", "go", "rb", "php"]).describe("File types to extract"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds")
})

const CACHE_PREFIX = "repo_"

export const repoScraperTool: Tool = {
    name: "repo_scraper",
    description: "Extract code and metadata from software repositories",
    schema: repoScraperSchema,
    handler: async ({ 
        url, 
        extractCode = true, 
        extractDependencies = true,
        maxFiles = 50,
        fileTypes = ["js", "ts", "py", "java", "cpp", "cs", "go", "rb", "php"],
        cacheResults = true,
        cacheDuration = 3600
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

            try {
                // Navigate to the repository
                await page.goto(url, {
                    waitUntil: "networkidle0",
                    timeout: 30000
                })

                // Extract repository information
                const repoInfo = await extractRepositoryInfo(page)
                
                // Extract files
                const files = await extractFiles(page, extractCode, maxFiles, fileTypes)
                
                // Extract dependencies if enabled
                const dependencies = extractDependencies ? await extractDependenciesInfo(page) : []

                const result = {
                    ...repoInfo,
                    files,
                    dependencies,
                    timestamp: new Date().toISOString()
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
            console.error("Repository scraping error:", error)
            throw error
        }
    }
}

async function extractRepositoryInfo(page: puppeteer.Page): Promise<Omit<z.infer<typeof repositorySchema>, "files" | "dependencies" | "timestamp">> {
    const name = await page.$eval("h1 strong a", el => el.textContent || "")
    const description = await page.$eval(".js-details-container", el => el.textContent || "")
    const owner = await page.$eval(".author a", el => el.textContent || "")
    const stars = await page.$eval("[data-hydro-click*='stargazers']", el => parseInt(el.textContent || "0"))
    const forks = await page.$eval("[data-hydro-click*='forks']", el => parseInt(el.textContent || "0"))
    const issues = await page.$eval("[data-hydro-click*='issues']", el => parseInt(el.textContent || "0"))
    const lastUpdated = await page.$eval("relative-time", el => el.getAttribute("datetime") || "")
    const license = await page.$eval(".octicon-law + a", el => el.textContent || "").catch(() => undefined)
    const topics = await page.$$eval(".topic-tag", els => els.map(el => el.textContent?.trim() || ""))
    const languages = await page.$$eval(".language-color", els => els.map(el => el.getAttribute("aria-label") || ""))

    // Extract README
    const readme = await extractReadme(page)

    return {
        url: sanitizeUrl(url),
        name: cleanText(name),
        description: cleanText(description),
        owner: cleanText(owner),
        stars,
        forks,
        issues,
        lastUpdated,
        license,
        topics,
        languages,
        readme
    }
}

async function extractReadme(page: puppeteer.Page): Promise<z.infer<typeof repositorySchema>["readme"]> {
    try {
        const content = await page.$eval("#readme", el => el.textContent || "")
        const html = await page.$eval("#readme", el => el.innerHTML || "")
        return { content: cleanText(content), html }
    } catch (error) {
        return { content: "", html: "" }
    }
}

async function extractFiles(
    page: puppeteer.Page,
    extractCode: boolean,
    maxFiles: number,
    fileTypes: string[]
): Promise<z.infer<typeof repositorySchema>["files"]> {
    const files: z.infer<typeof repositorySchema>["files"] = []
    const fileLinks = await page.$$("a[role='rowheader']")

    for (const link of fileLinks) {
        if (files.length >= maxFiles) break

        const path = await link.evaluate(el => el.getAttribute("href") || "")
        const name = await link.evaluate(el => el.textContent || "")
        const type = name.split(".").pop() || ""

        if (fileTypes.includes(type)) {
            const file = await extractFileDetails(page, path, extractCode)
            if (file) {
                files.push(file)
            }
        }
    }

    return files
}

async function extractFileDetails(
    page: puppeteer.Page,
    path: string,
    extractCode: boolean
): Promise<z.infer<typeof codeFileSchema> | null> {
    try {
        // Navigate to the file
        await page.goto(path, { waitUntil: "networkidle0" })

        const content = extractCode ? await page.$eval("#L1", el => el.textContent || "") : ""
        const language = await page.$eval(".highlight", el => el.getAttribute("lang") || "")
        const size = await page.$eval(".text-mono", el => parseInt(el.textContent || "0"))
        const lastModified = await page.$eval("relative-time", el => el.getAttribute("datetime") || "")
        const lines = content.split("\n").length

        // Extract code analysis
        const dependencies = await extractDependenciesFromFile(content)
        const imports = await extractImports(content, language)
        const exports = await extractExports(content, language)
        const functions = await extractFunctions(content, language)
        const classes = await extractClasses(content, language)

        return {
            path,
            name: path.split("/").pop() || "",
            type: path.split(".").pop() || "",
            content,
            language,
            size,
            lastModified,
            lines,
            dependencies,
            imports,
            exports,
            functions,
            classes
        }
    } catch (error) {
        console.error("Error extracting file details:", error)
        return null
    }
}

async function extractDependenciesFromFile(content: string): Promise<string[]> {
    // Extract dependencies based on file type
    const dependencies: string[] = []
    
    // Common dependency patterns
    const patterns = [
        /require\(['"]([^'"]+)['"]\)/g, // CommonJS
        /import\s+.*?from\s+['"]([^'"]+)['"]/g, // ES6
        /import\s+['"]([^'"]+)['"]/g, // ES6
        /@import\s+['"]([^'"]+)['"]/g, // CSS
        /using\s+([^;]+);/g, // C#
        /import\s+([^;]+);/g, // Java
        /include\s+['"]([^'"]+)['"]/g, // PHP
        /require\s+['"]([^'"]+)['"]/g // Ruby
    ]

    for (const pattern of patterns) {
        const matches = content.match(pattern)
        if (matches) {
            dependencies.push(...matches.map(match => match.replace(pattern, "$1")))
        }
    }

    return [...new Set(dependencies)]
}

async function extractImports(content: string, language: string): Promise<string[]> {
    const imports: string[] = []
    
    switch (language) {
        case "typescript":
        case "javascript":
            const es6Imports = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g)
            if (es6Imports) {
                imports.push(...es6Imports)
            }
            break
        case "python":
            const pyImports = content.match(/from\s+([^\s]+)\s+import/g)
            if (pyImports) {
                imports.push(...pyImports)
            }
            break
        // Add more language-specific import patterns
    }

    return imports
}

async function extractExports(content: string, language: string): Promise<string[]> {
    const exports: string[] = []
    
    switch (language) {
        case "typescript":
        case "javascript":
            const es6Exports = content.match(/export\s+(?:default\s+)?(?:const|let|var|function|class)\s+(\w+)/g)
            if (es6Exports) {
                exports.push(...es6Exports)
            }
            break
        case "python":
            const pyExports = content.match(/__all__\s*=\s*\[(.*?)\]/g)
            if (pyExports) {
                exports.push(...pyExports)
            }
            break
        // Add more language-specific export patterns
    }

    return exports
}

async function extractFunctions(content: string, language: string): Promise<z.infer<typeof codeFileSchema>["functions"]> {
    const functions: z.infer<typeof codeFileSchema>["functions"] = []
    
    switch (language) {
        case "typescript":
        case "javascript":
            const jsFunctions = content.match(/function\s+(\w+)\s*\((.*?)\)\s*(?::\s*([^{]+))?/g)
            if (jsFunctions) {
                functions.push(...jsFunctions.map(fn => ({
                    name: fn.match(/function\s+(\w+)/)?.[1] || "",
                    type: "function",
                    parameters: fn.match(/\((.*?)\)/)?.[1].split(",").map(p => p.trim()) || [],
                    returnType: fn.match(/\)\s*:\s*([^{]+)/)?.[1]?.trim(),
                    description: extractJSDoc(content, fn.match(/function\s+(\w+)/)?.[1] || "")
                })))
            }
            break
        case "python":
            const pyFunctions = content.match(/def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*([^:]+))?/g)
            if (pyFunctions) {
                functions.push(...pyFunctions.map(fn => ({
                    name: fn.match(/def\s+(\w+)/)?.[1] || "",
                    type: "function",
                    parameters: fn.match(/\((.*?)\)/)?.[1].split(",").map(p => p.trim()) || [],
                    returnType: fn.match(/\)\s*->\s*([^:]+)/)?.[1]?.trim(),
                    description: extractPythonDoc(content, fn.match(/def\s+(\w+)/)?.[1] || "")
                })))
            }
            break
        // Add more language-specific function patterns
    }

    return functions
}

async function extractClasses(content: string, language: string): Promise<z.infer<typeof codeFileSchema>["classes"]> {
    const classes: z.infer<typeof codeFileSchema>["classes"] = []
    
    switch (language) {
        case "typescript":
        case "javascript":
            const jsClasses = content.match(/class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g)
            if (jsClasses) {
                classes.push(...jsClasses.map(cls => ({
                    name: cls.match(/class\s+(\w+)/)?.[1] || "",
                    extends: cls.match(/extends\s+(\w+)/)?.[1],
                    implements: cls.match(/implements\s+([^{]+)/)?.[1]?.split(",").map(i => i.trim()),
                    methods: await extractMethods(content, cls.match(/class\s+(\w+)/)?.[1] || ""),
                    properties: await extractProperties(content, cls.match(/class\s+(\w+)/)?.[1] || "")
                })))
            }
            break
        case "python":
            const pyClasses = content.match(/class\s+(\w+)(?:\s*\((.*?)\))?/g)
            if (pyClasses) {
                classes.push(...pyClasses.map(cls => ({
                    name: cls.match(/class\s+(\w+)/)?.[1] || "",
                    extends: cls.match(/\((.*?)\)/)?.[1]?.split(",")[0]?.trim(),
                    methods: await extractPythonMethods(content, cls.match(/class\s+(\w+)/)?.[1] || ""),
                    properties: await extractPythonProperties(content, cls.match(/class\s+(\w+)/)?.[1] || "")
                })))
            }
            break
        // Add more language-specific class patterns
    }

    return classes
}

async function extractMethods(content: string, className: string): Promise<z.infer<typeof codeFileSchema>["classes"][0]["methods"]> {
    const methods: z.infer<typeof codeFileSchema>["classes"][0]["methods"] = []
    const classContent = content.match(new RegExp(`class\\s+${className}\\s*\\{([^}]+)\\}`))?.[1] || ""
    
    const methodPatterns = [
        /(\w+)\s*\((.*?)\)\s*(?::\s*([^{]+))?/g, // Regular methods
        /get\s+(\w+)\s*\((.*?)\)\s*(?::\s*([^{]+))?/g, // Getters
        /set\s+(\w+)\s*\((.*?)\)\s*(?::\s*([^{]+))?/g // Setters
    ]

    for (const pattern of methodPatterns) {
        const matches = classContent.match(pattern)
        if (matches) {
            methods.push(...matches.map(match => ({
                name: match.match(/(?:get|set)?\s*(\w+)/)?.[1] || "",
                type: match.includes("get") ? "getter" : match.includes("set") ? "setter" : "method",
                parameters: match.match(/\((.*?)\)/)?.[1].split(",").map(p => p.trim()) || [],
                returnType: match.match(/\)\s*:\s*([^{]+)/)?.[1]?.trim(),
                description: extractJSDoc(content, match.match(/(?:get|set)?\s*(\w+)/)?.[1] || "")
            })))
        }
    }

    return methods
}

async function extractProperties(content: string, className: string): Promise<z.infer<typeof codeFileSchema>["classes"][0]["properties"]> {
    const properties: z.infer<typeof codeFileSchema>["classes"][0]["properties"] = []
    const classContent = content.match(new RegExp(`class\\s+${className}\\s*\\{([^}]+)\\}`))?.[1] || ""
    
    const propertyPatterns = [
        /(?:private|public|protected)?\s*(?:readonly)?\s*(\w+)\s*:\s*([^;]+);/g, // TypeScript
        /this\.(\w+)\s*=\s*([^;]+);/g // JavaScript
    ]

    for (const pattern of propertyPatterns) {
        const matches = classContent.match(pattern)
        if (matches) {
            properties.push(...matches.map(match => ({
                name: match.match(/(?:this\.)?(\w+)/)?.[1] || "",
                type: match.match(/:\s*([^;]+)/)?.[1]?.trim() || match.match(/=\s*([^;]+)/)?.[1]?.trim(),
                description: extractJSDoc(content, match.match(/(?:this\.)?(\w+)/)?.[1] || "")
            })))
        }
    }

    return properties
}

async function extractPythonMethods(content: string, className: string): Promise<z.infer<typeof codeFileSchema>["classes"][0]["methods"]> {
    const methods: z.infer<typeof codeFileSchema>["classes"][0]["methods"] = []
    const classContent = content.match(new RegExp(`class\\s+${className}\\s*:([^\\n]+\\n(?:\\s+[^\\n]+\\n)*)`))?.[1] || ""
    
    const methodPattern = /def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*([^:]+))?/g
    const matches = classContent.match(methodPattern)

    if (matches) {
        methods.push(...matches.map(match => ({
            name: match.match(/def\s+(\w+)/)?.[1] || "",
            type: "method",
            parameters: match.match(/\((.*?)\)/)?.[1].split(",").map(p => p.trim()) || [],
            returnType: match.match(/\)\s*->\s*([^:]+)/)?.[1]?.trim(),
            description: extractPythonDoc(content, match.match(/def\s+(\w+)/)?.[1] || "")
        })))
    }

    return methods
}

async function extractPythonProperties(content: string, className: string): Promise<z.infer<typeof codeFileSchema>["classes"][0]["properties"]> {
    const properties: z.infer<typeof codeFileSchema>["classes"][0]["properties"] = []
    const classContent = content.match(new RegExp(`class\\s+${className}\\s*:([^\\n]+\\n(?:\\s+[^\\n]+\\n)*)`))?.[1] || ""
    
    const propertyPattern = /(\w+)\s*=\s*([^\\n]+)/g
    const matches = classContent.match(propertyPattern)

    if (matches) {
        properties.push(...matches.map(match => ({
            name: match.match(/(\w+)\s*=/)?.[1] || "",
            type: match.match(/=\s*([^\\n]+)/)?.[1]?.trim(),
            description: extractPythonDoc(content, match.match(/(\w+)\s*=/)?.[1] || "")
        })))
    }

    return properties
}

function extractJSDoc(content: string, name: string): string | undefined {
    const docPattern = new RegExp(`/\\*\\*\\s*\\*\\s*@param\\s+.*?\\s*\\*\\s*@returns?\\s+.*?\\s*\\*/\\s*\\w+\\s+${name}`)
    const match = content.match(docPattern)
    if (match) {
        return match[0].replace(/\/\*\*|\*\/|\*/g, "").trim()
    }
    return undefined
}

function extractPythonDoc(content: string, name: string): string | undefined {
    const docPattern = new RegExp(`\"\"\"\\s*.*?\\s*\"\"\"\\s*\\w+\\s+${name}`)
    const match = content.match(docPattern)
    if (match) {
        return match[0].replace(/"""|'''/g, "").trim()
    }
    return undefined
}

async function extractDependenciesInfo(page: puppeteer.Page): Promise<z.infer<typeof repositorySchema>["dependencies"]> {
    const dependencies: z.infer<typeof repositorySchema>["dependencies"] = []
    
    try {
        // Check for package.json
        const packageJson = await page.$eval("a[href*='package.json']", el => el.textContent || "").catch(() => "")
        if (packageJson) {
            const json = JSON.parse(packageJson)
            if (json.dependencies) {
                Object.entries(json.dependencies).forEach(([name, version]) => {
                    dependencies.push({ name, version: version as string, type: "dependencies" })
                })
            }
            if (json.devDependencies) {
                Object.entries(json.devDependencies).forEach(([name, version]) => {
                    dependencies.push({ name, version: version as string, type: "devDependencies" })
                })
            }
            if (json.peerDependencies) {
                Object.entries(json.peerDependencies).forEach(([name, version]) => {
                    dependencies.push({ name, version: version as string, type: "peerDependencies" })
                })
            }
        }
    } catch (error) {
        console.error("Error extracting dependencies:", error)
    }

    return dependencies
}

export function getRepoScraperDescription(args: ToolArgs): string {
    return `# Repository Scraper
Extract code and metadata from software repositories.

## Parameters
- \`url\`: The URL of the repository to scrape
- \`extractCode\`: Whether to extract code content (default: true)
- \`extractDependencies\`: Whether to extract dependencies (default: true)
- \`maxFiles\`: Maximum number of files to extract (default: 50)
- \`fileTypes\`: File types to extract (default: ["js", "ts", "py", "java", "cpp", "cs", "go", "rb", "php"])
- \`cacheResults\`: Whether to cache results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)

## Returns
- \`url\`: The URL of the repository
- \`name\`: Repository name
- \`description\`: Repository description
- \`owner\`: Repository owner
- \`stars\`: Number of stars
- \`forks\`: Number of forks
- \`issues\`: Number of issues
- \`lastUpdated\`: Last update timestamp
- \`license\`: Repository license
- \`topics\`: Repository topics
- \`languages\`: Programming languages used
- \`files\`: Array of code files with:
  - File path and name
  - Content and language
  - Size and line count
  - Dependencies and imports
  - Functions and classes
  - Documentation
- \`dependencies\`: Project dependencies
- \`readme\`: README content and HTML
- \`timestamp\`: When the scraping was performed

## Features
- Extracts code from multiple file types
- Analyzes code structure and dependencies
- Extracts documentation and comments
- Handles multiple programming languages
- Extracts repository metadata
- Caching mechanism for faster repeated access
- Error handling and recovery
- Rate limiting and request management
- Support for various repository platforms

## Example
\`\`\`typescript
const result = await repoScraperTool.handler({
    url: "https://github.com/username/repo",
    extractCode: true,
    extractDependencies: true,
    maxFiles: 50,
    fileTypes: ["js", "ts", "py"],
    cacheResults: true,
    cacheDuration: 3600
})
\`\`\`
`
} 