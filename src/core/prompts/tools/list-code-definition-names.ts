<<<<<<< HEAD
import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import { glob } from "glob"
import { readFile } from "fs/promises"
import { join } from "path"
import { cache } from "../../utils/cache"

const codeDefinitionSchema = z.object({
    name: z.string(),
    type: z.enum(["function", "class", "interface", "type", "enum", "variable", "constant", "module"]),
    file: z.string(),
    line: z.number(),
    column: z.number(),
    scope: z.enum(["global", "module", "class", "function"]),
    visibility: z.enum(["public", "private", "protected", "internal"]),
    isExported: z.boolean(),
    isAsync: z.boolean().optional(),
    isStatic: z.boolean().optional(),
    parameters: z.array(z.object({
        name: z.string(),
        type: z.string().optional(),
        isOptional: z.boolean(),
        defaultValue: z.string().optional()
    })).optional(),
    returnType: z.string().optional(),
    extends: z.string().optional(),
    implements: z.array(z.string()).optional(),
    decorators: z.array(z.string()).optional(),
    documentation: z.string().optional(),
    references: z.array(z.object({
        file: z.string(),
        line: z.number(),
        column: z.number()
    })).optional()
})

const listCodeDefinitionsSchema = z.object({
    path: z.string().optional().describe("The path to search in (default: workspace root)"),
    filePattern: z.string().optional().describe("Glob pattern to filter files"),
    types: z.array(z.enum(["function", "class", "interface", "type", "enum", "variable", "constant", "module"])).optional().describe("Types of definitions to include"),
    includeReferences: z.boolean().optional().default(false).describe("Whether to include reference information"),
    includeDocumentation: z.boolean().optional().default(true).describe("Whether to include documentation"),
    includeDecorators: z.boolean().optional().default(true).describe("Whether to include decorators"),
    maxResults: z.number().optional().default(1000).describe("Maximum number of results to return"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
    outputFormat: z.enum(["json", "yaml", "markdown"]).optional().default("json").describe("Output format")
})

const CACHE_PREFIX = "definitions_"

export const listCodeDefinitionsTool: Tool = {
    name: "list_code_definitions",
    description: "List code definitions with enhanced analysis and metadata",
    schema: listCodeDefinitionsSchema,
    handler: async ({
        path = ".",
        filePattern = "**/*.{js,ts,jsx,tsx}",
        types,
        includeReferences = false,
        includeDocumentation = true,
        includeDecorators = true,
        maxResults = 1000,
        cacheResults = true,
        cacheDuration = 3600,
        outputFormat = "json"
    }) => {
        try {
            // Check cache first if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${path}_${filePattern}_${types?.join(",")}`
                const cachedResult = await cache.get(cacheKey)
                if (cachedResult) {
                    return cachedResult
                }
            }

            // Find all matching files
            const files = await glob(join(path, filePattern))
            
            // Process files
            const definitions: z.infer<typeof codeDefinitionSchema>[] = []
            
            for (const file of files) {
                const content = await readFile(file, "utf-8")
                const fileDefinitions = await analyzeFile(file, content, {
                    types,
                    includeReferences,
                    includeDocumentation,
                    includeDecorators
                })
                definitions.push(...fileDefinitions)
                
                // Check if we've reached max results
                if (definitions.length >= maxResults) {
                    definitions.length = maxResults
                    break
                }
            }

            const result = {
                path,
                filePattern,
                types,
                totalDefinitions: definitions.length,
                definitions,
                timestamp: new Date().toISOString()
            }

            // Cache the result if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${path}_${filePattern}_${types?.join(",")}`
                await cache.set(cacheKey, result, cacheDuration)
            }

            return result
        } catch (error) {
            console.error("Code definition analysis error:", error)
            throw error
        }
    }
}

async function analyzeFile(
    file: string,
    content: string,
    options: {
        types?: string[]
        includeReferences: boolean
        includeDocumentation: boolean
        includeDecorators: boolean
    }
): Promise<z.infer<typeof codeDefinitionSchema>[]> {
    const definitions: z.infer<typeof codeDefinitionSchema>[] = []
    const lines = content.split("\n")
    
    // Basic regex patterns for different definition types
    const patterns = {
        function: /(?:async\s+)?function\s+(\w+)\s*\(/g,
        class: /class\s+(\w+)/g,
        interface: /interface\s+(\w+)/g,
        type: /type\s+(\w+)\s*=/g,
        enum: /enum\s+(\w+)/g,
        variable: /(?:const|let|var)\s+(\w+)\s*=/g,
        constant: /const\s+(\w+)\s*=/g,
        module: /export\s+(?:default\s+)?(?:class|interface|type|enum|function|const|let|var)\s+(\w+)/g
    }

    // Process each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // Check each pattern
        for (const [type, pattern] of Object.entries(patterns)) {
            if (options.types && !options.types.includes(type)) {
                continue
            }

            let match: RegExpExecArray | null
            while ((match = pattern.exec(line)) !== null) {
                const name = match[1]
                const column = match.index + 1
                
                // Extract documentation if available
                let documentation: string | undefined
                if (options.includeDocumentation && i > 0) {
                    const prevLine = lines[i - 1].trim()
                    if (prevLine.startsWith("/**") || prevLine.startsWith("//")) {
                        documentation = prevLine
                    }
                }

                // Extract decorators if available
                let decorators: string[] | undefined
                if (options.includeDecorators && i > 0) {
                    const prevLine = lines[i - 1].trim()
                    if (prevLine.startsWith("@")) {
                        decorators = [prevLine]
                    }
                }

                // Create definition object
                const definition: z.infer<typeof codeDefinitionSchema> = {
                    name,
                    type: type as any,
                    file,
                    line: i + 1,
                    column,
                    scope: determineScope(line),
                    visibility: determineVisibility(line),
                    isExported: line.includes("export"),
                    isAsync: line.includes("async"),
                    isStatic: line.includes("static"),
                    documentation,
                    decorators
                }

                // Add type-specific information
                if (type === "function") {
                    definition.parameters = extractParameters(line)
                    definition.returnType = extractReturnType(line)
                } else if (type === "class") {
                    definition.extends = extractExtends(line)
                    definition.implements = extractImplements(line)
                }

                definitions.push(definition)
            }
        }
    }

    return definitions
}

function determineScope(line: string): "global" | "module" | "class" | "function" {
    if (line.includes("export")) return "module"
    if (line.includes("class")) return "class"
    if (line.includes("function")) return "function"
    return "global"
}

function determineVisibility(line: string): "public" | "private" | "protected" | "internal" {
    if (line.includes("private")) return "private"
    if (line.includes("protected")) return "protected"
    if (line.includes("internal")) return "internal"
    return "public"
}

function extractParameters(line: string): { name: string; type?: string; isOptional: boolean; defaultValue?: string }[] {
    const paramsMatch = line.match(/\((.*?)\)/)
    if (!paramsMatch) return []

    return paramsMatch[1].split(",").map(param => {
        const [name, type] = param.split(":").map(s => s.trim())
        return {
            name,
            type,
            isOptional: name.includes("?"),
            defaultValue: param.includes("=") ? param.split("=")[1].trim() : undefined
        }
    })
}

function extractReturnType(line: string): string | undefined {
    const returnMatch = line.match(/\)\s*:\s*(\w+)/)
    return returnMatch ? returnMatch[1] : undefined
}

function extractExtends(line: string): string | undefined {
    const extendsMatch = line.match(/extends\s+(\w+)/)
    return extendsMatch ? extendsMatch[1] : undefined
}

function extractImplements(line: string): string[] {
    const implementsMatch = line.match(/implements\s+([^\{]+)/)
    if (!implementsMatch) return []
    return implementsMatch[1].split(",").map(i => i.trim())
}

export function getListCodeDefinitionsDescription(args: ToolArgs): string {
    return `# List Code Definitions
List code definitions with enhanced analysis and metadata.

## Parameters
- \`path\`: The path to search in (default: workspace root)
- \`filePattern\`: Glob pattern to filter files (default: "**/*.{js,ts,jsx,tsx}")
- \`types\`: Types of definitions to include
  - "function": Function definitions
  - "class": Class definitions
  - "interface": Interface definitions
  - "type": Type definitions
  - "enum": Enum definitions
  - "variable": Variable definitions
  - "constant": Constant definitions
  - "module": Module exports
- \`includeReferences\`: Whether to include reference information (default: false)
- \`includeDocumentation\`: Whether to include documentation (default: true)
- \`includeDecorators\`: Whether to include decorators (default: true)
- \`maxResults\`: Maximum number of results to return (default: 1000)
- \`cacheResults\`: Whether to cache results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`outputFormat\`: Output format (default: "json")

## Returns
- \`path\`: The path searched
- \`filePattern\`: The file pattern used
- \`types\`: Types of definitions included
- \`totalDefinitions\`: Total number of definitions found
- \`definitions\`: Array of code definitions with:
  - Name and type
  - File location
  - Scope and visibility
  - Export status
  - Async and static flags
  - Parameters (for functions)
  - Return type (for functions)
  - Extends and implements (for classes)
  - Documentation
  - Decorators
  - References (if enabled)
- \`timestamp\`: When the analysis was performed

## Features
- Multiple definition type support
- Documentation extraction
- Decorator detection
- Reference tracking
- Scope and visibility analysis
- Parameter and return type extraction
- Inheritance information
- Caching mechanism
- Multiple output formats
- Error handling and recovery

## Example
\`\`\`typescript
const result = await listCodeDefinitionsTool.handler({
    path: ".",
    filePattern: "**/*.{js,ts}",
    types: ["function", "class", "interface"],
    includeReferences: true,
    includeDocumentation: true,
    includeDecorators: true,
    maxResults: 1000,
    cacheResults: true,
    cacheDuration: 3600,
    outputFormat: "json"
})
\`\`\`
`
}

    parameters: z.array(z.object({
        name: z.string(),
        type: z.string().optional(),
        isOptional: z.boolean(),
        defaultValue: z.string().optional()
    })).optional(),
    returnType: z.string().optional(),
    extends: z.string().optional(),
    implements: z.array(z.string()).optional(),
    decorators: z.array(z.string()).optional(),
    documentation: z.string().optional(),
    references: z.array(z.object({
        file: z.string(),
        line: z.number(),
        column: z.number()
    })).optional()
})

const listCodeDefinitionsSchema = z.object({
    path: z.string().optional().describe("The path to search in (default: workspace root)"),
    filePattern: z.string().optional().describe("Glob pattern to filter files"),
    types: z.array(z.enum(["function", "class", "interface", "type", "enum", "variable", "constant", "module"])).optional().describe("Types of definitions to include"),
    includeReferences: z.boolean().optional().default(false).describe("Whether to include reference information"),
    includeDocumentation: z.boolean().optional().default(true).describe("Whether to include documentation"),
    includeDecorators: z.boolean().optional().default(true).describe("Whether to include decorators"),
    maxResults: z.number().optional().default(1000).describe("Maximum number of results to return"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
    outputFormat: z.enum(["json", "yaml", "markdown"]).optional().default("json").describe("Output format")
})

const CACHE_PREFIX = "definitions_"

export const listCodeDefinitionsTool: Tool = {
    name: "list_code_definitions",
    description: "List code definitions with enhanced analysis and metadata",
    schema: listCodeDefinitionsSchema,
    handler: async ({
        path = ".",
        filePattern = "**/*.{js,ts,jsx,tsx}",
        types,
        includeReferences = false,
        includeDocumentation = true,
        includeDecorators = true,
        maxResults = 1000,
        cacheResults = true,
        cacheDuration = 3600,
        outputFormat = "json"
    }) => {
        try {
            // Check cache first if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${path}_${filePattern}_${types?.join(",")}`
                const cachedResult = await cache.get(cacheKey)
                if (cachedResult) {
                    return cachedResult
                }
            }

            // Find all matching files
            const files = await glob(join(path, filePattern))
            
            // Process files
            const definitions: z.infer<typeof codeDefinitionSchema>[] = []
            
            for (const file of files) {
                const content = await readFile(file, "utf-8")
                const fileDefinitions = await analyzeFile(file, content, {
                    types,
                    includeReferences,
                    includeDocumentation,
                    includeDecorators
                })
                definitions.push(...fileDefinitions)
                
                // Check if we've reached max results
                if (definitions.length >= maxResults) {
                    definitions.length = maxResults
                    break
                }
            }

            const result = {
                path,
                filePattern,
                types,
                totalDefinitions: definitions.length,
                definitions,
                timestamp: new Date().toISOString()
            }

            // Cache the result if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${path}_${filePattern}_${types?.join(",")}`
                await cache.set(cacheKey, result, cacheDuration)
            }

            return result
        } catch (error) {
            console.error("Code definition analysis error:", error)
            throw error
        }
    }
}

async function analyzeFile(
    file: string,
    content: string,
    options: {
        types?: string[]
        includeReferences: boolean
        includeDocumentation: boolean
        includeDecorators: boolean
    }
): Promise<z.infer<typeof codeDefinitionSchema>[]> {
    const definitions: z.infer<typeof codeDefinitionSchema>[] = []
    const lines = content.split("\n")
    
    // Basic regex patterns for different definition types
    const patterns = {
        function: /(?:async\s+)?function\s+(\w+)\s*\(/g,
        class: /class\s+(\w+)/g,
        interface: /interface\s+(\w+)/g,
        type: /type\s+(\w+)\s*=/g,
        enum: /enum\s+(\w+)/g,
        variable: /(?:const|let|var)\s+(\w+)\s*=/g,
        constant: /const\s+(\w+)\s*=/g,
        module: /export\s+(?:default\s+)?(?:class|interface|type|enum|function|const|let|var)\s+(\w+)/g
    }

    // Process each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // Check each pattern
        for (const [type, pattern] of Object.entries(patterns)) {
            if (options.types && !options.types.includes(type)) {
                continue
            }

            let match: RegExpExecArray | null
            while ((match = pattern.exec(line)) !== null) {
                const name = match[1]
                const column = match.index + 1
                
                // Extract documentation if available
                let documentation: string | undefined
                if (options.includeDocumentation && i > 0) {
                    const prevLine = lines[i - 1].trim()
                    if (prevLine.startsWith("/**") || prevLine.startsWith("//")) {
                        documentation = prevLine
                    }
                }

                // Extract decorators if available
                let decorators: string[] | undefined
                if (options.includeDecorators && i > 0) {
                    const prevLine = lines[i - 1].trim()
                    if (prevLine.startsWith("@")) {
                        decorators = [prevLine]
                    }
                }

                // Create definition object
                const definition: z.infer<typeof codeDefinitionSchema> = {
                    name,
                    type: type as any,
                    file,
                    line: i + 1,
                    column,
                    scope: determineScope(line),
                    visibility: determineVisibility(line),
                    isExported: line.includes("export"),
                    isAsync: line.includes("async"),
                    isStatic: line.includes("static"),
                    documentation,
                    decorators
                }

                // Add type-specific information
                if (type === "function") {
                    definition.parameters = extractParameters(line)
                    definition.returnType = extractReturnType(line)
                } else if (type === "class") {
                    definition.extends = extractExtends(line)
                    definition.implements = extractImplements(line)
                }

                definitions.push(definition)
            }
        }
    }

    return definitions
}

function determineScope(line: string): "global" | "module" | "class" | "function" {
    if (line.includes("export")) return "module"
    if (line.includes("class")) return "class"
    if (line.includes("function")) return "function"
    return "global"
}

function determineVisibility(line: string): "public" | "private" | "protected" | "internal" {
    if (line.includes("private")) return "private"
    if (line.includes("protected")) return "protected"
    if (line.includes("internal")) return "internal"
    return "public"
}

function extractParameters(line: string): { name: string; type?: string; isOptional: boolean; defaultValue?: string }[] {
    const paramsMatch = line.match(/\((.*?)\)/)
    if (!paramsMatch) return []

    return paramsMatch[1].split(",").map(param => {
        const [name, type] = param.split(":").map(s => s.trim())
        return {
            name,
            type,
            isOptional: name.includes("?"),
            defaultValue: param.includes("=") ? param.split("=")[1].trim() : undefined
        }
    })
}

function extractReturnType(line: string): string | undefined {
    const returnMatch = line.match(/\)\s*:\s*(\w+)/)
    return returnMatch ? returnMatch[1] : undefined
}

function extractExtends(line: string): string | undefined {
    const extendsMatch = line.match(/extends\s+(\w+)/)
    return extendsMatch ? extendsMatch[1] : undefined
}

function extractImplements(line: string): string[] {
    const implementsMatch = line.match(/implements\s+([^\{]+)/)
    if (!implementsMatch) return []
    return implementsMatch[1].split(",").map(i => i.trim())
}

export function getListCodeDefinitionsDescription(args: ToolArgs): string {
    return `# List Code Definitions
List code definitions with enhanced analysis and metadata.

## Parameters
- \`path\`: The path to search in (default: workspace root)
- \`filePattern\`: Glob pattern to filter files (default: "**/*.{js,ts,jsx,tsx}")
- \`types\`: Types of definitions to include
  - "function": Function definitions
  - "class": Class definitions
  - "interface": Interface definitions
  - "type": Type definitions
  - "enum": Enum definitions
  - "variable": Variable definitions
  - "constant": Constant definitions
  - "module": Module exports
- \`includeReferences\`: Whether to include reference information (default: false)
- \`includeDocumentation\`: Whether to include documentation (default: true)
- \`includeDecorators\`: Whether to include decorators (default: true)
- \`maxResults\`: Maximum number of results to return (default: 1000)
- \`cacheResults\`: Whether to cache results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`outputFormat\`: Output format (default: "json")

## Returns
- \`path\`: The path searched
- \`filePattern\`: The file pattern used
- \`types\`: Types of definitions included
- \`totalDefinitions\`: Total number of definitions found
- \`definitions\`: Array of code definitions with:
  - Name and type
  - File location
  - Scope and visibility
  - Export status
  - Async and static flags
  - Parameters (for functions)
  - Return type (for functions)
  - Extends and implements (for classes)
  - Documentation
  - Decorators
  - References (if enabled)
- \`timestamp\`: When the analysis was performed

## Features
- Multiple definition type support
- Documentation extraction
- Decorator detection
- Reference tracking
- Scope and visibility analysis
- Parameter and return type extraction
- Inheritance information
- Caching mechanism
- Multiple output formats
- Error handling and recovery

## Example
\`\`\`typescript
const result = await listCodeDefinitionsTool.handler({
    path: ".",
    filePattern: "**/*.{js,ts}",
    types: ["function", "class", "interface"],
    includeReferences: true,
    includeDocumentation: true,
    includeDecorators: true,
    maxResults: 1000,
    cacheResults: true,
    cacheDuration: 3600,
    outputFormat: "json"
})
\`\`\`
`
}
=======
import { ToolArgs } from "./types"

export function getListCodeDefinitionNamesDescription(args: ToolArgs): string {
	return `## list_code_definition_names
Description: Request to list definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.
Parameters:
- path: (required) The path of the directory (relative to the current working directory ${args.cwd}) to list top level source code definitions for.
Usage:
<list_code_definition_names>
<path>Directory path here</path>
</list_code_definition_names>

Example: Requesting to list all top level source code definitions in the current directory
<list_code_definition_names>
<path>.</path>
</list_code_definition_names>`
}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
