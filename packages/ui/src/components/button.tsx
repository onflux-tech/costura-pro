import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@costura-pro/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
	"inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-medium text-md outline-none transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		defaultVariants: { size: "default", variant: "default" },
		variants: {
			size: {
				default: "min-h-11 px-3.5 md:min-h-9",
				icon: "size-11 md:size-9",
				sm: "min-h-11 px-3 md:min-h-8",
				touch: "min-h-12 w-full rounded-lg px-4 text-sm",
			},
			variant: {
				dashed:
					"border-border-strong border-dashed bg-card text-foreground hover:bg-muted",
				default:
					"bg-primary font-semibold text-primary-foreground hover:bg-secondary",
				destructive:
					"bg-danger-soft font-semibold text-danger-foreground hover:bg-danger-border",
				ghost: "text-foreground hover:bg-muted",
				link: "text-secondary underline-offset-4 hover:underline",
				nav: "text-subtle-foreground hover:bg-muted aria-[current=page]:bg-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent-foreground",
				outline: "border-border-strong bg-card text-foreground hover:bg-muted",
			},
		},
	}
);

function Button({
	className,
	variant = "default",
	size = "default",
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
	return (
		<ButtonPrimitive
			className={cn(buttonVariants({ className, size, variant }))}
			data-slot="button"
			{...props}
		/>
	);
}

export { Button, buttonVariants };
