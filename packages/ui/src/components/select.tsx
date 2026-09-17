import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "@costura-pro/ui/lib/utils";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

type SelectOption = { label: string; value: string };

type SelectProps = {
	className?: string;
	disabled?: boolean;
	id?: string;
	items: readonly SelectOption[];
	name?: string;
	onValueChange?: (value: string) => void;
	value?: string;
};

function Select({
	className,
	disabled,
	id,
	items,
	name,
	onValueChange,
	value,
}: SelectProps) {
	return (
		<SelectPrimitive.Root
			disabled={disabled}
			items={items as SelectOption[]}
			name={name}
			onValueChange={(next) => onValueChange?.(String(next))}
			value={value}
		>
			<SelectPrimitive.Trigger
				className={cn(
					"flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-base text-foreground outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-danger-foreground md:h-10 md:text-md",
					className
				)}
				data-slot="select-trigger"
				id={id}
			>
				<SelectPrimitive.Value className="truncate" />
				<SelectPrimitive.Icon
					className="shrink-0 text-muted-foreground"
					data-slot="select-icon"
				>
					<ChevronsUpDownIcon className="size-4" />
				</SelectPrimitive.Icon>
			</SelectPrimitive.Trigger>
			<SelectPrimitive.Portal>
				<SelectPrimitive.Positioner
					align="start"
					className="isolate z-50"
					sideOffset={4}
				>
					<SelectPrimitive.Popup
						className="max-h-(--available-height) w-(--anchor-width) min-w-32 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
						data-slot="select-popup"
					>
						<SelectPrimitive.List>
							{items.map((item) => (
								<SelectPrimitive.Item
									className="flex min-h-11 cursor-default select-none items-center gap-2 rounded-md px-2 py-2 text-md outline-hidden focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:-outline-offset-2 data-highlighted:bg-accent data-highlighted:text-accent-foreground md:min-h-9"
									key={item.value}
									value={item.value}
								>
									<SelectPrimitive.ItemText>
										{item.label}
									</SelectPrimitive.ItemText>
									<SelectPrimitive.ItemIndicator className="ml-auto">
										<CheckIcon className="size-4" />
									</SelectPrimitive.ItemIndicator>
								</SelectPrimitive.Item>
							))}
						</SelectPrimitive.List>
					</SelectPrimitive.Popup>
				</SelectPrimitive.Positioner>
			</SelectPrimitive.Portal>
		</SelectPrimitive.Root>
	);
}

export { Select, type SelectOption };
