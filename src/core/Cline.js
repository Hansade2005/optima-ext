import { getDiffStrategy } from "./diff/DiffStrategy";
import fs from "fs/promises";
import os from "os";
import pWaitFor from "p-wait-for";
import * as path from "path";
import * as vscode from "vscode";
import { buildApiHandler } from "../api";
import { DiffViewProvider } from "../integrations/editor/DiffViewProvider";
import { CheckpointService } from "../services/checkpoints/CheckpointService";
import { TerminalManager } from "../integrations/terminal/TerminalManager";
import { UrlContentFetcher } from "../services/browser/UrlContentFetcher";
import { findLastIndex } from "../shared/array";
import { combineApiRequests } from "../shared/combineApiRequests";
import { combineCommandSequences } from "../shared/combineCommandSequences";
import { getApiMetrics } from "../shared/getApiMetrics";
import { fileExistsAtPath } from "../utils/fs";
import { GlobalFileNames } from "./webview/ClineProvider";
import { BrowserSession } from "../services/browser/BrowserSession";
import crypto from "crypto";
import { EXPERIMENT_IDS, experiments as Experiments } from "../shared/experiments";
import { WebSearchService } from "../services/browser/WebSearchService";
const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop"); // may or may not exist but fs checking existence would immediately ask for permission which would be bad UX, need to come up with a better solution
export class Cline {
    taskId;
    api;
    terminalManager;
    urlContentFetcher;
    browserSession;
    webSearchService;
    didEditFile = false;
    customInstructions;
    diffStrategy;
    diffEnabled = false;
    fuzzyMatchThreshold = 1.0;
    apiConversationHistory = [];
    clineMessages = [];
    askResponse;
    askResponseText;
    askResponseImages;
    lastMessageTs;
    consecutiveMistakeCount = 0;
    consecutiveMistakeCountForApplyDiff = new Map();
    providerRef;
    abort = false;
    didFinishAbortingStream = false;
    abandoned = false;
    diffViewProvider;
    lastApiRequestTime;
    isInitialized = false;
    // checkpoints
    checkpointsEnabled = false;
    checkpointService;
    // streaming
    isWaitingForFirstChunk = false;
    isStreaming = false;
    currentStreamingContentIndex = 0;
    assistantMessageContent = [];
    presentAssistantMessageLocked = false;
    presentAssistantMessageHasPendingUpdates = false;
    userMessageContent = [];
    userMessageContentReady = false;
    didRejectTool = false;
    didAlreadyUseTool = false;
    didCompleteReadingStream = false;
    apiConfiguration;
    aborted = false;
    constructor(provider, apiConfiguration, customInstructions, enableDiff, enableCheckpoints, fuzzyMatchThreshold, task, images, historyItem, experiments) {
        if (!task && !images && !historyItem) {
            throw new Error("Either historyItem or task/images must be provided");
        }
        this.taskId = crypto.randomUUID();
        this.api = buildApiHandler(apiConfiguration);
        this.terminalManager = new TerminalManager();
        this.urlContentFetcher = new UrlContentFetcher(provider.context);
        this.browserSession = new BrowserSession(provider.context);
        this.webSearchService = new WebSearchService(provider.context, this.browserSession);
        this.customInstructions = customInstructions;
        this.diffEnabled = enableDiff ?? false;
        this.fuzzyMatchThreshold = fuzzyMatchThreshold ?? 1.0;
        this.providerRef = new WeakRef(provider);
        this.diffViewProvider = new DiffViewProvider(cwd);
        this.checkpointsEnabled = !!enableCheckpoints;
        if (historyItem) {
            this.taskId = historyItem.id;
        }
        // Initialize diffStrategy based on current state
        this.updateDiffStrategy(Experiments.isEnabled(experiments ?? {}, EXPERIMENT_IDS.DIFF_STRATEGY));
        if (task || images) {
            this.startTask(task, images);
        }
        else if (historyItem) {
            this.resumeTaskFromHistory();
        }
        // Initialize checkpoint service after task setup
        this.initializeCheckpointService();
    }
    // Add method to update diffStrategy
    async updateDiffStrategy(experimentalDiffStrategy) {
        // If not provided, get from current state
        if (experimentalDiffStrategy === undefined) {
            const { experiments: stateExperimental } = (await this.providerRef.deref()?.getState()) ?? {};
            experimentalDiffStrategy = stateExperimental?.[EXPERIMENT_IDS.DIFF_STRATEGY] ?? false;
        }
        this.diffStrategy = getDiffStrategy(this.api.getModel().id, this.fuzzyMatchThreshold, experimentalDiffStrategy);
    }
    // Storing task to disk for history
    async ensureTaskDirectoryExists() {
        const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath;
        if (!globalStoragePath) {
            throw new Error("Global storage uri is invalid");
        }
        const taskDir = path.join(globalStoragePath, "tasks", this.taskId);
        await fs.mkdir(taskDir, { recursive: true });
        return taskDir;
    }
    async getSavedApiConversationHistory() {
        const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.apiConversationHistory);
        const fileExists = await fileExistsAtPath(filePath);
        if (fileExists) {
            return JSON.parse(await fs.readFile(filePath, "utf8"));
        }
        return [];
    }
    async addToApiConversationHistory(message) {
        const messageWithTs = { ...message, ts: Date.now() };
        this.apiConversationHistory.push(messageWithTs);
        await this.saveApiConversationHistory();
    }
    async overwriteApiConversationHistory(newHistory) {
        this.apiConversationHistory = newHistory;
        await this.saveApiConversationHistory();
    }
    async saveApiConversationHistory() {
        try {
            const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.apiConversationHistory);
            await fs.writeFile(filePath, JSON.stringify(this.apiConversationHistory));
        }
        catch (error) {
            // in the off chance this fails, we don't want to stop the task
            console.error("Failed to save API conversation history:", error);
        }
    }
    async getSavedClineMessages() {
        const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.uiMessages);
        if (await fileExistsAtPath(filePath)) {
            return JSON.parse(await fs.readFile(filePath, "utf8"));
        }
        else {
            // check old location
            const oldPath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json");
            if (await fileExistsAtPath(oldPath)) {
                const data = JSON.parse(await fs.readFile(oldPath, "utf8"));
                await fs.unlink(oldPath); // remove old file
                return data;
            }
        }
        return [];
    }
    async addToClineMessages(message) {
        this.clineMessages.push(message);
        await this.saveClineMessages();
    }
    async overwriteClineMessages(newMessages) {
        this.clineMessages = newMessages;
        await this.saveClineMessages();
    }
    async saveClineMessages() {
        try {
            const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.uiMessages);
            await fs.writeFile(filePath, JSON.stringify(this.clineMessages));
            // combined as they are in ChatView
            const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(this.clineMessages.slice(1))));
            const taskMessage = this.clineMessages[0]; // first message is always the task say
            const lastRelevantMessage = this.clineMessages[findLastIndex(this.clineMessages, (m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"))];
            await this.providerRef.deref()?.updateTaskHistory({
                id: this.taskId,
                ts: lastRelevantMessage.ts,
                task: taskMessage.text ?? "",
                tokensIn: apiMetrics.totalTokensIn,
                tokensOut: apiMetrics.totalTokensOut,
                cacheWrites: apiMetrics.totalCacheWrites,
                cacheReads: apiMetrics.totalCacheReads,
                totalCost: apiMetrics.totalCost,
            });
        }
        catch (error) {
            console.error("Failed to save cline messages:", error);
        }
    }
    // Communicate with webview
    // partial has three valid states true (partial message), false (completion of partial message), undefined (individual complete message)
    async ask(type, text, partial) {
        // If this Cline instance was aborted by the provider, then the only thing keeping us alive is a promise still running in the background, in which case we don't want to send its result to the webview as it is attached to a new instance of Cline now. So we can safely ignore the result of any active promises, and this class will be deallocated. (Although we set Cline = undefined in provider, that simply removes the reference to this instance, but the instance is still alive until this promise resolves or rejects.)
        if (this.abort) {
            throw new Error("Optima AI instance aborted");
        }
        let askTs;
        if (partial !== undefined) {
            const lastMessage = this.clineMessages.at(-1);
            const isUpdatingPreviousPartial = lastMessage && lastMessage.partial && lastMessage.type === "ask" && lastMessage.ask === type;
            if (partial) {
                if (isUpdatingPreviousPartial) {
                    // existing partial message, so update it
                    lastMessage.text = text;
                    lastMessage.partial = partial;
                    // todo be more efficient about saving and posting only new data or one whole message at a time so ignore partial for saves, and only post parts of partial message instead of whole array in new listener
                    // await this.saveClineMessages()
                    // await this.providerRef.deref()?.postStateToWebview()
                    await this.providerRef
                        .deref()
                        ?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage });
                    throw new Error("Current ask promise was ignored 1");
                }
                else {
                    // this is a new partial message, so add it with partial state
                    // this.askResponse = undefined
                    // this.askResponseText = undefined
                    // this.askResponseImages = undefined
                    askTs = Date.now();
                    this.lastMessageTs = askTs;
                    await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text, partial });
                    await this.providerRef.deref()?.postStateToWebview();
                    throw new Error("Current ask promise was ignored 2");
                }
            }
            else {
                // partial=false means its a complete version of a previously partial message
                if (isUpdatingPreviousPartial) {
                    // this is the complete version of a previously partial message, so replace the partial with the complete version
                    this.askResponse = undefined;
                    this.askResponseText = undefined;
                    this.askResponseImages = undefined;
                    /*
                    Bug for the history books:
                    In the webview we use the ts as the chatrow key for the virtuoso list. Since we would update this ts right at the end of streaming, it would cause the view to flicker. The key prop has to be stable otherwise react has trouble reconciling items between renders, causing unmounting and remounting of components (flickering).
                    The lesson here is if you see flickering when rendering lists, it's likely because the key prop is not stable.
                    So in this case we must make sure that the message ts is never altered after first setting it.
                    */
                    askTs = lastMessage.ts;
                    this.lastMessageTs = askTs;
                    // lastMessage.ts = askTs
                    lastMessage.text = text;
                    lastMessage.partial = false;
                    await this.saveClineMessages();
                    // await this.providerRef.deref()?.postStateToWebview()
                    await this.providerRef
                        .deref()
                        ?.postMessageToWebview({ type: "partialMessage", partialMessage: lastMessage });
                }
                else {
                    // this is a new partial=false message, so add it like normal
                    this.askResponse = undefined;
                    this.askResponseText = undefined;
                    this.askResponseImages = undefined;
                    askTs = Date.now();
                    this.lastMessageTs = askTs;
                    await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text });
                    await this.providerRef.deref()?.postStateToWebview();
                }
            }
        }
        else {
            // this is a new non-partial message, so add it like normal
            // const lastMessage = this.clineMessages.at(-1)
            this.askResponse = undefined;
            this.askResponseText = undefined;
            this.askResponseImages = undefined;
            askTs = Date.now();
            this.lastMessageTs = askTs;
            await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text });
            await this.providerRef.deref()?.postStateToWebview();
        }
        await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 });
        if (this.lastMessageTs !== askTs) {
            throw new Error("Current ask promise was ignored"); // could happen if we send multiple asks in a row i.e. with command_output. It's important that when we know an ask could fail, it is handled gracefully
        }
        const result = { response: this.askResponse, text: this.askResponseText, images: this.askResponseImages };
        this.askResponse = undefined;
        this.askResponseText = undefined;
        this.askResponseImages = undefined;
        return result;
    }
    async handleWebviewAskResponse(askResponse, text, images) {
        this.askResponse = askResponse;
        this.askResponseText = text;
        this.askResponseImages = images;
    }
    async say(type, text, images, partial) {
        if (this.abort) {
            throw new Error("Optima AI instance aborted");
        }
        if (partial !== undefined) {
            // Implementation code here
        }
        return undefined; // Add proper return
    }
    async handleActionHtml(action) {
        if (this.aborted)
            return;
        // ... existing code ...
    }
    async handleActionScrape(action) {
        if (this.aborted)
            return;
        // ... existing code ...
    }
    async handleFetchAction(action) {
        if (this.aborted)
            return;
        // ... existing code ...
    }
    async handleWebSearch(action) {
        if (this.abort) {
            throw new Error("Optima AI instance aborted");
        }
        try {
            // Log the web search action
            console.log(`Web search for query: ${action.query}, maxResults: ${action.maxResults || 5}`);
            // Create a checkpoint before performing the web search
            if (this.checkpointsEnabled && !this.checkpointService) {
                await this.initializeCheckpointService();
            }
            if (this.checkpointsEnabled && this.checkpointService) {
                await this.checkpointService.saveCheckpoint("pre-web-search");
            }
            // Perform the web search
            const searchResults = await this.webSearchService.searchWeb(action.query, action.maxResults || 5, action.useCache !== false // Default to using cache if not specified
            );
            // Format the results for the AI
            const formattedResults = {
                query: searchResults.query,
                results: searchResults.results.map(result => ({
                    title: result.title,
                    url: result.url,
                    text: result.text || "No text content available",
                    links: result.links,
                    images: result.images
                }))
            };
            // Add the search results to the conversation history for the AI to use
            const resultsMessage = `Web search results for "${action.query}":\n\n${formattedResults.results
                .map((result, index) => {
                return `Result ${index + 1}: "${result.title}"\nURL: ${result.url}\n\nContent:\n${result.text?.substring(0, 1000) || "No content available"}${result.text && result.text.length > 1000 ? "... (content truncated)" : ""}\n\n`;
            })
                .join("---\n\n")}`;
            await this.say("web_search_result", resultsMessage);
            return formattedResults;
        }
        catch (error) {
            console.error("Web search error:", error);
            await this.say("error", `Error during web search: ${error.message || "Unknown error"}`);
            throw error;
        }
    }
    // Move the if statement inside a method
    checkModelCompatibility(vscodeModelInfo, modelInfo) {
        if (this.apiConfiguration.provider === "openRouter" &&
            (!vscodeModelInfo.families?.includes("claude") && modelInfo.family !== "laserjet")) {
            return "Optima AI uses complex prompts and iterative task execution that may be challenging for less capable models. For best results, it's recommended to use Claude 3.7 Sonnet for its advanced agentic coding capabilities.";
        }
        return null;
    }
    // Move this method inside the class
    async initializeCheckpointService() {
        if (this.checkpointsEnabled && !this.checkpointService) {
            try {
                const baseDir = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0);
                if (baseDir) {
                    this.checkpointService = await CheckpointService.create({
                        taskId: this.taskId,
                        baseDir,
                        log: console.log
                    });
                    console.log(`[Cline] CheckpointService initialized for task ${this.taskId}`);
                }
            }
            catch (error) {
                console.error(`[Cline] Failed to initialize CheckpointService: ${error}`);
            }
        }
    }
    async startTask(task, images) {
        // Implementation
    }
    async resumeTaskFromHistory() {
        // Implementation
    }
    async abortTask() {
        this.abort = true;
        this.aborted = true;
    }
    async speak(message, options) {
        // Implementation
    }
    async getEnvironmentDetails(includeSystemInfo) {
        // Implementation
        return {};
    }
    async recursivelyMakeClineRequests(messages, includeSystemInfo) {
        // Implementation
    }
    async attemptApiRequest(retryCount) {
        // Implementation
        return [];
    }
    async loadContext(content) {
        // Implementation
        return [content];
    }
    async checkpointDiff(data) {
        // Implementation
    }
    async checkpointRestore(data) {
        // Implementation
    }
}
//# sourceMappingURL=Cline.js.map