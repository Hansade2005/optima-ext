import { Anthropic } from "@anthropic-ai/sdk"
import cloneDeep from "clone-deep"
import { DiffStrategy, getDiffStrategy, UnifiedDiffStrategy } from "./diff/DiffStrategy"
import { validateToolUse, isToolAllowedForMode, ToolName } from "./mode-validator"
import delay from "delay"
import fs from "fs/promises"
import os from "os"
import pWaitFor from "p-wait-for"
import * as path from "path"
import { serializeError } from "serialize-error"
import * as vscode from "vscode"
import { ApiHandler, SingleCompletionHandler, buildApiHandler } from "../api"
import { ApiStream } from "../api/transform/stream"
import { DIFF_VIEW_URI_SCHEME, DiffViewProvider } from "../integrations/editor/DiffViewProvider"
import { CheckpointService } from "../services/checkpoints/CheckpointService"
import { findToolName, formatContentBlockToMarkdown } from "../integrations/misc/export-markdown"
import {
	extractTextFromFile,
	addLineNumbers,
	stripLineNumbers,
	everyLineHasLineNumbers,
	truncateOutput,
} from "../integrations/misc/extract-text"
import { TerminalManager } from "../integrations/terminal/TerminalManager"
import { UrlContentFetcher } from "../services/browser/UrlContentFetcher"
import { listFiles } from "../services/glob/list-files"
import { regexSearchFiles } from "../services/ripgrep"
import { parseSourceCodeForDefinitionsTopLevel } from "../services/tree-sitter"
import { ApiConfiguration } from "../shared/api"
import { findLastIndex } from "../shared/array"
import { combineApiRequests } from "../shared/combineApiRequests"
import { combineCommandSequences } from "../shared/combineCommandSequences"
import {
	BrowserAction,
	BrowserActionResult,
	browserActions,
	ClineApiReqCancelReason,
	ClineApiReqInfo,
	ClineAsk,
	ClineAskUseMcpServer,
	ClineMessage,
	ClineSay,
	ClineSayBrowserAction,
	ClineSayTool,
	WebSearchAction,
	WebSearchResults,
} from "../shared/ExtensionMessage"
import { getApiMetrics } from "../shared/getApiMetrics"
import { HistoryItem } from "../shared/HistoryItem"
import { ClineAskResponse } from "../shared/WebviewMessage"
import { calculateApiCost } from "../utils/cost"
import { fileExistsAtPath } from "../utils/fs"
import { arePathsEqual, getReadablePath } from "../utils/path"
import { parseMentions } from "./mentions"
import { AssistantMessageContent, parseAssistantMessage, ToolParamName, ToolUseName } from "./assistant-message"
import { formatResponse } from "./prompts/responses"
import { SYSTEM_PROMPT } from "./prompts/system"
import { modes, defaultModeSlug, getModeBySlug } from "../shared/modes"
import { truncateConversationIfNeeded } from "./sliding-window"
import { ClineProvider, GlobalFileNames } from "./webview/ClineProvider"
import { detectCodeOmission } from "../integrations/editor/detect-omission"
import { BrowserSession } from "../services/browser/BrowserSession"
import { OpenRouterHandler } from "../api/providers/openrouter"
import { McpHub } from "../services/mcp/McpHub"
import crypto from "crypto"
import { insertGroups } from "./diff/insert-groups"
import { EXPERIMENT_IDS, experiments as Experiments } from "../shared/experiments"
import { WebSearchService } from "../services/browser/WebSearchService"

const cwd =
	vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop") // may or may not exist but fs checking existence would immediately ask for permission which would be bad UX, need to come up with a better solution

type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>
type UserContent = Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>

interface HtmlAction {
	type: 'html';
	url: string;
}

interface ScrapeAction {
	type: 'scrape';
	url: string;
}

interface FetchAction {
	type: 'fetch';
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
}

export class Cline {
	readonly taskId: string
	api: ApiHandler
	private terminalManager: TerminalManager
	private urlContentFetcher: UrlContentFetcher
	private browserSession: BrowserSession
	private webSearchService: WebSearchService
	private didEditFile: boolean = false
	customInstructions?: string
	diffStrategy?: DiffStrategy
	diffEnabled: boolean = false
	fuzzyMatchThreshold: number = 1.0

	apiConversationHistory: (Anthropic.MessageParam & { ts?: number })[] = []
	clineMessages: ClineMessage[] = []
	private askResponse?: ClineAskResponse
	private askResponseText?: string
	private askResponseImages?: string[]
	private lastMessageTs?: number
	private consecutiveMistakeCount: number = 0
	private consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map()
	private providerRef: WeakRef<ClineProvider>
	private abort: boolean = false
	didFinishAbortingStream = false
	abandoned = false
	private diffViewProvider: DiffViewProvider
	private lastApiRequestTime?: number
	isInitialized = false

	// checkpoints
	checkpointsEnabled: boolean = false
	private checkpointService?: CheckpointService

	// streaming
	isWaitingForFirstChunk = false
	isStreaming = false
	private currentStreamingContentIndex = 0
	private assistantMessageContent: AssistantMessageContent[] = []
	private presentAssistantMessageLocked = false
	private presentAssistantMessageHasPendingUpdates = false
	private userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
	private userMessageContentReady = false
	private didRejectTool = false
	private didAlreadyUseTool = false
	private didCompleteReadingStream = false

	private apiConfiguration: any
	private aborted: boolean = false

	constructor(
		provider: ClineProvider,
		apiConfiguration: ApiConfiguration,
		customInstructions?: string,
		enableDiff?: boolean,
		enableCheckpoints?: boolean,
		fuzzyMatchThreshold?: number,
		task?: string | undefined,
		images?: string[] | undefined,
		historyItem?: HistoryItem | undefined,
		experiments?: Record<string, boolean>,
	) {
		if (!task && !images && !historyItem) {
			throw new Error("Either historyItem or task/images must be provided")
		}

		this.taskId = crypto.randomUUID()
		this.api = buildApiHandler(apiConfiguration)
		this.terminalManager = new TerminalManager()
		this.urlContentFetcher = new UrlContentFetcher(provider.context)
		this.browserSession = new BrowserSession(provider.context)
		this.webSearchService = new WebSearchService(provider.context, this.browserSession)
		this.customInstructions = customInstructions
		this.diffEnabled = enableDiff ?? false
		this.fuzzyMatchThreshold = fuzzyMatchThreshold ?? 1.0
		this.providerRef = new WeakRef(provider)
		this.diffViewProvider = new DiffViewProvider(cwd)
		this.checkpointsEnabled = !!enableCheckpoints

		if (historyItem) {
			this.taskId = historyItem.id
		}

		// Initialize diffStrategy based on current state
		this.updateDiffStrategy(Experiments.isEnabled(experiments ?? {}, EXPERIMENT_IDS.DIFF_STRATEGY))

		if (task || images) {
			this.startTask(task, images)
		} else if (historyItem) {
			this.resumeTaskFromHistory()
		}

		// Initialize checkpoint service after task setup
		this.initializeCheckpointService()
	}

	// Add method to update diffStrategy
	async updateDiffStrategy(experimentalDiffStrategy?: boolean) {
		// If not provided, get from current state
		if (experimentalDiffStrategy === undefined) {
			const { experiments: stateExperimental } = (await this.providerRef.deref()?.getState()) ?? {}
			experimentalDiffStrategy = stateExperimental?.[EXPERIMENT_IDS.DIFF_STRATEGY] ?? false
		}
		this.diffStrategy = getDiffStrategy(this.api.getModel().id, this.fuzzyMatchThreshold, experimentalDiffStrategy)
	}

	// Storing task to disk for history

	private async ensureTaskDirectoryExists(): Promise<string> {
		const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}
		const taskDir = path.join(globalStoragePath, "tasks", this.taskId)
		await fs.mkdir(taskDir, { recursive: true })
		return taskDir
	}

	private async getSavedApiConversationHistory(): Promise<Anthropic.MessageParam[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.apiConversationHistory)
		const fileExists = await fileExistsAtPath(filePath)
		if (fileExists) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		}
		return []
	}

	private async addToApiConversationHistory(message: Anthropic.MessageParam) {
		const messageWithTs = { ...message, ts: Date.now() }
		this.apiConversationHistory.push(messageWithTs)
		await this.saveApiConversationHistory()
	}

	async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
		this.apiConversationHistory = newHistory
		await this.saveApiConversationHistory()
	}

	private async saveApiConversationHistory() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.apiConversationHistory)
			await fs.writeFile(filePath, JSON.stringify(this.apiConversationHistory))
		} catch (error) {
			// in the off chance this fails, we don't want to stop the task
			console.error("Failed to save API conversation history:", error)
		}
	}

	private async getSavedClineMessages(): Promise<ClineMessage[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.uiMessages)
		if (await fileExistsAtPath(filePath)) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		} else {
			// check old location
			const oldPath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json")
			if (await fileExistsAtPath(oldPath)) {
				const data = JSON.parse(await fs.readFile(oldPath, "utf8"))
				await fs.unlink(oldPath) // remove old file
				return data
			}
		}
		return []
	}

	private async addToClineMessages(message: ClineMessage) {
		this.clineMessages.push(message)
		await this.saveClineMessages()
	}

	public async overwriteClineMessages(newMessages: ClineMessage[]) {
		this.clineMessages = newMessages
		await this.saveClineMessages()
	}

	private async saveClineMessages() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.uiMessages)
			await fs.writeFile(filePath, JSON.stringify(this.clineMessages))
			// combined as they are in ChatView
			const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(this.clineMessages.slice(1))))
			const taskMessage = this.clineMessages[0] // first message is always the task say
			const lastRelevantMessage =
				this.clineMessages[
					findLastIndex(
						this.clineMessages,
						(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
					)
				]
			await this.providerRef.deref()?.updateTaskHistory({
				id: this.taskId,
				ts: lastRelevantMessage.ts,
				task: taskMessage.text ?? "",
				tokensIn: apiMetrics.totalTokensIn,
				tokensOut: apiMetrics.totalTokensOut,
				cacheWrites: apiMetrics.totalCacheWrites,
				cacheReads: apiMetrics.totalCacheReads,
				totalCost: apiMetrics.totalCost,
			})
		} catch (error) {
			console.error("Failed to save cline messages:", error)
		}
	}

	// Communicate with webview

	// partial has three valid states true (partial message), false (completion of partial message), undefined (individual complete message)
	async ask(
		type: ClineAsk,
		text?: string,
		partial?: boolean,
	): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
		// If this Cline instance was aborted by the provider, then the only thing keeping us alive is a promise still running in the background, in which case we don't want to send its result to the webview as it is attached to a new instance of Cline now. So we can safely ignore the result of any active promises, and this class will be deallocated. (Although we set Cline = undefined in provider, that simply removes the reference to this instance, but the instance is still alive until this promise resolves or rejects.)
		if (this.abort) {
			throw new Error("Optima AI instance aborted")
		}
		let askTs: number
		if (partial !== undefined) {
			const lastMessage = this.clineMessages.at(-1)
			const isUpdatingPreviousPartial =
				lastMessage && lastMessage.partial && lastMessage.type === "ask" && lastMessage.ask === type
			if (partial) {
				if (isUpdatingPreviousPartial) {
					// existing partial message, so update it
					lastMessage.text = text
					lastMessage.partial = partial
					// todo be more efficient about saving and posting only new data or one whole message at a time so ignore partial for saves, and only post parts of partial message instead of whole array in new listener
					// await this.saveClineMessages()
					// await this.providerRef.deref()?.postStateToWebview()
					await this.providerRef
						.deref()
						?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage })
					throw new Error("Current ask promise was ignored 1")
				} else {
					// this is a new partial message, so add it with partial state
					// this.askResponse = undefined
					// this.askResponseText = undefined
					// this.askResponseImages = undefined
					askTs = Date.now()
					this.lastMessageTs = askTs
					await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text, partial })
					await this.providerRef.deref()?.postStateToWebview()
					throw new Error("Current ask promise was ignored 2")
				}
			} else {
				// partial=false means its a complete version of a previously partial message
				if (isUpdatingPreviousPartial) {
					// this is the complete version of a previously partial message, so replace the partial with the complete version
					this.askResponse = undefined
					this.askResponseText = undefined
					this.askResponseImages = undefined

					/*
					Bug for the history books:
					In the webview we use the ts as the chatrow key for the virtuoso list. Since we would update this ts right at the end of streaming, it would cause the view to flicker. The key prop has to be stable otherwise react has trouble reconciling items between renders, causing unmounting and remounting of components (flickering).
					The lesson here is if you see flickering when rendering lists, it's likely because the key prop is not stable.
					So in this case we must make sure that the message ts is never altered after first setting it.
					*/
					askTs = lastMessage.ts
					this.lastMessageTs = askTs
					// lastMessage.ts = askTs
					lastMessage.text = text
					lastMessage.partial = false
					await this.saveClineMessages()
					// await this.providerRef.deref()?.postStateToWebview()
					await this.providerRef
						.deref()
						?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage })
				} else {
					// this is a new partial=false message, so add it like normal
					this.askResponse = undefined
					this.askResponseText = undefined
					this.askResponseImages = undefined
					askTs = Date.now()
					this.lastMessageTs = askTs
					await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text })
					await this.providerRef.deref()?.postStateToWebview()
				}
			}
		} else {
			// this is a new non-partial message, so add it like normal
			// const lastMessage = this.clineMessages.at(-1)
			this.askResponse = undefined
			this.askResponseText = undefined
			this.askResponseImages = undefined
			askTs = Date.now()
			this.lastMessageTs = askTs
			await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text })
			await this.providerRef.deref()?.postStateToWebview()
		}

		await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 })
		if (this.lastMessageTs !== askTs) {
			throw new Error("Current ask promise was ignored") // could happen if we send multiple asks in a row i.e. with command_output. It's important that when we know an ask could fail, it is handled gracefully
		}
		const result = { response: this.askResponse!, text: this.askResponseText, images: this.askResponseImages }
		this.askResponse = undefined
		this.askResponseText = undefined
		this.askResponseImages = undefined
		return result
	}

	async handleWebviewAskResponse(askResponse: ClineAskResponse, text?: string, images?: string[]) {
		this.askResponse = askResponse
		this.askResponseText = text
		this.askResponseImages = images
	}

	async say(type: ClineSay, text?: string, images?: string[], partial?: boolean): Promise<undefined> {
		if (this.abort) {
			throw new Error("Optima AI instance aborted")
		}

		if (partial !== undefined) {
			// Implementation code here
		}
		return undefined; // Add proper return
	}

	async handleActionHtml(action: HtmlAction) {
		if (this.aborted) return;
		// ... existing code ...
	}

	async handleActionScrape(action: ScrapeAction) {
		if (this.aborted) return;
		// ... existing code ...
	}

	async handleFetchAction(action: FetchAction) {
		if (this.aborted) return;
		// ... existing code ...
	}

	async handleWebSearch(action: WebSearchAction) {
		if (this.abort) {
			throw new Error("Optima AI instance aborted")
		}

		try {
			// Log the web search action
			console.log(`Web search for query: ${action.query}, maxResults: ${action.maxResults || 5}`)
			
			// Create a checkpoint before performing the web search
			if (this.checkpointsEnabled && !this.checkpointService) {
				await this.initializeCheckpointService()
			}
			
			if (this.checkpointsEnabled && this.checkpointService) {
				await this.checkpointService.saveCheckpoint("pre-web-search")
			}
			
			// Perform the web search
			const searchResults = await this.webSearchService.searchWeb(
				action.query,
				action.maxResults || 5,
				action.useCache !== false // Default to using cache if not specified
			)
			
			// Format the results for the AI
			const formattedResults: WebSearchResults = {
				query: searchResults.query,
				results: searchResults.results.map(result => ({
					title: result.title,
					url: result.url,
					text: result.text || "No text content available",
					links: result.links,
					images: result.images
				}))
			}
			
			// Add the search results to the conversation history for the AI to use
			const resultsMessage = `Web search results for "${action.query}":\n\n${formattedResults.results
				.map((result, index) => {
					return `Result ${index + 1}: "${result.title}"\nURL: ${result.url}\n\nContent:\n${
						result.text?.substring(0, 1000) || "No content available"
					}${result.text && result.text.length > 1000 ? "... (content truncated)" : ""}\n\n`;
				})
				.join("---\n\n")}`;
			
			await this.say("web_search_result", resultsMessage)
			
			return formattedResults
		} catch (error) {
			console.error("Web search error:", error)
			await this.say("error", `Error during web search: ${error.message || "Unknown error"}`)
			throw error
		}
	}

	// Move the if statement inside a method
	checkModelCompatibility(vscodeModelInfo: any, modelInfo: any) {
		if (this.apiConfiguration.provider === "openRouter" && 
			(!vscodeModelInfo.families?.includes("claude") && modelInfo.family !== "laserjet")) {
			return "Optima AI uses complex prompts and iterative task execution that may be challenging for less capable models. For best results, it's recommended to use Claude 3.7 Sonnet for its advanced agentic coding capabilities."
		}
		return null;
	}

	// Move this method inside the class
	private async initializeCheckpointService() {
		if (this.checkpointsEnabled && !this.checkpointService) {
			try {
				const baseDir = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
				if (baseDir) {
				this.checkpointService = await CheckpointService.create({
					taskId: this.taskId,
						baseDir,
						log: console.log
					})
					console.log(`[Cline] CheckpointService initialized for task ${this.taskId}`)
				}
			} catch (error) {
				console.error(`[Cline] Failed to initialize CheckpointService: ${error}`)
			}
		}
	}

	async startTask(task: any, images: any) {
		// Implementation
	}

	async resumeTaskFromHistory() {
		// Implementation
	}

	async abortTask() {
		this.abort = true;
		this.aborted = true;
	}

	async speak(message: string, options: { isError?: boolean }) {
		// Implementation
	}

	async getEnvironmentDetails(includeSystemInfo: boolean) {
		// Implementation
		return {};
	}

	async recursivelyMakeClineRequests(messages: any[], includeSystemInfo: boolean) {
		// Implementation
	}

	async attemptApiRequest(retryCount: number) {
		// Implementation
		return [];
	}

	async loadContext(content: any) {
		// Implementation
		return [content];
	}

	async checkpointDiff(data: any) {
		// Implementation
	}

	async checkpointRestore(data: any) {
		// Implementation
	}
}
