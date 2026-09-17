import { BrandMark } from "@costura-pro/ui/components/brand";
import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

function BrandHeader({
	actions,
	className,
	name,
	...props
}: React.ComponentProps<"header"> & {
	actions?: React.ReactNode;
	name?: React.ReactNode;
}) {
	return (
		<header
			className={cn("bg-nav text-nav-foreground", className)}
			data-slot="brand-header"
			{...props}
		>
			<div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-3 px-4 py-2 md:px-6">
				<BrandMark />
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="font-semibold text-sm">Costura Pro</span>
					{name ? (
						<span className="truncate text-nav-active text-xs">{name}</span>
					) : null}
				</div>
				{actions}
			</div>
		</header>
	);
}

export { BrandHeader };
