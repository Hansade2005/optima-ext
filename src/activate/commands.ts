import * as vscode from "vscode"

import { ClineProvider } from "../core/webview/ClineProvider"
import { checkpointType, diffService, createDiffForCurrentFile, diffForSelection } from "../integrations/editor/diff"
import { ExtensionActivationParams } from "./types"

export function registerCommands({ context, outputChannel, provider }: ExtensionActivationParams) {
	// Used by the SidebarWebiew toolbar buttons
	context.subscriptions.push(
		vscode.commands.registerCommand(`${ClineProvider.sideBarId}.focus`, () => {
			// Implemented by vscode when you register a viewProvider
			// Execute `workbench.view.extension.optima-ai-ActivityBar` for focus sidebar
			return vscode.commands.executeCommand("workbench.view.extension.optima-ai-ActivityBar")
		}),
	)

	// Command to reload the webview if it fails to load properly
	context.subscriptions.push(
		vscode.commands.registerCommand("optima-ai.reloadWebview", async () => {
			outputChannel.appendLine("Reloading webview...")
			
			// Clear any existing state
			await provider.clearTask()
			
			// Try to dispose and recreate the webview
			try {
				// Force the webview to reload by closing and reopening the view
				await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
				await vscode.commands.executeCommand("workbench.view.extension.optima-ai-ActivityBar")
				
				// Wait a bit and try to reveal the view
				setTimeout(async () => {
					await vscode.commands.executeCommand(`${ClineProvider.sideBarId}.focus`)
					vscode.window.showInformationMessage("Optima AI UI has been reloaded")
				}, 500)
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to reload Optima AI UI: ${error}`)
				outputChannel.appendLine(`Error reloading webview: ${error}`)
			}
		})
	)

	// This command can be programmatically invoked, but we don't need to expose it to the command palette
	// Command is defined in package.json
	context.subscriptions.push(
		vscode.commands.registerCommand("optima-ai.openInNewTab", async (task?: string) => {
			return provider.resolveWebviewPanel(task)
		}),
	)

	// Command registered by a button on the toolbar in package.json
	context.subscriptions.push(
		vscode.commands.registerCommand("optima-ai.plusButtonClicked", async () => {
			// Clear existing task
			await provider.clearTask()
			provider.log("Plus button clicked")
			return provider.postMessageToWebview({ type: "action", action: "plusButtonClicked" })
		}),
	)

	// These commands are referenced in registerCodeActions, so they need to be defined
	context.subscriptions.push(
		vscode.commands.registerCommand("optima-ai.explainCode", async (data: Record<string, any>) => {
			await provider.clearTask()
			return ClineProvider.handleCodeAction("optima-ai.explainCode", "EXPLAIN", data)
		}),
	)
} 