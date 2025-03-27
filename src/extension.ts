import * as vscode from "vscode"
import * as fs from "fs"
import * as path from "path"

import { ClineProvider } from "./core/webview/ClineProvider"
import { createClineAPI } from "./exports"
import "./utils/path" // Necessary to have access to String.prototype.toPosix.
import { CodeActionProvider } from "./core/CodeActionProvider"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { handleUri, registerCommands, registerCodeActions, registerTerminalActions } from "./activate"
import { McpServerManager } from "./services/mcp/McpServerManager"

/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext

// Helper function to ensure UI assets exist
async function ensureWebviewAssets(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
	const extensionPath = context.extensionUri.fsPath;
	outputChannel.appendLine(`Extension path: ${extensionPath}`);

	// Check if the build directory exists
	const webviewBuildPath = path.join(extensionPath, 'webview-ui', 'build', 'assets');
	try {
		const stats = await fs.stat(webviewBuildPath);
		if (stats.isDirectory()) {
			outputChannel.appendLine(`Webview build directory exists at: ${webviewBuildPath}`);
			// List the files in the directory
			const files = await fs.readdir(webviewBuildPath);
			outputChannel.appendLine(`Webview build assets: ${files.join(', ')}`);
		} else {
			outputChannel.appendLine(`ERROR: ${webviewBuildPath} exists but is not a directory`);
		}
	} catch (error) {
		outputChannel.appendLine(`ERROR: Webview build directory not found at ${webviewBuildPath}`);
		outputChannel.appendLine(`Error details: ${error}`);
		
		// Create the directories if they don't exist
		try {
			await fs.mkdir(webviewBuildPath, { recursive: true });
			outputChannel.appendLine(`Created webview build directory at: ${webviewBuildPath}`);
			
			// Create minimal placeholder files
			const cssContent = '/* Placeholder CSS */\nbody { font-family: system-ui; }';
			const jsContent = `
			// Placeholder JS
			window.addEventListener('load', () => {
				const vscode = acquireVsCodeApi();
				document.getElementById('root').innerHTML = '<div style="padding: 20px; text-align: center;">' +
					'<h2>Optima AI UI</h2>' +
					'<p>UI assets missing. Try reloading or reinstalling the extension.</p>' +
					'<button onclick="vscode.postMessage({type: \'reloadWebview\'})">Reload UI</button>' +
					'</div>';
			});`;
			
			await fs.writeFile(path.join(webviewBuildPath, 'index.css'), cssContent);
			await fs.writeFile(path.join(webviewBuildPath, 'index.js'), jsContent);
			outputChannel.appendLine('Created placeholder CSS and JS files');
		} catch (createError) {
			outputChannel.appendLine(`Failed to create placeholder files: ${createError}`);
		}
	}
	
	// Check for codicon files
	const codiconCssPath = path.join(extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css');
	const codiconFontPath = path.join(extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.ttf');
	
	try {
		await fs.stat(codiconCssPath);
		outputChannel.appendLine(`Codicon CSS found at: ${codiconCssPath}`);
	} catch (error) {
		outputChannel.appendLine(`WARNING: Codicon CSS not found at ${codiconCssPath}`);
	}
	
	try {
		await fs.stat(codiconFontPath);
		outputChannel.appendLine(`Codicon font found at: ${codiconFontPath}`);
	} catch (error) {
		outputChannel.appendLine(`WARNING: Codicon font not found at ${codiconFontPath}`);
	}
}

// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export function activate(context: vscode.ExtensionContext) {
	extensionContext = context
	outputChannel = vscode.window.createOutputChannel("Optima-AI")
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine("Optima-AI extension activating...")

	// Verify webview assets
	ensureWebviewAssets(context, outputChannel).catch(error => {
		outputChannel.appendLine(`Failed to verify webview assets: ${error}`)
	})

	// Get default commands from configuration.
	const defaultCommands = vscode.workspace.getConfiguration("optima-ai").get<string[]>("allowedCommands") || []

	// Initialize global state if not already set.
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}

	// Create the provider
	const provider = new ClineProvider(context, outputChannel)

	// Register the webview view provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider, {
			webviewOptions: { 
				retainContextWhenHidden: true 
			}
		})
	)

	// Add message listener for webview errors
	context.subscriptions.push(
		vscode.commands.registerCommand('optima-ai.logWebviewError', (message: string) => {
			outputChannel.appendLine(`Webview error: ${message}`)
			vscode.window.showErrorMessage(`Optima AI UI error: ${message}`)
		})
	)

	registerCommands({ context, outputChannel, provider: provider })

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
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider),
	)

	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))

	// Register code actions provider.
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ pattern: "**/*" }, new CodeActionProvider(), {
			providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
		}),
	)

	registerCodeActions(context)
	registerTerminalActions(context)

	return createClineAPI(outputChannel, provider)
}

// This method is called when your extension is deactivated
export async function deactivate() {
	outputChannel.appendLine("Optima-AI extension deactivated")
	// Clean up MCP server manager
	await McpServerManager.cleanup(extensionContext)
}
