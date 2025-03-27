import { ExtensionContext } from "vscode"
import { SubscriptionManager } from "../subscription/SubscriptionManager"
import { ApiConfiguration } from "../../shared/api"

export class SubscriptionCheckMiddleware {
    private subscriptionManager: SubscriptionManager
    private context: ExtensionContext

    constructor(context: ExtensionContext) {
        this.context = context
        this.subscriptionManager = new SubscriptionManager(context)
    }

    async checkSubscription(config: ApiConfiguration): Promise<boolean> {
        if (config.apiProvider !== "optima-ai") {
            return true
        }

        const userId = this.getUserId()
        const status = await this.subscriptionManager.checkSubscriptionStatus(userId)
        
        if (!status) {
            const daysRemaining = await this.subscriptionManager.getDaysRemaining(userId)
            if (daysRemaining === 0) {
                await this.showSubscriptionPrompt()
                return false
            }
        }

        return true
    }

    private getUserId(): string {
        // Get a unique identifier for the user
        // This could be from VS Code's machine ID or a custom identifier
        return this.context.globalState.get<string>("userId") || 
               this.context.extensionContext.machineId
    }

    private async showSubscriptionPrompt(): Promise<void> {
        const subscriptionUrl = this.context.globalState.get<string>("optima-ai.subscriptionUrl")
        const message = "Your Optima AI trial has expired. Please subscribe to continue using the service."
        
        const result = await vscode.window.showInformationMessage(
            message,
            "Subscribe Now",
            "Cancel"
        )

        if (result === "Subscribe Now" && subscriptionUrl) {
            vscode.env.openExternal(vscode.Uri.parse(subscriptionUrl))
        }
    }

    async initializeTrial(userId: string): Promise<void> {
        await this.subscriptionManager.initializeSubscription(userId)
    }

    async activateSubscription(userId: string): Promise<void> {
        await this.subscriptionManager.activateSubscription(userId)
    }
} 