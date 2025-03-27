"use client"

<<<<<<< HEAD
import React from 'react';
import { Dialog as MuiDialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';

const StyledDialog = styled(MuiDialog)(({ theme }) => ({
	'& .MuiDialog-paper': {
		background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
		borderRadius: '16px',
		border: '1px solid #FF69B4',
		boxShadow: '0 4px 20px rgba(255, 105, 180, 0.1)',
	},
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
	color: '#FF69B4',
	borderBottom: '1px solid #FF69B4',
	padding: theme.spacing(2),
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
	color: '#FFB6C1',
	padding: theme.spacing(3),
}));

const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
	borderTop: '1px solid #FF69B4',
	padding: theme.spacing(2),
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
	color: '#FF69B4',
	'&:hover': {
		background: 'rgba(255, 105, 180, 0.1)',
	},
}));

interface DialogProps {
	open: boolean;
	onClose: () => void;
	title?: React.ReactNode;
	children?: React.ReactNode;
	actions?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
	open,
	onClose,
	title,
	children,
	actions,
}) => {
	return (
		<StyledDialog
			open={open}
			onClose={onClose}
			maxWidth="sm"
			fullWidth
		>
			{title && (
				<StyledDialogTitle>
					{title}
					<StyledIconButton onClick={onClose} size="small">
						<CloseIcon />
					</StyledIconButton>
				</StyledDialogTitle>
			)}
			<StyledDialogContent>
				{children}
			</StyledDialogContent>
			{actions && (
				<StyledDialogActions>
					{actions}
				</StyledDialogActions>
			)}
		</StyledDialog>
	);
};
=======
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Cross2Icon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		ref={ref}
		className={cn(
			"fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
			className,
		)}
		{...props}
	/>
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
	<DialogPortal>
		<DialogOverlay />
		<DialogPrimitive.Content
			ref={ref}
			className={cn(
				"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
				className,
			)}
			{...props}>
			{children}
			<DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
				<Cross2Icon className="h-4 w-4" />
				<span className="sr-only">Close</span>
			</DialogPrimitive.Close>
		</DialogPrimitive.Content>
	</DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title
		ref={ref}
		className={cn("text-lg font-semibold leading-none tracking-tight", className)}
		{...props}
	/>
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
	Dialog,
	DialogPortal,
	DialogOverlay,
	DialogTrigger,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription,
}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
