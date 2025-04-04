import { VSCodeButton, VSCodeTextField, VSCodeRadioGroup, VSCodeRadio } from "@vscode/webview-ui-toolkit/react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import { Virtuoso } from "react-virtuoso"
import React, { memo, useMemo, useState, useEffect, forwardRef } from "react"
import { Fzf } from "fzf"
import { formatLargeNumber } from "../../utils/format"
import { highlightFzfMatch } from "../../utils/highlight"
import { useCopyToClipboard } from "../../utils/clipboard"
import { Task } from "../../types/task"
import { vscode as vscodeUtilities } from "../../utilities/vscode"
import styles from "./HistoryView.module.css"

type HistoryViewProps = {
	onDone: () => void
}

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

const HistoryView = ({ onDone }: HistoryViewProps) => {
	const { taskHistory } = useExtensionState()
	const [searchQuery, setSearchQuery] = useState("")
	const [sortOption, setSortOption] = useState<SortOption>("newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<SortOption | null>("newest")
	const { showCopyFeedback, copyWithFeedback } = useCopyToClipboard()

	useEffect(() => {
		if (searchQuery && sortOption !== "mostRelevant" && !lastNonRelevantSort) {
			setLastNonRelevantSort(sortOption)
			setSortOption("mostRelevant")
		} else if (!searchQuery && sortOption === "mostRelevant" && lastNonRelevantSort) {
			setSortOption(lastNonRelevantSort)
			setLastNonRelevantSort(null)
		}
	}, [searchQuery, sortOption, lastNonRelevantSort])

	const handleHistorySelect = (id: string) => {
		vscodeUtilities.postMessage({ type: "showTaskWithId", text: id })
	}

	const handleDeleteHistoryItem = (id: string) => {
		vscodeUtilities.postMessage({ type: "deleteTaskWithId", text: id })
	}

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp)
		return date
			?.toLocaleString("en-US", {
				month: "long",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			})
			.replace(", ", " ")
			.replace(" at", ",")
			.toUpperCase()
	}

	const presentableTasks = useMemo(() => {
		return taskHistory.filter((item) => item.ts && item.task)
	}, [taskHistory])

	const fzf = useMemo(() => {
		return new Fzf(presentableTasks, {
			selector: (item) => item.task,
		})
	}, [presentableTasks])

	const taskHistorySearchResults = useMemo(() => {
		let results = presentableTasks
		if (searchQuery) {
			const searchResults = fzf.find(searchQuery)
			results = searchResults.map((result) => ({
				...result.item,
				task: highlightFzfMatch(result.item.task, Array.from(result.positions)),
			}))
		}

		// First apply search if needed
		const searchResults = searchQuery ? results : presentableTasks

		// Then sort the results
		return [...searchResults].sort((a, b) => {
			switch (sortOption) {
				case "oldest":
					return (a.ts || 0) - (b.ts || 0)
				case "mostExpensive":
					return (b.totalCost || 0) - (a.totalCost || 0)
				case "mostTokens":
					const aTokens = (a.tokensIn || 0) + (a.tokensOut || 0) + (a.cacheWrites || 0) + (a.cacheReads || 0)
					const bTokens = (b.tokensIn || 0) + (b.tokensOut || 0) + (b.cacheWrites || 0) + (b.cacheReads || 0)
					return bTokens - aTokens
				case "mostRelevant":
					// Keep fuse order if searching, otherwise sort by newest
					return searchQuery ? 0 : (b.ts || 0) - (a.ts || 0)
				case "newest":
				default:
					return (b.ts || 0) - (a.ts || 0)
			}
		})
	}, [presentableTasks, searchQuery, fzf, sortOption])

	return (
		<>
			<style>
				{`
					.history-item:hover {
						background-color: var(--vscode-list-hoverBackground);
					}
					.delete-button, .export-button, .copy-button {
						opacity: 0;
						pointer-events: none;
					}
					.history-item:hover .delete-button,
					.history-item:hover .export-button,
					.history-item:hover .copy-button {
						opacity: 1;
						pointer-events: auto;
					}
					.history-item-highlight {
						background-color: var(--vscode-editor-findMatchHighlightBackground);
						color: inherit;
					}
					.copy-modal {
						position: fixed;
						top: 50%;
						left: 50%;
						transform: translate(-50%, -50%);
						background-color: var(--vscode-notifications-background);
						color: var(--vscode-notifications-foreground);
						padding: 12px 20px;
						border-radius: 4px;
						box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
						z-index: 1000;
						transition: opacity 0.2s ease-in-out;
					}
				`}
			</style>
			{showCopyFeedback && <div className="copy-modal">Prompt Copied to Clipboard</div>}
			<div
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						padding: "10px 17px 10px 20px",
					}}>
					<h3 style={{ color: "var(--vscode-foreground)", margin: 0 }}>History</h3>
					<VSCodeButton onClick={onDone}>Done</VSCodeButton>
				</div>
				<div style={{ padding: "5px 17px 6px 17px" }}>
					<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
						<VSCodeTextField
							style={{ width: "100%" }}
							placeholder="Fuzzy search history..."
							value={searchQuery}
							onInput={(e) => {
								const newValue = (e.target as HTMLInputElement)?.value
								setSearchQuery(newValue)
								if (newValue && !searchQuery && sortOption !== "mostRelevant") {
									setLastNonRelevantSort(sortOption)
									setSortOption("mostRelevant")
								}
							}}>
							<div
								slot="start"
								className="codicon codicon-search"
								style={{ fontSize: 13, marginTop: 2.5, opacity: 0.8 }}></div>
							{searchQuery && (
								<div
									className="input-icon-button codicon codicon-close"
									aria-label="Clear search"
									onClick={() => setSearchQuery("")}
									slot="end"
									style={{
										display: "flex",
										justifyContent: "center",
										alignItems: "center",
										height: "100%",
									}}
								/>
							)}
						</VSCodeTextField>
						<VSCodeRadioGroup
							style={{ display: "flex", flexWrap: "wrap" }}
							value={sortOption}
							role="radiogroup"
							onChange={(e) => setSortOption((e.target as HTMLInputElement).value as SortOption)}>
							<VSCodeRadio value="newest">Newest</VSCodeRadio>
							<VSCodeRadio value="oldest">Oldest</VSCodeRadio>
							<VSCodeRadio value="mostExpensive">Most Expensive</VSCodeRadio>
							<VSCodeRadio value="mostTokens">Most Tokens</VSCodeRadio>
							<VSCodeRadio
								value="mostRelevant"
								disabled={!searchQuery}
								style={{ opacity: searchQuery ? 1 : 0.5 }}>
								Most Relevant
							</VSCodeRadio>
						</VSCodeRadioGroup>
					</div>
				</div>
				<div style={{ flexGrow: 1, overflowY: "auto", margin: 0 }}>
					<Virtuoso
						style={{
							flexGrow: 1,
							overflowY: "scroll",
						}}
						data={taskHistorySearchResults}
						data-testid="virtuoso-container"
						components={{
							List: forwardRef(({ style, children, ...props }, ref) => (
								<div {...props} ref={ref} data-testid="virtuoso-item-list" />
							)),
						}}
						context={{
							emptyPlaceholder: {
								style: {
									padding: 40,
									height: "100%",
									display: "flex",
									flexDirection: "column",
									justifyContent: "center",
									alignItems: "center",
									textAlign: "center",
									color: "var(--vscode-descriptionForeground)",
								},
							},
						}}
						itemContent={(index, historyItem) => (
							<div
								key={historyItem.id}
								style={{
									position: "relative",
									cursor: "pointer",
									padding: "12px 16px",
									marginBottom: "8px",
									backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
									border: "1px solid var(--optima-gray-light, var(--vscode-input-border))",
									borderRadius: "var(--radius)",
									overflow: "hidden",
									transition: "all 0.2s ease",
									boxShadow: "0 2px 5px rgba(0, 0, 0, 0.05)",
								}}
								className="history-item"
								onClick={() => handleHistorySelect(historyItem.id)}>
								<style>{`
									.history-item:hover {
										transform: translateY(-2px);
										box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
										border-color: var(--optima-pink-light, var(--vscode-input-border));
									}
									.history-item:hover .history-item-buttons {
										opacity: 1;
									}
								`}</style>
								<div
									style={{
										position: "absolute",
										top: "10px",
										right: "10px",
										display: "flex",
										gap: "6px",
										opacity: 0,
										transition: "opacity 0.2s ease",
									}}
									className="history-item-buttons">
									<ExportButton itemId={historyItem.id} />
									<VSCodeButton
										appearance="icon"
										onClick={(e) => {
											e.stopPropagation()
											handleDeleteHistoryItem(historyItem.id)
										}}>
										<span className="codicon codicon-trash"></span>
									</VSCodeButton>
								</div>
								<div
									style={{
										marginBottom: "8px",
										paddingBottom: "8px",
										borderBottom: "1px solid var(--vscode-input-border)",
										wordBreak: "break-word",
										paddingRight: "50px", // Make room for the icons on hover
									}}>
									{searchQuery ? (
										<div
											dangerouslySetInnerHTML={{ __html: historyItem.task }}
											style={{ fontWeight: "bold" }}
										/>
									) : (
										<div style={{ fontWeight: "bold" }}>{historyItem.task}</div>
									)}
								</div>
								
								{/* Add a subtle pinky accent border on the left side */}
								<div 
									style={{
										position: "absolute",
										left: 0,
										top: 0,
										bottom: 0,
										width: "3px",
										backgroundColor: "var(--optima-pink)",
										borderTopLeftRadius: "var(--radius)",
										borderBottomLeftRadius: "var(--radius)",
									}}
								/>
								
								<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
									<div
										style={{
											fontSize: "12px",
											color: "var(--vscode-descriptionForeground)",
										}}>
										{formatDate(historyItem.ts)}
									</div>
									<div
										style={{
											display: "flex",
											gap: "12px",
											fontSize: "12px",
											color: "var(--vscode-descriptionForeground)",
										}}>
										{historyItem.tokensIn !== undefined && (
											<div>
												Input: {formatLargeNumber(historyItem.tokensIn)}
											</div>
										)}
										{historyItem.tokensOut !== undefined && (
											<div>
												Output: {formatLargeNumber(historyItem.tokensOut)}
											</div>
										)}
										{historyItem.totalCost !== undefined && historyItem.totalCost > 0 && (
											<div>
												Cost: ${historyItem.totalCost.toFixed(historyItem.totalCost < 0.01 ? 5 : 3)}
											</div>
										)}
									</div>
								</div>
							</div>
						)}
					/>
				</div>
			</div>
			<div className={styles.taskPreviewPlaceholder}>
				<p>Select a task to preview</p>
				<svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.placeholderIcon}>
					<path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			</div>
		</>
	)
}

const ExportButton = ({ itemId }: { itemId: string }) => (
	<VSCodeButton
		className="export-button"
		appearance="icon"
		onClick={(e) => {
			e.stopPropagation()
			vscodeUtilities.postMessage({ type: "exportTaskWithId", text: itemId })
		}}>
		<div style={{ fontSize: "11px", fontWeight: 500, opacity: 1 }}>EXPORT</div>
	</VSCodeButton>
)

export default memo(HistoryView)
