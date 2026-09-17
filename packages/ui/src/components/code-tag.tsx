import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

function CodeTag({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-sm bg-accent px-2 py-1 font-mono font-semibold text-accent-foreground text-xs leading-none",
				className
			)}
			data-slot="code-tag"
			{...props}
		/>
	);
}

export { CodeTag };
