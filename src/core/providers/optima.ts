import { GoogleGenerativeAI } from "@google/generative-ai";
import { ApiHandler, ApiHandlerOptions, ApiProvider, ModelInfo } from "../../shared/api";
import { ChatMessage, ChatResponse, ModelId } from "../../shared/types";
import { getCache } from "../../utils/cache";
import { vscode } from "../../vscode";

const CACHE_PREFIX = "optima_";
const GEMINI_API_KEY = "AIzaSyDSt3zLmaZtmJWnq8z21VFOPUpCYe_A6qA";

export class OptimaProvider implements ApiHandler {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private cache: any;
    private subscriptionStatus: {
        isActive: boolean;
        expiryDate: Date;
        isTrial: boolean;
    };

    constructor() {
        this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemma-3-27b-it" });
        this.cache = getCache();
        this.subscriptionStatus = {
            isActive: false,
            expiryDate: new Date(),
            isTrial: false
        };
    }

    async initialize(): Promise<void> {
        // Check subscription status
        const status = await this.checkSubscriptionStatus();
        if (!status.isActive) {
            throw new Error("Optima AI subscription expired. Please renew your subscription.");
        }
    }

    private async checkSubscriptionStatus(): Promise<{
        isActive: boolean;
        expiryDate: Date;
        isTrial: boolean;
    }> {
        const cachedStatus = await this.cache.get(`${CACHE_PREFIX}subscription_status`);
        if (cachedStatus) {
            return cachedStatus;
        }

        // Get user's GitHub profile
        const session = await vscode.authentication.getSession('github', ['read:user', 'user:email'], {
            createIfNone: true,
        });

        if (!session) {
            throw new Error("GitHub authentication required for Optima AI");
        }

        // Check if user is in trial period
        const firstAccessDate = await this.cache.get(`${CACHE_PREFIX}first_access_${session.account.label}`);
        if (!firstAccessDate) {
            // New user - start trial
            const trialStart = new Date();
            const trialEnd = new Date(trialStart);
            trialEnd.setDate(trialEnd.getDate() + 14); // 2 weeks trial

            const status = {
                isActive: true,
                expiryDate: trialEnd,
                isTrial: true
            };

            await this.cache.set(`${CACHE_PREFIX}first_access_${session.account.label}`, trialStart);
            await this.cache.set(`${CACHE_PREFIX}subscription_status`, status);
            return status;
        }

        // Check if trial has expired
        const trialEnd = new Date(firstAccessDate);
        trialEnd.setDate(trialEnd.getDate() + 14);
        
        if (new Date() > trialEnd) {
            const status = {
                isActive: false,
                expiryDate: trialEnd,
                isTrial: true
            };
            await this.cache.set(`${CACHE_PREFIX}subscription_status`, status);
            return status;
        }

        return {
            isActive: true,
            expiryDate: trialEnd,
            isTrial: true
        };
    }

    async chat(
        messages: ChatMessage[],
        options: ApiHandlerOptions
    ): Promise<ChatResponse> {
        if (!this.subscriptionStatus.isActive) {
            throw new Error("Optima AI subscription expired. Please renew your subscription.");
        }

        // Convert messages to Gemma format
        const prompt = messages.map(m => `${m.role}: ${m.content}`).join("\n");

        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();

            return {
                content: response,
                model: "optima-3-27b",
                usage: {
                    promptTokens: prompt.length,
                    completionTokens: response.length,
                    totalTokens: prompt.length + response.length
                }
            };
        } catch (error) {
            console.error("Optima AI chat error:", error);
            throw error;
        }
    }

    async generateImage(prompt: string): Promise<string> {
        if (!this.subscriptionStatus.isActive) {
            throw new Error("Optima AI subscription expired. Please renew your subscription.");
        }

        try {
            const result = await this.model.generateContent([
                prompt,
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: "" // Image data will be provided by the user
                    }
                }
            ]);

            return result.response.text();
        } catch (error) {
            console.error("Optima AI image generation error:", error);
            throw error;
        }
    }

    async renewSubscription(): Promise<void> {
        // Open payment page
        vscode.env.openExternal(vscode.Uri.parse("https://pay.mesomb.com/l/AS99ei9BD6QARR2tPilq"));
        
        // Show warning about minimum balance
        vscode.window.showWarningMessage(
            "⚠️ Important: Please ensure you have at least 5000 XAF in your account before proceeding with payment. " +
            "Closing the payment tab without completing the transaction will permanently block access to Optima AI."
        );
    }

    getModels(): Record<ModelId, ModelInfo> {
        return {
            "optima-3-27b": {
                maxTokens: 8192,
                contextWindow: 128_000,
                supportsImages: true,
                supportsComputerUse: true,
                supportsPromptCache: true,
                inputPrice: 0.5,
                outputPrice: 2.0,
                cacheWritesPrice: 0.5,
                cacheReadsPrice: 0.1,
                description: "Optima AI's flagship model powered by Gemma 3",
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
                    supportedLanguages: ["typescript", "javascript", "python", "java", "cpp", "rust", "go", "ruby", "php", "swift", "kotlin", "scala", "r", "matlab", "sql"],
                    languageServerProtocols: ["LSP", "DAP"],
                    responseTime: 100,
                    accuracyScore: 0.95,
                    qualityMetrics: {
                        precision: 0.92,
                        recall: 0.94,
                        f1Score: 0.93
                    }
                }
            }
        };
    }
} 