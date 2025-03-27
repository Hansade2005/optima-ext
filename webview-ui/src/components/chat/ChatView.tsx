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
import { useVSCodeApi } from "../../contexts/VSCodeApiContext"
import { useContext } from "react"
import { NotificationContext } from "../../contexts/NotificationContext"
import { VSCodePanelView } from "@vscode/webview-ui-toolkit/react"
import ChatMessageBubble from "./ChatMessageBubble"

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

	const task = useMemo(() => messages.at(0), [messages])
	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])
	const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages])

	const [inputValue, setInputValue] = useState("")
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const [textAreaDisabled, setTextAreaDisabled] = useState(false)
	const [selectedImages, setSelectedImages] = useState<string[]>([])

	const [clineAsk, setClineAsk] = useState<ClineAsk | undefined>(undefined)
	const [enableButtons, setEnableButtons] = useState<boolean>(false)
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

	const lastMessage = useMemo(() => messages.at(-1), [messages])
	const secondLastMessage = useMemo(() => messages.at(-2), [messages])

	const vscodeApi = useVSCodeApi()
	const { showNotification } = useContext(NotificationContext)
	const [filter, setFilter] = useState("")

	const [activeMessages, setActiveMessages] = useState<Record<string, boolean>>({})

	const chatRef = useRef<HTMLDivElement>(null)
	const lastScrollRef = useRef<number>(-1)
	const [doFullAutoscroll, setDoFullAutoscroll] = useState(true)

	useEffect(() => {
		if (doFullAutoscroll && chatRef.current) {
			chatRef.current.scrollTop = chatRef.current.scrollHeight
		}
	}, [messages, doFullAutoscroll])

	useEffect(() => {
		if (!chatRef.current) {
			return
		}

		const handler = () => {
			const { scrollTop, scrollHeight, clientHeight } = chatRef.current!
			lastScrollRef.current = scrollTop
			setDoFullAutoscroll(scrollHeight - scrollTop - clientHeight < 100)
		}

		chatRef.current.addEventListener("scroll", handler)
		return () => chatRef.current?.removeEventListener("scroll", handler)
	}, [])

	useEffect(() => {
		if (!chatRef.current) {
			return
		}

		const filterHandler = (event: any) => {
			if (event.data?.type === "setFilter") {
				setFilter(event.data.filter)
			}
		}

		window.addEventListener("message", filterHandler)
		return () => window.removeEventListener("message", filterHandler)
	}, [])

	const toggleActive = useCallback(
		(id: string) => {
			setActiveMessages((prev) => ({
				...prev,
				[id]: !prev[id],
			}))

			setTimeout(() => {
				if (!chatRef.current) {
					return
				}

				const messageEl = document.getElementById(`message-${id}`)
				if (!messageEl) {
					return
				}

				const { top, bottom } = messageEl.getBoundingClientRect()
				const { top: containerTop, bottom: containerBottom } =
					chatRef.current.getBoundingClientRect()

				if (top < containerTop) {
					messageEl.scrollIntoView({ behavior: "smooth", block: "start" })
				} else if (bottom > containerBottom) {
					messageEl.scrollIntoView({ behavior: "smooth", block: "end" })
				}
			}, 150)
		},
		[setActiveMessages]
	)

	const filteredMessages = messages
		.filter((m) => m.text && typeof m.text === 'string' && 
			m.text.toLowerCase().includes(filter.toLowerCase()))

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
							setDidClickCancel(false)
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
		const isLastAsk = !!modifiedMessages.at(-1)?.ask
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
						case "command":
						case "command_output":
						case "use_mcp_server":
						case "completion_result":
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
					}
				}
				setInputValue("")
				setTextAreaDisabled(true)
				setSelectedImages([])
				setClineAsk(undefined)
				setEnableButtons(false)
				disableAutoScrollRef.current = false
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
			switch (message.ask) {
				case "completion_result":
					if (message.text === "") {
						return false
					}
					break
				case "api_req_failed":
				case "resume_task":
				case "resume_completed_task":
					return false
			}
			switch (message.say) {
				case "api_req_finished":
				case "api_req_retried":
				case "api_req_deleted":
					return false
				case "api_req_retry_delayed":
					return message === modifiedMessages.at(-1)
				case "text":
					if ((message.text ?? "") === "" && (message.images?.length ?? 0) === 0) {
						return false
					}
					break
				case "mcp_server_request_started":
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
		if (wasStreaming && !isStreaming && lastMessage) {
			if (lastMessage.type === "ask") {
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
			}
		}
		setWasStreaming(isStreaming)
	}, [isStreaming, lastMessage, wasStreaming, isAutoApproved])

	const isBrowserSessionMessage = (message: ClineMessage): boolean => {
		if (message.type === "ask") {
			return ["browser_action_launch"].includes(message.ask!)
		}
		if (message.type === "say") {
			return ["api_req_started", "text", "browser_action", "browser_action_result"].includes(message.say!)
		}
		return false
	}

	const groupedMessages = useMemo(() => {
		const result: (ClineMessage | ClineMessage[])[] = []
		let currentGroup: ClineMessage[] = []
		let isInBrowserSession = false

		const endBrowserSession = () => {
			if (currentGroup.length > 0) {
				result.push([...currentGroup])
				currentGroup = []
				isInBrowserSession = false
			}
		}

		visibleMessages.forEach((message) => {
			if (message.ask === "browser_action_launch") {
				endBrowserSession()
				isInBrowserSession = true
				currentGroup.push(message)
			} else if (isInBrowserSession) {
				if (message.say === "api_req_started") {
					const lastApiReqStarted = [...currentGroup].reverse().find((m) => m.say === "api_req_started")
					if (lastApiReqStarted?.text !== null && lastApiReqStarted?.text !== undefined) {
						const info = JSON.parse(lastApiReqStarted.text)
						const isCancelled = info.cancelReason !== null && info.cancelReason !== undefined
						if (isCancelled) {
							endBrowserSession()
							result.push(message)
							return
						}
					}
				}

				if (isBrowserSessionMessage(message)) {
					currentGroup.push(message)

					if (message.say === "browser_action") {
						const browserAction = JSON.parse(message.text || "{}") as ClineSayBrowserAction
						if (browserAction.action === "close") {
							endBrowserSession()
						}
					}
				} else {
					endBrowserSession()
					result.push(message)
				}
			} else {
				result.push(message)
			}
		})

		if (currentGroup.length > 0) {
			result.push([...currentGroup])
		}

		return result
	}, [visibleMessages])

	const scrollToBottomSmooth = useMemo(
		() =>
			debounce(
				() => {
					virtuosoRef.current?.scrollTo({
						top: Number.MAX_SAFE_INTEGER,
						behavior: "smooth",
					})
				},
				10,
				{ immediate: true },
			),
		[],
	)

	const scrollToBottomAuto = useCallback(() => {
		virtuosoRef.current?.scrollTo({
			top: Number.MAX_SAFE_INTEGER,
			behavior: "auto",
		})
	}, [])

	const toggleRowExpansion = useCallback(
		(ts: number) => {
			if (typeof ts !== 'number') return;
			
			const isCollapsing = expandedRows[ts]
			const isAtBottom = scrollContainerRef.current ? 
				Math.abs(scrollContainerRef.current.scrollHeight - scrollContainerRef.current.scrollTop - scrollContainerRef.current.clientHeight) < 2 : false;
			
			const lastMessage = groupedMessages.at(-1);
			const isLast = groupedMessages.length > 0 && 
				(Array.isArray(lastMessage) 
					? lastMessage.length > 0 && lastMessage[0].ts === ts 
					: lastMessage && 'ts' in lastMessage && lastMessage.ts === ts);
					
			const secondLastMessage = groupedMessages.at(-2);
			const isSecondToLast = groupedMessages.length > 1 && 
				(Array.isArray(secondLastMessage) 
					? secondLastMessage.length > 0 && secondLastMessage[0].ts === ts 
					: secondLastMessage && 'ts' in secondLastMessage && secondLastMessage.ts === ts);
					
			const lastGroup = groupedMessages.at(-1);
			const isLastCollapsedApiReq =
				isLast &&
				!Array.isArray(lastGroup) &&
				lastGroup && 'say' in lastGroup && lastGroup.say === "api_req_started" &&
				'ts' in lastGroup && typeof lastGroup.ts === 'number' && 
				!expandedRows[lastGroup.ts];
				
			setExpandedRows((prev) => ({
				...prev,
				[ts]: !prev[ts],
			}))

			if (!isCollapsing) {
				disableAutoScrollRef.current = true
			}

			if (isCollapsing && isAtBottom) {
				const timer = setTimeout(() => {
					scrollToBottomAuto()
				}, 0)
				return () => clearTimeout(timer)
			} else if (isLast || isSecondToLast) {
				if (isCollapsing) {
					if (isSecondToLast && !isLastCollapsedApiReq) {
						return
					}
					const timer = setTimeout(() => {
						scrollToBottomAuto()
					}, 0)
					return () => clearTimeout(timer)
				} else {
					const timer = setTimeout(() => {
						virtuosoRef.current?.scrollToIndex({
							index: groupedMessages.length - (isLast ? 1 : 2),
							align: "start",
						})
					}, 0)
					return () => clearTimeout(timer)
				}
			}
		},
		[groupedMessages, expandedRows, scrollToBottomAuto, isAtBottom],
	)

	const handleRowHeightChange = useCallback(
		(isTaller: boolean) => {
			if (!disableAutoScrollRef.current) {
				if (isTaller) {
					scrollToBottomSmooth()
				} else {
					setTimeout(() => {
						scrollToBottomAuto()
					}, 0)
				}
			}
		},
		[scrollToBottomSmooth, scrollToBottomAuto],
	)

	useEffect(() => {
		if (!disableAutoScrollRef.current) {
			setTimeout(() => {
				scrollToBottomSmooth()
			}, 50)
		}
	}, [groupedMessages.length, scrollToBottomSmooth])

	const handleWheel = useCallback((event: Event) => {
		const wheelEvent = event as WheelEvent
		if (wheelEvent.deltaY && wheelEvent.deltaY < 0) {
			if (scrollContainerRef.current?.contains(wheelEvent.target as Node)) {
				disableAutoScrollRef.current = true
			}
		}
	}, [])
	useEvent("wheel", handleWheel, window, { passive: true })

	const placeholderText = useMemo(() => {
		const baseText = task ? "Plan, search and build anything with Optima ai..." : "Plan, search and build anything with optima ai..."
		const contextText = "(@ to add context, / to switch modes"
		const imageText = shouldDisableImages ? "" : ", hold shift to drag in images"
		const helpText = imageText ? `\n${contextText}${imageText})` : `\n${contextText})`
		return baseText + helpText
	}, [task, shouldDisableImages])

	const itemContent = useCallback(
		(index: number, messageOrGroup: ClineMessage | ClineMessage[]) => {
			if (Array.isArray(messageOrGroup)) {
				return (
					<BrowserSessionRow
						messages={messageOrGroup as ClineMessage[]}
						isLast={index === groupedMessages.length - 1}
						lastModifiedMessage={modifiedMessages.at(-1)}
						onHeightChange={handleRowHeightChange}
						isStreaming={isStreaming}
						isExpanded={(messageTs: number) => expandedRows[messageTs] ?? false}
						onToggleExpand={(messageTs: number) => {
							setExpandedRows((prev) => ({
								...prev,
								[messageTs]: !prev[messageTs],
							}))
						}}
					/>
				)
			}

			return (
				<ChatRow
					key={messageOrGroup.ts}
					message={messageOrGroup as ClineMessage}
					isExpanded={expandedRows[messageOrGroup.ts] || false}
					onToggleExpand={() => toggleRowExpansion(messageOrGroup.ts)}
					lastModifiedMessage={modifiedMessages.at(-1)}
					isLast={index === groupedMessages.length - 1}
					onHeightChange={handleRowHeightChange}
					isStreaming={isStreaming}
				/>
			)
		},
		[
			expandedRows,
			modifiedMessages,
			groupedMessages.length,
			handleRowHeightChange,
			isStreaming,
			toggleRowExpansion,
		],
	)

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

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				display: isHidden ? "none" : "flex",
				flexDirection: "column",
				overflow: "hidden",
				backgroundColor: "var(--vscode-editor-background)",
				borderRadius: "var(--radius)",
				boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
				border: "1px solid var(--optima-gray-light, var(--vscode-panel-border))",
			}}>
			{task ? (
				<TaskHeader
					task={task}
					tokensIn={apiMetrics.totalTokensIn}
					tokensOut={apiMetrics.totalTokensOut}
					doesModelSupportPromptCache={selectedModelInfo.supportsPromptCache}
					cacheWrites={apiMetrics.totalCacheWrites}
					cacheReads={apiMetrics.totalCacheReads}
					totalCost={apiMetrics.totalCost}
					contextTokens={apiMetrics.contextTokens}
					onClose={handleTaskCloseButtonClick}
				/>
			) : (
				<div
					style={{
						flex: "1 1 0",
						minHeight: 0,
						overflowY: "auto",
						display: "flex",
						flexDirection: "column",
						paddingBottom: "10px",
					}}>
					{showAnnouncement && <Announcement version={version} hideAnnouncement={hideAnnouncement} />}
					<div style={{ padding: "0 20px", flexShrink: 0 }}>
						<h2>What can Optima AI do for you?</h2>
						<p className="capabilities-description">
							Thanks to cutting-edge agentic coding capabilities, I can autonomously handle complex software development tasks—step-by-step. Whether it's editing files, exploring large codebases, browsing the web, or executing terminal commands (with permission), I offer more than just code completion. I can even evolve by creating new tools through MCP, extending my capabilities as needed.
						</p>
					</div>
					{taskHistory.length > 0 && <HistoryPreview showHistoryView={showHistoryView} />}
				</div>
			)}

			{!task && (
				<AutoApproveMenu
					style={{
						marginBottom: -2,
						flex: "0 1 auto",
						minHeight: 0,
					}}
				/>
			)}

			{task && (
				<>
					<div style={{ flexGrow: 1, display: "flex" }} ref={scrollContainerRef}>
						<Virtuoso
							ref={virtuosoRef}
							key={task.ts}
							className="scrollable"
							style={{
								flexGrow: 1,
								overflowY: "scroll",
							}}
							components={{
								Footer: () => <div style={{ height: 5 }} />,
							}}
							increaseViewportBy={{ top: 3_000, bottom: Number.MAX_SAFE_INTEGER }}
							data={groupedMessages}
							itemContent={itemContent}
							atBottomStateChange={(isAtBottom) => {
								setIsAtBottom(isAtBottom)
								if (isAtBottom) {
									disableAutoScrollRef.current = false
								}
								setShowScrollToBottom(disableAutoScrollRef.current && !isAtBottom)
							}}
							atBottomThreshold={10}
							initialTopMostItemIndex={groupedMessages.length - 1}
						/>
					</div>
					<AutoApproveMenu />
					{showScrollToBottom ? (
						<div
							style={{
								display: "flex",
								padding: "10px 15px 0px 15px",
							}}>
							<ScrollToBottomButton
								onClick={() => {
									scrollToBottomSmooth()
									disableAutoScrollRef.current = false
								}}>
								<span className="codicon codicon-chevron-down" style={{ fontSize: "18px" }}></span>
							</ScrollToBottomButton>
						</div>
					) : (
						<div
							style={{
								opacity:
									primaryButtonText || secondaryButtonText || isStreaming
										? enableButtons || (isStreaming && !didClickCancel)
											? 1
											: 0.5
										: 0,
								display: "flex",
								padding: `${primaryButtonText || secondaryButtonText || isStreaming ? "10" : "0"}px 15px 0px 15px`,
							}}>
							{primaryButtonText && !isStreaming && (
								<VSCodeButton
									appearance="primary"
									disabled={!enableButtons}
									style={{
										flex: secondaryButtonText ? 1 : 2,
										marginRight: secondaryButtonText ? "6px" : "0",
									}}
									onClick={(e) => handlePrimaryButtonClick(inputValue, selectedImages)}>
									{primaryButtonText}
								</VSCodeButton>
							)}
							{(secondaryButtonText || isStreaming) && (
								<>
									{isStreaming ? (
										<>
											<GeneratingButton>
												Generating
												<span className="dot dot-1">.</span>
												<span className="dot dot-2">.</span>
												<span className="dot dot-3">.</span>
											</GeneratingButton>
											<StopButton
												onClick={(e) => handleSecondaryButtonClick(inputValue, selectedImages)}
												title="Stop generation"
											>
												<div className="stop-icon" />
											</StopButton>
										</>
									) : (
										<VSCodeButton
											appearance="secondary"
											disabled={!enableButtons}
											style={{
												flex: 1,
												marginLeft: "6px",
											}}
											onClick={(e) => handleSecondaryButtonClick(inputValue, selectedImages)}>
											{secondaryButtonText}
										</VSCodeButton>
									)}
								</>
							)}
						</div>
					)}
				</>
			)}

			<ChatTextArea
				ref={textAreaRef}
				inputValue={inputValue}
				setInputValue={setInputValue}
				textAreaDisabled={textAreaDisabled}
				placeholderText={placeholderText}
				selectedImages={selectedImages}
				setSelectedImages={setSelectedImages}
				onSend={() => handleSendMessage(inputValue, selectedImages)}
				onSelectImages={selectImages}
				shouldDisableImages={shouldDisableImages}
				onHeightChange={() => {
					if (isAtBottom) {
						scrollToBottomAuto()
					}
				}}
				mode={mode}
				setMode={setMode}
			/>

			<div id="chat-view-portal" />
		</div>
	)
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

const GeneratingButton = styled.div`
	background-color: var(--vscode-button-secondaryBackground);
	color: var(--vscode-button-secondaryForeground);
	border: 1px solid var(--vscode-button-border);
	border-radius: 2px;
	padding: 4px 12px;
	font-size: 13px;
	cursor: default;
	display: flex;
	align-items: center;
	justify-content: center;
	flex: 1.5;
	height: 28px;
	position: relative;

	@keyframes dot-animation {
		0% { opacity: 0.2; }
		20% { opacity: 1; }
		100% { opacity: 0.2; }
	}
	
	.dot {
		margin-left: 4px;
		display: inline-block;
	}
	
	.dot-1 {
		animation: dot-animation 1.4s infinite;
		animation-delay: 0s;
	}
	
	.dot-2 {
		animation: dot-animation 1.4s infinite;
		animation-delay: 0.2s;
	}
	
	.dot-3 {
		animation: dot-animation 1.4s infinite;
		animation-delay: 0.4s;
	}
`

const StopButton = styled.div`
	background-color: var(--vscode-button-secondaryBackground);
	color: var(--vscode-button-secondaryForeground);
	border: 1px solid var(--vscode-button-border);
	border-radius: 4px;
	width: 28px;
	height: 28px;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	margin-left: 6px;
	flex: 0 0 auto;
	
	&:hover {
		background-color: var(--vscode-button-secondaryHoverBackground);
	}
	
	.stop-icon {
		width: 12px;
		height: 12px;
		background-color: var(--vscode-button-secondaryForeground);
		border-radius: 1px;
	}
`

export default ChatView
