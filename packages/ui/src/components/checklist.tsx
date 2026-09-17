import { cn } from "@costura-pro/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import type * as React from "react";

const stateLabel = {
	current: "em andamento",
	done: "concluído",
	pending: "pendente",
} as const;

function Checklist({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol
			className={cn("flex flex-col gap-2.5", className)}
			data-slot="checklist"
			{...props}
		/>
	);
}

function ChecklistItem({
	children,
	className,
	state,
	step,
	...props
}: React.ComponentProps<"li"> & {
	state: keyof typeof stateLabel;
	step: number;
}) {
	return (
		<li
			aria-current={state === "current" ? "step" : undefined}
			className={cn(
				"flex items-center gap-2.5 text-md",
				state === "current" && "font-semibold",
				state === "pending" && "text-muted-foreground",
				className
			)}
			data-slot="checklist-item"
			{...props}
		>
			<span
				aria-hidden="true"
				className={cn(
					"flex size-5 shrink-0 items-center justify-center rounded-full font-semibold text-2xs",
					state === "done" && "bg-success text-primary-foreground",
					state === "current" &&
						"border border-warning bg-warning-soft text-warning-foreground",
					state === "pending" && "border border-input text-muted-foreground"
				)}
			>
				{state === "done" ? <CheckIcon className="size-3" /> : String(step)}
			</span>
			<span>{children}</span>
			<span className="sr-only">{stateLabel[state]}</span>
		</li>
	);
}

export { Checklist, ChecklistItem };
