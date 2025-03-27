export interface ApiHandlerOptions {
    optimaAiApiKey?: string
    baseUrl?: string
    maxRetries?: number
    timeout?: number
}

export interface ModelInfo {
    contextWindow: number
    supportsImages: boolean
    supportsComputerUse: boolean
    supportsPromptCache: boolean
    description: string
    reasoningEffort: string
    ideCapabilities: {
        codeCompletion: boolean
        codeRefactoring: boolean
        codeNavigation: boolean
        codeDefinition: boolean
        codeReferences: boolean
        codeHover: boolean
        codeHighlighting: boolean
        codeFormatting: boolean
        codeLinting: boolean
        codeActions: boolean
        debugging: boolean
        testing: boolean
        documenting: boolean
        versionControl: boolean
        pairProgramming: boolean
        codeReview: boolean
        projectManagement: boolean
        teamCollaboration: boolean
        supportedLanguages: string[]
        languageServerProtocols: string[]
        responseTime: number
        accuracyScore: number
        qualityMetrics: {
            precision: number
            recall: number
            f1Score: number
        }
    }
}

export interface ApiHandler {
    completePrompt(prompt: string): Promise<string>
    completePromptWithImages(prompt: string, images: string[]): Promise<string>
    getModel(): { id: string; info: ModelInfo }
} 