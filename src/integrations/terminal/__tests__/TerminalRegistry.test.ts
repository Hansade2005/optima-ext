import * as vscode from "vscode"
import { TerminalRegistry } from "../TerminalRegistry"

// Mock vscode.window.createTerminal
const mockCreateTerminal = jest.fn()
jest.mock("vscode", () => ({
	window: {
		createTerminal: (...args: any[]) => {
			mockCreateTerminal(...args)
			return {
				exitStatus: undefined,
			}
		},
	},
	ThemeIcon: jest.fn(),
}))

describe("TerminalRegistry", () => {
	beforeEach(() => {
		mockCreateTerminal.mockClear()
	})

	describe("createTerminal", () => {
		it("creates terminal with PAGER set to cat", () => {
			TerminalRegistry.createTerminal("/test/path")

			expect(mockCreateTerminal).toHaveBeenCalledWith({
				cwd: "/test/path",
<<<<<<< HEAD
				name: "Roo Code",
=======
				name: "Optima AI",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
				iconPath: expect.any(Object),
				env: {
					PAGER: "cat",
				},
			})
		})
	})
})
