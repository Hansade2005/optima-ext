import * as vscode from "vscode"
import delay from "delay"

import { ClineProvider } from "../core/webview/ClineProvider"

export type RegisterCommandOptions = {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	provider: ClineProvider
}

export const registerCommands = (options: RegisterCommandOptions) => {
	const { context, outputChannel } = options

	for (const [command, callback] of Object.entries(getCommandsMap(options))) {
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

const getCommandsMap = ({ context, outputChannel, provider }: RegisterCommandOptions) => {
	return {
		"optima-ai.plusButtonClicked": async () => {
			await provider.clearTask()
			await provider.postStateToWebview()
			await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		},
		"optima-ai.mcpButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
		},
		"optima-ai.promptsButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
		},
		"optima-ai.popoutButtonClicked": () => openClineInNewTab({ context, outputChannel }),
		"optima-ai.openInNewTab": () => openClineInNewTab({ context, outputChannel }),
		"optima-ai.settingsButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		},
		"optima-ai.historyButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
		},
	}
}

const openClineInNewTab = async ({ context, outputChannel }: Omit<RegisterCommandOptions, "provider">) => {
	outputChannel.appendLine("Opening Optima AI in secondary sidebar")

	// Create the panel in the secondary side bar (ViewColumn.Beside)
	const panel = vscode.window.createWebviewPanel(
		ClineProvider.tabPanelId, 
		"Optima AI", 
		vscode.ViewColumn.Beside, 
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [context.extensionUri],
		}
	)

	// TODO: use better svg icon with light and dark variants (see
	// https://stackoverflow.com/questions/58365687/vscode-extension-iconpath).
	panel.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "rocket.png"),
		dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "rocket.png"),
	}

	const tabProvider = new ClineProvider(context, outputChannel)
	await tabProvider.resolveWebviewView(panel)
}
