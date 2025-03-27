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
<<<<<<< HEAD
=======
import { useVSCodeApi } from "../../contexts/VSCodeApiContext"
import { useContext } from "react"
import { NotificationContext } from "../../contexts/NotificationContext"
import { VSCodePanelView } from "@vscode/webview-ui-toolkit/react"
import ChatMessageBubble from "./ChatMessageBubble"
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856

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

<<<<<<< HEAD
	//const task = messages.length > 0 ? (messages[0].say === "task" ? messages[0] : undefined) : undefined) : undefined
	const task = useMemo(() => messages.at(0), [messages]) // leaving this less safe version here since if the first message is not a task, then the extension is in a bad state and needs to be debugged (see Cline.abort)
	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])
	// has to be after api_req_finished are all reduced into api_req_started messages
=======
	const task = useMemo(() => messages.at(0), [messages])
	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
	const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages])

	const [inputValue, setInputValue] = useState("")
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const [textAreaDisabled, setTextAreaDisabled] = useState(false)
	const [selectedImages, setSelectedImages] = useState<string[]>([])

<<<<<<< HEAD
	// we need to hold on to the ask because useEffect > lastMessage will always let us know when an ask comes in and handle it, but by the time handleMessage is called, the last message might not be the ask anymore (it could be a say that followed)
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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

<<<<<<< HEAD
	// UI layout depends on the last 2 messages
	// (since it relies on the content of these messages, we are deep comparing. i.e. the button state after hitting button sets enableButtons to false, and this effect otherwise would have to true again even if messages didn't change
	const lastMessage = useMemo(() => messages.at(-1), [messages])
	const secondLastMessage = useMemo(() => messages.at(-2), [messages])

=======
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

>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
	function playSound(audioType: AudioType) {
		vscode.postMessage({ type: "playSound", audioType })
	}

	useDeepCompareEffect(() => {
<<<<<<< HEAD
		// if last message is an ask, show user ask UI
		// if user finished a task, then start a new task with a new conversation history since in this moment that the extension is waiting for user response, the user could close the extension and the conversation history would be lost.
		// basically as long as a task is active, the conversation history will be persisted
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
							// setPrimaryButtonText(undefined)
							// setSecondaryButtonText(undefined)
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
							// extension waiting for feedback. but we can just present a new task button
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
							setDidClickCancel(false) // special case where we reset the cancel button state
=======
							setDidClickCancel(false)
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
					// don't want to reset since there could be a "say" after an "ask" while ask is waiting for response
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
					switch (lastMessage.say) {
						case "api_req_retry_delayed":
							setTextAreaDisabled(true)
							break
						case "api_req_started":
							if (secondLastMessage?.ask === "command_output") {
<<<<<<< HEAD
								// if the last ask is a command_output, and we receive an api_req_started, then that means the command has finished and we don't need input from the user anymore (in every other case, the user has to interact with input field or buttons to continue, which does the following automatically)
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
		} else {
			// this would get called after sending the first message, so we have to watch messages.length instead
			// No messages, so user has to submit a task
			// setTextAreaDisabled(false)
			// setClineAsk(undefined)
			// setPrimaryButtonText(undefined)
			// setSecondaryButtonText(undefined)
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
		const isLastAsk = !!modifiedMessages.at(-1)?.ask // checking clineAsk isn't enough since messages effect may be called again for a tool for example, set clineAsk to its value, and if the next message is not an ask then it doesn't reset. This is likely due to how much more often we're updating messages as compared to before, and should be resolved with optimizations as it's likely a rendering bug. but as a final guard for now, the cancel button will show if the last message is not an ask
=======
		const isLastAsk = !!modifiedMessages.at(-1)?.ask
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
					// api request has not finished yet
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
						case "command": // user can provide feedback to a tool or command use
						case "command_output": // user can send input to command stdin
						case "use_mcp_server":
						case "completion_result": // if this happens then the user has feedback for the completion result
=======
						case "command":
						case "command_output":
						case "use_mcp_server":
						case "completion_result":
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
						// there is no other case that a textfield should be enabled
					}
				}
				// Only reset message-specific state, preserving mode
=======
					}
				}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
				setInputValue("")
				setTextAreaDisabled(true)
				setSelectedImages([])
				setClineAsk(undefined)
				setEnableButtons(false)
<<<<<<< HEAD
				// Do not reset mode here as it should persist
				// setPrimaryButtonText(undefined)
				// setSecondaryButtonText(undefined)
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
				disableAutoScrollRef.current = false
			}
		},
		[messages.length, clineAsk],
	)

	const handleSetChatBoxMessage = useCallback(
		(text: string, images: string[]) => {
<<<<<<< HEAD
			// Avoid nested template literals by breaking down the logic
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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

<<<<<<< HEAD
	/*
	This logic depends on the useEffect[messages] above to set clineAsk, after which buttons are shown and we then send an askResponse to the extension.
	*/
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
					// Only send text/images if they exist
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
					// Clear input state after sending
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
					setInputValue("")
					setSelectedImages([])
					break
				case "completion_result":
				case "resume_completed_task":
<<<<<<< HEAD
					// extension waiting for feedback. but we can just present a new task button
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
					// Only send text/images if they exist
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
					if (trimmedInput || (images && images.length > 0)) {
						vscode.postMessage({
							type: "askResponse",
							askResponse: "noButtonClicked",
							text: trimmedInput,
							images: images,
						})
					} else {
<<<<<<< HEAD
						// responds to the API with a "This operation failed" and lets it try again
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
						vscode.postMessage({
							type: "askResponse",
							askResponse: "noButtonClicked",
						})
					}
<<<<<<< HEAD
					// Clear input state after sending
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
			// textAreaRef.current is not explicitly required here since react gaurantees that ref will be stable across re-renders, and we're not using its value but its reference.
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
		// NOTE: the vscode window needs to be focused for this to work
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
					// don't show a chat row for a completion_result ask without text. This specific type of message only occurs if cline wants to execute a command as part of its completion result, in which case we interject the completion_result tool with the execute_command tool.
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
					if (message.text === "") {
						return false
					}
					break
<<<<<<< HEAD
				case "api_req_failed": // this message is used to update the latest api_req_started that the request failed
=======
				case "api_req_failed":
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
				case "resume_task":
				case "resume_completed_task":
					return false
			}
			switch (message.say) {
<<<<<<< HEAD
				case "api_req_finished": // combineApiRequests removes this from modifiedMessages anyways
				case "api_req_retried": // this message is used to update the latest api_req_started that the request was retried
				case "api_req_deleted": // aggregated api_req metrics from deleted messages
					return false
				case "api_req_retry_delayed":
					// Only show the retry message if it's the last message
					return message === modifiedMessages.at(-1)
				case "text":
					// Sometimes cline returns an empty text message, we don't want to render these. (We also use a say text for user messages, so in case they just sent images we still render that)
=======
				case "api_req_finished":
				case "api_req_retried":
				case "api_req_deleted":
					return false
				case "api_req_retry_delayed":
					return message === modifiedMessages.at(-1)
				case "text":
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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

<<<<<<< HEAD
	// Check if a command message is allowed
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
		// Only execute when isStreaming changes from true to false
		if (wasStreaming && !isStreaming && lastMessage) {
			// Play appropriate sound based on lastMessage content
			if (lastMessage.type === "ask") {
				// Don't play sounds for auto-approved actions
=======
		if (wasStreaming && !isStreaming && lastMessage) {
			if (lastMessage.type === "ask") {
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
		// Update previous value
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
		setWasStreaming(isStreaming)
	}, [isStreaming, lastMessage, wasStreaming, isAutoApproved])

	const isBrowserSessionMessage = (message: ClineMessage): boolean => {
<<<<<<< HEAD
		// which of visible messages are browser session messages, see above
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
				// complete existing browser session if any
				endBrowserSession()
				// start new
				isInBrowserSession = true
				currentGroup.push(message)
			} else if (isInBrowserSession) {
				// end session if api_req_started is cancelled

				if (message.say === "api_req_started") {
					// get last api_req_started in currentGroup to check if it's cancelled. If it is then this api req is not part of the current browser session
=======
				endBrowserSession()
				isInBrowserSession = true
				currentGroup.push(message)
			} else if (isInBrowserSession) {
				if (message.say === "api_req_started") {
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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

<<<<<<< HEAD
					// Check if this is a close action
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
					if (message.say === "browser_action") {
						const browserAction = JSON.parse(message.text || "{}") as ClineSayBrowserAction
						if (browserAction.action === "close") {
							endBrowserSession()
						}
					}
				} else {
<<<<<<< HEAD
					// complete existing browser session if any
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
					endBrowserSession()
					result.push(message)
				}
			} else {
				result.push(message)
			}
		})

<<<<<<< HEAD
		// Handle case where browser session is the last group
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
		if (currentGroup.length > 0) {
			result.push([...currentGroup])
		}

		return result
	}, [visibleMessages])

<<<<<<< HEAD
	// scrolling

=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
			behavior: "auto", // instant causes crash
		})
	}, [])

	// scroll when user toggles certain rows
	const toggleRowExpansion = useCallback(
		(ts: number) => {
			const isCollapsing = expandedRows[ts] ?? false
			const lastGroup = groupedMessages.at(-1)
			const isLast = Array.isArray(lastGroup) ? lastGroup[0].ts === ts : lastGroup?.ts === ts
			const secondToLastGroup = groupedMessages.at(-2)
			const isSecondToLast = Array.isArray(secondToLastGroup)
				? secondToLastGroup[0].ts === ts
				: secondToLastGroup?.ts === ts

			const isLastCollapsedApiReq =
				isLast &&
				!Array.isArray(lastGroup) && // Make sure it's not a browser session group
				lastGroup?.say === "api_req_started" &&
				!expandedRows[lastGroup.ts]

=======
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
				
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
			setExpandedRows((prev) => ({
				...prev,
				[ts]: !prev[ts],
			}))

<<<<<<< HEAD
			// disable auto scroll when user expands row
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
			// return () => clearTimeout(timer) // dont cleanup since if visibleMessages.length changes it cancels.
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
		}
	}, [groupedMessages.length, scrollToBottomSmooth])

	const handleWheel = useCallback((event: Event) => {
		const wheelEvent = event as WheelEvent
		if (wheelEvent.deltaY && wheelEvent.deltaY < 0) {
			if (scrollContainerRef.current?.contains(wheelEvent.target as Node)) {
<<<<<<< HEAD
				// user scrolled up
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
				disableAutoScrollRef.current = true
			}
		}
	}, [])
<<<<<<< HEAD
	useEvent("wheel", handleWheel, window, { passive: true }) // passive improves scrolling performance

	const placeholderText = useMemo(() => {
		const baseText = task ? "Type a message..." : "Type your task here..."
=======
	useEvent("wheel", handleWheel, window, { passive: true })

	const placeholderText = useMemo(() => {
		const baseText = task ? "Plan, search and build anything with Optima ai..." : "Plan, search and build anything with optima ai..."
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
		const contextText = "(@ to add context, / to switch modes"
		const imageText = shouldDisableImages ? "" : ", hold shift to drag in images"
		const helpText = imageText ? `\n${contextText}${imageText})` : `\n${contextText})`
		return baseText + helpText
	}, [task, shouldDisableImages])

	const itemContent = useCallback(
		(index: number, messageOrGroup: ClineMessage | ClineMessage[]) => {
<<<<<<< HEAD
			// browser session group
			if (Array.isArray(messageOrGroup)) {
				return (
					<BrowserSessionRow
						messages={messageOrGroup}
=======
			if (Array.isArray(messageOrGroup)) {
				return (
					<BrowserSessionRow
						messages={messageOrGroup as ClineMessage[]}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
						isLast={index === groupedMessages.length - 1}
						lastModifiedMessage={modifiedMessages.at(-1)}
						onHeightChange={handleRowHeightChange}
						isStreaming={isStreaming}
<<<<<<< HEAD
						// Pass handlers for each message in the group
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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

<<<<<<< HEAD
			// regular message
			return (
				<ChatRow
					key={messageOrGroup.ts}
					message={messageOrGroup}
=======
			return (
				<ChatRow
					key={messageOrGroup.ts}
					message={messageOrGroup as ClineMessage}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
		// Only proceed if we have an ask and buttons are enabled
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
		if (!clineAsk || !enableButtons) return

		const autoApprove = async () => {
			if (isAutoApproved(lastMessage)) {
<<<<<<< HEAD
				// Add delay for write operations
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
=======
				backgroundColor: "var(--vscode-editor-background)",
				borderRadius: "var(--radius)",
				boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
				border: "1px solid var(--optima-gray-light, var(--vscode-panel-border))",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
						flex: "1 1 0", // flex-grow: 1, flex-shrink: 1, flex-basis: 0
=======
						flex: "1 1 0",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
						minHeight: 0,
						overflowY: "auto",
						display: "flex",
						flexDirection: "column",
						paddingBottom: "10px",
					}}>
					{showAnnouncement && <Announcement version={version} hideAnnouncement={hideAnnouncement} />}
					<div style={{ padding: "0 20px", flexShrink: 0 }}>
<<<<<<< HEAD
						<h2>What can Optima do for you?</h2>
						<p>
							Thanks to the latest breakthroughs in agentic coding capabilities, I can handle complex
							software development tasks step-by-step. With tools that let me create & edit files, explore
							complex projects, use the browser, and execute terminal commands (after you grant
							permission), I can assist you in ways that go beyond code completion or tech support. I can
							even use MCP to create new tools and extend my own capabilities.
=======
						<h2>What can Optima AI do for you?</h2>
						<p className="capabilities-description">
							Thanks to cutting-edge agentic coding capabilities, I can autonomously handle complex software development tasks—step-by-step. Whether it's editing files, exploring large codebases, browsing the web, or executing terminal commands (with permission), I offer more than just code completion. I can even evolve by creating new tools through MCP, extending my capabilities as needed.
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
						</p>
					</div>
					{taskHistory.length > 0 && <HistoryPreview showHistoryView={showHistoryView} />}
				</div>
			)}

<<<<<<< HEAD
			{/* 
			// Flex layout explanation:
			// 1. Content div above uses flex: "1 1 0" to:
			//    - Grow to fill available space (flex-grow: 1) 
			//    - Shrink when AutoApproveMenu needs space (flex-shrink: 1)
			//    - Start from zero size (flex-basis: 0) to ensure proper distribution
			//    minHeight: 0 allows it to shrink below its content height
			//
			// 2. AutoApproveMenu uses flex: "0 1 auto" to:
			//    - Not grow beyond its content (flex-grow: 0)
			//    - Shrink when viewport is small (flex-shrink: 1) 
			//    - Use its content size as basis (flex-basis: auto)
			//    This ensures it takes its natural height when there's space
			//    but becomes scrollable when the viewport is too small
			*/}
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
			{!task && (
				<AutoApproveMenu
					style={{
						marginBottom: -2,
<<<<<<< HEAD
						flex: "0 1 auto", // flex-grow: 0, flex-shrink: 1, flex-basis: auto
=======
						flex: "0 1 auto",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
						minHeight: 0,
					}}
				/>
			)}

			{task && (
				<>
					<div style={{ flexGrow: 1, display: "flex" }} ref={scrollContainerRef}>
						<Virtuoso
							ref={virtuosoRef}
<<<<<<< HEAD
							key={task.ts} // trick to make sure virtuoso re-renders when task changes, and we use initialTopMostItemIndex to start at the bottom
							className="scrollable"
							style={{
								flexGrow: 1,
								overflowY: "scroll", // always show scrollbar
							}}
							components={{
								Footer: () => <div style={{ height: 5 }} />, // Add empty padding at the bottom
							}}
							// increasing top by 3_000 to prevent jumping around when user collapses a row
							increaseViewportBy={{ top: 3_000, bottom: Number.MAX_SAFE_INTEGER }} // hack to make sure the last message is always rendered to get truly perfect scroll to bottom animation when new messages are added (Number.MAX_SAFE_INTEGER is safe for arithmetic operations, which is all virtuoso uses this value for in src/sizeRangeSystem.ts)
							data={groupedMessages} // messages is the raw format returned by extension, modifiedMessages is the manipulated structure that combines certain messages of related type, and visibleMessages is the filtered structure that removes messages that should not be rendered
=======
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
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
							itemContent={itemContent}
							atBottomStateChange={(isAtBottom) => {
								setIsAtBottom(isAtBottom)
								if (isAtBottom) {
									disableAutoScrollRef.current = false
								}
								setShowScrollToBottom(disableAutoScrollRef.current && !isAtBottom)
							}}
<<<<<<< HEAD
							atBottomThreshold={10} // anything lower causes issues with followOutput
=======
							atBottomThreshold={10}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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
<<<<<<< HEAD
								<VSCodeButton
									appearance="secondary"
									disabled={!enableButtons && !(isStreaming && !didClickCancel)}
									style={{
										flex: isStreaming ? 2 : 1,
										marginLeft: isStreaming ? 0 : "6px",
									}}
									onClick={(e) => handleSecondaryButtonClick(inputValue, selectedImages)}>
									{isStreaming ? "Cancel" : secondaryButtonText}
								</VSCodeButton>
=======
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
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
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

<<<<<<< HEAD
=======
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

>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
export default ChatView
