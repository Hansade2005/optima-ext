<<<<<<< HEAD
import React from 'react';
import { Popover as MuiPopover, PopoverProps as MuiPopoverProps } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPopover = styled(MuiPopover)(({ theme }) => ({
	'& .MuiPaper-root': {
		background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
		borderRadius: '12px',
		border: '1px solid #FF69B4',
		boxShadow: '0 4px 20px rgba(255, 105, 180, 0.1)',
		color: '#FFB6C1',
		padding: '16px',
	},
}));

interface PopoverProps extends Omit<MuiPopoverProps, 'children'> {
	children: React.ReactNode;
}

export const Popover: React.FC<PopoverProps> = ({ children, ...props }) => {
	return (
		<StyledPopover
			{...props}
			anchorOrigin={{
				vertical: 'bottom',
				horizontal: 'center',
			}}
			transformOrigin={{
				vertical: 'top',
				horizontal: 'center',
			}}
		>
			{children}
		</StyledPopover>
	);
};
=======
import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
		container?: HTMLElement
	}
>(({ className, align = "center", sideOffset = 4, container, ...props }, ref) => (
	<PopoverPrimitive.Portal container={container}>
		<PopoverPrimitive.Content
			ref={ref}
			align={align}
			sideOffset={sideOffset}
			className={cn(
				"z-50 w-72 rounded-xs border border-vscode-dropdown-border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
				className,
			)}
			{...props}
		/>
	</PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
