import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface UsageMetrics {
    timestamp: number;
    userId: string;
    region: string;
    language: string;
    feature: string;
    duration: number;
    success: boolean;
    error?: string;
    metadata?: Record<string, any>;
}

interface PerformanceMetrics {
    timestamp: number;
    userId: string;
    region: string;
    feature: string;
    responseTime: number;
    resourceUsage: {
        cpu: number;
        memory: number;
        network: number;
    };
    errorRate: number;
}

interface CostMetrics {
    timestamp: number;
    userId: string;
    region: string;
    feature: string;
    cost: number;
    currency: string;
    model: string;
    tokens: number;
}

export class AnalyticsService {
    private static instance: AnalyticsService;
    private context: vscode.ExtensionContext;
    private config: {
        enabled: boolean;
        trackingLevel: 'basic' | 'detailed' | 'full';
        retentionPeriod: number;
        autoExport: boolean;
        exportInterval: number;
    };
    private usageMetrics: UsageMetrics[] = [];
    private performanceMetrics: PerformanceMetrics[] = [];
    private costMetrics: CostMetrics[] = [];
    private exportTimer: NodeJS.Timer | null = null;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = this.loadConfig();
        this.initializeService();
    }

    public static getInstance(context: vscode.ExtensionContext): AnalyticsService {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService(context);
        }
        return AnalyticsService.instance;
    }

    private loadConfig() {
        const config = vscode.workspace.getConfiguration('roo-cline.africanMarket');
        return {
            enabled: config.get('analytics.enabled') || false,
            trackingLevel: config.get('analytics.trackingLevel') || 'basic',
            retentionPeriod: config.get('analytics.retentionPeriod') || 30 * 24 * 60 * 60 * 1000, // 30 days
            autoExport: config.get('analytics.autoExport') || true,
            exportInterval: config.get('analytics.exportInterval') || 24 * 60 * 60 * 1000 // 24 hours
        };
    }

    private async initializeService(): Promise<void> {
        if (!this.config.enabled) return;

        await this.loadMetrics();
        this.setupExportTimer();
        this.cleanupOldMetrics();
    }

    private async loadMetrics(): Promise<void> {
        const metricsPath = path.join(this.context.globalStorageUri.fsPath, 'analytics');
        try {
            // Load usage metrics
            const usagePath = path.join(metricsPath, 'usage.json');
            if (await fs.promises.access(usagePath).then(() => true).catch(() => false)) {
                const usageContent = await fs.promises.readFile(usagePath, 'utf8');
                this.usageMetrics = JSON.parse(usageContent);
            }

            // Load performance metrics
            const performancePath = path.join(metricsPath, 'performance.json');
            if (await fs.promises.access(performancePath).then(() => true).catch(() => false)) {
                const performanceContent = await fs.promises.readFile(performancePath, 'utf8');
                this.performanceMetrics = JSON.parse(performanceContent);
            }

            // Load cost metrics
            const costPath = path.join(metricsPath, 'cost.json');
            if (await fs.promises.access(costPath).then(() => true).catch(() => false)) {
                const costContent = await fs.promises.readFile(costPath, 'utf8');
                this.costMetrics = JSON.parse(costContent);
            }
        } catch (error) {
            console.error('Failed to load analytics metrics:', error);
        }
    }

    private setupExportTimer(): void {
        if (this.config.autoExport) {
            this.exportTimer = setInterval(() => {
                this.exportMetrics();
            }, this.config.exportInterval);
        }
    }

    private async cleanupOldMetrics(): Promise<void> {
        const cutoff = Date.now() - this.config.retentionPeriod;

        this.usageMetrics = this.usageMetrics.filter(m => m.timestamp >= cutoff);
        this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp >= cutoff);
        this.costMetrics = this.costMetrics.filter(m => m.timestamp >= cutoff);

        await this.saveMetrics();
    }

    private async saveMetrics(): Promise<void> {
        const metricsPath = path.join(this.context.globalStorageUri.fsPath, 'analytics');
        try {
            await fs.promises.mkdir(metricsPath, { recursive: true });

            // Save usage metrics
            await fs.promises.writeFile(
                path.join(metricsPath, 'usage.json'),
                JSON.stringify(this.usageMetrics)
            );

            // Save performance metrics
            await fs.promises.writeFile(
                path.join(metricsPath, 'performance.json'),
                JSON.stringify(this.performanceMetrics)
            );

            // Save cost metrics
            await fs.promises.writeFile(
                path.join(metricsPath, 'cost.json'),
                JSON.stringify(this.costMetrics)
            );
        } catch (error) {
            console.error('Failed to save analytics metrics:', error);
        }
    }

    public async trackUsage(metrics: Omit<UsageMetrics, 'timestamp'>): Promise<void> {
        if (!this.config.enabled) return;

        const usageMetric: UsageMetrics = {
            ...metrics,
            timestamp: Date.now()
        };

        this.usageMetrics.push(usageMetric);
        await this.saveMetrics();
    }

    public async trackPerformance(metrics: Omit<PerformanceMetrics, 'timestamp'>): Promise<void> {
        if (!this.config.enabled || this.config.trackingLevel === 'basic') return;

        const performanceMetric: PerformanceMetrics = {
            ...metrics,
            timestamp: Date.now()
        };

        this.performanceMetrics.push(performanceMetric);
        await this.saveMetrics();
    }

    public async trackCost(metrics: Omit<CostMetrics, 'timestamp'>): Promise<void> {
        if (!this.config.enabled || this.config.trackingLevel !== 'full') return;

        const costMetric: CostMetrics = {
            ...metrics,
            timestamp: Date.now()
        };

        this.costMetrics.push(costMetric);
        await this.saveMetrics();
    }

    public async exportMetrics(): Promise<void> {
        if (!this.config.enabled) return;

        try {
            const exportPath = path.join(this.context.globalStorageUri.fsPath, 'analytics_exports');
            await fs.promises.mkdir(exportPath, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const exportFile = path.join(exportPath, `analytics_${timestamp}.json`);

            const exportData = {
                usage: this.usageMetrics,
                performance: this.performanceMetrics,
                cost: this.costMetrics,
                exportTimestamp: Date.now()
            };

            await fs.promises.writeFile(exportFile, JSON.stringify(exportData));
        } catch (error) {
            console.error('Failed to export analytics metrics:', error);
        }
    }

    public getUsageMetrics(filters: {
        userId?: string;
        region?: string;
        feature?: string;
        startTime?: number;
        endTime?: number;
    } = {}): UsageMetrics[] {
        return this.usageMetrics.filter(metric => {
            if (filters.userId && metric.userId !== filters.userId) return false;
            if (filters.region && metric.region !== filters.region) return false;
            if (filters.feature && metric.feature !== filters.feature) return false;
            if (filters.startTime && metric.timestamp < filters.startTime) return false;
            if (filters.endTime && metric.timestamp > filters.endTime) return false;
            return true;
        });
    }

    public getPerformanceMetrics(filters: {
        userId?: string;
        region?: string;
        feature?: string;
        startTime?: number;
        endTime?: number;
    } = {}): PerformanceMetrics[] {
        return this.performanceMetrics.filter(metric => {
            if (filters.userId && metric.userId !== filters.userId) return false;
            if (filters.region && metric.region !== filters.region) return false;
            if (filters.feature && metric.feature !== filters.feature) return false;
            if (filters.startTime && metric.timestamp < filters.startTime) return false;
            if (filters.endTime && metric.timestamp > filters.endTime) return false;
            return true;
        });
    }

    public getCostMetrics(filters: {
        userId?: string;
        region?: string;
        feature?: string;
        startTime?: number;
        endTime?: number;
    } = {}): CostMetrics[] {
        return this.costMetrics.filter(metric => {
            if (filters.userId && metric.userId !== filters.userId) return false;
            if (filters.region && metric.region !== filters.region) return false;
            if (filters.feature && metric.feature !== filters.feature) return false;
            if (filters.startTime && metric.timestamp < filters.startTime) return false;
            if (filters.endTime && metric.timestamp > filters.endTime) return false;
            return true;
        });
    }

    public getAggregatedMetrics(filters: {
        userId?: string;
        region?: string;
        feature?: string;
        startTime?: number;
        endTime?: number;
    } = {}): {
        usage: {
            total: number;
            success: number;
            failure: number;
            averageDuration: number;
        };
        performance: {
            averageResponseTime: number;
            averageResourceUsage: {
                cpu: number;
                memory: number;
                network: number;
            };
            errorRate: number;
        };
        cost: {
            total: number;
            average: number;
            byModel: Record<string, number>;
        };
    } {
        const usageMetrics = this.getUsageMetrics(filters);
        const performanceMetrics = this.getPerformanceMetrics(filters);
        const costMetrics = this.getCostMetrics(filters);

        return {
            usage: {
                total: usageMetrics.length,
                success: usageMetrics.filter(m => m.success).length,
                failure: usageMetrics.filter(m => !m.success).length,
                averageDuration: usageMetrics.reduce((sum, m) => sum + m.duration, 0) / usageMetrics.length || 0
            },
            performance: {
                averageResponseTime: performanceMetrics.reduce((sum, m) => sum + m.responseTime, 0) / performanceMetrics.length || 0,
                averageResourceUsage: {
                    cpu: performanceMetrics.reduce((sum, m) => sum + m.resourceUsage.cpu, 0) / performanceMetrics.length || 0,
                    memory: performanceMetrics.reduce((sum, m) => sum + m.resourceUsage.memory, 0) / performanceMetrics.length || 0,
                    network: performanceMetrics.reduce((sum, m) => sum + m.resourceUsage.network, 0) / performanceMetrics.length || 0
                },
                errorRate: performanceMetrics.reduce((sum, m) => sum + m.errorRate, 0) / performanceMetrics.length || 0
            },
            cost: {
                total: costMetrics.reduce((sum, m) => sum + m.cost, 0),
                average: costMetrics.reduce((sum, m) => sum + m.cost, 0) / costMetrics.length || 0,
                byModel: costMetrics.reduce((acc, m) => {
                    acc[m.model] = (acc[m.model] || 0) + m.cost;
                    return acc;
                }, {} as Record<string, number>)
            }
        };
    }

    public dispose(): void {
        if (this.exportTimer) {
            clearInterval(this.exportTimer);
            this.exportTimer = null;
        }
        this.usageMetrics = [];
        this.performanceMetrics = [];
        this.costMetrics = [];
    }
} 