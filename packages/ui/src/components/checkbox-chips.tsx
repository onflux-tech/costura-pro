import { Checkbox } from "@base-ui/react/checkbox";
import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import { cn } from "@costura-pro/ui/lib/utils";

function CheckboxChips({ className, ...props }: CheckboxGroup.Props) {
	return (
		<CheckboxGroup
			className={cn("flex flex-wrap gap-2", className)}
			data-slot="checkbox-chips"
			{...props}
		/>
	);
}

function CheckboxChip({ className, ...props }: Checkbox.Root.Props) {
	return (
		<Checkbox.Root
			className={cn(
				"inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-border-strong bg-card px-3 text-md text-subtle-foreground outline-none transition-colors not-data-checked:hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 data-checked:border-primary data-checked:bg-primary data-checked:font-semibold data-checked:text-primary-foreground data-disabled:opacity-50 md:min-h-9 md:flex-none",
				className
			)}
			data-slot="checkbox-chip"
			{...props}
		/>
	);
}

export { CheckboxChip, CheckboxChips };
