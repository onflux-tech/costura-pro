import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<InputPrimitive
			className={cn(
				"h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-danger-foreground md:h-10 md:text-md",
				className
			)}
			data-slot="input"
			type={type}
			{...props}
		/>
	);
}

export { Input };
