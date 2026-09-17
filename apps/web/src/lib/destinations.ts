import type { NavGroup, NavItem } from "@costura-pro/ui/lib/navigation";

export const destinationGroups: readonly NavGroup[] = [
	{ id: "catalogo-estoque", label: "Catálogo e estoque" },
	{ id: "gestao", label: "Gestão" },
];

export const destinations: readonly NavItem[] = [
	{ href: "/", id: "hoje", label: "Hoje", mobile: true, tier: "primary" },
	{
		href: "/agenda",
		id: "agenda",
		label: "Agenda",
		mobile: true,
		tier: "primary",
	},
	{
		href: "/atendimento",
		id: "atendimento",
		label: "Atendimento",
		mobile: false,
		tier: "primary",
	},
	{
		href: "/orcamentos",
		id: "orcamentos",
		label: "Orçamentos",
		mobile: false,
		tier: "primary",
	},
	{ href: "/os", id: "os", label: "OS", mobile: true, tier: "primary" },
	{
		href: "/producao",
		id: "producao",
		label: "Produção",
		mobile: false,
		tier: "secondary",
	},
	{
		href: "/vendas",
		id: "vendas",
		label: "Vendas",
		mobile: true,
		tier: "primary",
	},
	{
		group: "catalogo-estoque",
		href: "/catalogo-produtos",
		id: "catalogo",
		label: "Catálogo",
		mobile: false,
		tier: "secondary",
	},
	{
		group: "catalogo-estoque",
		href: "/estoque",
		id: "estoque",
		label: "Estoque",
		mobile: false,
		tier: "secondary",
	},
	{
		group: "catalogo-estoque",
		href: "/compras",
		id: "compras",
		label: "Compras",
		mobile: false,
		tier: "secondary",
	},
	{
		group: "gestao",
		href: "/financas",
		id: "financas",
		label: "Finanças",
		mobile: false,
		tier: "secondary",
	},
	{
		group: "gestao",
		href: "/relatorios",
		id: "relatorios",
		label: "Relatórios",
		mobile: false,
		tier: "secondary",
	},
	{
		group: "gestao",
		href: "/configuracoes",
		id: "configuracoes",
		label: "Configurações",
		mobile: false,
		tier: "secondary",
	},
];
