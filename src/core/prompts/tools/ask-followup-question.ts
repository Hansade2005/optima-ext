<<<<<<< HEAD
import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import { cache } from "../../utils/cache"

const questionSchema = z.object({
    question: z.string().describe("The question to ask the user"),
    context: z.string().optional().describe("Additional context for the question"),
    type: z.enum(["clarification", "confirmation", "preference", "technical", "business"]).optional().describe("Type of question"),
    priority: z.enum(["high", "medium", "low"]).optional().default("medium").describe("Priority of the question"),
    options: z.array(z.string()).optional().describe("Available options for the question"),
    validation: z.object({
        required: z.boolean().optional().default(true).describe("Whether the question requires an answer"),
        format: z.string().optional().describe("Expected answer format"),
        minLength: z.number().optional().describe("Minimum answer length"),
        maxLength: z.number().optional().describe("Maximum answer length")
    }).optional(),
    metadata: z.object({
        timestamp: z.string(),
        previousQuestions: z.array(z.string()).optional(),
        relatedTasks: z.array(z.string()).optional()
    }).optional()
})

const askFollowupQuestionSchema = z.object({
    question: z.string().describe("The question to ask the user"),
    context: z.string().optional().describe("Additional context for the question"),
    type: z.enum(["clarification", "confirmation", "preference", "technical", "business"]).optional().describe("Type of question"),
    priority: z.enum(["high", "medium", "low"]).optional().default("medium").describe("Priority of the question"),
    options: z.array(z.string()).optional().describe("Available options for the question"),
    validation: z.object({
        required: z.boolean().optional().default(true).describe("Whether the question requires an answer"),
        format: z.string().optional().describe("Expected answer format"),
        minLength: z.number().optional().describe("Minimum answer length"),
        maxLength: z.number().optional().describe("Maximum answer length")
    }).optional(),
    includeMetadata: z.boolean().optional().default(true).describe("Whether to include metadata"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
    outputFormat: z.enum(["json", "yaml", "markdown"]).optional().default("json").describe("Output format")
})

const CACHE_PREFIX = "question_"

export const askFollowupQuestionTool: Tool = {
    name: "ask_followup_question",
    description: "Ask followup questions with context awareness and validation",
    schema: askFollowupQuestionSchema,
    handler: async ({
        question,
        context,
        type = "clarification",
        priority = "medium",
        options,
        validation,
        includeMetadata = true,
        cacheResults = true,
        cacheDuration = 3600,
        outputFormat = "json"
    }) => {
        try {
            // Check cache first if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${question}_${type}_${priority}`
                const cachedResult = await cache.get(cacheKey)
                if (cachedResult) {
                    return cachedResult
                }
            }

            // Validate question
            await validateQuestion(question, validation)

            // Prepare question object
            const questionResult = {
                question,
                context,
                type,
                priority,
                options,
                validation,
                metadata: includeMetadata ? {
                    timestamp: new Date().toISOString(),
                    previousQuestions: [],
                    relatedTasks: []
                } : undefined
            }

            // Cache the result if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${question}_${type}_${priority}`
                await cache.set(cacheKey, questionResult, cacheDuration)
            }

            return questionResult
        } catch (error) {
            console.error("Question validation error:", error)
            throw error
        }
    }
}

async function validateQuestion(
    question: string,
    validation?: {
        required?: boolean
        format?: string
        minLength?: number
        maxLength?: number
    }
): Promise<void> {
    // Check question length
    if (validation?.minLength && question.length < validation.minLength) {
        throw new Error(`Question is too short. Minimum length is ${validation.minLength} characters.`)
    }

    if (validation?.maxLength && question.length > validation.maxLength) {
        throw new Error(`Question is too long. Maximum length is ${validation.maxLength} characters.`)
    }

    // Check question format
    if (validation?.format) {
        const formatRegex = new RegExp(validation.format)
        if (!formatRegex.test(question)) {
            throw new Error(`Question does not match required format: ${validation.format}`)
        }
    }

    // Check for required fields
    if (validation?.required && !question.trim()) {
        throw new Error("Question is required but empty")
    }

    // Check for common issues
    if (question.includes("??") || question.includes("!!")) {
        throw new Error("Question contains invalid characters")
    }

    // Check for proper punctuation
    if (!question.match(/[?]$/)) {
        throw new Error("Question should end with a question mark")
    }
}

export function getAskFollowupQuestionDescription(args: ToolArgs): string {
    return `# Ask Followup Question
Ask followup questions with context awareness and validation.

## Parameters
- \`question\`: The question to ask the user
- \`context\`: Additional context for the question
- \`type\`: Type of question
  - "clarification": For clarifying ambiguous requirements
  - "confirmation": For confirming user preferences
  - "preference": For gathering user preferences
  - "technical": For technical details
  - "business": For business requirements
- \`priority\`: Priority of the question (default: "medium")
  - "high": Critical information needed
  - "medium": Important but not critical
  - "low": Optional information
- \`options\`: Available options for the question
- \`validation\`: Validation rules for the question
  - required: Whether the question requires an answer
  - format: Expected answer format
  - minLength: Minimum answer length
  - maxLength: Maximum answer length
- \`includeMetadata\`: Whether to include metadata (default: true)
- \`cacheResults\`: Whether to cache results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`outputFormat\`: Output format (default: "json")

## Returns
- \`question\`: The question to ask
- \`context\`: Additional context
- \`type\`: Question type
- \`priority\`: Question priority
- \`options\`: Available options
- \`validation\`: Validation rules
- \`metadata\`: Additional information
  - Timestamp
  - Previous questions
  - Related tasks

## Features
- Question validation
- Context awareness
- Priority levels
- Multiple question types
- Answer format validation
- Length validation
- Caching mechanism
- Multiple output formats
- Error handling and recovery

## Example
\`\`\`typescript
const result = await askFollowupQuestionTool.handler({
    question: "What is your preferred database for this project?",
    context: "We need to choose a database that supports real-time updates",
    type: "preference",
    priority: "high",
    options: ["PostgreSQL", "MongoDB", "Redis"],
    validation: {
        required: true,
        format: "^[A-Za-z]+$",
        minLength: 3,
        maxLength: 50
    },
    includeMetadata: true,
    cacheResults: true,
    cacheDuration: 3600,
    outputFormat: "json"
})
\`\`\`
`
=======
export function getAskFollowupQuestionDescription(): string {
	return `## ask_followup_question
Description: Ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively. It allows for interactive problem-solving by enabling direct communication with the user. Use this tool judiciously to maintain a balance between gathering necessary information and avoiding excessive back-and-forth.
Parameters:
- question: (required) The question to ask the user. This should be a clear, specific question that addresses the information you need.
Usage:
<ask_followup_question>
<question>Your question here</question>
</ask_followup_question>

Example: Requesting to ask the user for the path to the frontend-config.json file
<ask_followup_question>
<question>What is the path to the frontend-config.json file?</question>
</ask_followup_question>`
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
}
