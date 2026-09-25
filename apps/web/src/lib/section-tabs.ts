import type { LinkTarget } from "@costura-pro/ui/lib/navigation";

import { activeDestination } from "./active-destination";

export const sectionTabs = {
	atendimento: [
		{ href: "/atendimento/clientes", id: "clientes", label: "Clientes" },
	],
	catalogo: [
		{
			href: "/catalogo-produtos/produtos",
			id: "produtos",
			label: "Produtos",
		},
		{
			href: "/catalogo-produtos/materiais",
			id: "materiais",
			label: "Materiais",
		},
		{
			href: "/catalogo-produtos/servicos",
			id: "servicos",
			label: "Serviços",
		},
		{
			href: "/catalogo-produtos/modelos-de-medidas",
			id: "modelos-de-medidas",
			label: "Modelos de medidas",
		},
	],
	compras: [
		{ href: "/compras/recebidas", id: "recebidas", label: "Compras" },
		{
			href: "/compras/fornecedores",
			id: "fornecedores",
			label: "Fornecedores",
		},
	],
	estoque: [
		{ href: "/estoque/saldos", id: "saldos", label: "Saldos" },
		{ href: "/estoque/inventario", id: "inventario", label: "Inventário" },
		{ href: "/estoque/locais", id: "locais", label: "Locais" },
	],
	financas: [
		{ href: "/financas/contas", id: "contas", label: "Contas" },
		{ href: "/financas/a-pagar", id: "a-pagar", label: "A pagar" },
	],
	orcamentos: [
		{ href: "/orcamentos/rascunhos", id: "rascunhos", label: "Rascunhos" },
		{ href: "/orcamentos/emitidos", id: "emitidos", label: "Emitidos" },
		{ href: "/orcamentos/aprovados", id: "aprovados", label: "Aprovados" },
		{ href: "/orcamentos/vencidos", id: "vencidos", label: "Vencidos" },
		{ href: "/orcamentos/recusados", id: "recusados", label: "Recusados" },
	],
	producao: [
		{ href: "/producao/quadro", id: "quadro", label: "Quadro" },
		{ href: "/producao/fluxo", id: "fluxo", label: "Fluxo de produção" },
	],
} as const satisfies Record<string, readonly LinkTarget[]>;

export type SectionHref =
	(typeof sectionTabs)[keyof typeof sectionTabs][number]["href"];

const noTabs: readonly LinkTarget[] = [];

export function sectionTabsFor(
	destinationId: string | undefined,
	pathname: string
): { activeId: string | undefined; items: readonly LinkTarget[] } {
	const items =
		destinationId && Object.hasOwn(sectionTabs, destinationId)
			? sectionTabs[destinationId as keyof typeof sectionTabs]
			: noTabs;
	return { activeId: activeDestination(pathname, items)?.id, items };
}
