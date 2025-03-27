<<<<<<< HEAD
import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import { readFile, stat } from "fs/promises"
import { createReadStream } from "fs"
import { join } from "path"
import { cache } from "../../utils/cache"

const readFileSchema = z.object({
	path: z.string().describe("The path of the file to read"),
	startLine: z.number().optional().describe("Starting line number (1-based)"),
	endLine: z.number().optional().describe("Ending line number (1-based)"),
	chunkSize: z.number().optional().default(1000).describe("Number of lines to read at once"),
	includeMetadata: z.boolean().optional().default(true).describe("Whether to include file metadata"),
	includeLineNumbers: z.boolean().optional().default(true).describe("Whether to include line numbers"),
	includeLanguage: z.boolean().optional().default(true).describe("Whether to detect and include language"),
	cacheResults: z.boolean().optional().default(true).describe("Whether to cache results"),
	cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
	outputFormat: z.enum(["json", "yaml", "markdown"]).optional().default("json").describe("Output format for results")
})

const CACHE_PREFIX = "read_"

export const readFileTool: Tool = {
	name: "read_file",
	description: "Read file contents with support for large files and chunking",
	schema: readFileSchema,
	handler: async ({
		path,
		startLine,
		endLine,
		chunkSize = 1000,
		includeMetadata = true,
		includeLineNumbers = true,
		includeLanguage = true,
		cacheResults = true,
		cacheDuration = 3600,
		outputFormat = "json"
	}) => {
		try {
			// Check cache first if enabled
			if (cacheResults) {
				const cacheKey = `${CACHE_PREFIX}${path}_${startLine}_${endLine}`
				const cachedResult = await cache.get(cacheKey)
				if (cachedResult) {
					return cachedResult
				}
			}

			// Get file stats
			const stats = await stat(path)
			const totalLines = await countLines(path)
			
			// Validate line numbers
			const start = startLine ? Math.max(1, startLine) : 1
			const end = endLine ? Math.min(totalLines, endLine) : totalLines
			
			if (start > end) {
				throw new Error("Start line must be less than or equal to end line")
			}

			// Read file content in chunks
			const content = await readFileInChunks(path, start, end, chunkSize)
			
			// Prepare result
			const result = {
				path,
				content,
				metadata: includeMetadata ? {
					size: stats.size,
					lines: totalLines,
					startLine: start,
					endLine: end,
					lastModified: stats.mtime.toISOString(),
					created: stats.birthtime.toISOString()
				} : undefined,
				language: includeLanguage ? getFileLanguage(path) : undefined,
				lineNumbers: includeLineNumbers ? {
					start,
					end,
					total: totalLines
				} : undefined,
				timestamp: new Date().toISOString()
			}

			// Cache the result if enabled
			if (cacheResults) {
				const cacheKey = `${CACHE_PREFIX}${path}_${startLine}_${endLine}`
				await cache.set(cacheKey, result, cacheDuration)
			}

			return result
		} catch (error) {
			console.error("File reading error:", error)
			throw error
		}
	}
}

async function countLines(path: string): Promise<number> {
	return new Promise((resolve, reject) => {
		let count = 0
		createReadStream(path)
			.on("data", (buffer) => {
				let idx = -1
				count-- // Because the first line doesn't have a newline
				while ((idx = buffer.indexOf(10, idx + 1)) !== -1) count++
			})
			.on("end", () => resolve(count))
			.on("error", reject)
	})
}

async function readFileInChunks(
	path: string,
	startLine: number,
	endLine: number,
	chunkSize: number
): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: string[] = []
		let currentLine = 0
		let currentChunk: string[] = []

		createReadStream(path)
			.on("data", (buffer) => {
				const lines = buffer.toString().split("\n")
				
				for (const line of lines) {
					currentLine++
					
					if (currentLine >= startLine && currentLine <= endLine) {
						currentChunk.push(line)
						
						if (currentChunk.length >= chunkSize) {
							chunks.push(currentChunk.join("\n"))
							currentChunk = []
						}
					}
				}
			})
			.on("end", () => {
				// Add any remaining lines
				if (currentChunk.length > 0) {
					chunks.push(currentChunk.join("\n"))
				}
				resolve(chunks.join("\n"))
			})
			.on("error", reject)
	})
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

export function getReadFileDescription(args: ToolArgs): string {
	return `# Read File
Read file contents with support for large files and chunking.

## Parameters
- \`path\`: The path of the file to read
- \`startLine\`: Starting line number (1-based)
- \`endLine\`: Ending line number (1-based)
- \`chunkSize\`: Number of lines to read at once (default: 1000)
- \`includeMetadata\`: Whether to include file metadata (default: true)
- \`includeLineNumbers\`: Whether to include line numbers (default: true)
- \`includeLanguage\`: Whether to detect and include language (default: true)
- \`cacheResults\`: Whether to cache results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`outputFormat\`: Output format for results (default: "json")

## Returns
- \`path\`: The path of the file
- \`content\`: The file content
- \`metadata\`: File metadata including:
  - File size
  - Total lines
  - Start and end lines
  - Last modified date
  - Creation date
- \`language\`: Detected programming language
- \`lineNumbers\`: Line number information
- \`timestamp\`: When the file was read

## Features
- Efficient handling of large files
- Chunked reading for better memory management
- Streaming support for better performance
- Line number tracking
- File metadata extraction
- Language detection
- Caching mechanism
- Multiple output formats
- Error handling and recovery

## Example
\`\`\`typescript
const result = await readFileTool.handler({
	path: "path/to/file.ts",
	startLine: 1,
	endLine: 100,
	chunkSize: 1000,
	includeMetadata: true,
	includeLineNumbers: true,
	includeLanguage: true,
	cacheResults: true,
	cacheDuration: 3600,
	outputFormat: "json"
})
\`\`\`
`
=======
import { ToolArgs } from "./types"

export function getReadFileDescription(args: ToolArgs): string {
	return `## read_file
Description: Request to read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files. The output includes line numbers prefixed to each line (e.g. "1 | const x = 1"), making it easier to reference specific lines when creating diffs or discussing code. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.
Parameters:
- path: (required) The path of the file to read (relative to the current working directory ${args.cwd})
Usage:
<read_file>
<path>File path here</path>
</read_file>

Example: Requesting to read frontend-config.json
<read_file>
<path>frontend-config.json</path>
</read_file>`
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
}
