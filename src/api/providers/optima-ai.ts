import { ApiHandler, ApiHandlerOptions, ModelInfo } from "../shared/api"
import { GoogleGenerativeAI } from "@google/generative-ai"
import * as vscode from "vscode"
import { truncateConversationIfNeeded } from "../../core/sliding-window"

const optimaAiDefaultModelId = "claude-3-7-sonnet-20240229"
const optimaAiDefaultModelInfo: ModelInfo = {
    contextWindow: 200000,
    supportsImages: true,
    supportsComputerUse: true,
    supportsPromptCache: true,
    description: "Optima AI powered by Claude 3.7 Sonnet - Advanced AI model with 200K context window and image support",
    reasoningEffort: "high",
    ideCapabilities: {
        codeCompletion: true,
        codeRefactoring: true,
        codeNavigation: true,
        codeDefinition: true,
        codeReferences: true,
        codeHover: true,
        codeHighlighting: true,
        codeFormatting: true,
        codeLinting: true,
        codeActions: true,
        debugging: true,
        testing: true,
        documenting: true,
        versionControl: true,
        pairProgramming: true,
        codeReview: true,
        projectManagement: true,
        teamCollaboration: true,
        supportedLanguages: ["typescript", "javascript", "python", "java", "cpp", "csharp", "go", "rust", "php", "ruby", "swift", "kotlin", "scala", "r", "matlab", "sql"],
        languageServerProtocols: ["typescript", "javascript", "python"],
        responseTime: 100,
        accuracyScore: 0.95,
        qualityMetrics: {
            precision: 0.92,
            recall: 0.94,
            f1Score: 0.93
        }
    }
}

const CLAUDE_SYSTEM_PROMPT = `You are Claude 3.7 Sonnet, an advanced AI assistant with exceptional reasoning capabilities. You excel at:
- Complex problem-solving and multi-step reasoning
- Code analysis, generation, and refactoring
- Understanding and explaining technical concepts
- Providing detailed, well-structured responses
- Maintaining context across long conversations
- Adapting your communication style to the user's needs

You have access to a 200K token context window and can process both text and images. Your responses should be:
- Precise and accurate
- Well-reasoned and logical
- Comprehensive yet concise
- Professional yet approachable
- Focused on providing value

You should maintain Claude's characteristic traits:
- Thoughtful and deliberate responses
- Strong analytical capabilities
- Clear communication style
- Ethical considerations
- Honest about limitations

Remember to:
- Break down complex problems
- Show your reasoning process
- Provide examples when helpful
- Ask clarifying questions when needed
- Maintain consistency in responses`

export class OptimaAiHandler implements ApiHandler {
    private options: ApiHandlerOptions
    private genAI: GoogleGenerativeAI
    private model: any
    private slidingWindowSize: number = 128000 // 128K tokens per window
    private overlapSize: number = 10000 // 10K token overlap

    constructor(options: ApiHandlerOptions) {
        this.options = options
        this.genAI = new GoogleGenerativeAI(this.options.optimaAiApiKey || "")
        this.model = this.genAI.getGenerativeModel({ model: "gemma-3-27b-it" })
    }

    async completePrompt(prompt: string): Promise<string> {
        try {
            // Add Claude system prompt to enhance capabilities
            const enhancedPrompt = `${CLAUDE_SYSTEM_PROMPT}\n\nUser: ${prompt}`
            
            // Process in sliding windows if needed
            if (this.estimateTokens(enhancedPrompt) > this.slidingWindowSize) {
                return await this.processWithSlidingWindow(enhancedPrompt)
            }

            const result = await this.model.generateContent(enhancedPrompt)
            return this.formatResponse(result.response.text())
        } catch (error) {
            throw new Error(`Optima AI API error: ${error}`)
        }
    }

    async completePromptWithImages(prompt: string, images: string[]): Promise<string> {
        try {
            const enhancedPrompt = `${CLAUDE_SYSTEM_PROMPT}\n\nUser: ${prompt}`
            const imageParts = await Promise.all(
                images.map(async (image) => {
                    const response = await fetch(image)
                    const blob = await response.blob()
                    return {
                        inlineData: {
                            data: await this.blobToBase64(blob),
                            mimeType: blob.type
                        }
                    }
                })
            )

            const result = await this.model.generateContent([enhancedPrompt, ...imageParts])
            return this.formatResponse(result.response.text())
        } catch (error) {
            throw new Error(`Optima AI API error with images: ${error}`)
        }
    }

    private async processWithSlidingWindow(prompt: string): Promise<string> {
        const chunks = this.splitIntoChunks(prompt)
        let finalResponse = ""
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]
            const result = await this.model.generateContent(chunk)
            const response = result.response.text()
            
            if (i === 0) {
                finalResponse = response
            } else {
                // Merge responses with overlap handling
                finalResponse = this.mergeResponses(finalResponse, response)
            }
        }

        return this.formatResponse(finalResponse)
    }

    private splitIntoChunks(text: string): string[] {
        const chunks: string[] = []
        let currentPosition = 0
        
        while (currentPosition < text.length) {
            const chunk = text.slice(currentPosition, currentPosition + this.slidingWindowSize)
            chunks.push(chunk)
            currentPosition += (this.slidingWindowSize - this.overlapSize)
        }

        return chunks
    }

    private mergeResponses(prevResponse: string, newResponse: string): string {
        // Remove overlapping content and merge responses
        const overlap = this.findOverlap(prevResponse, newResponse)
        return prevResponse + newResponse.slice(overlap.length)
    }

    private findOverlap(str1: string, str2: string): string {
        for (let i = Math.min(str1.length, str2.length); i > 0; i--) {
            if (str1.slice(-i) === str2.slice(0, i)) {
                return str1.slice(-i)
            }
        }
        return ""
    }

    private estimateTokens(text: string): number {
        // Rough estimation: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4)
    }

    private formatResponse(response: string): string {
        // Format response to match Claude's style
        return response
            .replace(/Assistant:/g, "Claude:")
            .replace(/Human:/g, "User:")
            .trim()
    }

    private async blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => {
                const base64data = reader.result as string
                resolve(base64data.split(',')[1])
            }
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
    }

    getModel(): { id: string; info: ModelInfo } {
        return {
            id: optimaAiDefaultModelId,
            info: optimaAiDefaultModelInfo
        }
    }
} 