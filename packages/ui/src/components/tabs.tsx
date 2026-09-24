import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@costura-pro/ui/lib/utils";

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
	return (
		<TabsPrimitive.Root
			className={cn("flex flex-col gap-4", className)}
			data-slot="tabs"
			{...props}
		/>
	);
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
	return (
		<TabsPrimitive.List
			className={cn("flex flex-wrap gap-2", className)}
			data-slot="tabs-list"
			{...props}
		/>
	);
}

function TabsTab({
	children,
	className,
	count,
	...props
}: TabsPrimitive.Tab.Props & { count?: number }) {
	return (
		<TabsPrimitive.Tab
			className={cn(
				"inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-card px-3.5 text-md text-subtle-foreground outline-none transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2 data-active:border-primary data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground md:min-h-9",
				className
			)}
			data-slot="tabs-tab"
			{...props}
		>
			{children}
			{count === undefined ? null : (
				<span className="font-mono text-2xs tabular-nums">{count}</span>
			)}
		</TabsPrimitive.Tab>
	);
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
	return (
		<TabsPrimitive.Panel
			className={cn(
				"outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-4",
				className
			)}
			data-slot="tabs-panel"
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsPanel, TabsTab };
