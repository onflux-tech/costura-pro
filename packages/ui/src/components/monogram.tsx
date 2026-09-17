import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

function Monogram({
	className,
	initials,
	size = "lg",
	...props
}: React.ComponentProps<"span"> & { initials: string; size?: "lg" | "sm" }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground",
				size === "lg"
					? "size-10 text-md md:size-12 md:text-lg"
					: "size-8 text-xs",
				className
			)}
			data-slot="monogram"
			{...props}
		>
			{initials}
		</span>
	);
}

export { Monogram };
