import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';

interface CacheEntry {
    data: any;
    timestamp: number;
    size: number;
}

export class PerformanceService {
    private static instance: PerformanceService;
    private context: vscode.ExtensionContext;
    private cache: Map<string, CacheEntry> = new Map();
    private config: {
        cacheResponses: boolean;
        cacheSizeLimit: number;
        preloadCommonQueries: boolean;
    };
    private currentCacheSize: number = 0;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = this.loadConfig();
        this.setupConfigListener();
        this.initializeCache();
    }

    public static getInstance(context: vscode.ExtensionContext): PerformanceService {
        if (!PerformanceService.instance) {
            PerformanceService.instance = new PerformanceService(context);
        }
        return PerformanceService.instance;
    }

    private loadConfig() {
        const config = vscode.workspace.getConfiguration('roo-cline.performance');
        return {
            cacheResponses: config.get('cacheResponses') || true,
            cacheSizeLimit: config.get('cacheSizeLimit') || 100,
            preloadCommonQueries: config.get('preloadCommonQueries') || true
        };
    }

    private setupConfigListener(): void {
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('roo-cline.performance')) {
                this.config = this.loadConfig();
                this.cleanCache();
            }
        });
    }

    private async initializeCache(): Promise<void> {
        const cachePath = this.getCachePath();
        try {
            if (await fs.promises.access(cachePath).then(() => true).catch(() => false)) {
                const cacheData = await fs.promises.readFile(cachePath, 'utf8');
                const parsedCache = JSON.parse(cacheData);
                this.cache = new Map(Object.entries(parsedCache));
                this.calculateCurrentCacheSize();
            }
        } catch (error) {
            console.error('Failed to initialize cache:', error);
        }
    }

    private getCachePath(): string {
        return path.join(this.context.globalStorageUri.fsPath, 'cache.json');
    }

    private calculateCurrentCacheSize(): void {
        this.currentCacheSize = Array.from(this.cache.values())
            .reduce((total, entry) => total + entry.size, 0);
    }

    public async cacheResponse(key: string, data: any): Promise<void> {
        if (!this.config.cacheResponses) return;

        const entry: CacheEntry = {
            data,
            timestamp: Date.now(),
            size: JSON.stringify(data).length
        };

        // Check if we need to clean cache before adding new entry
        if (this.currentCacheSize + entry.size > this.config.cacheSizeLimit * 1024 * 1024) {
            await this.cleanCache();
        }

        this.cache.set(key, entry);
        this.currentCacheSize += entry.size;
        await this.persistCache();
    }

    public getCachedResponse(key: string): any | null {
        if (!this.config.cacheResponses) return null;

        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if entry is expired (24 hours)
        if (Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) {
            this.cache.delete(key);
            this.currentCacheSize -= entry.size;
            this.persistCache();
            return null;
        }

        return entry.data;
    }

    private async cleanCache(): Promise<void> {
        // Remove oldest entries until we're under the size limit
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);

        while (this.currentCacheSize > this.config.cacheSizeLimit * 1024 * 1024 && entries.length > 0) {
            const [key, entry] = entries.shift()!;
            this.cache.delete(key);
            this.currentCacheSize -= entry.size;
        }

        await this.persistCache();
    }

    private async persistCache(): Promise<void> {
        try {
            const cachePath = this.getCachePath();
            const cacheData = Object.fromEntries(this.cache);
            await fs.promises.writeFile(cachePath, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Failed to persist cache:', error);
        }
    }

    public async optimizeForLowBandwidth(data: any): Promise<any> {
        // Implement low bandwidth optimizations
        if (typeof data === 'string') {
            // Compress text data
            return this.compressText(data);
        } else if (typeof data === 'object') {
            // Remove unnecessary whitespace and optimize JSON
            return JSON.parse(JSON.stringify(data));
        }
        return data;
    }

    private compressText(text: string): string {
        // Remove extra whitespace and newlines
        return text.replace(/\s+/g, ' ').trim();
    }

    public generateCacheKey(input: any): string {
        const stringified = JSON.stringify(input);
        return createHash('md5').update(stringified).digest('hex');
    }

    public dispose(): void {
        this.cache.clear();
        this.currentCacheSize = 0;
    }
} 