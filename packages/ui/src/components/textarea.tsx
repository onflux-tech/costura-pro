import { Field as FieldPrimitive } from "@base-ui/react/field";
import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<FieldPrimitive.Control
			className={cn(
				"min-h-24 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-danger-foreground md:text-md",
				className
			)}
			data-slot="textarea"
			render={<textarea {...props} />}
		/>
	);
}

export { Textarea };
