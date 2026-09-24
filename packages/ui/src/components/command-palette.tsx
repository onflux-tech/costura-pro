import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { dialogBackdropClass } from "@costura-pro/ui/components/dialog";
import { cn } from "@costura-pro/ui/lib/utils";
import { SearchIcon } from "lucide-react";
import type * as React from "react";

function CommandPalette({
	children,
	label,
	onOpenChange,
	open,
}: {
	children: React.ReactNode;
	label: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Backdrop
					className={dialogBackdropClass}
					data-slot="command-palette-backdrop"
				/>
				<DialogPrimitive.Viewport
					className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 pb-4 md:pt-24"
					data-slot="command-palette-viewport"
				>
					<DialogPrimitive.Popup
						aria-label={label}
						className="flex max-h-[min(38rem,calc(100dvh-5rem))] w-full max-w-xl flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg outline-none transition-[scale,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid data-ending-style:scale-[0.98] data-starting-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:opacity-0"
						data-slot="command-palette"
					>
						{children}
					</DialogPrimitive.Popup>
				</DialogPrimitive.Viewport>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

function CommandPaletteSearch<Group extends { items: readonly unknown[] }>({
	children,
	items,
	itemToStringValue,
	onValueChange,
	value,
}: {
	children: React.ReactNode;
	items: readonly Group[];
	itemToStringValue?: (item: Group["items"][number]) => string;
	onValueChange: (value: string) => void;
	value: string;
}) {
	return (
		<AutocompletePrimitive.Root
			autoHighlight="always"
			filter={null}
			inline
			items={items}
			itemToStringValue={itemToStringValue}
			keepHighlight
			onValueChange={(next) => onValueChange(next)}
			open
			value={value}
		>
			{children}
		</AutocompletePrimitive.Root>
	);
}

function CommandPaletteInput({
	className,
	closeLabel = "Fechar busca",
	...props
}: React.ComponentProps<typeof AutocompletePrimitive.Input> & {
	closeLabel?: string;
}) {
	return (
		<div
			className="flex items-center gap-3 border-divider border-b px-4 has-[input:focus-visible]:shadow-[inset_0_-2px_0_var(--color-ring)] [&_input]:outline-none"
			data-slot="command-palette-input-row"
		>
			<SearchIcon
				aria-hidden="true"
				className="size-4 shrink-0 text-muted-foreground"
			/>
			<AutocompletePrimitive.Input
				className={cn(
					"h-14 min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground",
					className
				)}
				data-slot="command-palette-input"
				{...props}
			/>
			<DialogPrimitive.Close
				aria-label={closeLabel}
				className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-card px-1.5 font-mono text-2xs text-subtle-foreground outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 md:h-7 md:min-w-9"
				data-slot="command-palette-close"
			>
				Esc
			</DialogPrimitive.Close>
		</div>
	);
}

function CommandPaletteList({
	className,
	...props
}: React.ComponentProps<typeof AutocompletePrimitive.List>) {
	return (
		<div
			className="min-h-0 flex-1 scroll-py-2 overflow-y-auto overscroll-contain p-2"
			data-slot="command-palette-scroll"
		>
			<AutocompletePrimitive.List
				className={cn(
					"outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid",
					className
				)}
				data-slot="command-palette-list"
				{...props}
			/>
		</div>
	);
}

function CommandPaletteGroup({
	className,
	...props
}: React.ComponentProps<typeof AutocompletePrimitive.Group>) {
	return (
		<AutocompletePrimitive.Group
			className={cn("not-last:mb-2", className)}
			data-slot="command-palette-group"
			{...props}
		/>
	);
}

function CommandPaletteGroupLabel({
	className,
	...props
}: React.ComponentProps<typeof AutocompletePrimitive.GroupLabel>) {
	return (
		<AutocompletePrimitive.GroupLabel
			className={cn(
				"px-3 pt-2 pb-1 font-semibold text-2xs text-muted-foreground uppercase tracking-wide",
				className
			)}
			data-slot="command-palette-group-label"
			{...props}
		/>
	);
}

const CommandPaletteCollection = AutocompletePrimitive.Collection;

function CommandPaletteItem({
	className,
	...props
}: React.ComponentProps<typeof AutocompletePrimitive.Item>) {
	return (
		<AutocompletePrimitive.Item
			className={cn(
				"relative flex min-h-11 cursor-default select-none flex-col justify-center gap-0.5 rounded-lg px-3 py-2 text-md outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid data-highlighted:bg-accent data-highlighted:before:absolute data-highlighted:before:inset-y-2 data-highlighted:before:left-0 data-highlighted:before:w-1 data-highlighted:before:rounded-full data-highlighted:before:bg-primary data-highlighted:[&_mark]:bg-nav-active",
				className
			)}
			data-slot="command-palette-item"
			{...props}
		/>
	);
}

function CommandPaletteEmpty({
	className,
	...props
}: React.ComponentProps<typeof AutocompletePrimitive.Empty>) {
	return (
		<AutocompletePrimitive.Empty
			className={cn(
				"px-4 py-6 text-md text-subtle-foreground empty:py-0",
				className
			)}
			data-slot="command-palette-empty"
			{...props}
		/>
	);
}

function CommandPaletteStatus({
	className,
	...props
}: React.ComponentProps<typeof AutocompletePrimitive.Status>) {
	return (
		<AutocompletePrimitive.Status
			className={cn("sr-only", className)}
			data-slot="command-palette-status"
			{...props}
		/>
	);
}

function CommandPaletteFooter({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"hidden flex-wrap items-center gap-x-4 gap-y-1 border-divider border-t bg-muted px-4 py-2.5 text-muted-foreground text-xs md:flex",
				className
			)}
			data-slot="command-palette-footer"
			{...props}
		/>
	);
}

function CommandPaletteKey({
	className,
	...props
}: React.ComponentProps<"kbd">) {
	return (
		<kbd
			className={cn(
				"inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border-strong bg-card px-1 font-mono text-2xs text-subtle-foreground",
				className
			)}
			data-slot="command-palette-key"
			{...props}
		/>
	);
}

export {
	CommandPalette,
	CommandPaletteCollection,
	CommandPaletteEmpty,
	CommandPaletteFooter,
	CommandPaletteGroup,
	CommandPaletteGroupLabel,
	CommandPaletteInput,
	CommandPaletteItem,
	CommandPaletteKey,
	CommandPaletteList,
	CommandPaletteSearch,
	CommandPaletteStatus,
};
