import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

function BrandMark({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex size-8 shrink-0 items-center justify-center rounded-md bg-nav-active font-semibold font-serif text-lg text-nav-active-foreground",
				className
			)}
			data-slot="brand-mark"
			{...props}
		>
			C
		</span>
	);
}

export { BrandMark };
