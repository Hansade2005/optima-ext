/**
 * This file contains stub types and implementations for missing exports in packages
 * Used to fix TypeScript import errors without modifying original files
 */

// Stubs for Anthropic SDK
export type TextBlock = any;
export type Usage = any;

// Stubs for Google Generative AI
export type ContentBlockParam = any;
export type TextBlockParam = any;
export type ImageBlockParam = any;
export type ToolUseBlockParam = any;
export type ToolResultBlockParam = any;
export type Base64PDFSource = any;
export type PlainTextSource = any;
export type ContentBlockSource = any;
export type Source = any;

// Add other stubs here as needed

/**
 * Helper to make TypeScript happy when a module has missing exports
 * @example
 * // First create the stub
 * const stubbedModule = createStubModule(['TextBlock', 'Usage']);
 * // Then mock the import
 * jest.mock('@anthropic-ai/sdk', () => ({
 *   ...jest.requireActual('@anthropic-ai/sdk'),
 *   ...stubbedModule
 * }));
 */
export function createStubModule(exportNames: string[]) {
  return exportNames.reduce((acc, name) => {
    acc[name] = jest.fn();
    return acc;
  }, {} as Record<string, jest.Mock>);
} 