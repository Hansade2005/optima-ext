import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Translation {
    [key: string]: string;
}

export class LocalizationService {
    private static instance: LocalizationService;
    private translations: { [key: string]: Translation } = {};
    private context: vscode.ExtensionContext;
    private currentLanguage: string = 'en';

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadTranslations();
        this.setupLanguageChangeListener();
    }

    public static getInstance(context: vscode.ExtensionContext): LocalizationService {
        if (!LocalizationService.instance) {
            LocalizationService.instance = new LocalizationService(context);
        }
        return LocalizationService.instance;
    }

    private async loadTranslations(): Promise<void> {
        const languages = ['en', 'sw', 'ha', 'yo', 'am', 'zu'];
        const basePath = path.join(this.context.extensionPath, 'resources', 'translations');

        for (const lang of languages) {
            try {
                const filePath = path.join(basePath, `${lang}.json`);
                const content = await fs.promises.readFile(filePath, 'utf8');
                this.translations[lang] = JSON.parse(content);
            } catch (error) {
                console.error(`Failed to load translations for ${lang}:`, error);
                // Fallback to empty translations if file doesn't exist
                this.translations[lang] = {};
            }
        }
    }

    private setupLanguageChangeListener(): void {
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('roo-cline.africanMarket.language')) {
                const config = vscode.workspace.getConfiguration('roo-cline.africanMarket');
                this.currentLanguage = config.get('language') || 'en';
            }
        });
    }

    public translate(key: string, params: { [key: string]: string } = {}): string {
        const translation = this.translations[this.currentLanguage]?.[key] || 
                          this.translations['en']?.[key] || 
                          key;

        return this.replaceParams(translation, params);
    }

    private replaceParams(text: string, params: { [key: string]: string }): string {
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] || match;
        });
    }

    public getCurrentLanguage(): string {
        return this.currentLanguage;
    }

    public setLanguage(language: string): void {
        if (this.translations[language]) {
            this.currentLanguage = language;
            vscode.workspace.getConfiguration('roo-cline.africanMarket').update('language', language);
        }
    }

    public getAvailableLanguages(): string[] {
        return Object.keys(this.translations);
    }

    public getLanguageName(code: string): string {
        const languageNames: { [key: string]: string } = {
            'en': 'English',
            'sw': 'Swahili',
            'ha': 'Hausa',
            'yo': 'Yoruba',
            'am': 'Amharic',
            'zu': 'Zulu'
        };
        return languageNames[code] || code;
    }
} 