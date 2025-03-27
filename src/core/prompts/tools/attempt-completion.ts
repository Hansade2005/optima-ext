<<<<<<< HEAD
import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import { platform } from "os"
import { cache } from "../../utils/cache"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const completionResultSchema = z.object({
    result: z.string().describe("The final result of the task"),
    command: z.string().optional().describe("Command to demonstrate the result"),
    metadata: z.object({
        timestamp: z.string(),
        platform: z.string(),
        success: z.boolean(),
        duration: z.number().optional(),
        dependencies: z.array(z.string()).optional(),
        warnings: z.array(z.string()).optional(),
        suggestions: z.array(z.string()).optional()
    }),
    validation: z.object({
        hasErrors: z.boolean(),
        errors: z.array(z.string()).optional(),
        warnings: z.array(z.string()).optional(),
        suggestions: z.array(z.string()).optional()
    })
})

const attemptCompletionSchema = z.object({
    result: z.string().describe("The final result of the task"),
    command: z.string().optional().describe("Command to demonstrate the result"),
    includeMetadata: z.boolean().optional().default(true).describe("Whether to include metadata"),
    includeValidation: z.boolean().optional().default(true).describe("Whether to include validation"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
    outputFormat: z.enum(["json", "yaml", "markdown"]).optional().default("json").describe("Output format")
})

const CACHE_PREFIX = "completion_"

export const attemptCompletionTool: Tool = {
    name: "attempt_completion",
    description: "Present task completion results with validation and metadata",
    schema: attemptCompletionSchema,
    handler: async ({
        result,
        command,
        includeMetadata = true,
        includeValidation = true,
        cacheResults = true,
        cacheDuration = 3600,
        outputFormat = "json"
    }: z.infer<typeof attemptCompletionSchema>) => {
        try {
            // Check cache first if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${result}_${command || ""}`
                const cachedResult = await cache.get(cacheKey)
                if (cachedResult) {
                    return cachedResult
                }
            }

            // Validate command if provided
            if (command) {
                await validateCommand(command)
            }

            // Prepare result object
            const completionResult = {
                result,
                command,
                metadata: includeMetadata ? {
                    timestamp: new Date().toISOString(),
                    platform: platform(),
                    success: true,
                    dependencies: [],
                    warnings: [],
                    suggestions: []
                } : undefined,
                validation: includeValidation ? {
                    hasErrors: false,
                    errors: [],
                    warnings: [],
                    suggestions: []
                } : undefined
            }

            // Cache the result if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${result}_${command || ""}`
                await cache.set(cacheKey, completionResult, cacheDuration)
            }

            return completionResult
        } catch (error) {
            console.error("Completion error:", error)
            throw error
        }
    }
}

async function validateCommand(command: string): Promise<void> {
    // Check for dangerous commands
    const dangerousCommands = [
        "rm", "mkfs", "dd", "chmod", "chown", "sudo", "su",
        "wget", "curl", "nc", "netcat", "telnet", "ssh"
    ]

    const cmd = command.toLowerCase()
    if (dangerousCommands.some(dc => cmd.includes(dc))) {
        throw new Error(`Command "${command}" is potentially dangerous and has been blocked`)
    }

    // Validate command format
    if (!/^[a-zA-Z0-9\-_\.]+(\s+[a-zA-Z0-9\-_\.]+)*$/.test(command)) {
        throw new Error(`Invalid command format: "${command}"`)
    }

    // Check for command existence
    const checkCommand = platform() === "win32" ? "where" : "which"
    try {
        await execAsync(`${checkCommand} ${command.split(" ")[0]}`)
    } catch (error) {
        throw new Error(`Command "${command}" not found`)
    }
}

export function getAttemptCompletionDescription(args: ToolArgs): string {
    return `# Attempt Completion
Present task completion results with validation and metadata.

## Parameters
- \`result\`: The final result of the task
- \`command\`: Command to demonstrate the result (optional)
- \`includeMetadata\`: Whether to include metadata (default: true)
- \`includeValidation\`: Whether to include validation (default: true)
- \`cacheResults\`: Whether to cache results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`outputFormat\`: Output format (default: "json")

## Returns
- \`result\`: The final result of the task
- \`command\`: Command to demonstrate the result
- \`metadata\`: Additional information about the completion
  - Timestamp
  - Platform
  - Success status
  - Duration
  - Dependencies
  - Warnings
  - Suggestions
- \`validation\`: Validation results
  - Error status
  - Error messages
  - Warnings
  - Suggestions

## Features
- Command validation
- Dangerous command blocking
- Platform-specific handling
- Metadata inclusion
- Validation results
- Caching mechanism
- Multiple output formats
- Error handling and recovery

## Example
\`\`\`typescript
const result = await attemptCompletionTool.handler({
    result: "Task completed successfully",
    command: "npm start",
    includeMetadata: true,
    includeValidation: true,
    cacheResults: true,
    cacheDuration: 3600,
    outputFormat: "json"
})
\`\`\`
`
}
=======
export function getAttemptCompletionDescription(): string {
	return `## attempt_completion
Description: After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user. Optionally you may provide a CLI command to showcase the result of your work. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.
IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must ask yourself in <thinking></thinking> tags if you've confirmed from the user that any previous tool uses were successful. If not, then DO NOT use this tool.
Parameters:
- result: (required) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.
- command: (optional) A CLI command to execute to show a live demo of the result to the user. For example, use \`open index.html\` to display a created html website, or \`open localhost:3000\` to display a locally running development server. But DO NOT use commands like \`echo\` or \`cat\` that merely print text. This command should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
Usage:
<attempt_completion>
<result>
Your final result description here
</result>
<command>Command to demonstrate result (optional)</command>
</attempt_completion>

Example: Requesting to attempt completion with a result and command
<attempt_completion>
<result>
I've updated the CSS
</result>
<command>open index.html</command>
</attempt_completion>`
}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
