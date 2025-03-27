import * as vscode from "vscode"
import { ClineProvider } from "../core/webview/ClineProvider"
import { TerminalManager } from "../integrations/terminal/TerminalManager"

const TERMINAL_COMMAND_IDS = {
<<<<<<< HEAD
	ADD_TO_CONTEXT: "roo-cline.terminalAddToContext",
	FIX: "roo-cline.terminalFixCommand",
	FIX_IN_CURRENT_TASK: "roo-cline.terminalFixCommandInCurrentTask",
	EXPLAIN: "roo-cline.terminalExplainCommand",
	EXPLAIN_IN_CURRENT_TASK: "roo-cline.terminalExplainCommandInCurrentTask",
=======
	ADD_TO_CONTEXT: "optima-ai.terminalAddToContext",
	FIX: "optima-ai.terminalFixCommand",
	FIX_IN_CURRENT_TASK: "optima-ai.terminalFixCommandInCurrentTask",
	EXPLAIN: "optima-ai.terminalExplainCommand",
	EXPLAIN_IN_CURRENT_TASK: "optima-ai.terminalExplainCommandInCurrentTask",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
} as const

export const registerTerminalActions = (context: vscode.ExtensionContext) => {
	const terminalManager = new TerminalManager()

	registerTerminalAction(context, terminalManager, TERMINAL_COMMAND_IDS.ADD_TO_CONTEXT, "TERMINAL_ADD_TO_CONTEXT")

	registerTerminalActionPair(
		context,
		terminalManager,
		TERMINAL_COMMAND_IDS.FIX,
		"TERMINAL_FIX",
<<<<<<< HEAD
		"What would you like Roo to fix?",
=======
		"What would you like Optima to fix?",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
	)

	registerTerminalActionPair(
		context,
		terminalManager,
		TERMINAL_COMMAND_IDS.EXPLAIN,
		"TERMINAL_EXPLAIN",
<<<<<<< HEAD
		"What would you like Roo to explain?",
=======
		"What would you like Optima to explain?",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
	)
}

const registerTerminalAction = (
	context: vscode.ExtensionContext,
	terminalManager: TerminalManager,
	command: string,
	promptType: "TERMINAL_ADD_TO_CONTEXT" | "TERMINAL_FIX" | "TERMINAL_EXPLAIN",
	inputPrompt?: string,
) => {
	context.subscriptions.push(
		vscode.commands.registerCommand(command, async (args: any) => {
			let content = args.selection
			if (!content || content === "") {
				content = await terminalManager.getTerminalContents(promptType === "TERMINAL_ADD_TO_CONTEXT" ? -1 : 1)
			}

			if (!content) {
				vscode.window.showWarningMessage("No terminal content selected")
				return
			}

			const params: Record<string, any> = {
				terminalContent: content,
			}

			if (inputPrompt) {
				params.userInput =
					(await vscode.window.showInputBox({
						prompt: inputPrompt,
					})) ?? ""
			}

			await ClineProvider.handleTerminalAction(command, promptType, params)
		}),
	)
}

const registerTerminalActionPair = (
	context: vscode.ExtensionContext,
	terminalManager: TerminalManager,
	baseCommand: string,
	promptType: "TERMINAL_ADD_TO_CONTEXT" | "TERMINAL_FIX" | "TERMINAL_EXPLAIN",
	inputPrompt?: string,
) => {
	// Register new task version
	registerTerminalAction(context, terminalManager, baseCommand, promptType, inputPrompt)
	// Register current task version
	registerTerminalAction(context, terminalManager, `${baseCommand}InCurrentTask`, promptType, inputPrompt)
}
