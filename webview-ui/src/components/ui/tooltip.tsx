<<<<<<< HEAD
import React from 'react';
import { Tooltip as MuiTooltip, TooltipProps as MuiTooltipProps } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledTooltip = styled(({ className, ...props }: MuiTooltipProps) => (
	<MuiTooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
	'& .MuiTooltip-tooltip': {
		background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
		border: '1px solid #FF69B4',
		borderRadius: '8px',
		color: '#FFB6C1',
		padding: '8px 12px',
		fontSize: '0.875rem',
		boxShadow: '0 4px 20px rgba(255, 105, 180, 0.1)',
	},
	'& .MuiTooltip-arrow': {
		color: '#FF69B4',
	},
}));

interface TooltipProps extends Omit<MuiTooltipProps, 'children'> {
	children: React.ReactElement;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, ...props }) => {
	return (
		<StyledTooltip {...props}>
			{children}
		</StyledTooltip>
	);
};
=======
import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<TooltipPrimitive.Portal>
		<TooltipPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				"z-50 overflow-hidden rounded-xs bg-vscode-notifications-background border border-vscode-notifications-border px-3 py-1.5 text-xs text-vscode-notifications-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
				className,
			)}
			{...props}
		/>
	</TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
