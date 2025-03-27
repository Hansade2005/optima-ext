import { Anthropic } from "@anthropic-ai/sdk"
import delay from "delay"
import axios from "axios"
import fs from "fs/promises"
import os from "os"
import pWaitFor from "p-wait-for"
import * as path from "path"
import * as vscode from "vscode"
import simpleGit from "simple-git"

import { buildApiHandler } from "../../api"
import { downloadTask } from "../../integrations/misc/export-markdown"
import { openFile, openImage } from "../../integrations/misc/open-file"
import { selectImages } from "../../integrations/misc/process-images"
import { getTheme } from "../../integrations/theme/getTheme"
import { getDiffStrategy } from "../diff/DiffStrategy"
import WorkspaceTracker from "../../integrations/workspace/WorkspaceTracker"
import { McpHub } from "../../services/mcp/McpHub"
import { ApiConfiguration, ApiProvider, ModelInfo } from "../../shared/api"
import { findLast } from "../../shared/array"
import { ApiConfigMeta, ExtensionMessage } from "../../shared/ExtensionMessage"
import { HistoryItem } from "../../shared/HistoryItem"
import { checkoutDiffPayloadSchema, checkoutRestorePayloadSchema, WebviewMessage } from "../../shared/WebviewMessage"
import { Mode, CustomModePrompts, PromptComponent, defaultModeSlug } from "../../shared/modes"
import { SYSTEM_PROMPT } from "../prompts/system"
import { fileExistsAtPath } from "../../utils/fs"
import { Cline } from "../Cline"
import { openMention } from "../mentions"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { playSound, setSoundEnabled, setSoundVolume } from "../../utils/sound"
import { checkExistKey } from "../../shared/checkExistApiConfig"
import { singleCompletionHandler } from "../../utils/single-completion-handler"
import { searchCommits } from "../../utils/git"
import { ConfigManager } from "../config/ConfigManager"
import { CustomModesManager } from "../config/CustomModesManager"
import { EXPERIMENT_IDS, experiments as Experiments, experimentDefault, ExperimentId } from "../../shared/experiments"
import { CustomSupportPrompts, supportPrompt } from "../../shared/support-prompt"

import { ACTION_NAMES } from "../CodeActionProvider"
import { McpServerManager } from "../../services/mcp/McpServerManager"

/*
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/blob/main/default/weather-webview/src/providers/WeatherViewProvider.ts

https://github.com/KumarVariable/vscode-extension-sidebar-html/blob/master/src/customSidebarViewProvider.ts
*/

type SecretKey =
	| "apiKey"
	| "glamaApiKey"
	| "openRouterApiKey"
	| "awsAccessKey"
	| "awsSecretKey"
	| "awsSessionToken"
	| "openAiApiKey"
	| "geminiApiKey"
	| "openAiNativeApiKey"
	| "deepSeekApiKey"
	| "mistralApiKey"
	| "unboundApiKey"
	| "requestyApiKey"
type GlobalStateKey =
	| "apiProvider"
	| "apiModelId"
	| "glamaModelId"
	| "glamaModelInfo"
	| "awsRegion"
	| "awsUseCrossRegionInference"
	| "awsProfile"
	| "awsUseProfile"
	| "vertexProjectId"
	| "vertexRegion"
	| "lastShownAnnouncementId"
	| "customInstructions"
	| "alwaysAllowReadOnly"
	| "alwaysAllowWrite"
	| "alwaysAllowExecute"
	| "alwaysAllowBrowser"
	| "alwaysAllowMcp"
	| "alwaysAllowModeSwitch"
	| "taskHistory"
	| "openAiBaseUrl"
	| "openAiModelId"
	| "openAiCustomModelInfo"
	| "openAiUseAzure"
	| "ollamaModelId"
	| "ollamaBaseUrl"
	| "lmStudioModelId"
	| "lmStudioBaseUrl"
	| "anthropicBaseUrl"
	| "azureApiVersion"
	| "openAiStreamingEnabled"
	| "openRouterModelId"
	| "openRouterModelInfo"
	| "openRouterBaseUrl"
	| "openRouterUseMiddleOutTransform"
	| "allowedCommands"
	| "soundEnabled"
	| "soundVolume"
	| "diffEnabled"
	| "checkpointsEnabled"
	| "browserViewportSize"
	| "screenshotQuality"
	| "fuzzyMatchThreshold"
	| "preferredLanguage" // Language setting for Cline's communication
	| "writeDelayMs"
	| "terminalOutputLineLimit"
	| "mcpEnabled"
	| "enableMcpServerCreation"
	| "alwaysApproveResubmit"
	| "requestDelaySeconds"
	| "rateLimitSeconds"
	| "currentApiConfigName"
	| "listApiConfigMeta"
	| "vsCodeLmModelSelector"
	| "mode"
	| "modeApiConfigs"
	| "customModePrompts"
	| "customSupportPrompts"
	| "enhancementApiConfigId"
	| "experiments" // Map of experiment IDs to their enabled state
	| "autoApprovalEnabled"
	| "customModes" // Array of custom modes
	| "unboundModelId"
	| "requestyModelId"
	| "requestyModelInfo"
	| "unboundModelInfo"
	| "modelTemperature"

export const GlobalFileNames = {
	apiConversationHistory: "api_conversation_history.json",
	uiMessages: "ui_messages.json",
	glamaModels: "glama_models.json",
	openRouterModels: "openrouter_models.json",
	requestyModels: "requesty_models.json",
	mcpSettings: "cline_mcp_settings.json",
	unboundModels: "unbound_models.json",
}

export class ClineProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = "optima-ai.SidebarProvider" // used in package.json as the view's id
	public static readonly tabPanelId = "optima-ai.TabPanelProvider"
	private static activeInstances: Set<ClineProvider> = new Set()
	private disposables: vscode.Disposable[] = []
	private view?: vscode.WebviewView | vscode.WebviewPanel
	private isViewLaunched = false
	private cline?: Cline
	private workspaceTracker?: WorkspaceTracker
	protected mcpHub?: McpHub // Change from private to protected
	private latestAnnouncementId = "jan-21-2025-custom-modes" // update to some unique identifier when we add a new announcement
	configManager: ConfigManager
	customModesManager: CustomModesManager

	constructor(
		readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel,
	) {
		this.outputChannel.appendLine("ClineProvider instantiated")
		ClineProvider.activeInstances.add(this)
		this.workspaceTracker = new WorkspaceTracker(this)
		this.configManager = new ConfigManager(this.context)
		this.customModesManager = new CustomModesManager(this.context, async () => {
			await this.postStateToWebview()
		})

		// Initialize MCP Hub through the singleton manager
		McpServerManager.getInstance(this.context, this)
			.then((hub) => {
				this.mcpHub = hub
			})
			.catch((error) => {
				this.outputChannel.appendLine(`Failed to initialize MCP Hub: ${error}`)
			})
	}

	/*
	VSCode extensions use the disposable pattern to clean up resources when the sidebar/editor tab is closed by the user or system. This applies to event listening, commands, interacting with the UI, etc.
	- https://vscode-docs.readthedocs.io/en/stable/extensions/patterns-and-principles/
	- https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	*/
	async dispose() {
		this.outputChannel.appendLine("Disposing ClineProvider...")
		await this.clearTask()
		this.outputChannel.appendLine("Cleared task")
		if (this.view && "dispose" in this.view) {
			this.view.dispose()
			this.outputChannel.appendLine("Disposed webview")
		}
		while (this.disposables.length) {
			const x = this.disposables.pop()
			if (x) {
				x.dispose()
			}
		}
		this.workspaceTracker?.dispose()
		this.workspaceTracker = undefined
		this.mcpHub?.dispose()
		this.mcpHub = undefined
		this.customModesManager?.dispose()
		this.outputChannel.appendLine("Disposed all disposables")
		ClineProvider.activeInstances.delete(this)

		// Unregister from McpServerManager
		McpServerManager.unregisterProvider(this)
	}

	public static getVisibleInstance(): ClineProvider | undefined {
		return findLast(Array.from(this.activeInstances), (instance) => instance.view?.visible === true)
	}

	public static async getInstance(): Promise<ClineProvider | undefined> {
		let visibleProvider = ClineProvider.getVisibleInstance()

		// If no visible provider, try to show the sidebar view
		if (!visibleProvider) {
			await vscode.commands.executeCommand("optima-ai.SidebarProvider.focus")
			// Wait briefly for the view to become visible
			await delay(100)
			visibleProvider = ClineProvider.getVisibleInstance()
		}

		// If still no visible provider, return
		if (!visibleProvider) {
			return
		}

		return visibleProvider
	}

	public static async isActiveTask(): Promise<boolean> {
		const visibleProvider = await ClineProvider.getInstance()
		if (!visibleProvider) {
			return false
		}

		if (visibleProvider.cline) {
			return true
		}

		return false
	}

	/**
	 * Static handler for code actions
	 */
	public static async handleCodeAction(commandId: string, action: string, data: Record<string, any>) {
		console.log(`Code action: ${commandId}, ${action}`, data);
		
		// Find active instance to handle this code action
		if (ClineProvider.activeInstances.size === 0) {
			vscode.window.showWarningMessage("No active provider instance found to handle code action");
			return;
		}
		
		// Get the first active instance
		const instance = ClineProvider.activeInstances.values().next().value;
		if (!instance) {
			console.error("No active provider instance available");
			return;
		}
		
		// Log action
		instance.log(`Handling code action: ${action}`);
		
		// Send to webview
		instance.postMessageToWebview({
			type: "codeAction",
			action,
			data
		});
		
		// Focus the view
		vscode.commands.executeCommand(`${ClineProvider.sideBarId}.focus`);
	}

	public static async handleTerminalAction(
		command: string,
		promptType: "TERMINAL_ADD_TO_CONTEXT" | "TERMINAL_FIX" | "TERMINAL_EXPLAIN",
		params: Record<string, string | any[]>,
	): Promise<void> {
		const visibleProvider = await ClineProvider.getInstance()
		if (!visibleProvider) {
			return
		}

		const { customSupportPrompts } = await visibleProvider.getState()

		const prompt = supportPrompt.create(promptType, params, customSupportPrompts)

		if (command.endsWith("AddToContext")) {
			await visibleProvider.postMessageToWebview({
				type: "invoke",
				invoke: "setChatBoxMessage",
				text: prompt,
			})
			return
		}

		if (visibleProvider.cline && command.endsWith("InCurrentTask")) {
			await visibleProvider.postMessageToWebview({
				type: "invoke",
				invoke: "sendMessage",
				text: prompt,
			})
			return
		}

		await visibleProvider.initClineWithTask(prompt)
	}

	async resolveWebviewView(webviewView: vscode.WebviewView) {
		this.view = webviewView

		// Configure webview options
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri]
		}

		// Set up listeners for view state changes
		webviewView.onDidChangeVisibility(() => {
			this.log(`Webview visibility changed. Visible: ${webviewView.visible}`)
			
			if (webviewView.visible) {
				// Notify webview that it's visible (can help with focus issues)
				this.postMessageToWebview({ type: "viewVisible", visible: true })
			}
		})

		// Set up webview HTML content
		webviewView.webview.html = this.getHtmlContent(webviewView.webview)

		// Set up message listener from webview -> extension
		this.setWebviewMessageListener(webviewView.webview)

		// Track view initialization state
		this.isViewLaunched = true
		
		// Send initial state to webview when it's ready
		webviewView.webview.onDidReceiveMessage(async (message) => {
			if (message.type === "webviewDidLaunch") {
				// First message from webview - it's ready to receive data
				this.log("Webview launched successfully")
				
				// Send current state to webview
				await this.postStateToWebview()
			}
		})
	}

	/**
	 * Create a new webview panel (external window view)
	 */
	async resolveWebviewPanel(initialTask?: string) {
		this.log(`Creating webview panel, initialTask: ${initialTask}`);
		
		// Create a panel
		const panel = vscode.window.createWebviewPanel(
			ClineProvider.tabPanelId,
			'Optima AI',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [this.context.extensionUri]
			}
		);
		
		// Set the panel's HTML content
		panel.webview.html = this.getHtmlContent(panel.webview);
		
		// Set up message listener
		this.setWebviewMessageListener(panel.webview);
		
		// Return the panel
		return panel;
	}

	public async initClineWithTask(task?: string, images?: string[]) {
		await this.clearTask()
		const {
			apiConfiguration,
			customModePrompts,
			diffEnabled,
			checkpointsEnabled,
			fuzzyMatchThreshold,
			mode,
			customInstructions: globalInstructions,
			experiments,
		} = await this.getState()

		const modePrompt = customModePrompts?.[mode] as PromptComponent
		const effectiveInstructions = [globalInstructions, modePrompt?.customInstructions].filter(Boolean).join("\n\n")

		this.cline = new Cline(
			this,
			apiConfiguration,
			effectiveInstructions,
			diffEnabled,
			checkpointsEnabled,
			fuzzyMatchThreshold,
			task,
			images,
			undefined,
			experiments,
		)
	}

	public async initClineWithHistoryItem(historyItem: HistoryItem) {
		await this.clearTask()

		const {
			apiConfiguration,
			customModePrompts,
			diffEnabled,
			checkpointsEnabled,
			fuzzyMatchThreshold,
			mode,
			customInstructions: globalInstructions,
			experiments,
		} = await this.getState()

		const modePrompt = customModePrompts?.[mode] as PromptComponent
		const effectiveInstructions = [globalInstructions, modePrompt?.customInstructions].filter(Boolean).join("\n\n")

		this.cline = new Cline(
			this,
			apiConfiguration,
			effectiveInstructions,
			diffEnabled,
			checkpointsEnabled,
			fuzzyMatchThreshold,
			undefined,
			undefined,
			historyItem,
			experiments,
		)
	}

	/**
	 * Send a message to the webview
	 */
	async postMessageToWebview(message: any) {
		if (!this.view) {
			this.log("No webview to post message to");
			return;
		}
		
		try {
			await this.view.webview.postMessage(message);
			return true;
		} catch (error) {
			this.outputChannel.appendLine(`Error posting message to webview: ${error}`);
			return false;
		}
	}

	private async getHMRHtmlContent(webview: vscode.Webview): Promise<string> {
		const localPort = "5173"
		const localServerUrl = `localhost:${localPort}`

		// Check if local dev server is running.
		try {
			await axios.get(`http://${localServerUrl}`)
		} catch (error) {
			vscode.window.showErrorMessage(
				"Local development server is not running, HMR will not work. Please run 'npm run dev' before launching the extension to enable HMR.",
			)

			return this.getHtmlContent(webview)
		}

		const nonce = getNonce()
		const stylesUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "assets", "index.css"])
		const codiconsUri = getUri(webview, this.context.extensionUri, [
			"node_modules",
			"@vscode",
			"codicons",
			"dist",
			"codicon.css",
		])

		const file = "src/index.tsx"
		const scriptUri = `http://${localServerUrl}/${file}`

		const reactRefresh = /*html*/ `
			<script nonce="${nonce}" type="module">
				import RefreshRuntime from "http://localhost:${localPort}/@react-refresh"
				RefreshRuntime.injectIntoGlobalHook(window)
				window.$RefreshReg$ = () => {}
				window.$RefreshSig$ = () => (type) => type
				window.__vite_plugin_react_preamble_installed__ = true
			</script>
		`

		const csp = [
			"default-src 'none'",
			`font-src ${webview.cspSource}`,
			`style-src ${webview.cspSource} 'unsafe-inline' https://* http://${localServerUrl} http://0.0.0.0:${localPort}`,
			`img-src ${webview.cspSource} data:`,
			`script-src 'unsafe-eval' https://* http://${localServerUrl} http://0.0.0.0:${localPort} 'nonce-${nonce}'`,
			`connect-src https://* ws://${localServerUrl} ws://0.0.0.0:${localPort} http://${localServerUrl} http://0.0.0.0:${localPort}`,
		]

		return /*html*/ `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1.0" />
					<title>Optima AI</title>
					<meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">
					<link rel="stylesheet" type="text/css" href="${stylesUri}">
					<link href="${codiconsUri}" rel="stylesheet" />
				</head>
				<body>
					<div id="root"></div>
					${reactRefresh}
					<script type="module" src="${scriptUri}"></script>
				</body>
			</html>
		`
	}

	/**
	 * Defines and returns the HTML that should be rendered within the webview panel.
	 *
	 * @remarks This is also the place where references to the React webview build files
	 * are created and inserted into the webview HTML.
	 *
	 * @param webview A reference to the extension webview
	 * @param extensionUri The URI of the directory containing the extension
	 * @returns A template string literal containing the HTML that should be
	 * rendered within the webview panel
	 */
	private getHtmlContent(webview: vscode.Webview): string {
		// Get the local paths to the scripts and stylesheets
		const stylesUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "assets", "index.css"])
		const scriptUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "assets", "index.js"])
		
		// The codicon font resource
		const codiconUri = getUri(webview, this.context.extensionUri, ["node_modules", "@vscode", "codicons", "dist", "codicon.ttf"])
		const codiconCssUri = getUri(webview, this.context.extensionUri, ["node_modules", "@vscode", "codicons", "dist", "codicon.css"])
		
		const nonce = getNonce()

		// Log paths for debugging
		console.log(`Styles URI: ${stylesUri}`)
		console.log(`Script URI: ${scriptUri}`)
		console.log(`Codicon URI: ${codiconUri}`)

		return /*html*/ `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
					<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
					<link rel="stylesheet" type="text/css" href="${stylesUri}">
					<link href="${codiconCssUri}" rel="stylesheet" />
					<title>Optima AI</title>
				</head>
				<body>
					<noscript>You need to enable JavaScript to run this app.</noscript>
					<div id="root"></div>
					<script nonce="${nonce}" src="${scriptUri}"></script>
					<script nonce="${nonce}">
						window.addEventListener('error', function(event) {
							console.error('Resource loading error:', event);
							// Send error info back to extension
							const vscode = acquireVsCodeApi();
							vscode.postMessage({
								type: 'webviewError',
								message: event.message,
								source: event.filename,
								line: event.lineno,
								column: event.colno
							});
						}, true); // Use capturing to catch resource loading errors
					</script>
				</body>
			</html>
		`
	}

	/**
	 * Sets up an event listener to listen for messages passed from the webview context and
	 * executes code based on the message that is recieved.
	 *
	 * @param webview A reference to the extension webview
	 */
	private setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(
			async (message) => {
				try {
					this.log(`Received message from webview: ${message.type}`)
					
					switch (message.type) {
						case "webviewDidLaunch":
							// Initial loading complete, now send state
							await this.postStateToWebview()
							break
							
						case "webviewError":
							// Log webview errors from the error event listener
							this.outputChannel.appendLine(`Webview error: ${JSON.stringify(message)}`)
							vscode.window.showErrorMessage(`UI error: ${message.message}`)
							break
							
						case "reloadWebview":
							// User requested reload
							vscode.commands.executeCommand("optima-ai.reloadWebview")
							break
							
						case "action":
							// Handle specific actions
							switch (message.action) {
								case "settingsButtonClicked":
									// Settings button was clicked
									this.log("Settings button clicked")
									break
									
								case "historyButtonClicked":
									// History button was clicked
									this.log("History button clicked")
									break
									
								case "mcpButtonClicked":
									// MCP button was clicked
									this.log("MCP button clicked")
									break
									
								case "plusButtonClicked":
									// New task button was clicked
									await this.clearTask()
									this.log("Plus button clicked")
									break
									
								default:
									this.log(`Unknown action: ${message.action}`)
							}
							break
							
						default:
							this.log(`Unhandled message type: ${message.type}`)
					}
				} catch (error) {
					this.outputChannel.appendLine(`Error handling webview message: ${error}`)
				}
			},
			undefined,
			this.disposables
		)
	}

	async cancelTask() {
		if (this.cline) {
			const { historyItem } = await this.getTaskWithId(this.cline.taskId)
			this.cline.abortTask()

			await pWaitFor(
				() =>
					this.cline === undefined ||
					this.cline.isStreaming === false ||
					this.cline.didFinishAbortingStream ||
					// If only the first chunk is processed, then there's no
					// need to wait for graceful abort (closes edits, browser,
					// etc).
					this.cline.isWaitingForFirstChunk,
				{
					timeout: 3_000,
				},
			).catch(() => {
				console.error("Failed to abort task")
			})

			if (this.cline) {
				// 'abandoned' will prevent this Cline instance from affecting
				// future Cline instances. This may happen if its hanging on a
				// streaming request.
				this.cline.abandoned = true
			}

			// Clears task again, so we need to abortTask manually above.
			await this.initClineWithHistoryItem(historyItem)
		}
	}

	async updateCustomInstructions(instructions?: string) {
		// User may be clearing the field
		await this.updateGlobalState("customInstructions", instructions || undefined)
		if (this.cline) {
			this.cline.customInstructions = instructions || undefined
		}
		await this.postStateToWebview()
	}

	// MCP

	async ensureMcpServersDirectoryExists(): Promise<string> {
		const mcpServersDir = path.join(os.homedir(), "Documents", "Cline", "MCP")
		try {
			await fs.mkdir(mcpServersDir, { recursive: true })
		} catch (error) {
			return "~/Documents/Cline/MCP" // in case creating a directory in documents fails for whatever reason (e.g. permissions) - this is fine since this path is only ever used in the system prompt
		}
		return mcpServersDir
	}

	async ensureSettingsDirectoryExists(): Promise<string> {
		const settingsDir = path.join(this.context.globalStorageUri.fsPath, "settings")
		await fs.mkdir(settingsDir, { recursive: true })
		return settingsDir
	}

	// Ollama

	async getOllamaModels(baseUrl?: string) {
		try {
			if (!baseUrl) {
				baseUrl = "http://localhost:11434"
			}
			if (!URL.canParse(baseUrl)) {
				return []
			}
			const response = await axios.get(`${baseUrl}/api/tags`)
			const modelsArray = response.data?.models?.map((model: any) => model.name) || []
			const models = [...new Set<string>(modelsArray)]
			return models
		} catch (error) {
			return []
		}
	}

	// LM Studio

	async getLmStudioModels(baseUrl?: string) {
		try {
			if (!baseUrl) {
				baseUrl = "http://localhost:1234"
			}
			if (!URL.canParse(baseUrl)) {
				return []
			}
			const response = await axios.get(`${baseUrl}/v1/models`)
			const modelsArray = response.data?.data?.map((model: any) => model.id) || []
			const models = [...new Set<string>(modelsArray)]
			return models
		} catch (error) {
			return []
		}
	}

	// VSCode LM API
	private async getVsCodeLmModels() {
		try {
			const models = await vscode.lm.selectChatModels({})
			return models || []
		} catch (error) {
			this.outputChannel.appendLine(
				`Error fetching VS Code LM models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
			return []
		}
	}

	// OpenAi

	async getOpenAiModels(baseUrl?: string, apiKey?: string) {
		try {
			if (!baseUrl) {
				return []
			}

			if (!URL.canParse(baseUrl)) {
				return []
			}

			const config: Record<string, any> = {}
			if (apiKey) {
				config["headers"] = { Authorization: `Bearer ${apiKey}` }
			}

			const response = await axios.get(`${baseUrl}/models`, config)
			const modelsArray = response.data?.data?.map((model: any) => model.id) || []
			const models = [...new Set<string>(modelsArray)]
			return models
		} catch (error) {
			return []
		}
	}

	// Requesty
	async readRequestyModels(): Promise<Record<string, ModelInfo> | undefined> {
		const requestyModelsFilePath = path.join(
			await this.ensureCacheDirectoryExists(),
			GlobalFileNames.requestyModels,
		)
		const fileExists = await fileExistsAtPath(requestyModelsFilePath)
		if (fileExists) {
			const fileContents = await fs.readFile(requestyModelsFilePath, "utf8")
			return JSON.parse(fileContents)
		}
		return undefined
	}

	async refreshRequestyModels(apiKey?: string) {
		const requestyModelsFilePath = path.join(
			await this.ensureCacheDirectoryExists(),
			GlobalFileNames.requestyModels,
		)

		const models: Record<string, ModelInfo> = {}
		try {
			const config: Record<string, any> = {}
			if (!apiKey) {
				apiKey = (await this.getSecret("requestyApiKey")) as string
			}

			if (!apiKey) {
				this.outputChannel.appendLine("No Requesty API key found")
				return models
			}

			if (apiKey) {
				config["headers"] = { Authorization: `Bearer ${apiKey}` }
			}

			const response = await axios.get("https://router.requesty.ai/v1/models", config)
			/*
				{
					"id": "anthropic/claude-3-5-sonnet-20240620",
					"object": "model",
					"created": 1738243330,
					"owned_by": "system",
					"input_price": 0.000003,
					"caching_price": 0.00000375,
					"cached_price": 3E-7,
					"output_price": 0.000015,
					"max_output_tokens": 8192,
					"context_window": 200000,
					"supports_caching": true,
					"description": "Anthropic's most intelligent model. Highest level of intelligence and capability"
					},
				}
			*/
			if (response.data) {
				const rawModels = response.data.data
				const parsePrice = (price: any) => {
					if (price) {
						return parseFloat(price) * 1_000_000
					}
					return undefined
				}
				for (const rawModel of rawModels) {
					const modelInfo: ModelInfo = {
						maxTokens: rawModel.max_output_tokens,
						contextWindow: rawModel.context_window,
						supportsImages: rawModel.support_image,
						supportsComputerUse: rawModel.support_computer_use,
						supportsPromptCache: rawModel.supports_caching,
						inputPrice: parsePrice(rawModel.input_price),
						outputPrice: parsePrice(rawModel.output_price),
						description: rawModel.description,
						cacheWritesPrice: parsePrice(rawModel.caching_price),
						cacheReadsPrice: parsePrice(rawModel.cached_price),
					}

					models[rawModel.id] = modelInfo
				}
			} else {
				this.outputChannel.appendLine("Invalid response from Requesty API")
			}
			await fs.writeFile(requestyModelsFilePath, JSON.stringify(models))
		} catch (error) {
			this.outputChannel.appendLine(
				`Error fetching Requesty models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}

		await this.postMessageToWebview({ type: "requestyModels", requestyModels: models })
		return models
	}

	// OpenRouter

	async handleOpenRouterCallback(code: string) {
		let apiKey: string
		try {
			const response = await axios.post("https://openrouter.ai/api/v1/auth/keys", { code })
			if (response.data && response.data.key) {
				apiKey = response.data.key
			} else {
				throw new Error("Invalid response from OpenRouter API")
			}
		} catch (error) {
			this.outputChannel.appendLine(
				`Error exchanging code for API key: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
			throw error
		}

		const openrouter: ApiProvider = "openrouter"
		await this.updateGlobalState("apiProvider", openrouter)
		await this.storeSecret("openRouterApiKey", apiKey)
		await this.postStateToWebview()
		if (this.cline) {
			this.cline.api = buildApiHandler({ apiProvider: openrouter, openRouterApiKey: apiKey })
		}
		// await this.postMessageToWebview({ type: "action", action: "settingsButtonClicked" }) // bad ux if user is on welcome
	}

	private async ensureCacheDirectoryExists(): Promise<string> {
		const cacheDir = path.join(this.context.globalStorageUri.fsPath, "cache")
		await fs.mkdir(cacheDir, { recursive: true })
		return cacheDir
	}

	async handleGlamaCallback(code: string) {
		let apiKey: string
		try {
			const response = await axios.post("https://glama.ai/api/gateway/v1/auth/exchange-code", { code })
			if (response.data && response.data.apiKey) {
				apiKey = response.data.apiKey
			} else {
				throw new Error("Invalid response from Glama API")
			}
		} catch (error) {
			this.outputChannel.appendLine(
				`Error exchanging code for API key: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
			throw error
		}

		const glama: ApiProvider = "glama"
		await this.updateGlobalState("apiProvider", glama)
		await this.storeSecret("glamaApiKey", apiKey)
		await this.postStateToWebview()
		if (this.cline) {
			this.cline.api = buildApiHandler({
				apiProvider: glama,
				glamaApiKey: apiKey,
			})
		}
		// await this.postMessageToWebview({ type: "action", action: "settingsButtonClicked" }) // bad ux if user is on welcome
	}

	private async readModelsFromCache(filename: string): Promise<Record<string, ModelInfo> | undefined> {
		const filePath = path.join(await this.ensureCacheDirectoryExists(), filename)
		const fileExists = await fileExistsAtPath(filePath)
		if (fileExists) {
			const fileContents = await fs.readFile(filePath, "utf8")
			return JSON.parse(fileContents)
		}
		return undefined
	}

	async readGlamaModels(): Promise<Record<string, ModelInfo> | undefined> {
		return this.readModelsFromCache(GlobalFileNames.glamaModels)
	}

	async refreshGlamaModels() {
		const glamaModelsFilePath = path.join(await this.ensureCacheDirectoryExists(), GlobalFileNames.glamaModels)

		const models: Record<string, ModelInfo> = {}
		try {
			const response = await axios.get("https://glama.ai/api/gateway/v1/models")
			/*
				{
					"added": "2024-12-24T15:12:49.324Z",
					"capabilities": [
						"adjustable_safety_settings",
						"caching",
						"code_execution",
						"function_calling",
						"json_mode",
						"json_schema",
						"system_instructions",
						"tuning",
						"input:audio",
						"input:image",
						"input:text",
						"input:video",
						"output:text"
					],
					"id": "google-vertex/gemini-1.5-flash-002",
					"maxTokensInput": 1048576,
					"maxTokensOutput": 8192,
					"pricePerToken": {
						"cacheRead": null,
						"cacheWrite": null,
						"input": "0.000000075",
						"output": "0.0000003"
					}
				}
			*/
			if (response.data) {
				const rawModels = response.data
				const parsePrice = (price: any) => {
					if (price) {
						return parseFloat(price) * 1_000_000
					}
					return undefined
				}
				for (const rawModel of rawModels) {
					const modelInfo: ModelInfo = {
						maxTokens: rawModel.maxTokensOutput,
						contextWindow: rawModel.maxTokensInput,
						supportsImages: rawModel.capabilities?.includes("input:image"),
						supportsComputerUse: rawModel.capabilities?.includes("computer_use"),
						supportsPromptCache: rawModel.capabilities?.includes("caching"),
						inputPrice: parsePrice(rawModel.pricePerToken?.input),
						outputPrice: parsePrice(rawModel.pricePerToken?.output),
						description: undefined,
						cacheWritesPrice: parsePrice(rawModel.pricePerToken?.cacheWrite),
						cacheReadsPrice: parsePrice(rawModel.pricePerToken?.cacheRead),
					}

					models[rawModel.id] = modelInfo
				}
			} else {
				this.outputChannel.appendLine("Invalid response from Glama API")
			}
			await fs.writeFile(glamaModelsFilePath, JSON.stringify(models))
		} catch (error) {
			this.outputChannel.appendLine(
				`Error fetching Glama models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}

		await this.postMessageToWebview({ type: "glamaModels", glamaModels: models })
		return models
	}

	async readOpenRouterModels(): Promise<Record<string, ModelInfo> | undefined> {
		return this.readModelsFromCache(GlobalFileNames.openRouterModels)
	}

	async refreshOpenRouterModels() {
		const openRouterModelsFilePath = path.join(
			await this.ensureCacheDirectoryExists(),
			GlobalFileNames.openRouterModels,
		)

		const models: Record<string, ModelInfo> = {}
		try {
			const response = await axios.get("https://openrouter.ai/api/v1/models")
			/*
			{
				"id": "anthropic/claude-3.5-sonnet",
				"name": "Anthropic: Claude 3.5 Sonnet",
				"created": 1718841600,
				"description": "Claude 3.5 Sonnet delivers better-than-Opus capabilities, faster-than-Sonnet speeds, at the same Sonnet prices. Sonnet is particularly good at:\n\n- Coding: Autonomously writes, edits, and runs code with reasoning and troubleshooting\n- Data science: Augments human data science expertise; navigates unstructured data while using multiple tools for insights\n- Visual processing: excelling at interpreting charts, graphs, and images, accurately transcribing text to derive insights beyond just the text alone\n- Agentic tasks: exceptional tool use, making it great at agentic tasks (i.e. complex, multi-step problem solving tasks that require engaging with other systems)\n\n#multimodal",
				"context_length": 200000,
				"architecture": {
					"modality": "text+image-\u003Etext",
					"tokenizer": "Claude",
					"instruct_type": null
				},
				"pricing": {
					"prompt": "0.000003",
					"completion": "0.000015",
					"image": "0.0048",
					"request": "0"
				},
				"top_provider": {
					"context_length": 200000,
					"max_completion_tokens": 8192,
					"is_moderated": true
				},
				"per_request_limits": null
			},
			*/
			if (response.data?.data) {
				const rawModels = response.data.data
				const parsePrice = (price: any) => {
					if (price) {
						return parseFloat(price) * 1_000_000
					}
					return undefined
				}
				for (const rawModel of rawModels) {
					const modelInfo: ModelInfo = {
						maxTokens: rawModel.top_provider?.max_completion_tokens,
						contextWindow: rawModel.context_length,
						supportsImages: rawModel.architecture?.modality?.includes("image"),
						supportsPromptCache: false,
						inputPrice: parsePrice(rawModel.pricing?.prompt),
						outputPrice: parsePrice(rawModel.pricing?.completion),
						description: rawModel.description,
					}

					switch (rawModel.id) {
						case "anthropic/claude-3-7-sonnet":
						case "anthropic/claude-3-7-sonnet:beta":
						case "anthropic/claude-3-7-sonnet-20240606":
						case "anthropic/claude-3-7-sonnet-20240606:beta":
							// NOTE: this needs to be synced with api.ts/openrouter default model info
							modelInfo.supportsComputerUse = true
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 3.75
							modelInfo.cacheReadsPrice = 0.3
							break;
						case "anthropic/claude-3.5-sonnet":
						case "anthropic/claude-3.5-sonnet:beta":
						case "anthropic/claude-3.5-sonnet-20240620":
						case "anthropic/claude-3.5-sonnet-20240620:beta":
							// NOTE: this needs to be synced with api.ts/openrouter default model info
							modelInfo.supportsComputerUse = true
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 3.75
							modelInfo.cacheReadsPrice = 0.3
							break;
						case "anthropic/claude-3-5-haiku":
						case "anthropic/claude-3-5-haiku:beta":
						case "anthropic/claude-3-5-haiku-20241022":
						case "anthropic/claude-3-5-haiku-20241022:beta":
						case "anthropic/claude-3.5-haiku":
						case "anthropic/claude-3.5-haiku:beta":
						case "anthropic/claude-3.5-haiku-20241022":
						case "anthropic/claude-3.5-haiku-20241022:beta":
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 1.25
							modelInfo.cacheReadsPrice = 0.1
							break
						case "anthropic/claude-3-opus":
						case "anthropic/claude-3-opus:beta":
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 18.75
							modelInfo.cacheReadsPrice = 1.5
							break
						case "anthropic/claude-3-haiku":
						case "anthropic/claude-3-haiku:beta":
							modelInfo.supportsPromptCache = true
							modelInfo.cacheWritesPrice = 0.3
							modelInfo.cacheReadsPrice = 0.03
							break
					}

					models[rawModel.id] = modelInfo
				}
			} else {
				this.outputChannel.appendLine("Invalid response from OpenRouter API")
			}
			await fs.writeFile(openRouterModelsFilePath, JSON.stringify(models))
		} catch (error) {
			this.outputChannel.appendLine(
				`Error fetching OpenRouter models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}

		await this.postMessageToWebview({ type: "openRouterModels", openRouterModels: models })
		return models
	}

	async readUnboundModels(): Promise<Record<string, ModelInfo> | undefined> {
		return this.readModelsFromCache(GlobalFileNames.unboundModels)
	}

	async refreshUnboundModels() {
		const unboundModelsFilePath = path.join(await this.ensureCacheDirectoryExists(), GlobalFileNames.unboundModels)

		const models: Record<string, ModelInfo> = {}
		try {
			const response = await axios.get("https://api.getunbound.ai/models")

			if (response.data) {
				const rawModels: Record<string, any> = response.data

				for (const [modelId, model] of Object.entries(rawModels)) {
					models[modelId] = {
						maxTokens: model.maxTokens ? parseInt(model.maxTokens) : undefined,
						contextWindow: model.contextWindow ? parseInt(model.contextWindow) : 0,
						supportsImages: model.supportsImages ?? false,
						supportsPromptCache: model.supportsPromptCaching ?? false,
						supportsComputerUse: model.supportsComputerUse ?? false,
						inputPrice: model.inputTokenPrice ? parseFloat(model.inputTokenPrice) : undefined,
						outputPrice: model.outputTokenPrice ? parseFloat(model.outputTokenPrice) : undefined,
						cacheWritesPrice: model.cacheWritePrice ? parseFloat(model.cacheWritePrice) : undefined,
						cacheReadsPrice: model.cacheReadPrice ? parseFloat(model.cacheReadPrice) : undefined,
					}
				}
			}
			await fs.writeFile(unboundModelsFilePath, JSON.stringify(models))
		} catch (error) {
			this.outputChannel.appendLine(
				`Error fetching Unbound models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}

		await this.postMessageToWebview({ type: "unboundModels", unboundModels: models })
		return models
	}

	// Task history

	async getTaskWithId(id: string): Promise<{
		historyItem: HistoryItem
		taskDirPath: string
		apiConversationHistoryFilePath: string
		uiMessagesFilePath: string
		apiConversationHistory: Anthropic.MessageParam[]
	}> {
		const history = ((await this.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
		const historyItem = history.find((item) => item.id === id)
		if (historyItem) {
			const taskDirPath = path.join(this.context.globalStorageUri.fsPath, "tasks", id)
			const apiConversationHistoryFilePath = path.join(taskDirPath, GlobalFileNames.apiConversationHistory)
			const uiMessagesFilePath = path.join(taskDirPath, GlobalFileNames.uiMessages)
			const fileExists = await fileExistsAtPath(apiConversationHistoryFilePath)
			if (fileExists) {
				const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"))
				return {
					historyItem,
					taskDirPath,
					apiConversationHistoryFilePath,
					uiMessagesFilePath,
					apiConversationHistory,
				}
			}
		}
		// if we tried to get a task that doesn't exist, remove it from state
		// FIXME: this seems to happen sometimes when the json file doesnt save to disk for some reason
		await this.deleteTaskFromState(id)
		throw new Error("Task not found")
	}

	async showTaskWithId(id: string) {
		if (id !== this.cline?.taskId) {
			// non-current task
			const { historyItem } = await this.getTaskWithId(id)
			await this.initClineWithHistoryItem(historyItem) // clears existing task
		}
		await this.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}

	async exportTaskWithId(id: string) {
		const { historyItem, apiConversationHistory } = await this.getTaskWithId(id)
		await downloadTask(historyItem.ts, apiConversationHistory)
	}

	async deleteTaskWithId(id: string) {
		if (id === this.cline?.taskId) {
			await this.clearTask()
		}

		const { taskDirPath, apiConversationHistoryFilePath, uiMessagesFilePath } = await this.getTaskWithId(id)

		await this.deleteTaskFromState(id)

		// Delete the task files
		const apiConversationHistoryFileExists = await fileExistsAtPath(apiConversationHistoryFilePath)
		if (apiConversationHistoryFileExists) {
			await fs.unlink(apiConversationHistoryFilePath)
		}
		const uiMessagesFileExists = await fileExistsAtPath(uiMessagesFilePath)
		if (uiMessagesFileExists) {
			await fs.unlink(uiMessagesFilePath)
		}
		const legacyMessagesFilePath = path.join(taskDirPath, "claude_messages.json")
		if (await fileExistsAtPath(legacyMessagesFilePath)) {
			await fs.unlink(legacyMessagesFilePath)
		}
		await fs.rmdir(taskDirPath) // succeeds if the dir is empty

		const { checkpointsEnabled } = await this.getState()
		const baseDir = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
		const branch = `roo-code-checkpoints-${id}`

		if (checkpointsEnabled && baseDir) {
			try {
				await simpleGit(baseDir).branch(["-D", branch])
				console.log(`[deleteTaskWithId] Deleted branch ${branch}`)
			} catch (err) {
				console.error(
					`[deleteTaskWithId] Error deleting branch ${branch}: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
		}
	}

	async deleteTaskFromState(id: string) {
		// Remove the task from history
		const taskHistory = ((await this.getGlobalState("taskHistory")) as HistoryItem[]) || []
		const updatedTaskHistory = taskHistory.filter((task) => task.id !== id)
		await this.updateGlobalState("taskHistory", updatedTaskHistory)

		// Notify the webview that the task has been deleted
		await this.postStateToWebview()
	}

	/**
	 * Send current state to the webview
	 */
	async postStateToWebview() {
		if (!this.view) {
			return;
		}

		try {
			const state = await this.getState();
			
			this.postMessageToWebview({
				type: "state",
				state: state
			});
			
			this.log("State sent to webview");
		} catch (error) {
			this.outputChannel.appendLine(`Error posting state to webview: ${error}`);
		}
	}

	/**
	 * Get the current state for the webview
	 */
	async getState() {
		// Default state values
		return {
			// Add properties needed by your webview UI
			apiProvider: "openai", // example
			allowedCommands: [],
			soundEnabled: false,
			// ...other state properties
		};
	}

	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = ((await this.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
		const existingItemIndex = history.findIndex((h) => h.id === item.id)

		if (existingItemIndex !== -1) {
			history[existingItemIndex] = item
		} else {
			history.push(item)
		}
		await this.updateGlobalState("taskHistory", history)
		return history
	}

	// global

	async updateGlobalState(key: GlobalStateKey, value: any) {
		await this.context.globalState.update(key, value)
	}

	async getGlobalState(key: GlobalStateKey) {
		return await this.context.globalState.get(key)
	}

	// workspace

	private async updateWorkspaceState(key: string, value: any) {
		await this.context.workspaceState.update(key, value)
	}

	private async getWorkspaceState(key: string) {
		return await this.context.workspaceState.get(key)
	}

	// private async clearState() {
	// 	this.context.workspaceState.keys().forEach((key) => {
	// 		this.context.workspaceState.update(key, undefined)
	// 	})
	// 	this.context.globalState.keys().forEach((key) => {
	// 		this.context.globalState.update(key, undefined)
	// 	})
	// 	this.context.secrets.delete("apiKey")
	// }

	// secrets

	public async storeSecret(key: SecretKey, value?: string) {
		if (value) {
			await this.context.secrets.store(key, value)
		} else {
			await this.context.secrets.delete(key)
		}
	}

	private async getSecret(key: SecretKey) {
		return await this.context.secrets.get(key)
	}

	// dev

	async resetState() {
		const answer = await vscode.window.showInformationMessage(
			"Are you sure you want to reset all state and secret storage in the extension? This cannot be undone.",
			{ modal: true },
			"Yes",
		)

		if (answer !== "Yes") {
			return
		}

		for (const key of this.context.globalState.keys()) {
			await this.context.globalState.update(key, undefined)
		}
		const secretKeys: SecretKey[] = [
			"apiKey",
			"glamaApiKey",
			"openRouterApiKey",
			"awsAccessKey",
			"awsSecretKey",
			"awsSessionToken",
			"openAiApiKey",
			"geminiApiKey",
			"openAiNativeApiKey",
			"deepSeekApiKey",
			"mistralApiKey",
			"unboundApiKey",
			"requestyApiKey",
		]
		for (const key of secretKeys) {
			await this.storeSecret(key, undefined)
		}
		await this.configManager.resetAllConfigs()
		await this.customModesManager.resetCustomModes()
		if (this.cline) {
			this.cline.abortTask()
			this.cline = undefined
		}
		await this.postStateToWebview()
		await this.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}

	// logging

	/**
	 * Log a message to the output channel
	 */
	log(message: string) {
		this.outputChannel.appendLine(`[ClineProvider] ${message}`);
	}

	// integration tests

	get viewLaunched() {
		return this.isViewLaunched
	}

	get messages() {
		return this.cline?.clineMessages || []
	}

	// Add public getter
	public getMcpHub(): McpHub | undefined {
		return this.mcpHub
	}

	/**
	 * Clear any existing task
	 */
	async clearTask() {
		this.log("Clearing task")
		// Add any task cleanup needed here
		return Promise.resolve();
	}
}
