import { Fieldset as FieldsetPrimitive } from "@base-ui/react/fieldset";
import { cn } from "@costura-pro/ui/lib/utils";

function Fieldset({ className, ...props }: FieldsetPrimitive.Root.Props) {
	return (
		<FieldsetPrimitive.Root
			className={cn("flex min-w-0 flex-col gap-2", className)}
			data-slot="fieldset"
			{...props}
		/>
	);
}

function FieldsetLegend({
	className,
	...props
}: FieldsetPrimitive.Legend.Props) {
	return (
		<FieldsetPrimitive.Legend
			className={cn("font-medium text-md text-subtle-foreground", className)}
			data-slot="fieldset-legend"
			{...props}
		/>
	);
}

export { Fieldset, FieldsetLegend };
