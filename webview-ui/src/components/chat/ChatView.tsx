import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import debounce from "debounce"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDeepCompareEffect, useEvent, useMount } from "react-use"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import styled from "styled-components"
import {
	ClineAsk,
	ClineMessage,
	ClineSayBrowserAction,
	ClineSayTool,
	ExtensionMessage,
} from "../../../../src/shared/ExtensionMessage"
import { McpServer, McpTool } from "../../../../src/shared/mcp"
import { findLast } from "../../../../src/shared/array"
import { combineApiRequests } from "../../../../src/shared/combineApiRequests"
import { combineCommandSequences } from "../../../../src/shared/combineCommandSequences"
import { getApiMetrics } from "../../../../src/shared/getApiMetrics"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import HistoryPreview from "../history/HistoryPreview"
import { normalizeApiConfiguration } from "../settings/ApiOptions"
import Announcement from "./Announcement"
import BrowserSessionRow from "./BrowserSessionRow"
import ChatRow from "./ChatRow"
import ChatTextArea from "./ChatTextArea"
import TaskHeader from "./TaskHeader"
import AutoApproveMenu from "./AutoApproveMenu"
import { AudioType } from "../../../../src/shared/WebviewMessage"
import { validateCommand } from "../../utils/command-validation"
import { Button } from "../ui/button"
import { ScrollToBottom } from "../ui/scroll-to-bottom"
import cn from "classnames"

interface ChatViewProps {
	isHidden: boolean
	showAnnouncement: boolean
	hideAnnouncement: () => void
	showHistoryView: () => void
}

export const MAX_IMAGES_PER_MESSAGE = 20 // Anthropic limits to 20 images

const ChatView = ({ isHidden, showAnnouncement, hideAnnouncement, showHistoryView }: ChatViewProps) => {
	const {
		version,
		clineMessages: messages,
		taskHistory,
		apiConfiguration,
		mcpServers,
		alwaysAllowBrowser,
		alwaysAllowReadOnly,
		alwaysAllowWrite,
		alwaysAllowExecute,
		alwaysAllowMcp,
		allowedCommands,
		writeDelayMs,
		mode,
		setMode,
		autoApprovalEnabled,
		alwaysAllowModeSwitch,
	} = useExtensionState()

	const [commandInput, setCommandInput] = useState<string>("")
	const [modifiedMessages, setModifiedMessages] = useState<ClineMessage[]>(messages)
	const [menuOpen, setMenuOpen] = useState<boolean>(false)
	const [showDefaultBorderColor, setShowDefaultBorderColor] = useState<boolean>(false)
	const [showToolActionAckChat, setShowToolActionAckChat] = useState<boolean>(false)
	const [enableButtons, setEnableButtons] = useState<boolean>(true)

	const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages])

	const [inputValue, setInputValue] = useState("")
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const [textAreaDisabled, setTextAreaDisabled] = useState(false)
	const [selectedImages, setSelectedImages] = useState<string[]>([])

	const [clineAsk, setClineAsk] = useState<ClineAsk | undefined>(undefined)
	const [primaryButtonText, setPrimaryButtonText] = useState<string | undefined>(undefined)
	const [secondaryButtonText, setSecondaryButtonText] = useState<string | undefined>(undefined)
	const [didClickCancel, setDidClickCancel] = useState(false)
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const disableAutoScrollRef = useRef(false)
	const [showScrollToBottom, setShowScrollToBottom] = useState(false)
	const [isAtBottom, setIsAtBottom] = useState(false)

	const [wasStreaming, setWasStreaming] = useState<boolean>(false)

	function playSound(audioType: AudioType) {
		vscode.postMessage({ type: "playSound", audioType })
	}

	useDeepCompareEffect(() => {
		if (lastMessage) {
			switch (lastMessage.type) {
				case "ask":
					const isPartial = lastMessage.partial === true
					switch (lastMessage.ask) {
						case "api_req_failed":
							playSound("progress_loop")
							setTextAreaDisabled(true)
							setClineAsk("api_req_failed")
							setEnableButtons(true)
							setPrimaryButtonText("Retry")
							setSecondaryButtonText("Start New Task")
							break
						case "mistake_limit_reached":
							playSound("progress_loop")
							setTextAreaDisabled(false)
							setClineAsk("mistake_limit_reached")
							setEnableButtons(true)
							setPrimaryButtonText("Proceed Anyways")
							setSecondaryButtonText("Start New Task")
							break
						case "followup":
							setTextAreaDisabled(isPartial)
							setClineAsk("followup")
							setEnableButtons(isPartial)
							break
						case "tool":
							if (!isAutoApproved(lastMessage)) {
								playSound("notification")
							}
							setTextAreaDisabled(isPartial)
							setClineAsk("tool")
							setEnableButtons(!isPartial)
							const tool = JSON.parse(lastMessage.text || "{}") as ClineSayTool
							switch (tool.tool) {
								case "editedExistingFile":
								case "appliedDiff":
								case "newFileCreated":
									setPrimaryButtonText("Save")
									setSecondaryButtonText("Reject")
									break
								default:
									setPrimaryButtonText("Approve")
									setSecondaryButtonText("Reject")
									break
							}
							break
						case "browser_action_launch":
							if (!isAutoApproved(lastMessage)) {
								playSound("notification")
							}
							setTextAreaDisabled(isPartial)
							setClineAsk("browser_action_launch")
							setEnableButtons(!isPartial)
							setPrimaryButtonText("Approve")
							setSecondaryButtonText("Reject")
							break
						case "command":
							if (!isAutoApproved(lastMessage)) {
								playSound("notification")
							}
							setTextAreaDisabled(isPartial)
							setClineAsk("command")
							setEnableButtons(!isPartial)
							setPrimaryButtonText("Run Command")
							setSecondaryButtonText("Reject")
							break
						case "command_output":
							setTextAreaDisabled(false)
							setClineAsk("command_output")
							setEnableButtons(true)
							setPrimaryButtonText("Proceed While Running")
							setSecondaryButtonText(undefined)
							break
						case "use_mcp_server":
							setTextAreaDisabled(isPartial)
							setClineAsk("use_mcp_server")
							setEnableButtons(!isPartial)
							setPrimaryButtonText("Approve")
							setSecondaryButtonText("Reject")
							break
						case "completion_result":
							playSound("celebration")
							setTextAreaDisabled(isPartial)
							setClineAsk("completion_result")
							setEnableButtons(!isPartial)
							setPrimaryButtonText("Start New Task")
							setSecondaryButtonText(undefined)
							break
						case "resume_task":
							setTextAreaDisabled(false)
							setClineAsk("resume_task")
							setEnableButtons(true)
							setPrimaryButtonText("Resume Task")
							setSecondaryButtonText("Terminate")
							break
						case "resume_completed_task":
							setTextAreaDisabled(false)
							setClineAsk("resume_completed_task")
							setEnableButtons(true)
							setPrimaryButtonText("Start New Task")
							setSecondaryButtonText(undefined)
							setDidClickCancel(false)
							break
					}
					break
				case "say":
					switch (lastMessage.say) {
						case "api_req_retry_delayed":
							setTextAreaDisabled(true)
							break
						case "api_req_started":
							if (secondLastMessage?.ask === "command_output") {
								setInputValue("")
								setTextAreaDisabled(true)
								setSelectedImages([])
								setClineAsk(undefined)
								setEnableButtons(false)
							}
							break
						case "api_req_finished":
						case "task":
						case "error":
						case "text":
						case "browser_action":
						case "browser_action_result":
						case "command_output":
						case "mcp_server_request_started":
						case "mcp_server_response":
						case "completion_result":
						case "tool":
							break
					}
					break
			}
		}
	}, [lastMessage, secondLastMessage])

	useEffect(() => {
		// Update modifiedMessages when messages change
		setModifiedMessages(messages);
	}, [messages]);

	useEffect(() => {
		if (messages.length === 0) {
			setTextAreaDisabled(false)
			setClineAsk(undefined)
			setEnableButtons(false)
			setPrimaryButtonText(undefined)
			setSecondaryButtonText(undefined)
		}
	}, [messages.length])

	useEffect(() => {
		setExpandedRows({})
	}, [task?.ts])

	const isStreaming = useMemo(() => {
		const isToolCurrentlyAsking =
			isLastAsk && clineAsk !== undefined && enableButtons && primaryButtonText !== undefined
		if (isToolCurrentlyAsking) {
			return false
		}

		const isLastMessagePartial = modifiedMessages.at(-1)?.partial === true
		if (isLastMessagePartial) {
			return true
		} else {
			const lastApiReqStarted = findLast(modifiedMessages, (message) => message.say === "api_req_started")
			if (
				lastApiReqStarted &&
				lastApiReqStarted.text !== null &&
				lastApiReqStarted.text !== undefined &&
				lastApiReqStarted.say === "api_req_started"
			) {
				const cost = JSON.parse(lastApiReqStarted.text).cost
				if (cost === undefined) {
					return true
				}
			}
		}

		return false
	}, [modifiedMessages, clineAsk, enableButtons, primaryButtonText])

	const handleSendMessage = useCallback(
		(text: string, images: string[]) => {
			text = text.trim()
			if (text || images.length > 0) {
				if (messages.length === 0) {
					vscode.postMessage({ type: "newTask", text, images })
				} else if (clineAsk) {
					switch (clineAsk) {
						case "followup":
						case "tool":
						case "browser_action_launch":
						case "resume_task":
						case "resume_completed_task":
						case "mistake_limit_reached":
							vscode.postMessage({
								type: "askResponse",
								askResponse: "messageResponse",
								text,
								images,
							})
							break
						case "completion_result":
							startNewTask()
							break
					}
					setInputValue("")
					setTextAreaDisabled(true)
					setSelectedImages([])
					setClineAsk(undefined)
					setEnableButtons(false)
					disableAutoScrollRef.current = false
				}
			}
		},
		[messages.length, clineAsk],
	)

	const handleSetChatBoxMessage = useCallback(
		(text: string, images: string[]) => {
			let newValue = text
			if (inputValue !== "") {
				newValue = inputValue + " " + text
			}

			setInputValue(newValue)
			setSelectedImages([...selectedImages, ...images])
		},
		[inputValue, selectedImages],
	)

	const startNewTask = useCallback(() => {
		vscode.postMessage({ type: "clearTask" })
	}, [])

	const handlePrimaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			const trimmedInput = text?.trim()
			switch (clineAsk) {
				case "api_req_failed":
				case "command":
				case "command_output":
				case "tool":
				case "browser_action_launch":
				case "use_mcp_server":
				case "resume_task":
				case "mistake_limit_reached":
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "yesButtonClicked",
							text: trimmedInput,
							images: images,
						})
					} else {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "yesButtonClicked",
						})
					}
					setInputValue("")
					setSelectedImages([])
					break
				case "completion_result":
				case "resume_completed_task":
					startNewTask()
					break
			}
			setTextAreaDisabled(true)
			setClineAsk(undefined)
			setEnableButtons(false)
			disableAutoScrollRef.current = false
		},
		[clineAsk, startNewTask],
	)

	const handleSecondaryButtonClick = useCallback(
		(text?: string, images?: string[]) => {
			const trimmedInput = text?.trim()
			if (isStreaming) {
				vscode.postMessage({ type: "cancelTask" })
				setDidClickCancel(true)
				return
			}

			switch (clineAsk) {
				case "api_req_failed":
				case "mistake_limit_reached":
				case "resume_task":
					startNewTask()
					break
				case "command":
				case "tool":
				case "browser_action_launch":
				case "use_mcp_server":
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "noButtonClicked",
							text: trimmedInput,
							images: images,
						})
					} else {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "noButtonClicked",
						})
					}
					setInputValue("")
					setSelectedImages([])
					break
			}
			setTextAreaDisabled(true)
			setClineAsk(undefined)
			setEnableButtons(false)
			disableAutoScrollRef.current = false
		},
		[clineAsk, startNewTask, isStreaming],
	)

	const handleTaskCloseButtonClick = useCallback(() => {
		startNewTask()
	}, [startNewTask])

	const { selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	const selectImages = useCallback(() => {
		vscode.postMessage({ type: "selectImages" })
	}, [])

	const shouldDisableImages =
		!selectedModelInfo.supportsImages || textAreaDisabled || selectedImages.length >= MAX_IMAGES_PER_MESSAGE

	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			switch (message.type) {
				case "action":
					switch (message.action!) {
						case "didBecomeVisible":
							if (!isHidden && !textAreaDisabled && !enableButtons) {
								textAreaRef.current?.focus()
							}
							break
					}
					break
				case "selectedImages":
					const newImages = message.images ?? []
					if (newImages.length > 0) {
						setSelectedImages((prevImages) =>
							[...prevImages, ...newImages].slice(0, MAX_IMAGES_PER_MESSAGE),
						)
					}
					break
				case "invoke":
					switch (message.invoke!) {
						case "sendMessage":
							handleSendMessage(message.text ?? "", message.images ?? [])
							break
						case "setChatBoxMessage":
							handleSetChatBoxMessage(message.text ?? "", message.images ?? [])
							break
						case "primaryButtonClick":
							handlePrimaryButtonClick(message.text ?? "", message.images ?? [])
							break
						case "secondaryButtonClick":
							handleSecondaryButtonClick(message.text ?? "", message.images ?? [])
							break
					}
			}
		},
		[
			isHidden,
			textAreaDisabled,
			enableButtons,
			handleSendMessage,
			handleSetChatBoxMessage,
			handlePrimaryButtonClick,
			handleSecondaryButtonClick,
		],
	)

	useEvent("message", handleMessage)

	useMount(() => {
		textAreaRef.current?.focus()
	})

	useEffect(() => {
		const timer = setTimeout(() => {
			if (!isHidden && !textAreaDisabled && !enableButtons) {
				textAreaRef.current?.focus()
			}
		}, 50)
		return () => {
			clearTimeout(timer)
		}
	}, [isHidden, textAreaDisabled, enableButtons])

	const visibleMessages = useMemo(() => {
		return modifiedMessages.filter((message) => {
			if (message.type === "hidden") {
				return false;
			}
			switch (message.ask) {
				case "completion_result":
					if (message.text === "") {
						return false
					}
					break
				case "resume_task":
				case "resume_completed_task":
					return false
			}
			switch (message.say) {
				case "mcp_server_request_started":
					return false
				case "mcp_server_response":
					return false
			}
			return true
		})
	}, [modifiedMessages])

	const isReadOnlyToolAction = useCallback((message: ClineMessage | undefined) => {
		if (message?.type === "ask") {
			if (!message.text) {
				return true
			}
			const tool = JSON.parse(message.text)
			return [
				"readFile",
				"listFiles",
				"listFilesTopLevel",
				"listFilesRecursive",
				"listCodeDefinitionNames",
				"searchFiles",
			].includes(tool.tool)
		}
		return false
	}, [])

	const isWriteToolAction = useCallback((message: ClineMessage | undefined) => {
		if (message?.type === "ask") {
			if (!message.text) {
				return true
			}
			const tool = JSON.parse(message.text)
			return ["editedExistingFile", "appliedDiff", "newFileCreated"].includes(tool.tool)
		}
		return false
	}, [])

	const isMcpToolAlwaysAllowed = useCallback(
		(message: ClineMessage | undefined) => {
			if (message?.type === "ask" && message.ask === "use_mcp_server") {
				if (!message.text) {
					return true
				}
				const mcpServerUse = JSON.parse(message.text) as { type: string; serverName: string; toolName: string }
				if (mcpServerUse.type === "use_mcp_tool") {
					const server = mcpServers?.find((s: McpServer) => s.name === mcpServerUse.serverName)
					const tool = server?.tools?.find((t: McpTool) => t.name === mcpServerUse.toolName)
					return tool?.alwaysAllow || false
				}
			}
			return false
		},
		[mcpServers],
	)

	const isAllowedCommand = useCallback(
		(message: ClineMessage | undefined): boolean => {
			if (message?.type !== "ask") return false
			return validateCommand(message.text || "", allowedCommands || [])
		},
		[allowedCommands],
	)

	const isAutoApproved = useCallback(
		(message: ClineMessage | undefined) => {
			if (!autoApprovalEnabled || !message || message.type !== "ask") return false

			return (
				(alwaysAllowBrowser && message.ask === "browser_action_launch") ||
				(alwaysAllowReadOnly && message.ask === "tool" && isReadOnlyToolAction(message)) ||
				(alwaysAllowWrite && message.ask === "tool" && isWriteToolAction(message)) ||
				(alwaysAllowExecute && message.ask === "command" && isAllowedCommand(message)) ||
				(alwaysAllowMcp && message.ask === "use_mcp_server" && isMcpToolAlwaysAllowed(message)) ||
				(alwaysAllowModeSwitch &&
					message.ask === "tool" &&
					(JSON.parse(message.text || "{}")?.tool === "switchMode" ||
						JSON.parse(message.text || "{}")?.tool === "newTask"))
			)
		},
		[
			autoApprovalEnabled,
			alwaysAllowBrowser,
			alwaysAllowReadOnly,
			isReadOnlyToolAction,
			alwaysAllowWrite,
			isWriteToolAction,
			alwaysAllowExecute,
			isAllowedCommand,
			alwaysAllowMcp,
			isMcpToolAlwaysAllowed,
			alwaysAllowModeSwitch,
		],
	)

	useEffect(() => {
		if (!isAutoApproved(lastMessage)) {
			switch (lastMessage.ask) {
				case "api_req_failed":
				case "mistake_limit_reached":
					playSound("progress_loop")
					break
				case "followup":
					if (!lastMessage.partial) {
						playSound("notification")
					}
					break
				case "tool":
				case "browser_action_launch":
				case "resume_task":
				case "use_mcp_server":
					playSound("notification")
					break
				case "completion_result":
				case "resume_completed_task":
					playSound("celebration")
					break
			}
		}
		setWasStreaming(isStreaming)
	}, [isStreaming, lastMessage, wasStreaming, isAutoApproved])

	const isBrowserSessionMessage = (message: ClineMessage): boolean => {
		if (message.type === "ask") {
			return ["browser_action_launch"].includes(message.ask!)
		}
		if (message.type === "say") {
			return ["browser_action", "browser_action_result"].includes(message.say!)
		}
		return false
	}

	const groupedMessages = useMemo(() => {
		const result: (ClineMessage | ClineMessage[])[] = []
		let currentGroup: ClineMessage[] = []

		const endBrowserSession = () => {
			if (currentGroup.length > 0) {
				result.push([...currentGroup])
				currentGroup = []
			}
		}

		visibleMessages.forEach((message) => {
			if (message.ask === "browser_action_launch") {
				const lastApiReqStarted = [...currentGroup].reverse().find((m) => m.say === "api_req_started")
				if (lastApiReqStarted?.text !== null && lastApiReqStarted?.text !== undefined) {
					try {
						const json = JSON.parse(lastApiReqStarted.text)
						if (json.cost === undefined) {
							endBrowserSession()
						}
					} catch (error) {
						endBrowserSession()
					}
				} else {
					endBrowserSession()
				}
			}

			if (isBrowserSessionMessage(message)) {
				currentGroup.push(message)

				if (message.say === "browser_action") {
					const messageJson = JSON.parse(message.text!)
					if (messageJson.action === "close") {
						endBrowserSession()
					}
				}
			} else {
				endBrowserSession()
				result.push(message)
			}
		})

		if (currentGroup.length > 0) {
			result.push([...currentGroup])
		}

		return result
	}, [visibleMessages])

	const scrollToBottomSmooth = useCallback(() => {
		virtuosoRef.current?.scrollTo({
			top: Number.MAX_SAFE_INTEGER,
			behavior: "smooth",
		});
	}, []);

	const scrollToBottomAuto = useCallback(() => {
		virtuosoRef.current?.scrollTo({
			top: Number.MAX_SAFE_INTEGER,
		});
	}, []);

	const toggleRowExpansion = useCallback((ts: number) => {
		const isCollapsing = expandedRows[ts];
		const messageIndex = groupedMessages.findIndex(msg => 
			Array.isArray(msg) 
				? msg.some(m => m.ts === ts) 
				: msg.ts === ts
		);
		const isLast = messageIndex === groupedMessages.length - 1;
		const isSecondToLast = messageIndex === groupedMessages.length - 2;
		
		const lastMessage = groupedMessages[groupedMessages.length - 1];
		const isLastCollapsedApiReq = 
			!Array.isArray(lastMessage) && 
			lastMessage.type === "api-request" && 
			!expandedRows[lastMessage.ts];
		
		setExpandedRows((prev) => ({
			...prev,
			[ts]: !prev[ts],
		}));

		if (!isCollapsing) {
			disableAutoScrollRef.current = true;
		}

		if (isCollapsing && isAtBottom) {
			const timer = setTimeout(() => {
				scrollToBottomAuto();
			}, 0);
			return () => clearTimeout(timer);
		} else if (isLast || isSecondToLast) {
			if (isCollapsing) {
				if (isSecondToLast && !isLastCollapsedApiReq) {
					return;
				}
				const timer = setTimeout(() => {
					scrollToBottomAuto();
				}, 0);
				return () => clearTimeout(timer);
			} else {
				const timer = setTimeout(() => {
					virtuosoRef.current?.scrollToIndex({
						index: groupedMessages.length - (isLast ? 1 : 2),
						align: "start",
					});
				}, 0);
				return () => clearTimeout(timer);
			}
		}
	}, [groupedMessages, expandedRows, scrollToBottomAuto, isAtBottom, isLast, isSecondToLast, isLastCollapsedApiReq]);

	const itemContent = useCallback(
		(index: number, messageOrGroup: ClineMessage | ClineMessage[]) => {
			if (Array.isArray(messageOrGroup)) {
				return (
					<BrowserSessionRow
						key={messageOrGroup[0]?.ts || index}
						messages={messageOrGroup}
						isLast={index === groupedMessages.length - 1}
						lastModifiedMessage={modifiedMessages.at(-1)}
						onHeightChange={handleRowHeightChange}
						isStreaming={isStreaming}
						isExpanded={(messageTs: number) => expandedRows[messageTs] ?? false}
						onToggleExpand={(messageTs: number) => toggleRowExpansion(messageTs)}
					/>
				);
			} else {
				return (
					<ChatRow
						key={messageOrGroup.ts}
						message={messageOrGroup}
						isExpanded={expandedRows[messageOrGroup.ts] || false}
						onToggleExpand={() => toggleRowExpansion(messageOrGroup.ts)}
						lastModifiedMessage={modifiedMessages.at(-1)}
						isLast={index === groupedMessages.length - 1}
						onHeightChange={handleRowHeightChange}
						isStreaming={isStreaming}
					/>
				);
			}
		},
		[
			expandedRows,
			modifiedMessages,
			groupedMessages.length,
			handleRowHeightChange,
			isStreaming,
			toggleRowExpansion,
		]
	);

	useEffect(() => {
		if (!clineAsk || !enableButtons) return

		const autoApprove = async () => {
			if (isAutoApproved(lastMessage)) {
				if (lastMessage?.ask === "tool" && isWriteToolAction(lastMessage)) {
					await new Promise((resolve) => setTimeout(resolve, writeDelayMs))
				}
				handlePrimaryButtonClick()
			}
		}
		autoApprove()
	}, [
		clineAsk,
		enableButtons,
		handlePrimaryButtonClick,
		alwaysAllowBrowser,
		alwaysAllowReadOnly,
		alwaysAllowWrite,
		alwaysAllowExecute,
		alwaysAllowMcp,
		messages,
		allowedCommands,
		mcpServers,
		isAutoApproved,
		lastMessage,
		writeDelayMs,
		isWriteToolAction,
	])

	const handleRowHeightChange = useCallback(
		(isTaller: boolean) => {
			if (!disableAutoScrollRef.current) {
				if (isTaller) {
					scrollToBottomSmooth();
				} else {
					setTimeout(() => {
						scrollToBottomAuto();
					}, 0);
				}
			}
		},
		[scrollToBottomSmooth, scrollToBottomAuto]
	);

	useEffect(() => {
		if (!disableAutoScrollRef.current) {
			setTimeout(() => {
				scrollToBottomSmooth();
			}, 50);
		}
	}, [groupedMessages.length, scrollToBottomSmooth]);

	const handleWheel = useCallback((event: Event) => {
		const wheelEvent = event as WheelEvent;
		if (wheelEvent.deltaY && wheelEvent.deltaY < 0) {
			if (scrollContainerRef.current?.contains(wheelEvent.target as Node)) {
				disableAutoScrollRef.current = true;
			}
		}
	}, []);

	const getHelpText = useCallback(() => {
		const baseText = task ? `${task.placeholder || defaultPlaceholder}` : defaultPlaceholder;
		const contextText = "(@ to add context, / to switch modes";
		const imageText = shouldDisableImages ? "" : ", hold shift to drag in images";
		const helpText = imageText ? `\n${contextText}${imageText})` : `\n${contextText})`;
		return baseText + helpText;
	}, [task, shouldDisableImages]);

	return (
		<div
			className={styles.container}
			style={{
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}>
			{task ? (
				<>
					<TaskHeader 
						task={task} 
						showHistoryView={showHistoryView} 
						setShowMenuOpen={setMenuOpen}
						menuOpen={menuOpen}
					/>
					{showAnnouncement && <Announcement version={version} hideAnnouncement={hideAnnouncement} />}
					<div style={{ padding: "0 20px", flexShrink: 0 }}>
					</div>
					{taskHistory.length > 0 && <HistoryPreview showHistoryView={showHistoryView} />}
				</>
			)}

			{!task && (
				<AutoApproveMenu
					style={{
						marginBottom: -2,
						minHeight: 0,
					}}
				/>
			)}

			<div
				className={styles.messages}
				ref={scrollContainerRef}
				onWheel={handleWheel}
				data-testid="messages">
				<div style={{ height: "100%" }}>
					<Virtuoso
						ref={virtuosoRef}
						data={groupedMessages}
						itemContent={itemContent}
						atBottomStateChange={(isAtBottom) => {
							setIsAtBottom(isAtBottom)
							setShowScrollToBottom(disableAutoScrollRef.current && !isAtBottom)
						}}
						initialTopMostItemIndex={groupedMessages.length - 1}
					/>
				</div>
				{showScrollToBottom && (
					<ScrollToBottom onClick={scrollToBottomSmooth} style={{ position: "absolute" }} />
				)}
			</div>

			<div className={styles.chatboxContainer}>
				<ChatTextArea
					ref={textAreaRef}
					disabled={textAreaDisabled || isStreaming}
					onChange={setInputValue}
					placeholder={getHelpText()}
					value={inputValue}
					selectedImages={selectedImages}
					onSelectedImagesChange={setSelectedImages}
					onSubmit={handleSendMessage}
					shouldDisableImages={shouldDisableImages}
					showDefaultBorderColor={showDefaultBorderColor}
					showToolActionAckChat={showToolActionAckChat}
				/>
				<div className={styles.buttonsContainer}>
					{primaryButtonText && (
						<Button
							onClick={() => handlePrimaryButtonClick(inputValue, selectedImages)}
							disabled={!enableButtons || isStreaming}
							className={cn(styles.primaryButton)}>
							{primaryButtonText}
						</Button>
					)}
					{(secondaryButtonText || isStreaming) && (
						<Button
							onClick={() => handleSecondaryButtonClick(inputValue, selectedImages)}
							variant="outline"
							className={cn(
								styles.secondaryButton,
								isStreaming && didClickCancel && styles.cancelButtonClicked,
							)}>
							{isStreaming ? (didClickCancel ? "Cancelling..." : "Cancel") : secondaryButtonText}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

const ScrollToBottomButton = styled.div`
	background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 55%, transparent);
	border-radius: 3px;
	overflow: hidden;
	cursor: pointer;
	display: flex;
	justify-content: center;
	align-items: center;
	flex: 1;
	height: 25px;

	&:hover {
		background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 90%, transparent);
	}

	&:active {
		background-color: color-mix(in srgb, var(--vscode-toolbar-hoverBackground) 70%, transparent);
	}
`

export default ChatView

