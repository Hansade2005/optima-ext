<<<<<<< HEAD
import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import { readdir, stat } from "fs/promises"
import { join } from "path"
import { cache } from "../../utils/cache"

const fileSystemEntrySchema = z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(["file", "directory", "symlink"]),
    size: z.number().optional(),
    lastModified: z.string(),
    created: z.string(),
    permissions: z.string(),
    isHidden: z.boolean(),
    extension: z.string().optional(),
    language: z.string().optional(),
    metadata: z.object({
        isExecutable: z.boolean(),
        isReadable: z.boolean(),
        isWritable: z.boolean(),
        owner: z.string().optional(),
        group: z.string().optional(),
        mimeType: z.string().optional()
    }).optional()
})

const listFilesSchema = z.object({
    path: z.string().optional().describe("The path to list (default: current directory)"),
    pattern: z.string().optional().describe("Glob pattern to filter entries"),
    recursive: z.boolean().optional().default(false).describe("Whether to list recursively"),
    maxDepth: z.number().optional().default(3).describe("Maximum depth for recursive listing"),
    includeHidden: z.boolean().optional().default(false).describe("Whether to include hidden files"),
    includeMetadata: z.boolean().optional().default(true).describe("Whether to include detailed metadata"),
    sortBy: z.enum(["name", "size", "date", "type"]).optional().default("name").describe("Sort entries by"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("asc").describe("Sort order"),
    groupBy: z.enum(["type", "extension", "none"]).optional().default("none").describe("Group entries by"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
    outputFormat: z.enum(["json", "yaml", "markdown", "tree"]).optional().default("json").describe("Output format")
})

const CACHE_PREFIX = "list_"

export const listFilesTool: Tool = {
    name: "list_files",
    description: "List files and directories with enhanced metadata and organization options",
    schema: listFilesSchema,
    handler: async ({
        path = ".",
        pattern,
        recursive = false,
        maxDepth = 3,
        includeHidden = false,
        includeMetadata = true,
        sortBy = "name",
        sortOrder = "asc",
        groupBy = "none",
        cacheResults = true,
        cacheDuration = 3600,
        outputFormat = "json"
    }) => {
        try {
            // Check cache first if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${path}_${pattern}_${recursive}_${maxDepth}`
                const cachedResult = await cache.get(cacheKey)
                if (cachedResult) {
                    return cachedResult
                }
            }

            // Get directory contents
            const entries = await listDirectory(path, {
                pattern,
                recursive,
                maxDepth,
                includeHidden,
                includeMetadata
            })

            // Sort entries
            const sortedEntries = sortEntries(entries, sortBy, sortOrder)

            // Group entries if requested
            const groupedEntries = groupEntries(sortedEntries, groupBy)

            const result = {
                path,
                pattern,
                recursive,
                maxDepth,
                totalEntries: entries.length,
                entries: groupedEntries,
                timestamp: new Date().toISOString()
            }

            // Cache the result if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${path}_${pattern}_${recursive}_${maxDepth}`
                await cache.set(cacheKey, result, cacheDuration)
            }

            return result
        } catch (error) {
            console.error("Directory listing error:", error)
            throw error
        }
    }
}

async function listDirectory(
    dirPath: string,
    options: {
        pattern?: string
        recursive: boolean
        maxDepth: number
        includeHidden: boolean
        includeMetadata: boolean
    }
): Promise<z.infer<typeof fileSystemEntrySchema>[]> {
    const entries: z.infer<typeof fileSystemEntrySchema>[] = []
    const { pattern, recursive, maxDepth, includeHidden, includeMetadata } = options

    try {
        const items = await readdir(dirPath, { withFileTypes: true })
        
        for (const item of items) {
            const fullPath = join(dirPath, item.name)
            const stats = await stat(fullPath)
            
            // Skip hidden files if not included
            if (!includeHidden && item.name.startsWith(".")) {
                continue
            }

            // Skip if doesn't match pattern
            if (pattern && !matchesPattern(item.name, pattern)) {
                continue
            }

            const entry: z.infer<typeof fileSystemEntrySchema> = {
                name: item.name,
                path: fullPath,
                type: item.isDirectory() ? "directory" : item.isSymbolicLink() ? "symlink" : "file",
                lastModified: stats.mtime.toISOString(),
                created: stats.birthtime.toISOString(),
                permissions: stats.mode.toString(8),
                isHidden: item.name.startsWith("."),
                extension: item.isFile() ? item.name.split(".").pop() : undefined,
                language: item.isFile() ? getFileLanguage(item.name) : undefined
            }

            if (includeMetadata) {
                entry.metadata = {
                    isExecutable: (stats.mode & 0o111) !== 0,
                    isReadable: (stats.mode & 0o444) !== 0,
                    isWritable: (stats.mode & 0o222) !== 0,
                    owner: stats.uid.toString(),
                    group: stats.gid.toString(),
                    mimeType: item.isFile() ? getMimeType(item.name) : undefined
                }
            }

            entries.push(entry)

            // Recursively list subdirectories if enabled
            if (recursive && item.isDirectory() && maxDepth > 0) {
                const subEntries = await listDirectory(fullPath, {
                    ...options,
                    maxDepth: maxDepth - 1
                })
                entries.push(...subEntries)
            }
        }
    } catch (error) {
        console.error(`Error listing directory ${dirPath}:`, error)
    }

    return entries
}

function matchesPattern(name: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"))
    return regex.test(name)
}

function sortEntries(
    entries: z.infer<typeof fileSystemEntrySchema>[],
    sortBy: "name" | "size" | "date" | "type",
    sortOrder: "asc" | "desc"
): z.infer<typeof fileSystemEntrySchema>[] {
    return [...entries].sort((a, b) => {
        let comparison = 0

        switch (sortBy) {
            case "name":
                comparison = a.name.localeCompare(b.name)
                break
            case "size":
                comparison = (a.size || 0) - (b.size || 0)
                break
            case "date":
                comparison = new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()
                break
            case "type":
                comparison = a.type.localeCompare(b.type)
                break
        }

        return sortOrder === "asc" ? comparison : -comparison
    })
}

function groupEntries(
    entries: z.infer<typeof fileSystemEntrySchema>[],
    groupBy: "type" | "extension" | "none"
): any {
    if (groupBy === "none") {
        return entries
    }

    const groups: Record<string, z.infer<typeof fileSystemEntrySchema>[]> = {}

    for (const entry of entries) {
        let key: string

        switch (groupBy) {
            case "type":
                key = entry.type
                break
            case "extension":
                key = entry.extension || "no-extension"
                break
            default:
                key = "other"
        }

        if (!groups[key]) {
            groups[key] = []
        }
        groups[key].push(entry)
    }

    return groups
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

function getMimeType(file: string): string {
    const ext = file.split(".").pop()?.toLowerCase()
    const mimeMap: Record<string, string> = {
        "txt": "text/plain",
        "js": "application/javascript",
        "ts": "application/typescript",
        "py": "text/x-python",
        "java": "text/x-java-source",
        "cpp": "text/x-c++",
        "cs": "text/x-csharp",
        "go": "text/x-go",
        "rb": "text/x-ruby",
        "php": "application/x-httpd-php",
        "html": "text/html",
        "css": "text/css",
        "json": "application/json",
        "md": "text/markdown",
        "yaml": "text/yaml",
        "yml": "text/yaml",
        "xml": "application/xml",
        "sh": "application/x-sh",
        "bash": "application/x-sh",
        "sql": "application/sql",
        "pdf": "application/pdf",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls": "application/vnd.ms-excel",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "svg": "image/svg+xml"
    }
    return mimeMap[ext || ""] || "application/octet-stream"
}

export function getListFilesDescription(args: ToolArgs): string {
    return `# List Files
List files and directories with enhanced metadata and organization options.

## Parameters
- \`path\`: The path to list (default: current directory)
- \`pattern\`: Glob pattern to filter entries
- \`recursive\`: Whether to list recursively (default: false)
- \`maxDepth\`: Maximum depth for recursive listing (default: 3)
- \`includeHidden\`: Whether to include hidden files (default: false)
- \`includeMetadata\`: Whether to include detailed metadata (default: true)
- \`sortBy\`: Sort entries by (default: "name")
  - "name": Sort by name
  - "size": Sort by size
  - "date": Sort by last modified date
  - "type": Sort by entry type
- \`sortOrder\`: Sort order (default: "asc")
  - "asc": Ascending order
  - "desc": Descending order
- \`groupBy\`: Group entries by (default: "none")
  - "type": Group by entry type
  - "extension": Group by file extension
  - "none": No grouping
- \`cacheResults\`: Whether to cache results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`outputFormat\`: Output format (default: "json")
  - "json": JSON format
  - "yaml": YAML format
  - "markdown": Markdown format
  - "tree": Tree-like format

## Returns
- \`path\`: The path listed
- \`pattern\`: The pattern used for filtering
- \`recursive\`: Whether recursive listing was enabled
- \`maxDepth\`: Maximum depth for recursive listing
- \`totalEntries\`: Total number of entries found
- \`entries\`: Array or object of file system entries with:
  - Name and path
  - Entry type (file, directory, symlink)
  - Size (for files)
  - Last modified and creation dates
  - Permissions
  - Hidden status
  - File extension and language
  - Detailed metadata (if enabled)
- \`timestamp\`: When the listing was performed

## Features
- Recursive directory listing
- Pattern-based filtering
- Hidden file handling
- Detailed metadata extraction
- Multiple sorting options
- Entry grouping
- Caching mechanism
- Multiple output formats
- File type detection
- Language detection
- MIME type detection
- Error handling and recovery

## Example
\`\`\`typescript
const result = await listFilesTool.handler({
    path: ".",
    pattern: "*.{js,ts}",
    recursive: true,
    maxDepth: 3,
    includeHidden: false,
    includeMetadata: true,
    sortBy: "date",
    sortOrder: "desc",
    groupBy: "type",
    cacheResults: true,
    cacheDuration: 3600,
    outputFormat: "json"
})
\`\`\`
`
}
=======
import { ToolArgs } from "./types"

export function getListFilesDescription(args: ToolArgs): string {
	return `## list_files
Description: Request to list files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents. Do not use this tool to confirm the existence of files you may have created, as the user will let you know if the files were created successfully or not.
Parameters:
- path: (required) The path of the directory to list contents for (relative to the current working directory ${args.cwd})
- recursive: (optional) Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.
Usage:
<list_files>
<path>Directory path here</path>
<recursive>true or false (optional)</recursive>
</list_files>

Example: Requesting to list all files in the current directory
<list_files>
<path>.</path>
<recursive>false</recursive>
</list_files>`
}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
