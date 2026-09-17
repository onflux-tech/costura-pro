import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import { CheckIcon } from "lucide-react";
import type * as React from "react";

function Checkbox({
	children,
	className,
	...props
}: CheckboxPrimitive.Root.Props & {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<FieldPrimitive.Root className={className} data-slot="checkbox">
			<FieldPrimitive.Label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-md has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50">
				<CheckboxPrimitive.Root
					className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-input bg-card outline-none transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 data-checked:border-primary data-checked:bg-primary"
					data-slot="checkbox-control"
					{...props}
				>
					<CheckboxPrimitive.Indicator className="flex text-primary-foreground data-unchecked:hidden">
						<CheckIcon aria-hidden="true" className="size-3.5" />
					</CheckboxPrimitive.Indicator>
				</CheckboxPrimitive.Root>
				{children}
			</FieldPrimitive.Label>
		</FieldPrimitive.Root>
	);
}

export { Checkbox };
