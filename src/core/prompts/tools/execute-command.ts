<<<<<<< HEAD
import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import { exec } from "child_process"
import { platform } from "os"
import { promisify } from "util"
import { cache } from "../../utils/cache"

const execAsync = promisify(exec)

const commandResultSchema = z.object({
    command: z.string(),
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
    duration: z.number(),
    platform: z.string(),
    timestamp: z.string()
})

const executeCommandSchema = z.object({
    command: z.string().describe("The command to execute"),
    args: z.array(z.string()).optional().describe("Command arguments"),
    cwd: z.string().optional().describe("Working directory for the command"),
    env: z.record(z.string()).optional().describe("Environment variables"),
    timeout: z.number().optional().default(30000).describe("Command timeout in milliseconds"),
    shell: z.string().optional().describe("Shell to use for command execution"),
    validateCommand: z.boolean().optional().default(true).describe("Whether to validate command before execution"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
    outputFormat: z.enum(["json", "yaml", "markdown"]).optional().default("json").describe("Output format")
})

const CACHE_PREFIX = "cmd_"

export const executeCommandTool: Tool = {
    name: "execute_command",
    description: "Execute commands with OS-specific handling and validation",
    schema: executeCommandSchema,
    handler: async ({
        command,
        args = [],
        cwd,
        env,
        timeout = 30000,
        shell,
        validateCommand = true,
        cacheResults = true,
        cacheDuration = 3600,
        outputFormat = "json"
    }) => {
        try {
            // Check cache first if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${command}_${args.join("_")}`
                const cachedResult = await cache.get(cacheKey)
                if (cachedResult) {
                    return cachedResult
                }
            }

            // Validate command if enabled
            if (validateCommand) {
                await validateCommandExecution(command, args)
            }

            // Prepare command with OS-specific handling
            const preparedCommand = prepareCommand(command, args)
            
            // Execute command
            const startTime = Date.now()
            const { stdout, stderr, exitCode } = await execAsync(preparedCommand, {
                cwd,
                env,
                timeout,
                shell: shell || getDefaultShell()
            })
            const duration = Date.now() - startTime

            const result = {
                command: preparedCommand,
                exitCode,
                stdout,
                stderr,
                duration,
                platform: platform(),
                timestamp: new Date().toISOString()
            }

            // Cache the result if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${command}_${args.join("_")}`
                await cache.set(cacheKey, result, cacheDuration)
            }

            return result
        } catch (error) {
            console.error("Command execution error:", error)
            throw error
        }
    }
}

async function validateCommandExecution(command: string, args: string[]): Promise<void> {
    // Check for dangerous commands
    const dangerousCommands = [
        "rm", "mkfs", "dd", "chmod", "chown", "sudo", "su",
        "wget", "curl", "nc", "netcat", "telnet", "ssh"
    ]

    const cmd = command.toLowerCase()
    if (dangerousCommands.some(dc => cmd.includes(dc))) {
        throw new Error(`Command "${command}" is potentially dangerous and has been blocked`)
    }

    // Check for command existence
    const checkCommand = platform() === "win32" ? "where" : "which"
    try {
        await execAsync(`${checkCommand} ${command}`)
    } catch (error) {
        throw new Error(`Command "${command}" not found`)
    }
}

function prepareCommand(command: string, args: string[]): string {
    const os = platform()
    
    // Handle Windows-specific commands
    if (os === "win32") {
        // Convert Unix-style paths to Windows paths
        const windowsArgs = args.map(arg => {
            if (arg.startsWith("/")) {
                return arg.replace(/\//g, "\\")
            }
            return arg
        })

        // Handle special commands
        if (command === "ls") return `dir ${windowsArgs.join(" ")}`
        if (command === "pwd") return "cd"
        if (command === "cp") return `copy ${windowsArgs.join(" ")}`
        if (command === "mv") return `move ${windowsArgs.join(" ")}`
        if (command === "rm") return `del ${windowsArgs.join(" ")}`
        if (command === "mkdir") return `md ${windowsArgs.join(" ")}`
        if (command === "rmdir") return `rd ${windowsArgs.join(" ")}`
        if (command === "cat") return `type ${windowsArgs.join(" ")}`
        if (command === "grep") return `findstr ${windowsArgs.join(" ")}`
        if (command === "ps") return `tasklist ${windowsArgs.join(" ")}`
        if (command === "kill") return `taskkill ${windowsArgs.join(" ")}`
    }

    // Handle Unix-specific commands
    if (os === "darwin" || os === "linux") {
        // Convert Windows-style paths to Unix paths
        const unixArgs = args.map(arg => {
            if (arg.includes("\\")) {
                return arg.replace(/\\/g, "/")
            }
            return arg
        })

        // Handle special commands
        if (command === "dir") return `ls ${unixArgs.join(" ")}`
        if (command === "copy") return `cp ${unixArgs.join(" ")}`
        if (command === "move") return `mv ${unixArgs.join(" ")}`
        if (command === "del") return `rm ${unixArgs.join(" ")}`
        if (command === "md") return `mkdir ${unixArgs.join(" ")}`
        if (command === "rd") return `rmdir ${unixArgs.join(" ")}`
        if (command === "type") return `cat ${unixArgs.join(" ")}`
        if (command === "findstr") return `grep ${unixArgs.join(" ")}`
        if (command === "tasklist") return `ps ${unixArgs.join(" ")}`
        if (command === "taskkill") return `kill ${unixArgs.join(" ")}`
    }

    // Return original command with args if no special handling needed
    return `${command} ${args.join(" ")}`
}

function getDefaultShell(): string {
    const os = platform()
    if (os === "win32") {
        return process.env.COMSPEC || "cmd.exe"
    }
    return process.env.SHELL || "/bin/sh"
}

export function getExecuteCommandDescription(args: ToolArgs): string {
    return `# Execute Command
Execute commands with OS-specific handling and validation.

## Parameters
- \`command\`: The command to execute
- \`args\`: Command arguments
- \`cwd\`: Working directory for the command
- \`env\`: Environment variables
- \`timeout\`: Command timeout in milliseconds (default: 30000)
- \`shell\`: Shell to use for command execution
- \`validateCommand\`: Whether to validate command before execution (default: true)
- \`cacheResults\`: Whether to cache results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`outputFormat\`: Output format (default: "json")

## Returns
- \`command\`: The executed command
- \`exitCode\`: Command exit code
- \`stdout\`: Command standard output
- \`stderr\`: Command standard error
- \`duration\`: Command execution duration in milliseconds
- \`platform\`: Operating system platform
- \`timestamp\`: When the command was executed

## Features
- OS-specific command handling
- Command validation
- Dangerous command blocking
- Path conversion for different OS
- Command existence checking
- Timeout handling
- Environment variable support
- Working directory support
- Caching mechanism
- Multiple output formats
- Error handling and recovery

## OS-Specific Command Mappings
### Windows to Unix
- dir → ls
- copy → cp
- move → mv
- del → rm
- md → mkdir
- rd → rmdir
- type → cat
- findstr → grep
- tasklist → ps
- taskkill → kill

### Unix to Windows
- ls → dir
- cp → copy
- mv → move
- rm → del
- mkdir → md
- rmdir → rd
- cat → type
- grep → findstr
- ps → tasklist
- kill → taskkill

## Example
\`\`\`typescript
const result = await executeCommandTool.handler({
    command: "ls",
    args: ["-la"],
    cwd: ".",
    env: { PATH: process.env.PATH },
    timeout: 30000,
    validateCommand: true,
    cacheResults: true,
    cacheDuration: 3600,
    outputFormat: "json"
})
\`\`\`
`
=======
import { ToolArgs } from "./types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	return `## execute_command
Description: Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Commands will be executed in the current working directory: ${args.cwd}
Parameters:
- command: (required) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
Usage:
<execute_command>
<command>Your command here</command>
</execute_command>

Example: Requesting to execute npm run dev
<execute_command>
<command>npm run dev</command>
</execute_command>`
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
}
