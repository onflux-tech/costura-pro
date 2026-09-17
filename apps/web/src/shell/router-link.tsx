import type { LinkRenderer } from "@costura-pro/ui/components/nav-link";
import { Link } from "@tanstack/react-router";

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
