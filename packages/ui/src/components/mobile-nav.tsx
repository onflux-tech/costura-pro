import {
	type LinkRenderer,
	renderAnchor,
} from "@costura-pro/ui/components/nav-link";
import { NavMenu, sectionsContain } from "@costura-pro/ui/components/nav-menu";
import {
	mobileNavigation,
	type NavGroup,
	type NavItem,
} from "@costura-pro/ui/lib/navigation";
import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";

function tabClass(active: boolean) {
	return cn(
		"flex min-h-14 w-full flex-col items-center justify-center gap-1.5 rounded-md px-1 text-2xs outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid",
		active ? "font-semibold text-primary" : "font-medium text-muted-foreground"
	);
}

function TabContent({ active, label }: { active: boolean; label: string }) {
	return (
		<>
			<span
				aria-hidden="true"
				className={cn(
					"h-1 w-6 rounded-full",
					active ? "bg-primary" : "bg-border"
				)}
			/>
			<span className="truncate">{label}</span>
		</>
	);
}

function MobileNav({
	activeId,
	className,
	groups = [],
	items,
	renderLink = renderAnchor,
	...props
}: React.ComponentProps<"nav"> & {
	activeId?: string;
	groups?: readonly NavGroup[];
	items: readonly NavItem[];
	renderLink?: LinkRenderer;
}) {
	const { bar, more } = mobileNavigation(items, groups);
	const moreActive = sectionsContain(more, activeId);
	return (
		<nav
			aria-label="Principal"
			className={cn(
				"sticky bottom-0 border-t bg-card px-1 pb-[env(safe-area-inset-bottom)] md:hidden",
				className
			)}
			data-slot="mobile-nav"
			{...props}
		>
			<ul className="flex">
				{bar.map((item) => (
					<li className="min-w-0 flex-1" key={item.id}>
						{renderLink(item, {
							"aria-current": item.id === activeId ? "page" : undefined,
							children: (
								<TabContent active={item.id === activeId} label={item.label} />
							),
							className: tabClass(item.id === activeId),
						})}
					</li>
				))}
				{more.length > 0 ? (
					<li className="min-w-0 flex-1">
						<NavMenu
							activeId={activeId}
							align="end"
							renderLink={renderLink}
							sections={more}
							side="top"
							trigger={<TabContent active={moreActive} label="Mais" />}
							triggerClassName={tabClass(moreActive)}
						/>
					</li>
				) : null}
			</ul>
		</nav>
	);
}

export { MobileNav };
