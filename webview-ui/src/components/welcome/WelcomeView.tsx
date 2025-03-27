import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useState } from "react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { validateApiConfiguration } from "../../utils/validate"
import { vscode } from "../../utils/vscode"
import ApiOptions from "../settings/ApiOptions"
import styles from "./WelcomeView.module.css"

const WelcomeView = () => {
	const { apiConfiguration } = useExtensionState()

	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

	const handleSubmit = () => {
		const error = validateApiConfiguration(apiConfiguration)
		if (error) {
			setErrorMessage(error)
			return
		}
		setErrorMessage(undefined)
		vscode.postMessage({ type: "apiConfiguration", apiConfiguration })
	}

	return (
		<div style={{ 
			position: "fixed", 
			top: 0, 
			left: 0, 
			right: 0, 
			bottom: 0, 
			padding: "0 20px",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
		}}>
			<div style={{
				maxWidth: "600px",
				width: "100%",
				backgroundColor: "var(--vscode-editor-background)",
				borderRadius: "12px",
				padding: "24px",
				boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
				border: "1px solid var(--optima-pink-light, var(--vscode-editor-lineHighlightBorder))",
				marginBottom: "24px"
			}}>
				<div style={{ 
					display: "flex", 
					alignItems: "center", 
					marginBottom: "16px",
					borderBottom: "1px solid var(--optima-accent-light, var(--vscode-editor-lineHighlightBorder))",
					paddingBottom: "16px"
				}}>
					<div style={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						width: "48px",
						height: "48px",
						borderRadius: "50%",
						backgroundColor: "var(--optima-pink, var(--vscode-button-background))",
						marginRight: "16px"
					}}>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
								fill="var(--vscode-editor-background)" />
						</svg>
					</div>
					<h2 style={{ margin: 0, color: "var(--optima-pink, var(--vscode-editor-foreground))" }}>
						Welcome to Optima AI
					</h2>
				</div>
				<p style={{ 
					fontSize: "14px", 
					lineHeight: "1.6", 
					color: "var(--vscode-editor-foreground)",
					marginBottom: "20px"
				}}>
					I can do all kinds of tasks thanks to the latest breakthroughs in agentic coding capabilities and access
					to tools that let me create & edit files, explore complex projects, use the browser, and execute
					terminal commands (with your permission, of course). I can even use MCP to create new tools and extend
					my own capabilities.
				</p>

				<div style={{ 
					padding: "12px", 
					backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
					borderRadius: "8px",
					marginBottom: "20px",
					fontWeight: "bold" 
				}}>
					To get started, this extension needs an API provider.
				</div>

				<div style={{ marginTop: "10px" }}>
					<ApiOptions fromWelcomeView />
					<div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "12px" }}>
						<VSCodeButton 
							onClick={handleSubmit} 
							style={{ 
								marginTop: "8px",
								borderRadius: "6px",
								padding: "8px 16px",
								fontWeight: "bold",
								height: "auto",
								backgroundColor: "var(--optima-pink, var(--vscode-button-background))",
								transition: "transform 0.2s ease, background-color 0.2s ease",
							}}
							onMouseOver={(e) => {
								e.currentTarget.style.transform = "translateY(-2px)";
								e.currentTarget.style.backgroundColor = "var(--optima-pink-dark, var(--vscode-button-hoverBackground))";
							}}
							onMouseOut={(e) => {
								e.currentTarget.style.transform = "translateY(0)";
								e.currentTarget.style.backgroundColor = "var(--optima-pink, var(--vscode-button-background))";
							}}
						>
							Let's get started with Optima AI!
						</VSCodeButton>
						{errorMessage && <span style={{ color: "var(--vscode-errorForeground)", marginTop: "8px" }}>{errorMessage}</span>}
					</div>
				</div>
			</div>
		</div>
	)
}

export default WelcomeView
