import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Link } from "@tanstack/react-router";

import UserMenu from "./user-menu";

const links = [
	{ label: "Início", to: "/" },
	{ label: "Painel", to: "/dashboard" },
] as const;

export default function Header() {
	return (
		<header className="flex min-h-14 items-center justify-between gap-3 border-b bg-card px-4">
			<nav aria-label="Acesso rápido" className="flex gap-1">
				{links.map(({ label, to }) => (
					<ButtonLink key={to} render={<Link to={to} />} variant="nav">
						{label}
					</ButtonLink>
				))}
			</nav>
			<UserMenu />
		</header>
	);
}
