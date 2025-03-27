import * as vscode from 'vscode';
import { PaymentService } from './PaymentService';

interface PricingTier {
    id: string;
    name: string;
    description: string;
    price: {
        amount: number;
        currency: string;
    };
    features: string[];
    billingPeriod: 'monthly' | 'yearly';
    studentDiscount?: number;
    startupDiscount?: number;
    regionalDiscounts?: {
        [region: string]: number;
    };
}

interface Subscription {
    id: string;
    userId: string;
    tierId: string;
    status: 'active' | 'cancelled' | 'expired';
    startDate: number;
    endDate: number;
    autoRenew: boolean;
    paymentMethod: string;
    appliedDiscounts: {
        type: string;
        percentage: number;
    }[];
}

export class PricingService {
    private static instance: PricingService;
    private context: vscode.ExtensionContext;
    private paymentService: PaymentService;
    private pricingTiers: Map<string, PricingTier> = new Map();
    private subscriptions: Map<string, Subscription> = new Map();
    private config: {
        enabled: boolean;
        defaultCurrency: string;
        supportedCurrencies: string[];
        studentDiscountEnabled: boolean;
        startupDiscountEnabled: boolean;
        regionalPricingEnabled: boolean;
    };

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.paymentService = PaymentService.getInstance(context);
        this.config = this.loadConfig();
        this.initializePricingTiers();
        this.loadSubscriptions();
    }

    public static getInstance(context: vscode.ExtensionContext): PricingService {
        if (!PricingService.instance) {
            PricingService.instance = new PricingService(context);
        }
        return PricingService.instance;
    }

    private loadConfig() {
        const config = vscode.workspace.getConfiguration('roo-cline.africanMarket');
        return {
            enabled: config.get('pricing.enabled') || false,
            defaultCurrency: config.get('pricing.defaultCurrency') || 'USD',
            supportedCurrencies: config.get('pricing.supportedCurrencies') || ['USD', 'EUR', 'NGN', 'KES', 'ZAR'],
            studentDiscountEnabled: config.get('pricing.studentDiscountEnabled') || true,
            startupDiscountEnabled: config.get('pricing.startupDiscountEnabled') || true,
            regionalPricingEnabled: config.get('pricing.regionalPricingEnabled') || true
        };
    }

    private initializePricingTiers(): void {
        // Basic Tier
        this.addPricingTier({
            id: 'basic',
            name: 'Basic',
            description: 'Essential features for individual developers',
            price: {
                amount: 9.99,
                currency: 'USD'
            },
            features: [
                'Basic code completion',
                'Standard support',
                'Community access',
                'Basic tutorials'
            ],
            billingPeriod: 'monthly',
            studentDiscount: 0.5,
            regionalDiscounts: {
                'NGN': 0.2,
                'KES': 0.2,
                'ZAR': 0.2
            }
        });

        // Pro Tier
        this.addPricingTier({
            id: 'pro',
            name: 'Professional',
            description: 'Advanced features for professional developers',
            price: {
                amount: 29.99,
                currency: 'USD'
            },
            features: [
                'Advanced code completion',
                'Priority support',
                'Advanced tutorials',
                'Code examples',
                'Custom snippets',
                'Team collaboration'
            ],
            billingPeriod: 'monthly',
            studentDiscount: 0.5,
            startupDiscount: 0.3,
            regionalDiscounts: {
                'NGN': 0.25,
                'KES': 0.25,
                'ZAR': 0.25
            }
        });

        // Enterprise Tier
        this.addPricingTier({
            id: 'enterprise',
            name: 'Enterprise',
            description: 'Full features for teams and organizations',
            price: {
                amount: 99.99,
                currency: 'USD'
            },
            features: [
                'All Pro features',
                'Custom model training',
                'Dedicated support',
                'Advanced security',
                'SLA guarantees',
                'Custom integrations'
            ],
            billingPeriod: 'monthly',
            startupDiscount: 0.2,
            regionalDiscounts: {
                'NGN': 0.3,
                'KES': 0.3,
                'ZAR': 0.3
            }
        });
    }

    private addPricingTier(tier: PricingTier): void {
        this.pricingTiers.set(tier.id, tier);
    }

    private async loadSubscriptions(): Promise<void> {
        const subscriptionsPath = path.join(this.context.globalStorageUri.fsPath, 'subscriptions.json');
        try {
            if (await fs.promises.access(subscriptionsPath).then(() => true).catch(() => false)) {
                const content = await fs.promises.readFile(subscriptionsPath, 'utf8');
                const subscriptions = JSON.parse(content);
                this.subscriptions = new Map(Object.entries(subscriptions));
            }
        } catch (error) {
            console.error('Failed to load subscriptions:', error);
        }
    }

    private async saveSubscriptions(): Promise<void> {
        const subscriptionsPath = path.join(this.context.globalStorageUri.fsPath, 'subscriptions.json');
        try {
            const subscriptions = Object.fromEntries(this.subscriptions);
            await fs.promises.writeFile(subscriptionsPath, JSON.stringify(subscriptions));
        } catch (error) {
            console.error('Failed to save subscriptions:', error);
        }
    }

    public getPricingTiers(): PricingTier[] {
        return Array.from(this.pricingTiers.values());
    }

    public getPricingTier(tierId: string): PricingTier | null {
        return this.pricingTiers.get(tierId) || null;
    }

    public calculatePrice(
        tierId: string,
        options: {
            userId: string;
            region?: string;
            isStudent?: boolean;
            isStartup?: boolean;
            currency?: string;
        }
    ): {
        originalPrice: number;
        finalPrice: number;
        appliedDiscounts: { type: string; percentage: number }[];
    } {
        const tier = this.pricingTiers.get(tierId);
        if (!tier) {
            throw new Error(`Pricing tier ${tierId} not found`);
        }

        let finalPrice = tier.price.amount;
        const appliedDiscounts: { type: string; percentage: number }[] = [];

        // Apply regional discount
        if (this.config.regionalPricingEnabled && options.region && tier.regionalDiscounts?.[options.region]) {
            const discount = tier.regionalDiscounts[options.region];
            finalPrice *= (1 - discount);
            appliedDiscounts.push({
                type: 'regional',
                percentage: discount * 100
            });
        }

        // Apply student discount
        if (this.config.studentDiscountEnabled && options.isStudent && tier.studentDiscount) {
            finalPrice *= (1 - tier.studentDiscount);
            appliedDiscounts.push({
                type: 'student',
                percentage: tier.studentDiscount * 100
            });
        }

        // Apply startup discount
        if (this.config.startupDiscountEnabled && options.isStartup && tier.startupDiscount) {
            finalPrice *= (1 - tier.startupDiscount);
            appliedDiscounts.push({
                type: 'startup',
                percentage: tier.startupDiscount * 100
            });
        }

        return {
            originalPrice: tier.price.amount,
            finalPrice,
            appliedDiscounts
        };
    }

    public async createSubscription(
        userId: string,
        tierId: string,
        options: {
            paymentMethod: string;
            autoRenew: boolean;
            isStudent?: boolean;
            isStartup?: boolean;
            region?: string;
        }
    ): Promise<Subscription> {
        const tier = this.pricingTiers.get(tierId);
        if (!tier) {
            throw new Error(`Pricing tier ${tierId} not found`);
        }

        const price = this.calculatePrice(tierId, {
            userId,
            region: options.region,
            isStudent: options.isStudent,
            isStartup: options.isStartup
        });

        // Create subscription
        const subscription: Subscription = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            tierId,
            status: 'active',
            startDate: Date.now(),
            endDate: Date.now() + (tier.billingPeriod === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000,
            autoRenew: options.autoRenew,
            paymentMethod: options.paymentMethod,
            appliedDiscounts: price.appliedDiscounts
        };

        // Save subscription
        this.subscriptions.set(subscription.id, subscription);
        await this.saveSubscriptions();

        // Process payment
        await this.paymentService.initiatePayment(
            price.finalPrice,
            tier.price.currency,
            options.paymentMethod
        );

        return subscription;
    }

    public async cancelSubscription(subscriptionId: string): Promise<void> {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error(`Subscription ${subscriptionId} not found`);
        }

        subscription.status = 'cancelled';
        subscription.autoRenew = false;
        await this.saveSubscriptions();
    }

    public async renewSubscription(subscriptionId: string): Promise<void> {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error(`Subscription ${subscriptionId} not found`);
        }

        const tier = this.pricingTiers.get(subscription.tierId);
        if (!tier) {
            throw new Error(`Pricing tier ${subscription.tierId} not found`);
        }

        const price = this.calculatePrice(subscription.tierId, {
            userId: subscription.userId,
            isStudent: subscription.appliedDiscounts.some(d => d.type === 'student'),
            isStartup: subscription.appliedDiscounts.some(d => d.type === 'startup')
        });

        // Process payment
        await this.paymentService.initiatePayment(
            price.finalPrice,
            tier.price.currency,
            subscription.paymentMethod
        );

        subscription.status = 'active';
        subscription.startDate = Date.now();
        subscription.endDate = Date.now() + (tier.billingPeriod === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000;
        await this.saveSubscriptions();
    }

    public getSubscription(subscriptionId: string): Subscription | null {
        return this.subscriptions.get(subscriptionId) || null;
    }

    public getUserSubscriptions(userId: string): Subscription[] {
        return Array.from(this.subscriptions.values())
            .filter(sub => sub.userId === userId);
    }

    public dispose(): void {
        this.pricingTiers.clear();
        this.subscriptions.clear();
    }
} 