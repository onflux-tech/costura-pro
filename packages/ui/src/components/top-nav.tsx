import { BrandMark } from "@costura-pro/ui/components/brand";
import {
	type LinkRenderer,
	renderAnchor,
} from "@costura-pro/ui/components/nav-link";
import { NavMenu, sectionsContain } from "@costura-pro/ui/components/nav-menu";
import {
	type NavGroup,
	type NavItem,
	navigationLayout,
} from "@costura-pro/ui/lib/navigation";
import { cn } from "@costura-pro/ui/lib/utils";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import type * as React from "react";

const focusOnNav =
	"outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-nav-active focus-visible:outline-offset-2";

function navLinkClass(active: boolean) {
	return cn(
		"flex h-9 items-center whitespace-nowrap rounded-md px-2.5 text-md transition-colors",
		focusOnNav,
		active
			? "bg-nav-active font-semibold text-nav-active-foreground"
			: "font-medium text-nav-muted hover:text-nav-foreground"
	);
}

function TopNavBrand() {
	return (
		<span className="flex shrink-0 items-center gap-2">
			<BrandMark />
			<span className="hidden font-semibold text-sm xl:inline">
				Costura Pro
			</span>
		</span>
	);
}

function TopNav({
	account,
	activeId,
	brand = <TopNavBrand />,
	className,
	groups = [],
	items,
	renderLink = renderAnchor,
	search,
	...props
}: React.ComponentProps<"header"> & {
	account?: React.ReactNode;
	activeId?: string;
	brand?: React.ReactNode;
	groups?: readonly NavGroup[];
	items: readonly NavItem[];
	renderLink?: LinkRenderer;
	search?: React.ReactNode;
}) {
	const wide = navigationLayout(items, groups, "xl");
	const narrow = navigationLayout(items, groups, "md");
	const alwaysInline = new Set(narrow.inline.map((item) => item.id));
	return (
		<header
			className={cn("hidden bg-nav text-nav-foreground md:block", className)}
			data-slot="top-nav"
			{...props}
		>
			<div className="flex h-14 items-center gap-3 px-4 xl:px-5">
				{brand}
				<nav aria-label="Principal" className="min-w-0 flex-1">
					<ul className="flex items-center gap-px">
						{wide.inline.map((item) => (
							<li
								className={
									alwaysInline.has(item.id) ? "flex" : "hidden xl:flex"
								}
								key={item.id}
							>
								{renderLink(item, {
									"aria-current": item.id === activeId ? "page" : undefined,
									children: item.label,
									className: navLinkClass(item.id === activeId),
								})}
							</li>
						))}
						{wide.menus.map((section) => (
							<li className="hidden xl:flex" key={section.group?.id}>
								<NavMenu
									activeId={activeId}
									renderLink={renderLink}
									sections={[{ items: section.items }]}
									trigger={
										<>
											{section.group?.label}
											<ChevronDownIcon aria-hidden="true" className="size-4" />
										</>
									}
									triggerClassName={cn(
										navLinkClass(sectionsContain([section], activeId)),
										"gap-1"
									)}
								/>
							</li>
						))}
						{narrow.overflow.length > 0 ? (
							<li className="flex xl:hidden">
								<NavMenu
									activeId={activeId}
									align="end"
									renderLink={renderLink}
									sections={narrow.overflow}
									trigger={
										<>
											Mais
											<ChevronDownIcon aria-hidden="true" className="size-4" />
										</>
									}
									triggerClassName={cn(
										navLinkClass(sectionsContain(narrow.overflow, activeId)),
										"gap-1"
									)}
								/>
							</li>
						) : null}
					</ul>
				</nav>
				{search}
				{account}
			</div>
		</header>
	);
}

function TopNavSearch({
	className,
	placeholder = "Buscar cliente, OS, material",
	...props
}: React.ComponentProps<"button"> & { placeholder?: string }) {
	return (
		<button
			aria-label={placeholder}
			className={cn(
				"flex h-9 shrink-0 items-center gap-2 rounded-md border border-nav-foreground/15 bg-nav-foreground/10 px-2.5 text-nav-muted text-xs xl:w-48",
				focusOnNav,
				className
			)}
			data-slot="top-nav-search"
			type="button"
			{...props}
		>
			<SearchIcon aria-hidden="true" className="size-4 shrink-0" />
			<span className="hidden truncate xl:inline">{placeholder}</span>
		</button>
	);
}

function TopNavAvatar({
	className,
	initials,
	...props
}: React.ComponentProps<"button"> & { initials: string }) {
	return (
		<button
			className={cn(
				"flex size-8 shrink-0 items-center justify-center rounded-full border border-nav-foreground/20 bg-secondary font-semibold text-nav-active text-xs",
				focusOnNav,
				className
			)}
			data-slot="top-nav-avatar"
			type="button"
			{...props}
		>
			{initials}
		</button>
	);
}

export { TopNav, TopNavAvatar, TopNavSearch };
