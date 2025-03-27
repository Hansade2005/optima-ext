import * as vscode from "vscode";
import { EditorUtils } from "./EditorUtils";
export const ACTION_NAMES = {
    EXPLAIN: "Optima AI: Explain Code",
    FIX: "Optima AI: Fix Code",
    FIX_LOGIC: "Optima AI: Fix Logic",
    IMPROVE: "Optima AI: Improve Code",
    ADD_TO_CONTEXT: "Optima AI: Add to Context",
};
export const COMMAND_IDS = {
    EXPLAIN: "optima-ai.explainCode",
    FIX: "optima-ai.fixCode",
    IMPROVE: "optima-ai.improveCode",
    ADD_TO_CONTEXT: "optima-ai.addToContext",
};
export class CodeActionProvider {
    static providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.RefactorRewrite,
    ];
    createAction(title, kind, command, args) {
        const action = new vscode.CodeAction(title, kind);
        action.command = { command, title, arguments: args };
        return action;
    }
    createActionPair(baseTitle, kind, baseCommand, args) {
        return [
            this.createAction(`${baseTitle} in New Task`, kind, baseCommand, args),
            this.createAction(`${baseTitle} in Current Task`, kind, `${baseCommand}InCurrentTask`, args),
        ];
    }
    provideCodeActions(document, range, context) {
        try {
            const effectiveRange = EditorUtils.getEffectiveRange(document, range);
            if (!effectiveRange) {
                return [];
            }
            const filePath = EditorUtils.getFilePath(document);
            const actions = [];
            actions.push(...this.createActionPair(ACTION_NAMES.EXPLAIN, vscode.CodeActionKind.QuickFix, COMMAND_IDS.EXPLAIN, [
                filePath,
                effectiveRange.text,
            ]));
            if (context.diagnostics.length > 0) {
                const relevantDiagnostics = context.diagnostics.filter((d) => EditorUtils.hasIntersectingRange(effectiveRange.range, d.range));
                if (relevantDiagnostics.length > 0) {
                    const diagnosticMessages = relevantDiagnostics.map(EditorUtils.createDiagnosticData);
                    actions.push(...this.createActionPair(ACTION_NAMES.FIX, vscode.CodeActionKind.QuickFix, COMMAND_IDS.FIX, [
                        filePath,
                        effectiveRange.text,
                        diagnosticMessages,
                    ]));
                }
            }
            else {
                actions.push(...this.createActionPair(ACTION_NAMES.FIX_LOGIC, vscode.CodeActionKind.QuickFix, COMMAND_IDS.FIX, [
                    filePath,
                    effectiveRange.text,
                ]));
            }
            actions.push(...this.createActionPair(ACTION_NAMES.IMPROVE, vscode.CodeActionKind.RefactorRewrite, COMMAND_IDS.IMPROVE, [filePath, effectiveRange.text]));
            actions.push(this.createAction(ACTION_NAMES.ADD_TO_CONTEXT, vscode.CodeActionKind.QuickFix, COMMAND_IDS.ADD_TO_CONTEXT, [filePath, effectiveRange.text]));
            return actions;
        }
        catch (error) {
            console.error("Error providing code actions:", error);
            return [];
        }
    }
}
//# sourceMappingURL=CodeActionProvider.js.map