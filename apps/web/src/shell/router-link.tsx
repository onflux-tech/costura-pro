import type { LinkRenderer } from "@costura-pro/ui/components/nav-link";
import { Link } from "@tanstack/react-router";

import type { SectionHref } from "@/lib/section-tabs";

export const renderRouterLink: LinkRenderer = (target, props) =>
	target.href === "/" ? (
		<Link {...props} to="/" />
	) : (
		<Link
			{...props}
			params={{ destino: target.href.slice(1) }}
			to="/$destino"
		/>
	);

export const renderSectionLink: LinkRenderer = (target, props) => (
	<Link {...props} to={target.href as SectionHref} />
);
