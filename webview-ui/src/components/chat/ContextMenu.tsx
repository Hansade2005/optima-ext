import React, { useEffect, useMemo, useRef } from "react"
import { ContextMenuOptionType, ContextMenuQueryItem, getContextMenuOptions } from "../../utils/context-mentions"
import { removeLeadingNonAlphanumeric } from "../common/CodeAccordian"
import { ModeConfig } from "../../../../src/shared/modes"
<<<<<<< HEAD
import { theme, commonStyles } from '../../theme'
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856

interface ContextMenuProps {
	onSelect: (type: ContextMenuOptionType, value?: string) => void
	searchQuery: string
	onMouseDown: () => void
	selectedIndex: number
	setSelectedIndex: (index: number) => void
	selectedType: ContextMenuOptionType | null
	queryItems: ContextMenuQueryItem[]
	modes?: ModeConfig[]
}

const ContextMenu: React.FC<ContextMenuProps> = ({
	onSelect,
	searchQuery,
	onMouseDown,
	selectedIndex,
	setSelectedIndex,
	selectedType,
	queryItems,
	modes,
}) => {
	const menuRef = useRef<HTMLDivElement>(null)

	const filteredOptions = useMemo(
		() => getContextMenuOptions(searchQuery, selectedType, queryItems, modes),
		[searchQuery, selectedType, queryItems, modes],
	)

	useEffect(() => {
		if (menuRef.current) {
			const selectedElement = menuRef.current.children[selectedIndex] as HTMLElement
			if (selectedElement) {
				const menuRect = menuRef.current.getBoundingClientRect()
				const selectedRect = selectedElement.getBoundingClientRect()

				if (selectedRect.bottom > menuRect.bottom) {
					menuRef.current.scrollTop += selectedRect.bottom - menuRect.bottom
				} else if (selectedRect.top < menuRect.top) {
					menuRef.current.scrollTop -= menuRect.top - selectedRect.top
				}
			}
		}
	}, [selectedIndex])

	const renderOptionContent = (option: ContextMenuQueryItem) => {
		switch (option.type) {
			case ContextMenuOptionType.Mode:
				return (
					<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
<<<<<<< HEAD
						<span style={{
							lineHeight: "1.2",
							color: theme.colors.text,
							fontFamily: theme.typography.fontFamily
						}}>{option.label}</span>
=======
						<span style={{ lineHeight: "1.2" }}>{option.label}</span>
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
						{option.description && (
							<span
								style={{
									opacity: 0.5,
									fontSize: "0.9em",
									lineHeight: "1.2",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
<<<<<<< HEAD
									color: theme.colors.textSecondary,
									fontFamily: theme.typography.fontFamily
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
								}}>
								{option.description}
							</span>
						)}
					</div>
				)
			case ContextMenuOptionType.Problems:
<<<<<<< HEAD
				return <span style={{
					color: theme.colors.text,
					fontFamily: theme.typography.fontFamily
				}}>Problems</span>
			case ContextMenuOptionType.URL:
				return <span style={{
					color: theme.colors.text,
					fontFamily: theme.typography.fontFamily
				}}>Paste URL to fetch contents</span>
			case ContextMenuOptionType.NoResults:
				return <span style={{
					color: theme.colors.textSecondary,
					fontFamily: theme.typography.fontFamily
				}}>No results found</span>
=======
				return <span>Problems</span>
			case ContextMenuOptionType.URL:
				return <span>Paste URL to fetch contents</span>
			case ContextMenuOptionType.NoResults:
				return <span>No results found</span>
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
			case ContextMenuOptionType.Git:
				if (option.value) {
					return (
						<div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
<<<<<<< HEAD
							<span style={{
								lineHeight: "1.2",
								color: theme.colors.text,
								fontFamily: theme.typography.fontFamily
							}}>{option.label}</span>
=======
							<span style={{ lineHeight: "1.2" }}>{option.label}</span>
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
							<span
								style={{
									fontSize: "0.85em",
									opacity: 0.7,
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
									lineHeight: "1.2",
<<<<<<< HEAD
									color: theme.colors.textSecondary,
									fontFamily: theme.typography.fontFamily
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
								}}>
								{option.description}
							</span>
						</div>
					)
				} else {
<<<<<<< HEAD
					return <span style={{
						color: theme.colors.text,
						fontFamily: theme.typography.fontFamily
					}}>Git Commits</span>
=======
					return <span>Git Commits</span>
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
				}
			case ContextMenuOptionType.File:
			case ContextMenuOptionType.OpenedFile:
			case ContextMenuOptionType.Folder:
				if (option.value) {
					return (
						<>
<<<<<<< HEAD
							<span style={{
								color: theme.colors.text,
								fontFamily: theme.typography.fontFamily
							}}>/</span>
							{option.value?.startsWith("/.") && <span style={{
								color: theme.colors.text,
								fontFamily: theme.typography.fontFamily
							}}>.</span>}
=======
							<span>/</span>
							{option.value?.startsWith("/.") && <span>.</span>}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
							<span
								style={{
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
									direction: "rtl",
									textAlign: "left",
<<<<<<< HEAD
									color: theme.colors.text,
									fontFamily: theme.typography.fontFamily
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
								}}>
								{removeLeadingNonAlphanumeric(option.value || "") + "\u200E"}
							</span>
						</>
					)
				} else {
<<<<<<< HEAD
					return <span style={{
						color: theme.colors.text,
						fontFamily: theme.typography.fontFamily
					}}>Add {option.type === ContextMenuOptionType.File ? "File" : "Folder"}</span>
=======
					return <span>Add {option.type === ContextMenuOptionType.File ? "File" : "Folder"}</span>
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
				}
		}
	}

	const getIconForOption = (option: ContextMenuQueryItem): string => {
		switch (option.type) {
			case ContextMenuOptionType.Mode:
				return "symbol-misc"
			case ContextMenuOptionType.OpenedFile:
				return "window"
			case ContextMenuOptionType.File:
				return "file"
			case ContextMenuOptionType.Folder:
				return "folder"
			case ContextMenuOptionType.Problems:
				return "warning"
			case ContextMenuOptionType.URL:
				return "link"
			case ContextMenuOptionType.Git:
				return "git-commit"
			case ContextMenuOptionType.NoResults:
				return "info"
			default:
				return "file"
		}
	}

	const isOptionSelectable = (option: ContextMenuQueryItem): boolean => {
		return option.type !== ContextMenuOptionType.NoResults && option.type !== ContextMenuOptionType.URL
	}

	return (
		<div
			style={{
				position: "absolute",
				bottom: "calc(100% - 10px)",
				left: 15,
				right: 15,
				overflowX: "hidden",
			}}
			onMouseDown={onMouseDown}>
			<div
				ref={menuRef}
				style={{
<<<<<<< HEAD
					...commonStyles.card,
					background: theme.colors.background,
					borderRadius: theme.borderRadius.card,
					boxShadow: theme.shadows.card,
=======
					backgroundColor: "var(--vscode-dropdown-background)",
					border: "1px solid var(--vscode-editorGroup-border)",
					borderRadius: "3px",
					boxShadow: "0 4px 10px rgba(0, 0, 0, 0.25)",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
					zIndex: 1000,
					display: "flex",
					flexDirection: "column",
					maxHeight: "200px",
					overflowY: "auto",
<<<<<<< HEAD
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
				{filteredOptions.map((option, index) => (
					<div
						key={`${option.type}-${option.value || index}`}
						onClick={() => isOptionSelectable(option) && onSelect(option.type, option.value)}
						style={{
							padding: "8px 12px",
							cursor: isOptionSelectable(option) ? "pointer" : "default",
<<<<<<< HEAD
							color: theme.colors.text,
							borderBottom: `1px solid ${theme.colors.border}`,
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							background: index === selectedIndex && isOptionSelectable(option)
								? `${theme.colors.primary}20`
								: 'transparent',
							transition: theme.transitions.default,
							'&:hover': {
								background: `${theme.colors.primary}10`
							}
=======
							color: "var(--vscode-dropdown-foreground)",
							borderBottom: "1px solid var(--vscode-editorGroup-border)",
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							backgroundColor:
								index === selectedIndex && isOptionSelectable(option)
									? "var(--vscode-list-activeSelectionBackground)"
									: "",
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
						}}
						onMouseEnter={() => isOptionSelectable(option) && setSelectedIndex(index)}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								flex: 1,
								minWidth: 0,
								overflow: "hidden",
								paddingTop: 0,
							}}>
							{option.type !== ContextMenuOptionType.Mode && getIconForOption(option) && (
								<i
									className={`codicon codicon-${getIconForOption(option)}`}
									style={{
										marginRight: "6px",
										flexShrink: 0,
										fontSize: "14px",
										marginTop: 0,
<<<<<<< HEAD
										color: theme.colors.text
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
									}}
								/>
							)}
							{renderOptionContent(option)}
						</div>
						{(option.type === ContextMenuOptionType.File ||
							option.type === ContextMenuOptionType.Folder ||
							option.type === ContextMenuOptionType.Git) &&
							!option.value && (
								<i
									className="codicon codicon-chevron-right"
<<<<<<< HEAD
									style={{
										fontSize: "14px",
										flexShrink: 0,
										marginLeft: 8,
										color: theme.colors.text
									}}
=======
									style={{ fontSize: "14px", flexShrink: 0, marginLeft: 8 }}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
								/>
							)}
						{(option.type === ContextMenuOptionType.Problems ||
							((option.type === ContextMenuOptionType.File ||
								option.type === ContextMenuOptionType.Folder ||
								option.type === ContextMenuOptionType.OpenedFile ||
								option.type === ContextMenuOptionType.Git) &&
								option.value)) && (
							<i
								className="codicon codicon-add"
<<<<<<< HEAD
								style={{
									fontSize: "14px",
									flexShrink: 0,
									marginLeft: 8,
									color: theme.colors.text
								}}
=======
								style={{ fontSize: "14px", flexShrink: 0, marginLeft: 8 }}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
							/>
						)}
					</div>
				))}
			</div>
		</div>
	)
}

export default ContextMenu
