import {
	type LinkRenderer,
	renderAnchor,
} from "@costura-pro/ui/components/nav-link";
import type { LinkTarget } from "@costura-pro/ui/lib/navigation";
import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

function SubTabs({
	activeId,
	className,
	items,
	label,
	renderLink = renderAnchor,
	status,
	...props
}: React.ComponentProps<"div"> & {
	activeId?: string;
	items: readonly LinkTarget[];
	label: string;
	renderLink?: LinkRenderer;
	status?: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex min-h-12 items-center gap-4 border-b bg-card px-4 xl:px-5",
				className
			)}
			data-slot="sub-tabs"
			{...props}
		>
			{items.length > 0 ? (
				<nav
					aria-label={label}
					className="no-scrollbar min-w-0 flex-1 overflow-x-auto contain-inline-size"
				>
					<ul className="flex items-center gap-5">
						{items.map((item) => {
							const active = item.id === activeId;
							return (
								<li key={item.id}>
									{renderLink(item, {
										"aria-current": active ? "page" : undefined,
										children: item.label,
										className: cn(
											"-mb-px flex h-12 items-center whitespace-nowrap border-b-2 text-md outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2",
											active
												? "border-primary font-semibold text-primary"
												: "border-transparent font-medium text-muted-foreground hover:text-foreground"
										),
									})}
								</li>
							);
						})}
					</ul>
				</nav>
			) : (
				<div className="flex-1" />
			)}
			{status ? <div className="hidden shrink-0 md:block">{status}</div> : null}
		</div>
	);
}

export { SubTabs };
