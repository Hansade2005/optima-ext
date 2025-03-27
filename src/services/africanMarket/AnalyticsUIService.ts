import * as vscode from 'vscode';
import { AnalyticsService } from './AnalyticsService';
import * as path from 'path';
import * as fs from 'fs';

export class AnalyticsUIService {
    private static instance: AnalyticsUIService;
    private context: vscode.ExtensionContext;
    private analyticsService: AnalyticsService;
    private webviewPanel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.analyticsService = AnalyticsService.getInstance(context);
        this.initializeCommands();
    }

    public static getInstance(context: vscode.ExtensionContext): AnalyticsUIService {
        if (!AnalyticsUIService.instance) {
            AnalyticsUIService.instance = new AnalyticsUIService(context);
        }
        return AnalyticsUIService.instance;
    }

    private initializeCommands(): void {
        // Register command to show analytics dashboard
        this.disposables.push(
            vscode.commands.registerCommand('roo-cline.showAnalytics', () => {
                this.showAnalyticsDashboard();
            })
        );

        // Register command to export analytics data
        this.disposables.push(
            vscode.commands.registerCommand('roo-cline.exportAnalytics', () => {
                this.exportAnalyticsData();
            })
        );
    }

    private async showAnalyticsDashboard(): Promise<void> {
        if (this.webviewPanel) {
            this.webviewPanel.reveal(vscode.ViewColumn.One);
            return;
        }

        this.webviewPanel = vscode.window.createWebviewPanel(
            'rooClineAnalytics',
            'Roo-Cline Analytics Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.webviewPanel.webview.html = await this.getWebviewContent();

        // Handle messages from the webview
        this.webviewPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'refreshData':
                        await this.refreshAnalyticsData();
                        break;
                    case 'exportData':
                        await this.exportAnalyticsData();
                        break;
                    case 'updateFilters':
                        await this.updateAnalyticsFilters(message.filters);
                        break;
                }
            },
            undefined,
            this.disposables
        );

        this.webviewPanel.onDidDispose(
            () => {
                this.webviewPanel = undefined;
            },
            null,
            this.disposables
        );
    }

    private async getWebviewContent(): Promise<string> {
        const analyticsData = await this.getAnalyticsData();
        const templatePath = path.join(this.context.extensionPath, 'src', 'webview-ui', 'analytics.html');
        let htmlContent = await fs.promises.readFile(templatePath, 'utf8');

        // Replace placeholders with actual data
        htmlContent = htmlContent
            .replace('${analyticsData}', JSON.stringify(analyticsData))
            .replace('${webviewCspSource}', this.webviewPanel?.webview.cspSource || '');

        return htmlContent;
    }

    private async getAnalyticsData() {
        const filters = {
            startTime: Date.now() - 30 * 24 * 60 * 60 * 1000 // Last 30 days
        };

        const metrics = this.analyticsService.getAggregatedMetrics(filters);

        return {
            usage: {
                total: metrics.usage.total,
                success: metrics.usage.success,
                failure: metrics.usage.failure,
                averageDuration: metrics.usage.averageDuration,
                byRegion: this.getMetricsByRegion('usage'),
                byFeature: this.getMetricsByFeature('usage')
            },
            performance: {
                averageResponseTime: metrics.performance.averageResponseTime,
                resourceUsage: metrics.performance.averageResourceUsage,
                errorRate: metrics.performance.errorRate,
                byRegion: this.getMetricsByRegion('performance'),
                byFeature: this.getMetricsByFeature('performance')
            },
            cost: {
                total: metrics.cost.total,
                average: metrics.cost.average,
                byModel: metrics.cost.byModel,
                byRegion: this.getMetricsByRegion('cost'),
                byFeature: this.getMetricsByFeature('cost')
            }
        };
    }

    private getMetricsByRegion(metricType: 'usage' | 'performance' | 'cost') {
        const regions = new Set<string>();
        let metrics: any[] = [];

        switch (metricType) {
            case 'usage':
                metrics = this.analyticsService.getUsageMetrics();
                break;
            case 'performance':
                metrics = this.analyticsService.getPerformanceMetrics();
                break;
            case 'cost':
                metrics = this.analyticsService.getCostMetrics();
                break;
        }

        metrics.forEach(metric => regions.add(metric.region));

        return Array.from(regions).map(region => {
            const regionMetrics = metrics.filter(m => m.region === region);
            return {
                region,
                count: regionMetrics.length,
                ...(metricType === 'usage' && {
                    success: regionMetrics.filter(m => m.success).length,
                    failure: regionMetrics.filter(m => !m.success).length,
                    averageDuration: regionMetrics.reduce((sum, m) => sum + m.duration, 0) / regionMetrics.length || 0
                }),
                ...(metricType === 'performance' && {
                    averageResponseTime: regionMetrics.reduce((sum, m) => sum + m.responseTime, 0) / regionMetrics.length || 0,
                    averageResourceUsage: {
                        cpu: regionMetrics.reduce((sum, m) => sum + m.resourceUsage.cpu, 0) / regionMetrics.length || 0,
                        memory: regionMetrics.reduce((sum, m) => sum + m.resourceUsage.memory, 0) / regionMetrics.length || 0,
                        network: regionMetrics.reduce((sum, m) => sum + m.resourceUsage.network, 0) / regionMetrics.length || 0
                    },
                    errorRate: regionMetrics.reduce((sum, m) => sum + m.errorRate, 0) / regionMetrics.length || 0
                }),
                ...(metricType === 'cost' && {
                    total: regionMetrics.reduce((sum, m) => sum + m.cost, 0),
                    average: regionMetrics.reduce((sum, m) => sum + m.cost, 0) / regionMetrics.length || 0
                })
            };
        });
    }

    private getMetricsByFeature(metricType: 'usage' | 'performance' | 'cost') {
        const features = new Set<string>();
        let metrics: any[] = [];

        switch (metricType) {
            case 'usage':
                metrics = this.analyticsService.getUsageMetrics();
                break;
            case 'performance':
                metrics = this.analyticsService.getPerformanceMetrics();
                break;
            case 'cost':
                metrics = this.analyticsService.getCostMetrics();
                break;
        }

        metrics.forEach(metric => features.add(metric.feature));

        return Array.from(features).map(feature => {
            const featureMetrics = metrics.filter(m => m.feature === feature);
            return {
                feature,
                count: featureMetrics.length,
                ...(metricType === 'usage' && {
                    success: featureMetrics.filter(m => m.success).length,
                    failure: featureMetrics.filter(m => !m.success).length,
                    averageDuration: featureMetrics.reduce((sum, m) => sum + m.duration, 0) / featureMetrics.length || 0
                }),
                ...(metricType === 'performance' && {
                    averageResponseTime: featureMetrics.reduce((sum, m) => sum + m.responseTime, 0) / featureMetrics.length || 0,
                    averageResourceUsage: {
                        cpu: featureMetrics.reduce((sum, m) => sum + m.resourceUsage.cpu, 0) / featureMetrics.length || 0,
                        memory: featureMetrics.reduce((sum, m) => sum + m.resourceUsage.memory, 0) / featureMetrics.length || 0,
                        network: featureMetrics.reduce((sum, m) => sum + m.resourceUsage.network, 0) / featureMetrics.length || 0
                    },
                    errorRate: featureMetrics.reduce((sum, m) => sum + m.errorRate, 0) / featureMetrics.length || 0
                }),
                ...(metricType === 'cost' && {
                    total: featureMetrics.reduce((sum, m) => sum + m.cost, 0),
                    average: featureMetrics.reduce((sum, m) => sum + m.cost, 0) / featureMetrics.length || 0
                })
            };
        });
    }

    private async refreshAnalyticsData(): Promise<void> {
        if (this.webviewPanel) {
            const analyticsData = await this.getAnalyticsData();
            this.webviewPanel.webview.postMessage({
                command: 'updateData',
                data: analyticsData
            });
        }
    }

    private async exportAnalyticsData(): Promise<void> {
        try {
            await this.analyticsService.exportMetrics();
            vscode.window.showInformationMessage('Analytics data exported successfully');
        } catch (error) {
            vscode.window.showErrorMessage('Failed to export analytics data');
            console.error('Failed to export analytics data:', error);
        }
    }

    private async updateAnalyticsFilters(filters: any): Promise<void> {
        await this.refreshAnalyticsData();
    }

    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        if (this.webviewPanel) {
            this.webviewPanel.dispose();
            this.webviewPanel = undefined;
        }
    }
} 