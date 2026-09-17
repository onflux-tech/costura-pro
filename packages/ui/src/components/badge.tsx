import { cn } from "@costura-pro/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const badgeVariants = cva(
	"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1 font-semibold text-xs leading-none",
	{
		defaultVariants: { tone: "neutral" },
		variants: {
			tone: {
				danger: "bg-danger-soft text-danger-foreground",
				neutral: "bg-muted text-subtle-foreground",
				success: "bg-success-soft text-success-foreground",
				warning: "bg-warning-soft text-warning-foreground",
			},
		},
	}
);

function Badge({
	className,
	tone,
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return (
		<span
			className={cn(badgeVariants({ tone }), className)}
			data-slot="badge"
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
