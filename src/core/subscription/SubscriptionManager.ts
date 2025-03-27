import { ExtensionContext } from "vscode"
import { cache } from "../../utils/cache"

interface SubscriptionStatus {
    isActive: boolean
    startDate: string
    endDate: string
    type: "trial" | "paid"
    lastRenewalDate?: string
}

export class SubscriptionManager {
    private static readonly TRIAL_DURATION_DAYS = 14
    private static readonly CACHE_KEY_PREFIX = "subscription_"
    private context: ExtensionContext

    constructor(context: ExtensionContext) {
        this.context = context
    }

    async initializeSubscription(userId: string): Promise<SubscriptionStatus> {
        const status = await this.getSubscriptionStatus(userId)
        if (status) {
            return status
        }

        const startDate = new Date().toISOString()
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + SubscriptionManager.TRIAL_DURATION_DAYS)

        const newStatus: SubscriptionStatus = {
            isActive: true,
            startDate,
            endDate: endDate.toISOString(),
            type: "trial"
        }

        await this.saveSubscriptionStatus(userId, newStatus)
        return newStatus
    }

    async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null> {
        const cacheKey = `${SubscriptionManager.CACHE_KEY_PREFIX}${userId}`
        const status = await cache.get<SubscriptionStatus>(cacheKey)

        if (!status) {
            return null
        }

        // Check if subscription has expired
        if (new Date(status.endDate) < new Date()) {
            status.isActive = false
            await this.saveSubscriptionStatus(userId, status)
        }

        return status
    }

    async activateSubscription(userId: string): Promise<SubscriptionStatus> {
        const status = await this.getSubscriptionStatus(userId)
        if (!status) {
            throw new Error("No subscription found for user")
        }

        const newStatus: SubscriptionStatus = {
            isActive: true,
            startDate: new Date().toISOString(),
            endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
            type: "paid",
            lastRenewalDate: new Date().toISOString()
        }

        await this.saveSubscriptionStatus(userId, newStatus)
        return newStatus
    }

    async checkSubscriptionStatus(userId: string): Promise<boolean> {
        const status = await this.getSubscriptionStatus(userId)
        return status?.isActive || false
    }

    private async saveSubscriptionStatus(userId: string, status: SubscriptionStatus): Promise<void> {
        const cacheKey = `${SubscriptionManager.CACHE_KEY_PREFIX}${userId}`
        await cache.set(cacheKey, status, 60 * 60 * 24) // Cache for 24 hours
    }

    async getDaysRemaining(userId: string): Promise<number> {
        const status = await this.getSubscriptionStatus(userId)
        if (!status || !status.isActive) {
            return 0
        }

        const endDate = new Date(status.endDate)
        const today = new Date()
        const diffTime = endDate.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        return Math.max(0, diffDays)
    }
} 