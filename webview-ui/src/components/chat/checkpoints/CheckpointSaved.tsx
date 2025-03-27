import { useEffect, useRef, useState } from "react"
import { CheckpointMenu } from "./CheckpointMenu"
import { vscode } from "../../../utilities/vscode"
import styles from "./CheckpointSaved.module.css"

type CheckpointSavedProps = {
	ts: number
	commitHash: string
	currentCheckpointHash?: string
}

export const CheckpointSaved = (props: CheckpointSavedProps) => {
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isConfirming, setIsConfirming] = useState(false)
	const isCurrent = props.currentCheckpointHash === props.commitHash

	return (
		<div style={{ marginTop: "10px" }}>
			<div
				style={{
					backgroundColor: "rgba(0, 153, 51, 0.1)",
					border: "1px solid rgba(0, 153, 51, 0.3)",
					borderRadius: "4px",
					padding: "10px 12px",
					marginBottom: "5px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "10px",
					position: "relative",
				}}>
				<div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.9em" }}>
					<span
						className="codicon codicon-debug-line-by-line"
						style={{ color: "var(--vscode-charts-green)" }}></span>
					<span>
						<span style={{ fontWeight: 600 }}>Checkpoint saved</span> (
						<code style={{ fontSize: "0.9em" }}>{props.commitHash.substring(0, 8)}</code>)
					</span>
				</div>
				<div style={{ display: "flex", gap: "4px" }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							border: "1px solid var(--vscode-border)",
							borderRadius: "3px",
							width: "24px",
							height: "24px",
							cursor: "pointer",
						}}
						title="View Diff"
						onClick={() =>
							vscode.postMessage({
								type: "checkpointDiff",
								payload: { ts: props.ts, commitHash: props.commitHash, mode: "checkpoint" },
							})
						}>
						<span className="codicon codicon-diff"></span>
					</div>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							border: "1px solid var(--vscode-border)",
							borderRadius: "3px",
							width: "24px",
							height: "24px",
							cursor: "pointer",
							position: "relative",
						}}
						title="Open Menu"
						onClick={(e) => {
							e.stopPropagation()
							setIsMenuOpen(!isMenuOpen)
						}}>
						<span className="codicon codicon-ellipsis"></span>
						{isMenuOpen && (
							<div
								style={{
									position: "absolute",
									top: "calc(100% + 4px)",
									right: 0,
									backgroundColor: "var(--vscode-editor-background)",
									border: "1px solid var(--vscode-editorWidget-border)",
									borderRadius: "3px",
									boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
									zIndex: 10,
									width: "200px",
								}}>
								<div
									style={{
										padding: "6px 10px",
										cursor: "pointer",
										fontSize: "0.85em",
										display: "flex",
										alignItems: "center",
										gap: "5px",
									}}
									onClick={() => {
										vscode.postMessage({
											type: "checkpointRestore",
											payload: { ts: props.ts, commitHash: props.commitHash, mode: "preview" },
										})
										setIsMenuOpen(false)
									}}>
									<span className="codicon codicon-empty-window"></span>
									<span>Restore Files</span>
								</div>
								<div
									style={{
										borderTop: "1px solid var(--vscode-editorWidget-border)",
										padding: "6px 10px",
										cursor: "pointer",
										fontSize: "0.85em",
										display: "flex",
										alignItems: "center",
										gap: "5px",
									}}
									onClick={() => {
										if (isConfirming) {
											vscode.postMessage({
												type: "checkpointRestore",
												payload: { ts: props.ts, commitHash: props.commitHash, mode: "restore" },
											})
											setIsMenuOpen(false)
											setIsConfirming(false)
										} else {
											setIsConfirming(true)
										}
									}}>
									{isConfirming ? (
										<>
											<span className="codicon codicon-warning" style={{ color: "#e51400" }}></span>
											<span style={{ color: "#e51400" }}>Confirm Restore Files & Task</span>
										</>
									) : (
										<>
											<span className="codicon codicon-trash"></span>
											<span>Restore Files & Task</span>
										</>
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
