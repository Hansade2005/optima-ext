import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ModelInfo {
    name: string;
    path: string;
    size: number;
    lastUsed: number;
    quantization: string;
    threads: number;
    gpuLayers: number;
}

export class LocalModelService {
    private static instance: LocalModelService;
    private context: vscode.ExtensionContext;
    private models: Map<string, ModelInfo> = new Map();
    private config: {
        useLocalModels: boolean;
        modelPath: string;
        quantization: string;
        threads: number;
        gpuLayers: number;
    };

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = this.loadConfig();
        this.setupConfigListener();
        this.initializeModels();
    }

    public static getInstance(context: vscode.ExtensionContext): LocalModelService {
        if (!LocalModelService.instance) {
            LocalModelService.instance = new LocalModelService(context);
        }
        return LocalModelService.instance;
    }

    private loadConfig() {
        const config = vscode.workspace.getConfiguration('roo-cline.africanMarket');
        return {
            useLocalModels: config.get('useLocalModels') || false,
            modelPath: this.getDefaultModelPath(),
            quantization: 'int8',
            threads: this.getOptimalThreadCount(),
            gpuLayers: this.getOptimalGpuLayers()
        };
    }

    private setupConfigListener(): void {
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('roo-cline.africanMarket')) {
                this.config = this.loadConfig();
                this.initializeModels();
            }
        });
    }

    private getDefaultModelPath(): string {
        const platform = process.platform;
        const basePath = this.context.globalStorageUri.fsPath;
        return path.join(basePath, 'models', platform);
    }

    private getOptimalThreadCount(): number {
        const cpuCount = require('os').cpus().length;
        return Math.max(1, Math.floor(cpuCount * 0.75));
    }

    private getOptimalGpuLayers(): number {
        // This is a placeholder - implement actual GPU detection
        return 0;
    }

    private async initializeModels(): Promise<void> {
        if (!this.config.useLocalModels) return;

        try {
            await this.ensureModelDirectory();
            await this.scanModels();
        } catch (error) {
            console.error('Failed to initialize models:', error);
        }
    }

    private async ensureModelDirectory(): Promise<void> {
        const modelPath = this.config.modelPath;
        if (!await fs.promises.access(modelPath).then(() => true).catch(() => false)) {
            await fs.promises.mkdir(modelPath, { recursive: true });
        }
    }

    private async scanModels(): Promise<void> {
        const modelPath = this.config.modelPath;
        try {
            const files = await fs.promises.readdir(modelPath);
            for (const file of files) {
                if (file.endsWith('.bin') || file.endsWith('.gguf')) {
                    const fullPath = path.join(modelPath, file);
                    const stats = await fs.promises.stat(fullPath);
                    const modelName = path.basename(file, path.extname(file));

                    this.models.set(modelName, {
                        name: modelName,
                        path: fullPath,
                        size: stats.size,
                        lastUsed: stats.mtimeMs,
                        quantization: this.config.quantization,
                        threads: this.config.threads,
                        gpuLayers: this.config.gpuLayers
                    });
                }
            }
        } catch (error) {
            console.error('Failed to scan models:', error);
        }
    }

    public async downloadModel(modelName: string, url: string): Promise<void> {
        if (!this.config.useLocalModels) {
            throw new Error('Local models are not enabled');
        }

        const modelPath = path.join(this.config.modelPath, `${modelName}.bin`);
        const downloadCommand = `curl -L "${url}" -o "${modelPath}"`;

        try {
            await execAsync(downloadCommand);
            await this.scanModels();
        } catch (error) {
            console.error(`Failed to download model ${modelName}:`, error);
            throw error;
        }
    }

    public async quantizeModel(modelName: string, targetQuantization: string = 'int8'): Promise<void> {
        const model = this.models.get(modelName);
        if (!model) {
            throw new Error(`Model ${modelName} not found`);
        }

        // This is a placeholder - implement actual quantization logic
        // You would typically use a tool like llama.cpp or similar
        console.log(`Quantizing model ${modelName} to ${targetQuantization}`);
    }

    public getModelInfo(modelName: string): ModelInfo | null {
        return this.models.get(modelName) || null;
    }

    public getAvailableModels(): string[] {
        return Array.from(this.models.keys());
    }

    public async optimizeModel(modelName: string): Promise<void> {
        const model = this.models.get(modelName);
        if (!model) {
            throw new Error(`Model ${modelName} not found`);
        }

        // Implement model optimization logic
        // This could include:
        // 1. Quantization
        // 2. Thread optimization
        // 3. GPU layer optimization
        // 4. Memory optimization
        console.log(`Optimizing model ${modelName}`);
    }

    public async cleanupUnusedModels(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
        const now = Date.now();
        for (const [name, model] of this.models.entries()) {
            if (now - model.lastUsed > maxAge) {
                try {
                    await fs.promises.unlink(model.path);
                    this.models.delete(name);
                } catch (error) {
                    console.error(`Failed to delete unused model ${name}:`, error);
                }
            }
        }
    }

    public dispose(): void {
        this.models.clear();
    }
} 