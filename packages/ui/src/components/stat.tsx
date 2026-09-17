import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

const toneText = {
	danger: "text-danger-foreground",
	success: "text-success-foreground",
	warning: "text-warning-foreground",
} as const;

function Stat({
	className,
	hint,
	label,
	tone,
	value,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	hint?: React.ReactNode;
	label: string;
	tone?: keyof typeof toneText;
	value: React.ReactNode;
}) {
	return (
		<div
			className={cn("flex flex-col gap-0.5", className)}
			data-slot="stat"
			{...props}
		>
			<p className="text-muted-foreground text-xs">{label}</p>
			<p
				className={cn(
					"font-semibold text-xl tabular-nums",
					tone && toneText[tone]
				)}
			>
				{value}
			</p>
			{hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
		</div>
	);
}

export { Stat };
