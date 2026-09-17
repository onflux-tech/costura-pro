import { cn } from "@costura-pro/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const headingVariants = cva("text-foreground", {
	defaultVariants: { size: "page" },
	variants: {
		size: {
			page: "font-semibold font-serif text-2xl leading-tight",
			section: "font-semibold font-serif text-xl leading-tight",
			title: "font-semibold text-sm",
		},
	},
});

const headingTags = { 1: "h1", 2: "h2", 3: "h3", 4: "h4" } as const;

function Heading({
	className,
	level = 1,
	size,
	...props
}: React.ComponentProps<"h1"> &
	VariantProps<typeof headingVariants> & { level?: keyof typeof headingTags }) {
	const Tag = headingTags[level];
	return (
		<Tag
			className={cn(headingVariants({ size }), className)}
			data-slot="heading"
			{...props}
		/>
	);
}

const textVariants = cva("", {
	defaultVariants: { size: "md", tone: "default", weight: "normal" },
	variants: {
		numeric: { true: "tabular-nums" },
		size: {
			lg: "text-lg",
			md: "text-md",
			sm: "text-sm",
			xl: "text-xl",
			xs: "text-xs",
		},
		tone: {
			danger: "text-danger-foreground",
			default: "text-foreground",
			muted: "text-muted-foreground",
			subtle: "text-subtle-foreground",
			success: "text-success-foreground",
			warning: "text-warning-foreground",
		},
		weight: {
			medium: "font-medium",
			normal: "font-normal",
			semibold: "font-semibold",
		},
	},
});

type TextProps = VariantProps<typeof textVariants> & {
	className?: string;
	inline?: boolean;
};

function Text({
	className,
	inline = false,
	numeric,
	size,
	tone,
	weight,
	...props
}: TextProps &
	Omit<React.ComponentProps<"p">, keyof TextProps> &
	Omit<React.ComponentProps<"span">, keyof TextProps>) {
	const Tag = inline ? "span" : "p";
	return (
		<Tag
			className={cn(textVariants({ numeric, size, tone, weight }), className)}
			data-slot="text"
			{...props}
		/>
	);
}

function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"font-mono text-2xs text-muted-foreground uppercase tracking-widest",
				className
			)}
			data-slot="eyebrow"
			{...props}
		/>
	);
}

function Mono({
	className,
	size = "xs",
	tone = "default",
	...props
}: React.ComponentProps<"span"> & {
	size?: "2xs" | "xs";
	tone?: "default" | "muted";
}) {
	return (
		<span
			className={cn(
				"font-mono",
				size === "xs" ? "text-xs" : "text-2xs",
				tone === "muted" && "text-muted-foreground",
				className
			)}
			data-slot="mono"
			{...props}
		/>
	);
}

export { Eyebrow, Heading, headingVariants, Mono, Text, textVariants };
