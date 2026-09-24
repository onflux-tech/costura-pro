import { formatPhone } from "@costura-pro/domain/client";
import { quoteStatus } from "@costura-pro/domain/quote";
import { searchLimits } from "@costura-pro/domain/search";
import type { BaseUnitCode } from "@costura-pro/domain/unit";

import { moneyLabel } from "./finance";
import { statusLabels } from "./quotes";
import { balanceQuantity } from "./stock";

type Group<T> = { items: T[]; total: number };

export type ClientHitView = {
	archived: boolean;
	email: string | null;
	id: string;
	kind: "organization" | "person";
	name: string;
	phone: string | null;
	secondaryPhone: string | null;
};

export type ProfileHitView = {
	archived: boolean;
	clientId: string;
	clientName: string;
	id: string;
	name: string;
};

export type ProductVariantHitView = {
	archived: boolean;
	code: string | null;
	id: string;
	name: string;
	priceCents: string;
};

export type MaterialVariantHitView = {
	archived: boolean;
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	id: string;
	name: string;
	quantityMicros: string;
};

export type ParentHitView<V> = {
	archived: boolean;
	category: string | null;
	id: string;
	matchedCount: number;
	name: string;
	variantCount: number;
	variants: V[];
};

export type QuoteHitView = {
	archived: boolean;
	clientName: string;
	code: string;
	id: string;
	refused: boolean;
	revisionNumber: number | null;
	totalCents: string;
	validUntil: string | null;
};

export type ServiceHitView = {
	archived: boolean;
	category: string | null;
	id: string;
	name: string;
	outsourced: boolean;
	priceCents: string;
};

export type SearchView = {
	clients: Group<ClientHitView>;
	materials: Group<ParentHitView<MaterialVariantHitView>>;
	products: Group<ParentHitView<ProductVariantHitView>>;
	profiles: Group<ProfileHitView>;
	quotes: Group<QuoteHitView>;
	services: Group<ServiceHitView>;
};

export type GroupPageView = {
	[G in SearchGroupKey]: { group: G; items: SearchView[G]["items"] };
}[SearchGroupKey];

export type ShortcutEvent = Pick<
	KeyboardEvent,
	"altKey" | "ctrlKey" | "isComposing" | "key" | "metaKey" | "shiftKey"
>;

export const searchGroupOrder = [
	"clients",
	"profiles",
	"quotes",
	"products",
	"materials",
	"services",
] as const;

export type SearchGroupKey = (typeof searchGroupOrder)[number];

export const groupParamValues = [
	"clientes",
	"perfis",
	"orcamentos",
	"produtos",
	"materiais",
	"servicos",
] as const;

export type GroupParam = (typeof groupParamValues)[number];

export const groupParams: Record<SearchGroupKey, GroupParam> = {
	clients: "clientes",
	materials: "materiais",
	products: "produtos",
	profiles: "perfis",
	quotes: "orcamentos",
	services: "servicos",
};

const groupNames: Record<
	SearchGroupKey,
	{ label: string; many: string; one: string }
> = {
	clients: { label: "Clientes", many: "clientes", one: "cliente" },
	materials: { label: "Materiais", many: "materiais", one: "material" },
	products: { label: "Produtos", many: "produtos", one: "produto" },
	profiles: { label: "Perfis", many: "perfis", one: "perfil" },
	quotes: { label: "Orçamentos", many: "orçamentos", one: "orçamento" },
	services: { label: "Serviços", many: "serviços", one: "serviço" },
};

export type PaletteOption =
	| { hit: ClientHitView; id: string; kind: "clients"; label: string }
	| { hit: ProfileHitView; id: string; kind: "profiles"; label: string }
	| {
			hit: ParentHitView<ProductVariantHitView>;
			id: string;
			kind: "products";
			label: string;
	  }
	| {
			hit: ParentHitView<MaterialVariantHitView>;
			id: string;
			kind: "materials";
			label: string;
	  }
	| { hit: QuoteHitView; id: string; kind: "quotes"; label: string }
	| { hit: ServiceHitView; id: string; kind: "services"; label: string }
	| { id: "all"; kind: "all"; label: string }
	| { id: "archived"; kind: "archived"; label: string };

export type PaletteGroup = {
	id: SearchGroupKey | "more";
	items: PaletteOption[];
	label: string | null;
};

export type SearchTab = {
	count: number;
	group: SearchGroupKey | null;
	id: "tudo" | GroupParam;
	label: string;
};

export function isSearchShortcut(event: ShortcutEvent): boolean {
	return (
		(event.ctrlKey || event.metaKey) &&
		!(event.altKey || event.shiftKey || event.isComposing) &&
		event.key.toLowerCase() === "k"
	);
}

export function searchReady(text: string): boolean {
	return text.trim().length >= searchLimits.query.min;
}

export function clientDetail(
	hit: Pick<ClientHitView, "email" | "phone" | "secondaryPhone">
): string {
	const phone = hit.phone ?? hit.secondaryPhone;
	if (phone) {
		return formatPhone(phone);
	}
	return hit.email ?? "Sem contato";
}

export function profileDetail(hit: Pick<ProfileHitView, "clientName">): string {
	return `Perfil de ${hit.clientName}`;
}

function variantsLabel(count: number): string {
	if (count === 0) {
		return "Sem variantes";
	}
	return count === 1 ? "1 variante" : `${count} variantes`;
}

export function parentDetail(
	category: string | null,
	variantCount: number
): string {
	return `${category ?? "Sem categoria"} · ${variantsLabel(variantCount)}`;
}

function labelOf(parts: readonly (string | null)[], archived: boolean): string {
	return [...parts, archived ? "arquivada" : null]
		.filter((part): part is string => part !== null)
		.join(" · ");
}

export function productVariantLabel(variant: ProductVariantHitView): string {
	return labelOf(
		[variant.name, variant.code, moneyLabel(variant.priceCents)],
		variant.archived
	);
}

export function materialVariantLabel(variant: MaterialVariantHitView): string {
	return labelOf(
		[variant.name, variant.code, balanceQuantity(variant)],
		variant.archived
	);
}

export function moreVariants(
	matchedCount: number,
	shown: number
): string | null {
	const rest = matchedCount - shown;
	if (rest <= 0) {
		return null;
	}
	return rest === 1 ? "e mais 1 variante" : `e mais ${rest} variantes`;
}

export function quoteDetail(
	hit: Pick<
		QuoteHitView,
		"clientName" | "refused" | "totalCents" | "validUntil"
	>,
	today: string
): string {
	const status = quoteStatus({
		refused: hit.refused,
		today,
		validUntil: hit.validUntil,
	});
	return `${hit.clientName} · ${statusLabels[status]} · ${moneyLabel(hit.totalCents)}`;
}

export function serviceDetail(
	hit: Pick<ServiceHitView, "category" | "priceCents">
): string {
	return `${hit.category ?? "Sem categoria"} · ${moneyLabel(hit.priceCents)}`;
}

function totalOf(result: SearchView): number {
	return searchGroupOrder.reduce((sum, key) => sum + result[key].total, 0);
}

function firstOf<T>(items: T[]): T[] {
	return items.slice(0, searchLimits.dialogPerGroup);
}

function optionsOf(
	result: SearchView
): Record<SearchGroupKey, PaletteOption[]> {
	return {
		clients: firstOf(result.clients.items).map((hit) => ({
			hit,
			id: `clients:${hit.id}`,
			kind: "clients",
			label: hit.name,
		})),
		materials: firstOf(result.materials.items).map((hit) => ({
			hit,
			id: `materials:${hit.id}`,
			kind: "materials",
			label: hit.name,
		})),
		products: firstOf(result.products.items).map((hit) => ({
			hit,
			id: `products:${hit.id}`,
			kind: "products",
			label: hit.name,
		})),
		profiles: firstOf(result.profiles.items).map((hit) => ({
			hit,
			id: `profiles:${hit.id}`,
			kind: "profiles",
			label: hit.name,
		})),
		quotes: firstOf(result.quotes.items).map((hit) => ({
			hit,
			id: `quotes:${hit.id}`,
			kind: "quotes",
			label: hit.code,
		})),
		services: firstOf(result.services.items).map((hit) => ({
			hit,
			id: `services:${hit.id}`,
			kind: "services",
			label: hit.name,
		})),
	};
}

export function seeAllLabel(total: number): string {
	return total === 1
		? "Ver o resultado na página de busca"
		: `Ver todos os ${total} resultados`;
}

export function paletteGroups(result: SearchView): PaletteGroup[] {
	const options = optionsOf(result);
	const groups: PaletteGroup[] = searchGroupOrder
		.filter((key) => options[key].length > 0)
		.map((key) => ({
			id: key,
			items: options[key],
			label: `${groupNames[key].label} · ${result[key].total}`,
		}));
	const total = totalOf(result);
	const last: PaletteOption =
		total === 0
			? {
					id: "archived",
					kind: "archived",
					label: "Buscar também nos arquivados",
				}
			: { id: "all", kind: "all", label: seeAllLabel(total) };
	return [...groups, { id: "more", items: [last], label: null }];
}

export function searchTabs(result: SearchView): SearchTab[] {
	return [
		{ count: totalOf(result), group: null, id: "tudo", label: "Tudo" },
		...searchGroupOrder
			.filter((key) => result[key].total > 0)
			.map((key) => ({
				count: result[key].total,
				group: key,
				id: groupParams[key],
				label: groupNames[key].label,
			})),
	];
}

export function groupOfParam(param: string | undefined): SearchGroupKey | null {
	return searchGroupOrder.find((key) => groupParams[key] === param) ?? null;
}

export function seeGroupLabel(key: SearchGroupKey, total: number): string {
	return `Ver os ${total} ${groupNames[key].many}`;
}

function listed(parts: readonly string[]): string {
	const last = parts.at(-1) ?? "";
	const rest = parts.slice(0, -1);
	return rest.length === 0 ? last : `${rest.join(", ")} e ${last}`;
}

export function searchStatus(
	result: SearchView | undefined,
	query: string,
	stale: boolean
): string {
	if (stale) {
		return `Buscando ${query}`;
	}
	if (!result) {
		return "";
	}
	const parts = searchGroupOrder.flatMap((key) => {
		const { total } = result[key];
		if (total === 0) {
			return [];
		}
		return [
			total === 1
				? `1 ${groupNames[key].one}`
				: `${total} ${groupNames[key].many}`,
		];
	});
	return parts.length === 0
		? `Nada encontrado para ${query}`
		: `${listed(parts)} para ${query}`;
}

export function isEmptyResult(result: SearchView): boolean {
	return totalOf(result) === 0;
}

export function emptyHint(archived: boolean): string {
	return archived
		? "Confira a grafia ou busque por um trecho do telefone."
		: "Confira a grafia, busque por um trecho do telefone ou marque Incluir arquivados.";
}
