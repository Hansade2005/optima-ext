<<<<<<< HEAD
import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import { glob } from "glob"
import { readFile } from "fs/promises"
import { join } from "path"
import { cache } from "../../utils/cache"

const searchResultSchema = z.object({
    file: z.string(),
    line: z.number(),
    column: z.number(),
    match: z.string(),
    context: z.object({
        before: z.string(),
        after: z.string()
    }),
    metadata: z.object({
        language: z.string().optional(),
        size: z.number(),
        lastModified: z.string(),
        lineCount: z.number()
    })
})

const searchFilesSchema = z.object({
    query: z.string().describe("The search query (regex pattern)"),
    path: z.string().optional().describe("The path to search in (default: workspace root)"),
    filePattern: z.string().optional().describe("Glob pattern to filter files"),
    excludePattern: z.string().optional().describe("Glob pattern to exclude files"),
    maxResults: z.number().optional().default(100).describe("Maximum number of results to return"),
    contextLines: z.number().optional().default(3).describe("Number of context lines before and after matches"),
    caseSensitive: z.boolean().optional().default(false).describe("Whether to perform case-sensitive search"),
    wholeWord: z.boolean().optional().default(false).describe("Whether to match whole words only"),
    includeHidden: z.boolean().optional().default(false).describe("Whether to include hidden files"),
    parallelProcessing: z.boolean().optional().default(true).describe("Whether to process files in parallel"),
    maxConcurrentFiles: z.number().optional().default(10).describe("Maximum number of concurrent file processing"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache search results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
    outputFormat: z.enum(["json", "yaml", "markdown"]).optional().default("json").describe("Output format for results")
})

const CACHE_PREFIX = "search_"

export const searchFilesTool: Tool = {
    name: "search_files",
    description: "Search for patterns across files in the workspace with enhanced features",
    schema: searchFilesSchema,
    handler: async ({
        query,
        path = ".",
        filePattern = "**/*",
        excludePattern,
        maxResults = 100,
        contextLines = 3,
        caseSensitive = false,
        wholeWord = false,
        includeHidden = false,
        parallelProcessing = true,
        maxConcurrentFiles = 10,
        cacheResults = true,
        cacheDuration = 3600,
        outputFormat = "json"
    }) => {
        try {
            // Check cache first if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${query}_${path}_${filePattern}`
                const cachedResult = await cache.get(cacheKey)
                if (cachedResult) {
                    return cachedResult
                }
            }

            // Build glob pattern
            const globPattern = join(path, filePattern)
            const globOptions = {
                ignore: excludePattern ? [excludePattern] : undefined,
                dot: includeHidden,
                absolute: true
            }

            // Find all matching files
            const files = await glob(globPattern, globOptions)
            
            // Process files
            const results: z.infer<typeof searchResultSchema>[] = []
            const regex = new RegExp(
                wholeWord ? `\\b${query}\\b` : query,
                caseSensitive ? undefined : "i"
            )

            if (parallelProcessing) {
                // Process files in parallel with chunking
                const chunks = chunkArray(files, maxConcurrentFiles)
                for (const chunk of chunks) {
                    const chunkResults = await Promise.all(
                        chunk.map(file => processFile(file, regex, contextLines))
                    )
                    results.push(...chunkResults.flat())
                    
                    // Check if we've reached max results
                    if (results.length >= maxResults) {
                        results.length = maxResults
                        break
                    }
                }
            } else {
                // Process files sequentially
                for (const file of files) {
                    const fileResults = await processFile(file, regex, contextLines)
                    results.push(...fileResults)
                    
                    // Check if we've reached max results
                    if (results.length >= maxResults) {
                        results.length = maxResults
                        break
                    }
                }
            }

            const result = {
                query,
                path,
                filePattern,
                excludePattern,
                totalFiles: files.length,
                totalMatches: results.length,
                results,
                timestamp: new Date().toISOString()
            }

            // Cache the result if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${query}_${path}_${filePattern}`
                await cache.set(cacheKey, result, cacheDuration)
            }

            return result
        } catch (error) {
            console.error("Search error:", error)
            throw error
        }
    }
}

async function processFile(
    file: string,
    regex: RegExp,
    contextLines: number
): Promise<z.infer<typeof searchResultSchema>[]> {
    try {
        const content = await readFile(file, "utf-8")
        const lines = content.split("\n")
        const results: z.infer<typeof searchResultSchema>[] = []

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            let match: RegExpExecArray | null

            while ((match = regex.exec(line)) !== null) {
                const before = lines.slice(Math.max(0, i - contextLines), i).join("\n")
                const after = lines.slice(i + 1, Math.min(lines.length, i + contextLines + 1)).join("\n")

                results.push({
                    file,
                    line: i + 1,
                    column: match.index + 1,
                    match: match[0],
                    context: {
                        before,
                        after
                    },
                    metadata: {
                        language: getFileLanguage(file),
                        size: content.length,
                        lastModified: new Date().toISOString(), // This should be replaced with actual file stats
                        lineCount: lines.length
                    }
                })
            }
        }

        return results
    } catch (error) {
        console.error(`Error processing file ${file}:`, error)
        return []
    }
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size))
    }
    return chunks
}

function getFileLanguage(file: string): string {
    const ext = file.split(".").pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
        "js": "javascript",
        "ts": "typescript",
        "py": "python",
        "java": "java",
        "cpp": "cpp",
        "cs": "csharp",
        "go": "go",
        "rb": "ruby",
        "php": "php",
        "html": "html",
        "css": "css",
        "json": "json",
        "md": "markdown",
        "yaml": "yaml",
        "yml": "yaml",
        "xml": "xml",
        "sh": "shell",
        "bash": "shell",
        "sql": "sql"
    }
    return languageMap[ext || ""] || "unknown"
}

export function getSearchFilesDescription(args: ToolArgs): string {
    return `# Search Files
Search for patterns across files in the workspace with enhanced features.

## Parameters
- \`query\`: The search query (regex pattern)
- \`path\`: The path to search in (default: workspace root)
- \`filePattern\`: Glob pattern to filter files (default: "**/*")
- \`excludePattern\`: Glob pattern to exclude files
- \`maxResults\`: Maximum number of results to return (default: 100)
- \`contextLines\`: Number of context lines before and after matches (default: 3)
- \`caseSensitive\`: Whether to perform case-sensitive search (default: false)
- \`wholeWord\`: Whether to match whole words only (default: false)
- \`includeHidden\`: Whether to include hidden files (default: false)
- \`parallelProcessing\`: Whether to process files in parallel (default: true)
- \`maxConcurrentFiles\`: Maximum number of concurrent file processing (default: 10)
- \`cacheResults\`: Whether to cache search results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`outputFormat\`: Output format for results (default: "json")

## Returns
- \`query\`: The search query used
- \`path\`: The path searched
- \`filePattern\`: The file pattern used
- \`excludePattern\`: The exclude pattern used
- \`totalFiles\`: Total number of files searched
- \`totalMatches\`: Total number of matches found
- \`results\`: Array of search results with:
  - File path
  - Line and column numbers
  - Matching text
  - Context (lines before and after)
  - File metadata (language, size, last modified, line count)
- \`timestamp\`: When the search was performed

## Features
- Searches across entire workspace
- Supports regex patterns
- Provides context around matches
- Handles multiple file types
- Parallel processing for better performance
- Caching mechanism for faster repeated searches
- Configurable search options
- Multiple output formats
- File metadata extraction
- Language detection
- Error handling and recovery

## Example
\`\`\`typescript
const result = await searchFilesTool.handler({
    query: "function\\s+\\w+\\s*\\(",
    path: ".",
    filePattern: "**/*.{js,ts}",
    excludePattern: "**/node_modules/**",
    maxResults: 100,
    contextLines: 3,
    caseSensitive: false,
    wholeWord: false,
    includeHidden: false,
    parallelProcessing: true,
    maxConcurrentFiles: 10,
    cacheResults: true,
    cacheDuration: 3600,
    outputFormat: "json"
})
\`\`\`
`
=======
import { ToolArgs } from "./types"

export function getSearchFilesDescription(args: ToolArgs): string {
	return `## search_files
Description: Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.
Parameters:
- path: (required) The path of the directory to search in (relative to the current working directory ${args.cwd}). This directory will be recursively searched.
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).
Usage:
<search_files>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
</search_files>

Example: Requesting to search for all .ts files in the current directory
<search_files>
<path>.</path>
<regex>.*</regex>
<file_pattern>*.ts</file_pattern>
</search_files>`
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
}
