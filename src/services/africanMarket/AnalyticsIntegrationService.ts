import * as vscode from 'vscode';
import { AnalyticsService } from './AnalyticsService';
import { AnalyticsUIService } from './AnalyticsUIService';

export class AnalyticsIntegrationService {
    private static instance: AnalyticsIntegrationService;
    private context: vscode.ExtensionContext;
    private analyticsService: AnalyticsService;
    private analyticsUIService: AnalyticsUIService;
    private disposables: vscode.Disposable[] = [];

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.analyticsService = AnalyticsService.getInstance(context);
        this.analyticsUIService = AnalyticsUIService.getInstance(context);
        this.initializeService();
    }

    public static getInstance(context: vscode.ExtensionContext): AnalyticsIntegrationService {
        if (!AnalyticsIntegrationService.instance) {
            AnalyticsIntegrationService.instance = new AnalyticsIntegrationService(context);
        }
        return AnalyticsIntegrationService.instance;
    }

    private initializeService(): void {
        // Track extension activation
        this.trackUsage('extension_activation', {
            version: this.context.extension.packageJSON.version,
            vscodeVersion: vscode.version,
            platform: process.platform,
            language: vscode.env.language
        });

        // Track command usage
        this.disposables.push(
            vscode.commands.registerCommand('roo-cline.explainCode', () => {
                this.trackUsage('command_execution', {
                    command: 'explainCode',
                    context: 'editor'
                });
            }),
            vscode.commands.registerCommand('roo-cline.fixCode', () => {
                this.trackUsage('command_execution', {
                    command: 'fixCode',
                    context: 'editor'
                });
            }),
            vscode.commands.registerCommand('roo-cline.improveCode', () => {
                this.trackUsage('command_execution', {
                    command: 'improveCode',
                    context: 'editor'
                });
            }),
            vscode.commands.registerCommand('roo-cline.addToContext', () => {
                this.trackUsage('command_execution', {
                    command: 'addToContext',
                    context: 'editor'
                });
            }),
            vscode.commands.registerCommand('roo-cline.terminalAddToContext', () => {
                this.trackUsage('command_execution', {
                    command: 'terminalAddToContext',
                    context: 'terminal'
                });
            }),
            vscode.commands.registerCommand('roo-cline.terminalFixCommand', () => {
                this.trackUsage('command_execution', {
                    command: 'terminalFixCommand',
                    context: 'terminal'
                });
            }),
            vscode.commands.registerCommand('roo-cline.terminalExplainCommand', () => {
                this.trackUsage('command_execution', {
                    command: 'terminalExplainCommand',
                    context: 'terminal'
                });
            })
        );

        // Track performance metrics
        this.setupPerformanceTracking();
    }

    private setupPerformanceTracking(): void {
        const config = vscode.workspace.getConfiguration('roo-cline.africanMarket.analytics');
        if (config.get('trackingLevel') === 'detailed' || config.get('trackingLevel') === 'full') {
            // Track memory usage
            setInterval(() => {
                const memoryUsage = process.memoryUsage();
                this.trackPerformance('memory_usage', {
                    heapUsed: memoryUsage.heapUsed,
                    heapTotal: memoryUsage.heapTotal,
                    external: memoryUsage.external
                });
            }, 60000); // Every minute

            // Track CPU usage
            let lastCpuUsage = process.cpuUsage();
            setInterval(() => {
                const currentCpuUsage = process.cpuUsage(lastCpuUsage);
                this.trackPerformance('cpu_usage', {
                    user: currentCpuUsage.user,
                    system: currentCpuUsage.system
                });
                lastCpuUsage = process.cpuUsage();
            }, 60000); // Every minute
        }
    }

    public async trackUsage(feature: string, metadata: Record<string, any> = {}): Promise<void> {
        const config = vscode.workspace.getConfiguration('roo-cline.africanMarket.analytics');
        if (!config.get('enabled')) return;

        const startTime = Date.now();
        try {
            await this.analyticsService.trackUsage({
                userId: this.getUserId(),
                region: this.getRegion(),
                language: vscode.env.language,
                feature,
                duration: 0,
                success: true,
                metadata
            });
        } catch (error) {
            await this.analyticsService.trackUsage({
                userId: this.getUserId(),
                region: this.getRegion(),
                language: vscode.env.language,
                feature,
                duration: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                metadata
            });
        }
    }

    public async trackPerformance(feature: string, metrics: Record<string, number>): Promise<void> {
        const config = vscode.workspace.getConfiguration('roo-cline.africanMarket.analytics');
        if (!config.get('enabled') || config.get('trackingLevel') === 'basic') return;

        try {
            await this.analyticsService.trackPerformance({
                userId: this.getUserId(),
                region: this.getRegion(),
                feature,
                responseTime: metrics.responseTime || 0,
                resourceUsage: {
                    cpu: metrics.cpu || 0,
                    memory: metrics.memory || 0,
                    network: metrics.network || 0
                },
                errorRate: metrics.errorRate || 0
            });
        } catch (error) {
            console.error('Failed to track performance metrics:', error);
        }
    }

    public async trackCost(feature: string, cost: number, model: string, tokens: number): Promise<void> {
        const config = vscode.workspace.getConfiguration('roo-cline.africanMarket.analytics');
        if (!config.get('enabled') || config.get('trackingLevel') !== 'full') return;

        try {
            await this.analyticsService.trackCost({
                userId: this.getUserId(),
                region: this.getRegion(),
                feature,
                cost,
                currency: 'USD',
                model,
                tokens
            });
        } catch (error) {
            console.error('Failed to track cost metrics:', error);
        }
    }

    private getUserId(): string {
        // Get or generate a unique user ID
        let userId = this.context.globalState.get<string>('roo-cline.userId');
        if (!userId) {
            userId = Math.random().toString(36).substring(2) + Date.now().toString(36);
            this.context.globalState.update('roo-cline.userId', userId);
        }
        return userId;
    }

    private getRegion(): string {
        // Get the user's region based on their language or timezone
        const language = vscode.env.language;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Map language codes to regions
        const languageToRegion: Record<string, string> = {
            'sw': 'East Africa',
            'ha': 'West Africa',
            'yo': 'West Africa',
            'am': 'East Africa',
            'zu': 'Southern Africa',
            'ar': 'North Africa',
            'fr': 'West Africa',
            'pt': 'Southern Africa',
            'en': 'South Africa'
        };

        // Try to get region from language
        const region = languageToRegion[language.split('-')[0]];
        if (region) {
            return region;
        }

        // Fallback to timezone-based region
        if (timezone.includes('Africa')) {
            if (timezone.includes('Cairo') || timezone.includes('Casablanca')) {
                return 'North Africa';
            } else if (timezone.includes('Lagos') || timezone.includes('Accra')) {
                return 'West Africa';
            } else if (timezone.includes('Nairobi') || timezone.includes('Addis_Ababa')) {
                return 'East Africa';
            } else if (timezone.includes('Johannesburg') || timezone.includes('Harare')) {
                return 'Southern Africa';
            }
        }

        // Default to unknown region
        return 'Unknown';
    }

    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.analyticsService.dispose();
        this.analyticsUIService.dispose();
    }
} 