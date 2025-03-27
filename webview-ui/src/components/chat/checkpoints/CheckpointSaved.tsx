import { CheckpointMenu } from "./CheckpointMenu"
<<<<<<< HEAD
import { theme } from '../../../theme'
=======
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856

type CheckpointSavedProps = {
	ts: number
	commitHash: string
	currentCheckpointHash?: string
}

export const CheckpointSaved = (props: CheckpointSavedProps) => {
	const isCurrent = props.currentCheckpointHash === props.commitHash

	return (
<<<<<<< HEAD
		<div style={{
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			padding: '8px 12px',
			background: `${theme.colors.primary}10`,
			borderRadius: theme.borderRadius.card,
			border: `1px solid ${theme.colors.border}`,
			transition: theme.transitions.default,
			'&:hover': {
				background: `${theme.colors.primary}20`
			}
		}}>
			<div style={{
				display: 'flex',
				alignItems: 'center',
				gap: '8px'
			}}>
				<span 
					className="codicon codicon-git-commit" 
					style={{ 
						color: theme.colors.primary,
						fontSize: '16px'
					}} 
				/>
				<span style={{
					color: theme.colors.text,
					fontFamily: theme.typography.fontFamily,
					fontWeight: theme.typography.weights.bold
				}}>
					Checkpoint
				</span>
				{isCurrent && (
					<span style={{
						color: theme.colors.textSecondary,
						fontSize: '12px',
						fontFamily: theme.typography.fontFamily
					}}>
						Current
					</span>
				)}
=======
		<div className="flex items-center justify-between">
			<div className="flex gap-2">
				<span className="codicon codicon-git-commit text-blue-400" />
				<span className="font-bold">Checkpoint</span>
				{isCurrent && <span className="text-muted text-sm">Current</span>}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
			</div>
			<CheckpointMenu {...props} />
		</div>
	)
}
