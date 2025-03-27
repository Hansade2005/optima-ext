import { DiffStrategy } from "../../diff/DiffStrategy"
import { McpHub } from "../../../services/mcp/McpHub"
<<<<<<< HEAD
import { z } from "zod"
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856

export type ToolArgs = {
	cwd: string
	supportsComputerUse: boolean
	diffStrategy?: DiffStrategy
	browserViewportSize?: string
	mcpHub?: McpHub
	toolOptions?: any
}
<<<<<<< HEAD

export interface Tool {
	name: string
	description: string
	schema: z.ZodType<any>
	handler: (args: any) => Promise<any>
}

export interface CacheOptions {
	ttl?: number
	maxSize?: number
	strategy?: "memory" | "disk" | "distributed"
}

export interface ValidationResult {
	isValid: boolean
	errors: string[]
	warnings: string[]
	suggestions: string[]
}

export interface Metadata {
	timestamp: string
	platform: string
	version: string
	environment: string
	[key: string]: any
}

export interface ToolResult<T = any> {
	success: boolean
	data: T
	metadata: Metadata
	validation: ValidationResult
	error?: Error
}
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
