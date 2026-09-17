import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { cn } from "@costura-pro/ui/lib/utils";

function ChoiceChips({ className, ...props }: RadioGroup.Props) {
	return (
		<RadioGroup
			className={cn("flex flex-wrap gap-2", className)}
			data-slot="choice-chips"
			{...props}
		/>
	);
}

function ChoiceChip({ className, ...props }: Radio.Root.Props) {
	return (
		<Radio.Root
			className={cn(
				"inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-border-strong bg-card px-3 text-md text-subtle-foreground outline-none transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 data-checked:border-primary data-checked:bg-primary data-checked:font-semibold data-checked:text-primary-foreground data-disabled:opacity-50 md:min-h-9 md:flex-none",
				className
			)}
			data-slot="choice-chip"
			{...props}
		/>
	);
}

export { ChoiceChip, ChoiceChips };
