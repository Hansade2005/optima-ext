import * as vscode from "vscode";
import { ClineProvider } from "./core/webview/ClineProvider";
import { createClineAPI } from "./exports";
import "./utils/path"; // Necessary to have access to String.prototype.toPosix.
import { CodeActionProvider } from "./core/CodeActionProvider";
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider";
import { handleUri, registerCommands, registerCodeActions, registerTerminalActions } from "./activate";
import { McpServerManager } from "./services/mcp/McpServerManager";
/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */
let outputChannel;
let extensionContext;
// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export function activate(context) {
    extensionContext = context;
    outputChannel = vscode.window.createOutputChannel("Optima-AI");
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine("Optima-AI extension activated");
    // Get default commands from configuration.
    const defaultCommands = vscode.workspace.getConfiguration("optima-ai").get("allowedCommands") || [];
    // Initialize global state if not already set.
    if (!context.globalState.get("allowedCommands")) {
        context.globalState.update("allowedCommands", defaultCommands);
    }
    const sidebarProvider = new ClineProvider(context, outputChannel);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, sidebarProvider, {
        webviewOptions: { retainContextWhenHidden: true },
    }));
    registerCommands({ context, outputChannel, provider: sidebarProvider });
    /**
     * We use the text document content provider API to show the left side for diff
     * view by creating a virtual document for the original content. This makes it
     * readonly so users know to edit the right side if they want to keep their changes.
     *
     * This API allows you to create readonly documents in VSCode from arbitrary
     * sources, and works by claiming an uri-scheme for which your provider then
     * returns text contents. The scheme must be provided when registering a
     * provider and cannot change afterwards.
     *
     * Note how the provider doesn't create uris for virtual documents - its role
     * is to provide contents given such an uri. In return, content providers are
     * wired into the open document logic so that providers are always considered.
     *
     * https://code.visualstudio.com/api/extension-guides/virtual-documents
     */
    const diffContentProvider = new (class {
        provideTextDocumentContent(uri) {
            return Buffer.from(uri.query, "base64").toString("utf-8");
        }
    })();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider));
    context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }));
    // Register code actions provider.
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider({ pattern: "**/*" }, new CodeActionProvider(), {
        providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
    }));
    registerCodeActions(context);
    registerTerminalActions(context);
    return createClineAPI(outputChannel, sidebarProvider);
}
// This method is called when your extension is deactivated
export async function deactivate() {
    outputChannel.appendLine("Optima-AI extension deactivated");
    // Clean up MCP server manager
    await McpServerManager.cleanup(extensionContext);
}
//# sourceMappingURL=extension.js.map