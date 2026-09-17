import { cn } from "@costura-pro/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const alertVariants = cva(
	"group/alert flex flex-col gap-1.5 rounded-xl border p-4",
	{
		defaultVariants: { tone: "warning" },
		variants: {
			tone: {
				danger: "border-danger-border bg-danger-surface",
				success: "border-success-border bg-success-surface",
				warning: "border-warning-border bg-warning-surface",
			},
		},
	}
);

function Alert({
	className,
	tone,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			className={cn(alertVariants({ tone }), className)}
			data-slot="alert"
			data-tone={tone ?? "warning"}
			{...props}
		/>
	);
}

function AlertTitle({
	children,
	className,
	...props
}: React.ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"flex items-center gap-2 font-semibold text-md group-data-[tone=danger]/alert:text-danger-strong group-data-[tone=success]/alert:text-success-foreground group-data-[tone=warning]/alert:text-warning-body",
				className
			)}
			data-slot="alert-title"
			{...props}
		>
			<span
				aria-hidden="true"
				className="size-2 shrink-0 rounded-full group-data-[tone=danger]/alert:bg-danger group-data-[tone=success]/alert:bg-success group-data-[tone=warning]/alert:bg-warning"
			/>
			{children}
		</p>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-md leading-relaxed group-data-[tone=danger]/alert:text-danger-body group-data-[tone=success]/alert:text-success-body group-data-[tone=warning]/alert:text-warning-body",
				className
			)}
			data-slot="alert-description"
			{...props}
		/>
	);
}

function AlertActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("mt-2 flex flex-wrap gap-2", className)}
			data-slot="alert-actions"
			{...props}
		/>
	);
}

export { Alert, AlertActions, AlertDescription, AlertTitle };
