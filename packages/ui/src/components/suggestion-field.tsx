import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { cn } from "@costura-pro/ui/lib/utils";

type SuggestionFieldProps = {
	className?: string;
	disabled?: boolean;
	emptyLabel?: string;
	id?: string;
	items: readonly string[];
	maxLength?: number;
	name?: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	value: string;
};

function SuggestionField({
	className,
	disabled,
	emptyLabel = "Nenhuma sugestão",
	id,
	items,
	maxLength,
	name,
	onValueChange,
	placeholder,
	value,
}: SuggestionFieldProps) {
	return (
		<AutocompletePrimitive.Root
			items={items as string[]}
			onValueChange={(next) => onValueChange(next)}
			value={value}
		>
			<AutocompletePrimitive.Input
				className={cn(
					"h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-danger-foreground md:h-10 md:text-md",
					className
				)}
				data-slot="suggestion-field-input"
				disabled={disabled}
				id={id}
				maxLength={maxLength}
				name={name}
				placeholder={placeholder}
			/>
			<AutocompletePrimitive.Portal>
				<AutocompletePrimitive.Positioner
					align="start"
					className="isolate z-50"
					sideOffset={4}
				>
					<AutocompletePrimitive.Popup
						className="max-h-(--available-height) w-(--anchor-width) min-w-32 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
						data-slot="suggestion-field-popup"
					>
						<AutocompletePrimitive.Empty className="px-2 py-2 text-md text-muted-foreground">
							{emptyLabel}
						</AutocompletePrimitive.Empty>
						<AutocompletePrimitive.List>
							{(item: string) => (
								<AutocompletePrimitive.Item
									className="flex min-h-11 cursor-default select-none items-center rounded-md px-2 py-2 text-md outline-hidden focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:-outline-offset-2 data-highlighted:bg-accent data-highlighted:text-accent-foreground md:min-h-9"
									key={item}
									value={item}
								>
									{item}
								</AutocompletePrimitive.Item>
							)}
						</AutocompletePrimitive.List>
					</AutocompletePrimitive.Popup>
				</AutocompletePrimitive.Positioner>
			</AutocompletePrimitive.Portal>
		</AutocompletePrimitive.Root>
	);
}

export { SuggestionField };
