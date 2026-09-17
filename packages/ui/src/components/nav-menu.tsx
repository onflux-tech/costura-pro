import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@costura-pro/ui/components/dropdown-menu";
import {
	type LinkRenderer,
	renderAnchor,
} from "@costura-pro/ui/components/nav-link";
import type { NavItem, NavSection } from "@costura-pro/ui/lib/navigation";
import type * as React from "react";
import { Fragment } from "react";

function NavMenuItems({
	activeId,
	items,
	renderLink,
}: {
	activeId?: string;
	items: readonly NavItem[];
	renderLink: LinkRenderer;
}) {
	return items.map((item) => (
		<DropdownMenuItem
			key={item.id}
			render={(itemProps) =>
				renderLink(item, {
					...itemProps,
					"aria-current": item.id === activeId ? "page" : undefined,
					children: item.label,
				})
			}
		/>
	));
}

function NavMenu({
	activeId,
	align = "start",
	renderLink = renderAnchor,
	sections,
	side = "bottom",
	trigger,
	triggerClassName,
}: {
	activeId?: string;
	align?: "center" | "end" | "start";
	renderLink?: LinkRenderer;
	sections: readonly NavSection[];
	side?: "bottom" | "top";
	trigger: React.ReactNode;
	triggerClassName?: string;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger className={triggerClassName}>
				{trigger}
			</DropdownMenuTrigger>
			<DropdownMenuContent align={align} className="w-56" side={side}>
				{sections.map((section, index) => (
					<Fragment key={section.group?.id ?? "solto"}>
						{index > 0 ? <DropdownMenuSeparator /> : null}
						{section.group ? (
							<DropdownMenuGroup>
								<DropdownMenuLabel>{section.group.label}</DropdownMenuLabel>
								<NavMenuItems
									activeId={activeId}
									items={section.items}
									renderLink={renderLink}
								/>
							</DropdownMenuGroup>
						) : (
							<NavMenuItems
								activeId={activeId}
								items={section.items}
								renderLink={renderLink}
							/>
						)}
					</Fragment>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function sectionsContain(sections: readonly NavSection[], activeId?: string) {
	return sections.some((section) =>
		section.items.some((item) => item.id === activeId)
	);
}

export { NavMenu, sectionsContain };
