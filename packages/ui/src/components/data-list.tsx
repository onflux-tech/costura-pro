import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

function DataList({
	className,
	columns,
	style,
	...props
}: React.ComponentProps<"ul"> & { columns: string }) {
	return (
		<ul
			className={cn("flex flex-col", className)}
			data-slot="data-list"
			style={
				{ "--data-list-columns": columns, ...style } as React.CSSProperties
			}
			{...props}
		/>
	);
}

function DataListHeader({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			aria-hidden="true"
			className={cn(
				"hidden gap-x-3.5 border-divider border-b px-4 py-2.5 text-muted-foreground text-xs uppercase tracking-wide md:grid md:grid-cols-(--data-list-columns)",
				className
			)}
			data-slot="data-list-header"
			{...props}
		/>
	);
}

function DataListHeaderCell({
	align = "start",
	className,
	...props
}: React.ComponentProps<"span"> & { align?: "end" | "start" }) {
	return (
		<span
			className={cn(align === "end" && "text-right", className)}
			data-slot="data-list-header-cell"
			{...props}
		/>
	);
}

function DataListRow({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			className={cn(
				"flex flex-col gap-1.5 border-divider border-b px-4 py-3 text-md last:border-b-0 md:grid md:grid-cols-(--data-list-columns) md:items-center md:gap-x-3.5",
				className
			)}
			data-slot="data-list-row"
			{...props}
		/>
	);
}

function DataListCell({
	align = "start",
	children,
	className,
	label,
	...props
}: React.ComponentProps<"div"> & { align?: "end" | "start"; label: string }) {
	return (
		<div
			className={cn(
				"flex min-w-0 items-baseline justify-between gap-3 md:block",
				align === "end" && "md:text-right",
				className
			)}
			data-slot="data-list-cell"
			{...props}
		>
			<span className="text-muted-foreground text-xs md:sr-only">{label}</span>
			<div className="min-w-0 text-right md:[text-align:inherit]">
				{children}
			</div>
		</div>
	);
}

export {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
};
