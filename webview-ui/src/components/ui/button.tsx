import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:opacity-90",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground shadow hover:bg-primary/90 transform hover:-translate-y-0.5 hover:shadow-md transition-all duration-200",
				secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90 transform hover:-translate-y-0.5 hover:shadow-md transition-all duration-200",
				outline:
					"border-2 border-primary/30 text-primary bg-transparent shadow-sm hover:border-primary/80 hover:bg-primary/10 transform hover:-translate-y-0.5 transition-all duration-200",
				ghost: "hover:bg-accent/20 hover:text-accent-foreground transition-all duration-200",
				link: "text-primary underline-offset-4 hover:underline",
				destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 transform hover:-translate-y-0.5 hover:shadow-md transition-all duration-200",
				combobox:
					"bg-vscode-dropdown-background text-vscode-dropdown-foreground border border-vscode-dropdown-border rounded-md transition-all duration-200",
			},
			size: {
				default: "h-8 px-4 py-2",
				sm: "h-7 px-3 py-1 text-sm",
				lg: "h-9 px-5 py-2.5 text-lg",
				icon: "h-8 w-8",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button"
		return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
	},
)
Button.displayName = "Button"

export { Button, buttonVariants }
