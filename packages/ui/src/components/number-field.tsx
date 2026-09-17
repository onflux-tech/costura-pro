import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

const fieldShell =
	"h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-right text-base tabular-nums outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-danger-foreground md:h-10 md:text-md";

function NumberField({
	className,
	suffix,
	...props
}: Omit<React.ComponentProps<"input">, "type"> & { suffix?: string }) {
	return (
		<span
			className="relative flex w-full items-center"
			data-slot="number-field"
		>
			<InputPrimitive
				className={cn(fieldShell, suffix && "pr-14", className)}
				data-slot="number-field-input"
				inputMode="decimal"
				type="text"
				{...props}
			/>
			{suffix ? (
				<span
					className="pointer-events-none absolute right-3 text-md text-muted-foreground"
					data-slot="number-field-suffix"
				>
					{suffix}
				</span>
			) : null}
		</span>
	);
}

export { NumberField };
