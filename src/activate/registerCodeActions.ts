import * as vscode from "vscode"

import { ACTION_NAMES, COMMAND_IDS } from "../core/CodeActionProvider"
import { EditorUtils } from "../core/EditorUtils"
import { ClineProvider } from "../core/webview/ClineProvider"

export const registerCodeActions = (context: vscode.ExtensionContext) => {
	registerCodeActionPair(
		context,
		COMMAND_IDS.EXPLAIN,
		"EXPLAIN",
<<<<<<< HEAD
		"What would you like Roo to explain?",
=======
		"What would you like Optima to explain?",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
		"E.g. How does the error handling work?",
	)

	registerCodeActionPair(
		context,
		COMMAND_IDS.FIX,
		"FIX",
<<<<<<< HEAD
		"What would you like Roo to fix?",
=======
		"What would you like Optima to fix?",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
		"E.g. Maintain backward compatibility",
	)

	registerCodeActionPair(
		context,
		COMMAND_IDS.IMPROVE,
		"IMPROVE",
<<<<<<< HEAD
		"What would you like Roo to improve?",
=======
		"What would you like Optima to improve?",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
		"E.g. Focus on performance optimization",
	)

	registerCodeAction(context, COMMAND_IDS.ADD_TO_CONTEXT, "ADD_TO_CONTEXT")
}

const registerCodeAction = (
	context: vscode.ExtensionContext,
	command: string,
	promptType: keyof typeof ACTION_NAMES,
	inputPrompt?: string,
	inputPlaceholder?: string,
) => {
	let userInput: string | undefined

	context.subscriptions.push(
		vscode.commands.registerCommand(command, async (...args: any[]) => {
			if (inputPrompt) {
				userInput = await vscode.window.showInputBox({
					prompt: inputPrompt,
					placeHolder: inputPlaceholder,
				})
			}

			// Handle both code action and direct command cases.
			let filePath: string
			let selectedText: string
			let diagnostics: any[] | undefined

			if (args.length > 1) {
				// Called from code action.
				;[filePath, selectedText, diagnostics] = args
			} else {
				// Called directly from command palette.
				const context = EditorUtils.getEditorContext()
				if (!context) return
				;({ filePath, selectedText, diagnostics } = context)
			}

			const params = {
				...{ filePath, selectedText },
				...(diagnostics ? { diagnostics } : {}),
				...(userInput ? { userInput } : {}),
			}

			await ClineProvider.handleCodeAction(command, promptType, params)
		}),
	)
}

const registerCodeActionPair = (
	context: vscode.ExtensionContext,
	baseCommand: string,
	promptType: keyof typeof ACTION_NAMES,
	inputPrompt?: string,
	inputPlaceholder?: string,
) => {
	// Register new task version.
	registerCodeAction(context, baseCommand, promptType, inputPrompt, inputPlaceholder)

	// Register current task version.
	registerCodeAction(context, `${baseCommand}InCurrentTask`, promptType, inputPrompt, inputPlaceholder)
}
