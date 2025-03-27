import * as vscode from "vscode";
import { CodeActionProvider, ACTION_NAMES } from "../CodeActionProvider";
import { EditorUtils } from "../EditorUtils";
// Mock VSCode API
jest.mock("vscode", () => ({
    CodeAction: jest.fn().mockImplementation((title, kind) => ({
        title,
        kind,
        command: undefined,
    })),
    CodeActionKind: {
        QuickFix: { value: "quickfix" },
        RefactorRewrite: { value: "refactor.rewrite" },
    },
    Range: jest.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
        start: { line: startLine, character: startChar },
        end: { line: endLine, character: endChar },
    })),
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3,
    },
}));
// Mock EditorUtils
jest.mock("../EditorUtils", () => ({
    EditorUtils: {
        getEffectiveRange: jest.fn(),
        getFilePath: jest.fn(),
        hasIntersectingRange: jest.fn(),
        createDiagnosticData: jest.fn(),
    },
}));
describe("CodeActionProvider", () => {
    let provider;
    let mockDocument;
    let mockRange;
    let mockContext;
    beforeEach(() => {
        provider = new CodeActionProvider();
        // Mock document
        mockDocument = {
            getText: jest.fn(),
            lineAt: jest.fn(),
            lineCount: 10,
            uri: { fsPath: "/test/file.ts" },
        };
        // Mock range
        mockRange = new vscode.Range(0, 0, 0, 10);
        // Mock context
        mockContext = {
            diagnostics: [],
        };
        EditorUtils.getEffectiveRange.mockReturnValue({
            range: mockRange,
            text: "test code",
        });
        EditorUtils.getFilePath.mockReturnValue("/test/file.ts");
        EditorUtils.hasIntersectingRange.mockReturnValue(true);
        EditorUtils.createDiagnosticData.mockImplementation((d) => d);
    });
    describe("provideCodeActions", () => {
        it("should provide explain, improve, fix logic, and add to context actions by default", () => {
            const actions = provider.provideCodeActions(mockDocument, mockRange, mockContext);
            expect(actions).toHaveLength(7); // 2 explain + 2 fix logic + 2 improve + 1 add to context
            expect(actions[0].title).toBe(`${ACTION_NAMES.EXPLAIN} in New Task`);
            expect(actions[1].title).toBe(`${ACTION_NAMES.EXPLAIN} in Current Task`);
            expect(actions[2].title).toBe(`${ACTION_NAMES.FIX_LOGIC} in New Task`);
            expect(actions[3].title).toBe(`${ACTION_NAMES.FIX_LOGIC} in Current Task`);
            expect(actions[4].title).toBe(`${ACTION_NAMES.IMPROVE} in New Task`);
            expect(actions[5].title).toBe(`${ACTION_NAMES.IMPROVE} in Current Task`);
            expect(actions[6].title).toBe(ACTION_NAMES.ADD_TO_CONTEXT);
        });
        it("should provide fix action instead of fix logic when diagnostics exist", () => {
            mockContext.diagnostics = [
                {
                    message: "test error",
                    severity: vscode.DiagnosticSeverity.Error,
                    range: mockRange,
                },
            ];
            const actions = provider.provideCodeActions(mockDocument, mockRange, mockContext);
            expect(actions).toHaveLength(7); // 2 explain + 2 fix + 2 improve + 1 add to context
            expect(actions.some((a) => a.title === `${ACTION_NAMES.FIX} in New Task`)).toBe(true);
            expect(actions.some((a) => a.title === `${ACTION_NAMES.FIX} in Current Task`)).toBe(true);
            expect(actions.some((a) => a.title === `${ACTION_NAMES.FIX_LOGIC} in New Task`)).toBe(false);
            expect(actions.some((a) => a.title === `${ACTION_NAMES.FIX_LOGIC} in Current Task`)).toBe(false);
        });
        it("should return empty array when no effective range", () => {
            ;
            EditorUtils.getEffectiveRange.mockReturnValue(null);
            const actions = provider.provideCodeActions(mockDocument, mockRange, mockContext);
            expect(actions).toEqual([]);
        });
        it("should handle errors gracefully", () => {
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });
            EditorUtils.getEffectiveRange.mockImplementation(() => {
                throw new Error("Test error");
            });
            const actions = provider.provideCodeActions(mockDocument, mockRange, mockContext);
            expect(actions).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalledWith("Error providing code actions:", expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });
});
//# sourceMappingURL=CodeActionProvider.test.js.map