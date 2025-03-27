import * as vscode from "vscode"
<<<<<<< HEAD
=======
import * as fs from "fs"
import * as path from "path"
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856

import { ClineProvider } from "./core/webview/ClineProvider"
import { createClineAPI } from "./exports"
import "./utils/path" // Necessary to have access to String.prototype.toPosix.
import { CodeActionProvider } from "./core/CodeActionProvider"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { handleUri, registerCommands, registerCodeActions, registerTerminalActions } from "./activate"
import { McpServerManager } from "./services/mcp/McpServerManager"
<<<<<<< HEAD
import { AnalyticsIntegrationService } from './services/africanMarket/AnalyticsIntegrationService'
import { AccountWebviewProvider } from './webview/AccountWebviewProvider'
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856

/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext

<<<<<<< HEAD
// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export async function activate(context: vscode.ExtensionContext) {
	extensionContext = context
	outputChannel = vscode.window.createOutputChannel("Roo-Code")
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine("Roo-Code extension activated")

	// Get default commands from configuration.
	const config = vscode.workspace.getConfiguration("roo-cline")
	const defaultCommands = config.get<string[]>("defaultCommands") || []

	// Initialize analytics services
	const analyticsIntegration = AnalyticsIntegrationService.getInstance(context)
	context.subscriptions.push(analyticsIntegration)

	// Initialize MCP server manager
	const mcpServerManager = new McpServerManager(context)
	context.subscriptions.push(mcpServerManager)

	// Create Cline API
	const clineAPI = await createClineAPI(context)

	// Register providers
	const sidebarProvider = new ClineProvider(context, outputChannel)
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, sidebarProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)

	registerCommands({ context, outputChannel, provider: sidebarProvider })
=======
// Helper function to ensure UI assets exist
async function ensureWebviewAssets(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
	const extensionPath = context.extensionUri.fsPath;
	outputChannel.appendLine(`Extension path: ${extensionPath}`);

	// Check if the build directory exists
	const webviewBuildPath = path.join(extensionPath, 'webview-ui', 'build', 'assets');
	try {
		// Use fs/promises for modern async file system operations
		const fsPromises = fs.promises;
		
		try {
			const stats = await fsPromises.stat(webviewBuildPath);
			if (stats.isDirectory()) {
				outputChannel.appendLine(`Webview build directory exists at: ${webviewBuildPath}`);
				// List the files in the directory
				const files = await fsPromises.readdir(webviewBuildPath);
				outputChannel.appendLine(`Webview build assets: ${files.join(', ')}`);
			}
		} catch (error) {
			outputChannel.appendLine(`ERROR: Webview build directory not found at ${webviewBuildPath}`);
			
			// Create the directories if they don't exist
			try {
				await fsPromises.mkdir(webviewBuildPath, { recursive: true });
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
						'<button onclick="vscode.postMessage({type: \\'reloadWebview\\'})">Reload UI</button>' +
						'</div>';
				});`;
				
				await fsPromises.writeFile(path.join(webviewBuildPath, 'index.css'), cssContent);
				await fsPromises.writeFile(path.join(webviewBuildPath, 'index.js'), jsContent);
				outputChannel.appendLine('Created placeholder CSS and JS files');
			} catch (createError) {
				outputChannel.appendLine(`Failed to create placeholder files: ${createError}`);
			}
		}
	} catch (error) {
		outputChannel.appendLine(`General error checking assets: ${error}`);
	}
	
	// Check for codicon files
	const codiconCssPath = path.join(extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css');
	const codiconFontPath = path.join(extensionPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.ttf');
	
	try {
		await fs.promises.stat(codiconCssPath);
		outputChannel.appendLine(`Codicon CSS found at: ${codiconCssPath}`);
	} catch (error) {
		outputChannel.appendLine(`WARNING: Codicon CSS not found at ${codiconCssPath}`);
	}
	
	try {
		await fs.promises.stat(codiconFontPath);
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
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856

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
<<<<<<< HEAD
			const content = uri.query
			return decodeURIComponent(content)
=======
			return Buffer.from(uri.query, "base64").toString("utf-8")
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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

<<<<<<< HEAD
	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('roo-cline.explainCode', async () => {
			const editor = vscode.window.activeTextEditor
			if (!editor) {
				vscode.window.showErrorMessage('No active editor')
				return
			}

			const selection = editor.selection
			const text = editor.document.getText(selection)
			if (!text) {
				vscode.window.showErrorMessage('No text selected')
				return
			}

			await sidebarProvider.explainCode(text)
		}),
		vscode.commands.registerCommand('roo-cline.fixCode', async () => {
			const editor = vscode.window.activeTextEditor
			if (!editor) {
				vscode.window.showErrorMessage('No active editor')
				return
			}

			const selection = editor.selection
			const text = editor.document.getText(selection)
			if (!text) {
				vscode.window.showErrorMessage('No text selected')
				return
			}

			await sidebarProvider.fixCode(text)
		}),
		vscode.commands.registerCommand('roo-cline.improveCode', async () => {
			const editor = vscode.window.activeTextEditor
			if (!editor) {
				vscode.window.showErrorMessage('No active editor')
				return
			}

			const selection = editor.selection
			const text = editor.document.getText(selection)
			if (!text) {
				vscode.window.showErrorMessage('No text selected')
				return
			}

			await sidebarProvider.improveCode(text)
		}),
		vscode.commands.registerCommand('roo-cline.addToContext', async () => {
			const editor = vscode.window.activeTextEditor
			if (!editor) {
				vscode.window.showErrorMessage('No active editor')
				return
			}

			const selection = editor.selection
			const text = editor.document.getText(selection)
			if (!text) {
				vscode.window.showErrorMessage('No text selected')
				return
			}

			await sidebarProvider.addToContext(text)
		}),
		vscode.commands.registerCommand('roo-cline.terminalAddToContext', async () => {
			const terminal = vscode.window.activeTerminal
			if (!terminal) {
				vscode.window.showErrorMessage('No active terminal')
				return
			}

			await sidebarProvider.addTerminalToContext(terminal)
		}),
		vscode.commands.registerCommand('roo-cline.terminalFixCommand', async () => {
			const terminal = vscode.window.activeTerminal
			if (!terminal) {
				vscode.window.showErrorMessage('No active terminal')
				return
			}

			await sidebarProvider.fixTerminalCommand(terminal)
		}),
		vscode.commands.registerCommand('roo-cline.terminalExplainCommand', async () => {
			const terminal = vscode.window.activeTerminal
			if (!terminal) {
				vscode.window.showErrorMessage('No active terminal')
				return
			}

			await sidebarProvider.explainTerminalCommand(terminal)
		}),
		vscode.commands.registerCommand('roo-cline.terminalFixCommandInCurrentTask', async () => {
			const terminal = vscode.window.activeTerminal
			if (!terminal) {
				vscode.window.showErrorMessage('No active terminal')
				return
			}

			await sidebarProvider.fixTerminalCommandInCurrentTask(terminal)
		}),
		vscode.commands.registerCommand('roo-cline.terminalExplainCommandInCurrentTask', async () => {
			const terminal = vscode.window.activeTerminal
			if (!terminal) {
				vscode.window.showErrorMessage('No active terminal')
				return
			}

			await sidebarProvider.explainTerminalCommandInCurrentTask(terminal)
		})
	)

	// Register Account Webview Provider
	const accountProvider = new AccountWebviewProvider(context.extensionUri, context)
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			AccountWebviewProvider.viewType,
			accountProvider
		)
	)

	// Show secondary sidebar by default
	await vscode.commands.executeCommand('workbench.action.togglePanelPosition', 'right')
	await vscode.commands.executeCommand('workbench.action.togglePanelVisibility', true)

	// Register toggle command
	let disposable = vscode.commands.registerCommand('roo-cline.toggleSidebar', async () => {
		const panel = vscode.window.createWebviewPanel(
			'roo-cline-sidebar',
			'Roo-Cline',
			vscode.ViewColumn.Two,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		)

		// Set the webview's initial html content
		panel.webview.html = accountProvider.getHtmlContent()

		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(async (message) => {
			switch (message.command) {
				case 'getAccountData':
					// Handle account data request
					break
				case 'githubLogin':
					// Handle GitHub login
					break
				case 'renewSubscription':
					// Handle subscription renewal
					break
			}
		})

		// Show the panel
		panel.reveal(vscode.ViewColumn.Two)
	})

	context.subscriptions.push(disposable)

	// Add toggle button to status bar
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
	statusBarItem.text = "$(rocket) Roo-Cline"
	statusBarItem.tooltip = "Toggle Roo-Cline Sidebar"
	statusBarItem.command = 'roo-cline.toggleSidebar'
	statusBarItem.show()

	return createClineAPI(outputChannel, sidebarProvider)
=======
	return createClineAPI(outputChannel, provider)
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
}

// This method is called when your extension is deactivated
export async function deactivate() {
<<<<<<< HEAD
	outputChannel.appendLine("Roo-Code extension deactivated")
=======
	outputChannel.appendLine("Optima-AI extension deactivated")
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
	// Clean up MCP server manager
	await McpServerManager.cleanup(extensionContext)
}
