import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { useWindowSize } from "react-use"
import { ClineMessage } from "../../../../src/shared/ExtensionMessage"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import Thumbnails from "../common/Thumbnails"
import { mentionRegexGlobal } from "../../../../src/shared/context-mentions"
import { formatLargeNumber } from "../../utils/format"
import { normalizeApiConfiguration } from "../settings/ApiOptions"



interface TaskHeaderProps {
	task: ClineMessage
	tokensIn: number
	tokensOut: number
	doesModelSupportPromptCache: boolean
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	contextTokens: number
	onClose: () => void
}

const TaskHeader: React.FC<TaskHeaderProps> = ({
	task,
	tokensIn,
	tokensOut,
	doesModelSupportPromptCache,
	cacheWrites,
	cacheReads,
	totalCost,
	contextTokens,
	onClose,
}) => {
	const { apiConfiguration } = useExtensionState()
	const { selectedModelInfo } = useMemo(() => normalizeApiConfiguration(apiConfiguration), [apiConfiguration])
	const [isTaskExpanded, setIsTaskExpanded] = useState(true)
	const [isTextExpanded, setIsTextExpanded] = useState(false)
	const [showSeeMore, setShowSeeMore] = useState(false)
	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)
	const contextWindow = selectedModelInfo?.contextWindow || 1
	const contextPercentage = Math.round((contextTokens / contextWindow) * 100)



	const { height: windowHeight, width: windowWidth } = useWindowSize()

	useEffect(() => {
		if (isTextExpanded && textContainerRef.current) {
			const maxHeight = windowHeight * (1 / 2)
			textContainerRef.current.style.maxHeight = `${maxHeight}px`
		}
	}, [isTextExpanded, windowHeight])

	useEffect(() => {
		if (textRef.current && textContainerRef.current) {
			let textContainerHeight = textContainerRef.current.clientHeight
			if (!textContainerHeight) {
				textContainerHeight = textContainerRef.current.getBoundingClientRect().height
			}
			const isOverflowing = textRef.current.scrollHeight > textContainerHeight


			if (!isOverflowing) {
				setIsTextExpanded(false)
			}
			setShowSeeMore(isOverflowing)
		}
	}, [task.text, windowWidth])

	const isCostAvailable = useMemo(() => {
		return (
			apiConfiguration?.apiProvider !== "openai" &&
			apiConfiguration?.apiProvider !== "ollama" &&
			apiConfiguration?.apiProvider !== "lmstudio" &&
			apiConfiguration?.apiProvider !== "gemini"
		)
	}, [apiConfiguration?.apiProvider])

	const shouldShowPromptCacheInfo = doesModelSupportPromptCache && apiConfiguration?.apiProvider !== "openrouter"

	return (


					padding: "9px 10px 9px 14px",
					display: "flex",
					flexDirection: "column",
					gap: 6,
					position: "relative",
					zIndex: 1,
				}}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							cursor: "pointer",
							marginLeft: -2,
							userSelect: "none",
							WebkitUserSelect: "none",
							MozUserSelect: "none",
							msUserSelect: "none",
							flexGrow: 1,


						</div>
						<div
							style={{
								marginLeft: 6,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
								flexGrow: 1,


							{!isTaskExpanded && (
								<span style={{ marginLeft: 4 }}>{highlightMentions(task.text, false)}</span>
							)}
						</div>
					</div>
					{!isTaskExpanded && isCostAvailable && (
						<div
							style={{
								marginLeft: 10,


								display: "inline-block",
								flexShrink: 0,
							}}>
							${totalCost?.toFixed(4)}
						</div>
					)}


						<span className="codicon codicon-close"></span>
					</VSCodeButton>
				</div>
				{isTaskExpanded && (
					<>
						<div
							ref={textContainerRef}
							style={{
								marginTop: -2,
								fontSize: "var(--vscode-font-size)",
								overflowY: isTextExpanded ? "auto" : "hidden",
								wordBreak: "break-word",
								overflowWrap: "anywhere",
								position: "relative",


							}}>
							<div
								ref={textRef}
								style={{
									display: "-webkit-box",
									WebkitLineClamp: isTextExpanded ? "unset" : 3,
									WebkitBoxOrient: "vertical",
									overflow: "hidden",
									whiteSpace: "pre-wrap",
									wordBreak: "break-word",
									overflowWrap: "anywhere",
								}}>
								{highlightMentions(task.text, false)}
							</div>
							{!isTextExpanded && showSeeMore && (
								<div
									style={{
										position: "absolute",
										right: 0,
										bottom: 0,
										display: "flex",
										alignItems: "center",
									}}>
									<div
										style={{
											width: 30,
											height: "1.2em",


										}}
									/>
									<div
										style={{
											cursor: "pointer",


										}}
										onClick={() => setIsTextExpanded(!isTextExpanded)}>
										See more
									</div>
								</div>
							)}
						</div>
						{isTextExpanded && showSeeMore && (
							<div
								style={{
									cursor: "pointer",


								}}
								onClick={() => setIsTextExpanded(!isTextExpanded)}>
								See less
							</div>
						)}


		</div>
	)
}

export const highlightMentions = (text?: string, withShadow = true) => {
	if (!text) return text
	const parts = text.split(mentionRegexGlobal)
	return parts.map((part, index) => {
		if (index % 2 === 0) {
			// This is regular text
			return part
		} else {
			// This is a mention
			return (
				<span
					key={index}
					className={withShadow ? "mention-context-highlight-with-shadow" : "mention-context-highlight"}
					style={{ cursor: "pointer" }}
					onClick={() => vscode.postMessage({ type: "openMention", text: part })}>
					@{part}
				</span>
			)
		}
	})
}

const ExportButton = () => (
	<VSCodeButton
		appearance="icon"
		onClick={() => vscode.postMessage({ type: "exportCurrentTask" })}
		style={
			{
				// marginBottom: "-2px",
				// marginRight: "-2.5px",
			}
		}>
		<div style={{ fontSize: "10.5px", fontWeight: "bold", opacity: 0.6 }}>EXPORT</div>
	</VSCodeButton>
)

export default memo(TaskHeader)

