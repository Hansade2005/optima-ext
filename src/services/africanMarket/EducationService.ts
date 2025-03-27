import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface Tutorial {
    id: string;
    title: string;
    description: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    language: string;
    content: string;
    prerequisites: string[];
    estimatedTime: number;
    tags: string[];
}

interface CodeExample {
    id: string;
    title: string;
    description: string;
    language: string;
    code: string;
    explanation: string;
    tags: string[];
}

export class EducationService {
    private static instance: EducationService;
    private context: vscode.ExtensionContext;
    private tutorials: Map<string, Tutorial> = new Map();
    private codeExamples: Map<string, CodeExample> = new Map();
    private userProgress: Map<string, {
        completedTutorials: string[];
        completedExamples: string[];
        lastAccessed: number;
    }> = new Map();

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeContent();
        this.loadUserProgress();
    }

    public static getInstance(context: vscode.ExtensionContext): EducationService {
        if (!EducationService.instance) {
            EducationService.instance = new EducationService(context);
        }
        return EducationService.instance;
    }

    private async initializeContent(): Promise<void> {
        await this.loadTutorials();
        await this.loadCodeExamples();
    }

    private async loadTutorials(): Promise<void> {
        const tutorialsPath = path.join(this.context.extensionPath, 'resources', 'tutorials');
        try {
            const files = await fs.promises.readdir(tutorialsPath);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.promises.readFile(path.join(tutorialsPath, file), 'utf8');
                    const tutorial = JSON.parse(content);
                    this.tutorials.set(tutorial.id, tutorial);
                }
            }
        } catch (error) {
            console.error('Failed to load tutorials:', error);
        }
    }

    private async loadCodeExamples(): Promise<void> {
        const examplesPath = path.join(this.context.extensionPath, 'resources', 'examples');
        try {
            const files = await fs.promises.readdir(examplesPath);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.promises.readFile(path.join(examplesPath, file), 'utf8');
                    const example = JSON.parse(content);
                    this.codeExamples.set(example.id, example);
                }
            }
        } catch (error) {
            console.error('Failed to load code examples:', error);
        }
    }

    private async loadUserProgress(): Promise<void> {
        const progressPath = path.join(this.context.globalStorageUri.fsPath, 'education_progress.json');
        try {
            if (await fs.promises.access(progressPath).then(() => true).catch(() => false)) {
                const content = await fs.promises.readFile(progressPath, 'utf8');
                const progress = JSON.parse(content);
                this.userProgress = new Map(Object.entries(progress));
            }
        } catch (error) {
            console.error('Failed to load user progress:', error);
        }
    }

    private async saveUserProgress(): Promise<void> {
        const progressPath = path.join(this.context.globalStorageUri.fsPath, 'education_progress.json');
        try {
            const progress = Object.fromEntries(this.userProgress);
            await fs.promises.writeFile(progressPath, JSON.stringify(progress));
        } catch (error) {
            console.error('Failed to save user progress:', error);
        }
    }

    public getTutorials(filters: {
        difficulty?: 'beginner' | 'intermediate' | 'advanced';
        language?: string;
        tags?: string[];
    } = {}): Tutorial[] {
        return Array.from(this.tutorials.values()).filter(tutorial => {
            if (filters.difficulty && tutorial.difficulty !== filters.difficulty) return false;
            if (filters.language && tutorial.language !== filters.language) return false;
            if (filters.tags && !filters.tags.every(tag => tutorial.tags.includes(tag))) return false;
            return true;
        });
    }

    public getCodeExamples(filters: {
        language?: string;
        tags?: string[];
    } = {}): CodeExample[] {
        return Array.from(this.codeExamples.values()).filter(example => {
            if (filters.language && example.language !== filters.language) return false;
            if (filters.tags && !filters.tags.every(tag => example.tags.includes(tag))) return false;
            return true;
        });
    }

    public async startTutorial(tutorialId: string, userId: string): Promise<Tutorial> {
        const tutorial = this.tutorials.get(tutorialId);
        if (!tutorial) {
            throw new Error(`Tutorial ${tutorialId} not found`);
        }

        // Update user progress
        const progress = this.userProgress.get(userId) || {
            completedTutorials: [],
            completedExamples: [],
            lastAccessed: Date.now()
        };

        progress.lastAccessed = Date.now();
        this.userProgress.set(userId, progress);
        await this.saveUserProgress();

        return tutorial;
    }

    public async completeTutorial(tutorialId: string, userId: string): Promise<void> {
        const progress = this.userProgress.get(userId);
        if (!progress) {
            throw new Error(`No progress found for user ${userId}`);
        }

        if (!progress.completedTutorials.includes(tutorialId)) {
            progress.completedTutorials.push(tutorialId);
            progress.lastAccessed = Date.now();
            await this.saveUserProgress();
        }
    }

    public async completeCodeExample(exampleId: string, userId: string): Promise<void> {
        const progress = this.userProgress.get(userId);
        if (!progress) {
            throw new Error(`No progress found for user ${userId}`);
        }

        if (!progress.completedExamples.includes(exampleId)) {
            progress.completedExamples.push(exampleId);
            progress.lastAccessed = Date.now();
            await this.saveUserProgress();
        }
    }

    public getUserProgress(userId: string): {
        completedTutorials: string[];
        completedExamples: string[];
        lastAccessed: number;
    } | null {
        return this.userProgress.get(userId) || null;
    }

    public getRecommendedContent(userId: string): {
        tutorials: Tutorial[];
        examples: CodeExample[];
    } {
        const progress = this.userProgress.get(userId);
        if (!progress) {
            return {
                tutorials: this.getTutorials({ difficulty: 'beginner' }),
                examples: this.getCodeExamples()
            };
        }

        // Get completed content
        const completedTutorials = new Set(progress.completedTutorials);
        const completedExamples = new Set(progress.completedExamples);

        // Get next difficulty level
        const difficultyLevels = ['beginner', 'intermediate', 'advanced'];
        const currentLevel = this.getCurrentDifficultyLevel(progress.completedTutorials);
        const nextLevel = difficultyLevels[difficultyLevels.indexOf(currentLevel) + 1] || 'advanced';

        return {
            tutorials: this.getTutorials({ difficulty: nextLevel as any })
                .filter(t => !completedTutorials.has(t.id)),
            examples: this.getCodeExamples()
                .filter(e => !completedExamples.has(e.id))
        };
    }

    private getCurrentDifficultyLevel(completedTutorials: string[]): string {
        const tutorials = completedTutorials.map(id => this.tutorials.get(id));
        const levels = tutorials.map(t => t?.difficulty || 'beginner');
        
        if (levels.includes('advanced')) return 'advanced';
        if (levels.includes('intermediate')) return 'intermediate';
        return 'beginner';
    }

    public async createTutorial(tutorial: Tutorial): Promise<void> {
        this.tutorials.set(tutorial.id, tutorial);
        const tutorialsPath = path.join(this.context.extensionPath, 'resources', 'tutorials');
        await fs.promises.writeFile(
            path.join(tutorialsPath, `${tutorial.id}.json`),
            JSON.stringify(tutorial)
        );
    }

    public async createCodeExample(example: CodeExample): Promise<void> {
        this.codeExamples.set(example.id, example);
        const examplesPath = path.join(this.context.extensionPath, 'resources', 'examples');
        await fs.promises.writeFile(
            path.join(examplesPath, `${example.id}.json`),
            JSON.stringify(example)
        );
    }

    public dispose(): void {
        this.tutorials.clear();
        this.codeExamples.clear();
        this.userProgress.clear();
    }
} 