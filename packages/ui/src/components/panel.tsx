import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

function Panel({ className, ...props }: React.ComponentProps<"section">) {
	return (
		<section
			className={cn(
				"rounded-xl border bg-card text-card-foreground",
				className
			)}
			data-slot="panel"
			{...props}
		/>
	);
}

function PanelHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-divider border-b px-4 py-3.5",
				className
			)}
			data-slot="panel-header"
			{...props}
		/>
	);
}

function PanelTitle({
	className,
	level = 2,
	...props
}: React.ComponentProps<"h2"> & { level?: 2 | 3 }) {
	const Heading = level === 2 ? "h2" : "h3";
	return (
		<Heading
			className={cn("font-semibold text-sm", className)}
			data-slot="panel-title"
			{...props}
		/>
	);
}

function PanelMeta({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			className={cn("text-muted-foreground text-xs", className)}
			data-slot="panel-meta"
			{...props}
		/>
	);
}

function PanelContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("p-4", className)}
			data-slot="panel-content"
			{...props}
		/>
	);
}

export { Panel, PanelContent, PanelHeader, PanelMeta, PanelTitle };
