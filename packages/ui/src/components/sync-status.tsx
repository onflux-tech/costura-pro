import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

const dotTone = {
	offline: "bg-danger",
	ok: "bg-success",
	warning: "bg-warning",
} as const;

function SyncStatus({
	children,
	className,
	tone,
	...props
}: React.ComponentProps<"p"> & { tone: keyof typeof dotTone }) {
	return (
		<p
			className={cn(
				"flex items-center gap-2 text-subtle-foreground text-xs",
				className
			)}
			data-slot="sync-status"
			data-tone={tone}
			role="status"
			{...props}
		>
			<span
				aria-hidden="true"
				className={cn("size-2 shrink-0 rounded-full", dotTone[tone])}
			/>
			{children}
		</p>
	);
}

export { SyncStatus };
