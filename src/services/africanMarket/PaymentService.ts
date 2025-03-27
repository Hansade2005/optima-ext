import * as vscode from 'vscode';
import axios from 'axios';

interface PaymentConfig {
    enabled: boolean;
    providers: {
        mobileMoney: boolean;
        localBanks: boolean;
        crypto: boolean;
    };
    defaultProvider: string;
    supportedCurrencies: string[];
}

interface PaymentProvider {
    name: string;
    type: 'mobile_money' | 'local_bank' | 'crypto';
    supportedCurrencies: string[];
    fees: {
        percentage: number;
        fixed: number;
    };
    requiresVerification: boolean;
}

export class PaymentService {
    private static instance: PaymentService;
    private context: vscode.ExtensionContext;
    private config: PaymentConfig;
    private providers: Map<string, PaymentProvider> = new Map();

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = this.loadConfig();
        this.initializeProviders();
    }

    public static getInstance(context: vscode.ExtensionContext): PaymentService {
        if (!PaymentService.instance) {
            PaymentService.instance = new PaymentService(context);
        }
        return PaymentService.instance;
    }

    private loadConfig(): PaymentConfig {
        const config = vscode.workspace.getConfiguration('roo-cline.africanMarket');
        return {
            enabled: config.get('payment.enabled') || false,
            providers: {
                mobileMoney: config.get('payment.providers.mobileMoney') || true,
                localBanks: config.get('payment.providers.localBanks') || true,
                crypto: config.get('payment.providers.crypto') || false
            },
            defaultProvider: config.get('payment.defaultProvider') || 'mobile_money',
            supportedCurrencies: config.get('payment.supportedCurrencies') || ['USD', 'EUR', 'NGN', 'KES', 'ZAR']
        };
    }

    private initializeProviders(): void {
        // Mobile Money Providers
        if (this.config.providers.mobileMoney) {
            this.addProvider({
                name: 'M-Pesa',
                type: 'mobile_money',
                supportedCurrencies: ['KES', 'TZS', 'UGX'],
                fees: { percentage: 0.01, fixed: 0 },
                requiresVerification: true
            });

            this.addProvider({
                name: 'MTN Mobile Money',
                type: 'mobile_money',
                supportedCurrencies: ['GHS', 'UGX', 'ZMW'],
                fees: { percentage: 0.01, fixed: 0 },
                requiresVerification: true
            });
        }

        // Local Bank Providers
        if (this.config.providers.localBanks) {
            this.addProvider({
                name: 'Access Bank',
                type: 'local_bank',
                supportedCurrencies: ['NGN'],
                fees: { percentage: 0.015, fixed: 100 },
                requiresVerification: true
            });

            this.addProvider({
                name: 'Standard Bank',
                type: 'local_bank',
                supportedCurrencies: ['ZAR', 'NGN', 'KES'],
                fees: { percentage: 0.015, fixed: 100 },
                requiresVerification: true
            });
        }

        // Crypto Providers
        if (this.config.providers.crypto) {
            this.addProvider({
                name: 'Bitcoin',
                type: 'crypto',
                supportedCurrencies: ['BTC'],
                fees: { percentage: 0.01, fixed: 0 },
                requiresVerification: false
            });

            this.addProvider({
                name: 'USDT',
                type: 'crypto',
                supportedCurrencies: ['USDT'],
                fees: { percentage: 0.01, fixed: 0 },
                requiresVerification: false
            });
        }
    }

    private addProvider(provider: PaymentProvider): void {
        this.providers.set(provider.name, provider);
    }

    public async initiatePayment(
        amount: number,
        currency: string,
        providerName: string = this.config.defaultProvider
    ): Promise<string> {
        if (!this.config.enabled) {
            throw new Error('Payments are not enabled');
        }

        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Payment provider ${providerName} not found`);
        }

        if (!provider.supportedCurrencies.includes(currency)) {
            throw new Error(`Currency ${currency} not supported by provider ${providerName}`);
        }

        // Calculate fees
        const fees = this.calculateFees(amount, provider);
        const totalAmount = amount + fees;

        // Generate payment reference
        const paymentRef = this.generatePaymentReference();

        // Log payment attempt
        await this.logPaymentAttempt({
            reference: paymentRef,
            amount,
            currency,
            fees,
            provider: providerName,
            timestamp: Date.now()
        });

        // Return payment instructions based on provider type
        return this.getPaymentInstructions(provider, totalAmount, paymentRef);
    }

    private calculateFees(amount: number, provider: PaymentProvider): number {
        return (amount * provider.fees.percentage) + provider.fees.fixed;
    }

    private generatePaymentReference(): string {
        return `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private async logPaymentAttempt(payment: any): Promise<void> {
        // Implement payment logging logic
        console.log('Payment attempt:', payment);
    }

    private getPaymentInstructions(provider: PaymentProvider, amount: number, reference: string): string {
        switch (provider.type) {
            case 'mobile_money':
                return this.getMobileMoneyInstructions(provider, amount, reference);
            case 'local_bank':
                return this.getLocalBankInstructions(provider, amount, reference);
            case 'crypto':
                return this.getCryptoInstructions(provider, amount, reference);
            default:
                throw new Error(`Unsupported provider type: ${provider.type}`);
        }
    }

    private getMobileMoneyInstructions(provider: PaymentProvider, amount: number, reference: string): string {
        return `Please follow these steps to complete your payment:
1. Open your ${provider.name} app
2. Select "Send Money"
3. Enter the amount: ${amount}
4. Enter the reference: ${reference}
5. Confirm the transaction`;
    }

    private getLocalBankInstructions(provider: PaymentProvider, amount: number, reference: string): string {
        return `Please follow these steps to complete your payment:
1. Log in to your ${provider.name} account
2. Select "Transfer"
3. Enter the amount: ${amount}
4. Enter the reference: ${reference}
5. Confirm the transaction`;
    }

    private getCryptoInstructions(provider: PaymentProvider, amount: number, reference: string): string {
        return `Please follow these steps to complete your payment:
1. Send ${amount} ${provider.supportedCurrencies[0]} to the following address
2. Include the reference: ${reference} in the transaction memo
3. Wait for blockchain confirmation`;
    }

    public async verifyPayment(reference: string): Promise<boolean> {
        // Implement payment verification logic
        // This would typically involve checking with the payment provider's API
        return true;
    }

    public getAvailableProviders(): string[] {
        return Array.from(this.providers.keys());
    }

    public getProviderInfo(providerName: string): PaymentProvider | null {
        return this.providers.get(providerName) || null;
    }

    public dispose(): void {
        this.providers.clear();
    }
} 