import { useState, useEffect } from "react"
import copyToClipboard from "../../utils/copyToClipboard"

interface ChatMessageBubbleProps {
  message: {
    id: string
    role: string
    content: string
  }
  isActive: boolean
  toggleActive: (id: string) => void
  previousMessage: { role: string } | null
}

// Define types for the code component props
interface CodeProps {
  node: any;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

const ChatMessageBubble = ({ message, isActive, toggleActive, previousMessage }: ChatMessageBubbleProps) => {
  const [copied, setCopied] = useState(false)
  const [showExpand, setShowExpand] = useState(false)
  const [expandButton, setExpandButton] = useState<HTMLButtonElement | null>(null)
  
  const isUser = message.role === "user"
  const sameAsPrevious = previousMessage && previousMessage.role === message.role

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timeout)
    }
  }, [copied])

  // Handle copy action
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(message.content)
    setCopied(true)
  }

  // Update boxShadow style to prevent duplicate keys
  const bubbleStyle = {
    position: "relative" as const,
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "14px",
    lineHeight: "1.5",
    color: isUser ? "var(--vscode-input-foreground)" : "var(--vscode-editor-foreground)",
    backgroundColor: isUser ? "var(--vscode-input-background)" : "var(--vscode-sideBar-background)",
    border: isUser
      ? "1px solid var(--vscode-widget-border)"
      : "1px solid var(--vscode-sideBar-border, var(--vscode-widget-border))",
    // Use a single boxShadow property
    boxShadow: isActive 
      ? "0 3px 6px rgba(0, 0, 0, 0.1)" 
      : "0 1px 3px rgba(0, 0, 0, 0.05)",
    transition: "box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out",
    transform: isActive ? "translateY(-1px)" : "none",
    // ... other styles ...
  };

  // Format the content with simple line breaks instead of markdown
  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => (
      <div key={i}>{line || <br />}</div>
    ));
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`message-container ${sameAsPrevious ? "same-sender" : ""}`}
      style={{
        padding: sameAsPrevious ? "4px 20px" : "12px 20px",
        position: "relative",
        transition: "background-color 0.2s ease",
        backgroundColor: isUser 
          ? "var(--vscode-editor-background)" 
          : isActive
            ? "var(--vscode-list-hoverBackground)"
            : "var(--vscode-editor-background)",
      }}
      onClick={() => toggleActive(message.id)}
      onMouseEnter={() => setShowExpand(true)}
      onMouseLeave={() => setShowExpand(false)}
    >
      {/* Indicator of sender identity */}
      {!sameAsPrevious && (
        <div 
          style={{
            fontSize: "12px",
            fontWeight: "bold",
            marginBottom: "6px",
            color: isUser 
              ? "var(--vscode-editor-foreground)" 
              : "var(--optima-pink)",
          }}
        >
          {isUser ? "You" : "Optima AI"}
        </div>
      )}

      {/* Message bubble */}
      <div 
        style={bubbleStyle}
      >
        {/* Left pink accent for AI messages */}
        {!isUser && (
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
        )}

        {/* Message content */}
        <div 
          className="message-content" 
          style={{
            fontSize: "var(--vscode-font-size)",
            lineHeight: "1.5",
            color: "var(--vscode-editor-foreground)",
            paddingLeft: !isUser ? "8px" : "0", // Extra padding for AI messages with left border
            whiteSpace: "pre-wrap",
          }}
        >
          {formatContent(message.content)}
        </div>
      </div>

      {/* Copy button - only shown on hover */}
      {showExpand && (
        <button
          ref={setExpandButton}
          className="copy-button"
          style={{
            position: "absolute",
            top: "12px",
            right: "20px",
            opacity: copied ? 1 : 0.7,
            background: "transparent",
            border: "none",
            borderRadius: "4px",
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: "12px",
            color: "var(--vscode-foreground)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
          onClick={handleCopy}
        >
          <span className={`codicon ${copied ? 'codicon-check' : 'codicon-copy'}`}></span>
          {copied && (
            <span style={{ fontSize: "12px" }}>Copied!</span>
          )}
        </button>
      )}
    </div>
  )
}

export default ChatMessageBubble 