import { cn } from "@costura-pro/ui/lib/utils";
import { ArrowLeftIcon } from "lucide-react";
import type * as React from "react";

function MobileHeader({
	actions,
	back,
	className,
	eyebrow,
	heading,
	headingAs = "p",
	status,
	...props
}: React.ComponentProps<"header"> & {
	actions?: React.ReactNode;
	back?: React.ReactNode;
	eyebrow?: React.ReactNode;
	heading: React.ReactNode;
	headingAs?: "h1" | "p";
	status?: React.ReactNode;
}) {
	const Heading = headingAs;
	return (
		<header
			className={cn(
				"bg-nav px-4 pt-3 pb-4 text-nav-foreground md:hidden",
				className
			)}
			data-slot="mobile-header"
			{...props}
		>
			{status ? (
				<div className="mb-2 flex justify-end font-mono text-2xs text-nav-muted">
					{status}
				</div>
			) : null}
			<div className="flex items-center gap-2">
				{back}
				<div className="min-w-0 flex-1">
					{eyebrow ? (
						<p className="text-nav-active text-xs">{eyebrow}</p>
					) : null}
					<Heading className="truncate font-semibold text-base">
						{heading}
					</Heading>
				</div>
				{actions}
			</div>
		</header>
	);
}

function MobileHeaderBack({
	className,
	...props
}: React.ComponentProps<"button">) {
	return (
		<button
			aria-label="Voltar"
			className={cn(
				"-ml-2 flex size-11 shrink-0 items-center justify-center rounded-md text-nav-muted outline-none focus-visible:outline-2 focus-visible:outline-nav-active focus-visible:outline-solid",
				className
			)}
			data-slot="mobile-header-back"
			type="button"
			{...props}
		>
			<ArrowLeftIcon aria-hidden="true" className="size-5" />
		</button>
	);
}

export { MobileHeader, MobileHeaderBack };
