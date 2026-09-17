export type NavTier = "primary" | "secondary";

export type LinkTarget = { href: string; id: string; label: string };

export type NavItem = LinkTarget & {
	group?: string;
	mobile: boolean;
	tier: NavTier;
};

export type NavGroup = { id: string; label: string };

export type NavSection = { group?: NavGroup; items: NavItem[] };

export type NavViewport = "md" | "xl";

function groupSections(
	items: readonly NavItem[],
	groups: readonly NavGroup[]
): NavSection[] {
	return groups.flatMap((group) => {
		const grouped = items.filter((item) => item.group === group.id);
		return grouped.length > 0 ? [{ group, items: grouped }] : [];
	});
}

function withLooseSection(loose: NavItem[], sections: NavSection[]) {
	return loose.length > 0 ? [{ items: loose }, ...sections] : sections;
}

export function navigationLayout(
	items: readonly NavItem[],
	groups: readonly NavGroup[],
	viewport: NavViewport
) {
	const loose = items.filter((item) => !item.group);
	const sections = groupSections(items, groups);
	if (viewport === "xl") {
		return { inline: loose, menus: sections, overflow: [] as NavSection[] };
	}
	return {
		inline: loose.filter((item) => item.tier === "primary"),
		menus: [] as NavSection[],
		overflow: withLooseSection(
			loose.filter((item) => item.tier !== "primary"),
			sections
		),
	};
}

export function mobileNavigation(
	items: readonly NavItem[],
	groups: readonly NavGroup[]
) {
	return {
		bar: items.filter((item) => item.mobile),
		more: withLooseSection(
			items.filter((item) => !(item.mobile || item.group)),
			groupSections(
				items.filter((item) => !item.mobile),
				groups
			)
		),
	};
}
