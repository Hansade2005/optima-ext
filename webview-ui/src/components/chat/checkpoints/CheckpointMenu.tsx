import React, { useEffect, useRef, useState } from "react"
import { useOnClickOutside } from "usehooks-ts"
import styles from "./CheckpointMenu.module.css"
import { CheckIcon, Cross2Icon } from "@radix-ui/react-icons"
import { vscode } from "../../../utils/vscode"
import { theme, commonStyles } from '../../../theme'

type CheckpointMenuProps = {
	ts: number
	commitHash: string
	currentCheckpointHash?: string
}

export const CheckpointMenu = ({ ts, commitHash, currentCheckpointHash }: CheckpointMenuProps) => {
	const [portalContainer, setPortalContainer] = useState<HTMLElement>()
	const [isOpen, setIsOpen] = useState(false)
	const [isConfirming, setIsConfirming] = useState(false)

	const isCurrent = currentCheckpointHash === commitHash

	const onCheckpointDiff = () => {
		vscode.postMessage({ type: "checkpointDiff", payload: { ts, commitHash, mode: "checkpoint" } })
	}

	const onPreview = () => {
		vscode.postMessage({ type: "checkpointRestore", payload: { ts, commitHash, mode: "preview" } })
		setIsOpen(false)
	}

	const onRestore = () => {
		vscode.postMessage({ type: "checkpointRestore", payload: { ts, commitHash, mode: "restore" } })
		setIsOpen(false)
	}

	useEffect(() => {
		// The dropdown menu uses a portal from @shadcn/ui which by default renders
		// at the document root. This causes the menu to remain visible even when
		// the parent ChatView component is hidden (during settings/history view).
		// By moving the portal inside ChatView, the menu will properly hide when
		// its parent is hidden.
		setPortalContainer(document.getElementById("chat-view-portal") || undefined)
	}, [])

	const buttonStyle = {
		background: 'transparent',
		color: theme.colors.text,
		padding: '6px',
		borderRadius: theme.borderRadius.button,
		cursor: 'pointer',
		border: 'none',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		transition: theme.transitions.default,
		'&:hover': {
			background: `${theme.colors.primary}20`
		}
	}

	const popoverStyle = {
		...commonStyles.card,
		background: theme.colors.background,
		padding: '12px',
		borderRadius: theme.borderRadius.card,
		boxShadow: theme.shadows.card,
		minWidth: '250px'
	}

	const actionButtonStyle = {
		width: '100%',
		padding: '8px 12px',
		background: `linear-gradient(45deg, ${theme.colors.secondary}, ${theme.colors.primary})`,
		color: theme.colors.text,
		border: 'none',
		borderRadius: theme.borderRadius.button,
		fontFamily: theme.typography.fontFamily,
		cursor: 'pointer',
		transition: theme.transitions.default,
		'&:hover': {
			transform: 'translateY(-2px)',
			boxShadow: theme.shadows.hover
		}
	}

	const secondaryButtonStyle = {
		...actionButtonStyle,
		background: `${theme.colors.primary}20`,
		'&:hover': {
			background: `${theme.colors.primary}40`,
			transform: 'translateY(-2px)'
		}
	}

	return (
		<div style={{ display: 'flex', gap: '4px' }}>
			<button onClick={onCheckpointDiff} style={buttonStyle} title="View Diff">
				<span className="codicon codicon-diff-single" style={{ fontSize: '16px' }} />
			</button>
			<div style={{ position: 'relative' }}>
				<button 
					onClick={() => setIsOpen(!isOpen)} 
					style={buttonStyle} 
					title="Restore Checkpoint">
					<span className="codicon codicon-history" style={{ fontSize: '16px' }} />
				</button>
				{isOpen && (
					<div style={popoverStyle}>
						<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
							{!isCurrent && (
								<div>
									<button style={actionButtonStyle} onClick={onPreview}>
										Restore Files
									</button>
									<p style={{
										marginTop: '4px',
										fontSize: '12px',
										color: theme.colors.textSecondary,
										fontFamily: theme.typography.fontFamily
									}}>
										Restores your project's files back to a snapshot taken at this point.
									</p>
								</div>
							)}
							<div>
								{!isConfirming ? (
									<button 
										style={secondaryButtonStyle} 
										onClick={() => setIsConfirming(true)}>
										Restore Files & Task
									</button>
								) : (
									<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
										<button style={actionButtonStyle} onClick={onRestore}>
											<div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
												<CheckIcon />
												<span>Confirm</span>
											</div>
										</button>
										<button style={secondaryButtonStyle} onClick={() => setIsConfirming(false)}>
											<div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
												<Cross2Icon />
												<span>Cancel</span>
											</div>
										</button>
									</div>
								)}
								<p style={{
									marginTop: '4px',
									fontSize: '12px',
									color: isConfirming ? theme.colors.error : theme.colors.textSecondary,
									fontFamily: theme.typography.fontFamily,
									fontWeight: isConfirming ? theme.typography.weights.bold : 'normal'
								}}>
									{isConfirming ? 
										"This action cannot be undone." :
										"Restores your project's files back to a snapshot taken at this point and deletes all messages after this point."}
								</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
