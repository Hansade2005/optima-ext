<<<<<<< HEAD
import React from 'react';
import { Box, TextField, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';

const StyledBox = styled(Box)(({ theme }) => ({
	background: 'linear-gradient(145deg, #252526 0%, #2a2a2b 100%)',
	borderRadius: '16px',
	border: '1px solid #FF69B4',
	boxShadow: '0 4px 20px rgba(255, 105, 180, 0.1)',
	width: '100%',
	maxWidth: '600px',
	margin: '0 auto',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
	'& .MuiOutlinedInput-root': {
		borderRadius: '12px',
		backgroundColor: 'rgba(255, 105, 180, 0.1)',
		'&:hover fieldset': {
			borderColor: '#FF69B4',
		},
		'&.Mui-focused fieldset': {
			borderColor: '#FF69B4',
		},
	},
	'& .MuiInputLabel-root': {
		color: '#FFB6C1',
		'&.Mui-focused': {
			color: '#FF69B4',
		},
	},
	'& .MuiInputBase-input': {
		color: '#FFB6C1',
	},
}));

const StyledListItem = styled(ListItem)(({ theme }) => ({
	borderRadius: '8px',
	margin: '4px 0',
	'&:hover': {
		background: 'rgba(255, 105, 180, 0.1)',
	},
	'&.Mui-selected': {
		background: 'rgba(255, 105, 180, 0.2)',
		'&:hover': {
			background: 'rgba(255, 105, 180, 0.3)',
		},
	},
}));

const StyledListItemText = styled(ListItemText)(({ theme }) => ({
	'& .MuiListItemText-primary': {
		color: '#FF69B4',
	},
	'& .MuiListItemText-secondary': {
		color: '#FFB6C1',
	},
}));

interface CommandProps {
	placeholder?: string;
	items: {
		id: string;
		label: string;
		description?: string;
		icon?: React.ReactNode;
		onSelect: () => void;
	}[];
}

export const Command: React.FC<CommandProps> = ({
	placeholder = 'Type a command...',
	items,
}) => {
	const [search, setSearch] = React.useState('');
	const [selectedIndex, setSelectedIndex] = React.useState(-1);

	const filteredItems = items.filter(item =>
		item.label.toLowerCase().includes(search.toLowerCase())
	);

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			setSelectedIndex(prev => 
				prev < filteredItems.length - 1 ? prev + 1 : prev
			);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
		} else if (event.key === 'Enter' && selectedIndex >= 0) {
			filteredItems[selectedIndex].onSelect();
		}
	};

	return (
		<StyledBox>
			<Box sx={{ p: 2 }}>
				<StyledTextField
					fullWidth
					placeholder={placeholder}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					onKeyDown={handleKeyDown}
					InputProps={{
						startAdornment: (
							<SearchIcon sx={{ color: '#FF69B4', mr: 1 }} />
						),
					}}
				/>
			</Box>
			<List sx={{ maxHeight: '300px', overflow: 'auto', p: 2 }}>
				{filteredItems.map((item, index) => (
					<StyledListItem
						key={item.id}
						selected={index === selectedIndex}
						onClick={() => item.onSelect()}
						button
					>
						{item.icon && (
							<ListItemIcon sx={{ color: '#FF69B4' }}>
								{item.icon}
							</ListItemIcon>
						)}
						<StyledListItemText
							primary={item.label}
							secondary={item.description}
						/>
					</StyledListItem>
				))}
			</List>
		</StyledBox>
	);
};
=======
import * as React from "react"
import { type DialogProps } from "@radix-ui/react-dialog"
import { Command as CommandPrimitive } from "cmdk"
import { MagnifyingGlassIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"

import { Dialog, DialogContent } from "@/components/ui/dialog"

const Command = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
	<CommandPrimitive
		ref={ref}
		className={cn(
			"flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
			className,
		)}
		{...props}
	/>
))
Command.displayName = CommandPrimitive.displayName

const CommandDialog = ({ children, ...props }: DialogProps) => {
	return (
		<Dialog {...props}>
			<DialogContent className="overflow-hidden p-0">
				<Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
					{children}
				</Command>
			</DialogContent>
		</Dialog>
	)
}

const CommandInput = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Input>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
	<div className="flex items-center border-b border-vscode-dropdown-border px-3" cmdk-input-wrapper="">
		<MagnifyingGlassIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
		<CommandPrimitive.Input
			ref={ref}
			className={cn(
				"flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	</div>
))

CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.List
		ref={ref}
		className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
		{...props}
	/>
))

CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Empty>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />)

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Group>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Group
		ref={ref}
		className={cn(
			"overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
			className,
		)}
		{...props}
	/>
))

CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Separator
		ref={ref}
		className={cn("-mx-1 h-px bg-vscode-dropdown-border", className)}
		{...props}
	/>
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Item
		ref={ref}
		className={cn(
			"relative flex cursor-pointer gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm text-vscode-dropdown-foreground outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
			className,
		)}
		{...props}
	/>
))

CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
	return <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />
}
CommandShortcut.displayName = "CommandShortcut"

export {
	Command,
	CommandDialog,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandShortcut,
	CommandSeparator,
}
>>>>>>> 3cf26ac7f905eaeb8535f7a0a000137528dc6856
