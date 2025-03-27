import React, { useEffect, useRef } from "react"
import { CODE_BLOCK_BG_COLOR } from "../common/CodeBlock"
import MarkdownBlock from "../common/MarkdownBlock"
<<<<<<< HEAD
import { theme, commonStyles } from '../../theme'
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856

interface ReasoningBlockProps {
	content: string
	isCollapsed?: boolean
	onToggleCollapse?: () => void
	autoHeight?: boolean
}

const ReasoningBlock: React.FC<ReasoningBlockProps> = ({
	content,
	isCollapsed = false,
	onToggleCollapse,
	autoHeight = false,
}) => {
	const contentRef = useRef<HTMLDivElement>(null)

	// Scroll to bottom when content updates
	useEffect(() => {
		if (contentRef.current && !isCollapsed) {
			contentRef.current.scrollTop = contentRef.current.scrollHeight
		}
	}, [content, isCollapsed])

	return (
		<div
			style={{
<<<<<<< HEAD
				...commonStyles.card,
				background: 'rgba(0, 0, 0, 0.2)',
				borderRadius: theme.borderRadius.card,
=======
				backgroundColor: CODE_BLOCK_BG_COLOR,
				border: "1px solid var(--vscode-editorGroup-border)",
				borderRadius: "3px",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
				overflow: "hidden",
			}}>
			<div
				onClick={onToggleCollapse}
				style={{
					padding: "8px 12px",
					cursor: "pointer",
					userSelect: "none",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
<<<<<<< HEAD
					borderBottom: isCollapsed ? "none" : `1px solid ${theme.colors.border}`,
					background: theme.colors.background,
					color: theme.colors.text,
					fontFamily: theme.typography.fontFamily,
					fontWeight: theme.typography.weights.bold,
					transition: theme.transitions.default,
					'&:hover': {
						background: `${theme.colors.primary}10`
					}
				}}>
				<span>Reasoning</span>
=======
					borderBottom: isCollapsed ? "none" : "1px solid var(--vscode-editorGroup-border)",
				}}>
				<span style={{ fontWeight: "bold" }}>Reasoning</span>
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
				<span className={`codicon codicon-chevron-${isCollapsed ? "right" : "down"}`}></span>
			</div>
			{!isCollapsed && (
				<div
					ref={contentRef}
					style={{
						padding: "8px 12px",
						maxHeight: autoHeight ? "none" : "160px",
						overflowY: "auto",
<<<<<<< HEAD
						background: theme.colors.background,
						'&::-webkit-scrollbar': {
							width: '8px',
						},
						'&::-webkit-scrollbar-track': {
							background: 'transparent',
						},
						'&::-webkit-scrollbar-thumb': {
							background: theme.colors.border,
							borderRadius: '4px',
						},
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
					}}>
					<div
						style={{
							fontSize: "13px",
							opacity: 0.9,
<<<<<<< HEAD
							color: theme.colors.text,
							fontFamily: theme.typography.fontFamily,
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
						}}>
						<MarkdownBlock markdown={content} />
					</div>
				</div>
			)}
		</div>
	)
}

export default ReasoningBlock
