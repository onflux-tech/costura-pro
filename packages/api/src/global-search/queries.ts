import type { Database } from "@costura-pro/db";
import { client, clientProfile } from "@costura-pro/db/schema/clients";
import { material } from "@costura-pro/db/schema/materials";
import { product } from "@costura-pro/db/schema/products";
import { quote } from "@costura-pro/db/schema/quotes";
import { service } from "@costura-pro/db/schema/services";
import type { ClientKind } from "@costura-pro/domain/client";
import {
	matchedVariants,
	matchesAll,
	normalizeText,
	searchLimits,
	searchTokens,
} from "@costura-pro/domain/search";
import type { BaseUnitCode } from "@costura-pro/domain/unit";
import { and, asc, count, desc, eq, isNull, type SQL, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import z from "zod";

import { clientMatches } from "../clients/queries";
import { materialMatches } from "../materials/queries";
import { listMaterialVariants } from "../materials/store";
import { productMatches } from "../products/queries";
import { listProductVariants } from "../products/store";
import {
	draftTotalCents,
	latestRevision,
	quoteMatches,
} from "../quotes/queries";
import { serviceMatches } from "../services/queries";
import { variantBalanceTotals } from "../stock/queries";

export const globalSearchInput = z.object({
	archived: z.boolean().default(false),
	query: z
		.string()
		.trim()
		.min(searchLimits.query.min)
		.max(searchLimits.query.max),
});

export const searchGroupNames = [
	"clients",
	"profiles",
	"quotes",
	"products",
	"materials",
	"services",
] as const;

export type SearchGroupName = (typeof searchGroupNames)[number];

export const groupSearchInput = globalSearchInput.extend({
	group: z.enum(searchGroupNames),
	offset: z.number().int().nonnegative().default(0),
});

export type SearchGroup<T> = { items: T[]; total: number };

export type ClientHit = {
	archived: boolean;
	email: string | null;
	id: string;
	kind: ClientKind;
	name: string;
	phone: string | null;
	secondaryPhone: string | null;
};

export type ProfileHit = {
	archived: boolean;
	clientId: string;
	clientName: string;
	id: string;
	name: string;
};

export type ProductVariantHit = {
	archived: boolean;
	code: string | null;
	id: string;
	name: string;
	priceCents: string;
};

export type MaterialVariantHit = {
	archived: boolean;
	baseUnit: BaseUnitCode;
	code: string | null;
	displayPrecision: number;
	id: string;
	name: string;
	quantityMicros: string;
};

export type ParentHit<V> = {
	archived: boolean;
	category: string | null;
	id: string;
	matchedCount: number;
	name: string;
	variantCount: number;
	variants: V[];
};

export type ServiceHit = {
	archived: boolean;
	category: string | null;
	id: string;
	name: string;
	outsourced: boolean;
	priceCents: string;
};

export type QuoteHit = {
	archived: boolean;
	clientName: string;
	code: string;
	id: string;
	refused: boolean;
	revisionNumber: number | null;
	totalCents: string;
	validUntil: string | null;
};

type GroupHits = {
	clients: ClientHit;
	materials: ParentHit<MaterialVariantHit>;
	products: ParentHit<ProductVariantHit>;
	profiles: ProfileHit;
	quotes: QuoteHit;
	services: ServiceHit;
};

export type GlobalSearchResult = {
	[G in SearchGroupName]: SearchGroup<GroupHits[G]>;
};

export type GroupSearchResult = {
	[G in SearchGroupName]: {
		group: G;
		items: GroupHits[G][];
		nextOffset: number | null;
		total: number;
	};
}[SearchGroupName];

type Reader = Pick<Database, "select" | "selectDistinct">;

type GroupSource<T> = {
	page: (offset: number, limit: number) => T[];
	total: () => number;
};

type SourceFactory<T> = (
	db: Reader,
	tokens: readonly string[],
	archived: boolean
) => GroupSource<T>;

function activeFirst(archivedAt: AnySQLiteColumn): SQL {
	return sql`${archivedAt} IS NOT NULL`;
}

function onlyActive(
	archived: boolean,
	archivedAt: AnySQLiteColumn
): SQL | undefined {
	return archived ? undefined : isNull(archivedAt);
}

function compareText(left: string, right: string): number {
	if (left < right) {
		return -1;
	}
	return left > right ? 1 : 0;
}

function activeCount(variants: readonly { archivedAt: Date | null }[]): number {
	return variants.filter((variant) => variant.archivedAt === null).length;
}

const clientSource: SourceFactory<ClientHit> = (db, tokens, archived) => {
	const where = and(
		isNull(client.anonymizedAt),
		onlyActive(archived, client.archivedAt),
		...clientMatches(tokens)
	);
	return {
		page: (offset, limit) =>
			db
				.select({
					archivedAt: client.archivedAt,
					email: client.email,
					id: client.id,
					kind: client.kind,
					name: client.name,
					phone: client.phone,
					secondaryPhone: client.secondaryPhone,
				})
				.from(client)
				.where(where)
				.orderBy(
					activeFirst(client.archivedAt),
					asc(client.searchText),
					asc(client.id)
				)
				.limit(limit)
				.offset(offset)
				.all()
				.map(({ archivedAt, ...row }) => ({
					...row,
					archived: archivedAt !== null,
				})),
		total: () =>
			db.select({ total: count() }).from(client).where(where).get()?.total ?? 0,
	};
};

const profileSource: SourceFactory<ProfileHit> = (db, tokens, archived) => {
	const hits = db
		.select({
			clientArchivedAt: client.archivedAt,
			clientId: client.id,
			clientName: client.name,
			id: clientProfile.id,
			name: clientProfile.name,
			profileArchivedAt: clientProfile.archivedAt,
		})
		.from(clientProfile)
		.innerJoin(client, eq(client.id, clientProfile.clientId))
		.where(
			and(
				isNull(client.anonymizedAt),
				onlyActive(archived, clientProfile.archivedAt),
				onlyActive(archived, client.archivedAt)
			)
		)
		.all()
		.filter((row) => matchesAll(row.name, tokens))
		.map(({ clientArchivedAt, profileArchivedAt, ...row }) => ({
			...row,
			archived: clientArchivedAt !== null || profileArchivedAt !== null,
			key: normalizeText(row.name),
		}))
		.sort(
			(left, right) =>
				Number(left.archived) - Number(right.archived) ||
				compareText(left.key, right.key) ||
				compareText(left.id, right.id)
		)
		.map(({ key, ...hit }) => hit);
	return {
		page: (offset, limit) => hits.slice(offset, offset + limit),
		total: () => hits.length,
	};
};

const productSource: SourceFactory<ParentHit<ProductVariantHit>> = (
	db,
	tokens,
	archived
) => {
	const where = and(
		onlyActive(archived, product.archivedAt),
		...productMatches(db, tokens)
	);
	return {
		page: (offset, limit) =>
			db
				.select({
					archivedAt: product.archivedAt,
					category: product.category,
					id: product.id,
					name: product.name,
					searchText: product.searchText,
				})
				.from(product)
				.where(where)
				.orderBy(
					activeFirst(product.archivedAt),
					asc(product.searchText),
					asc(product.id)
				)
				.limit(limit)
				.offset(offset)
				.all()
				.map(({ archivedAt, searchText, ...row }) => {
					const variants = listProductVariants(db, row.id);
					const matched = matchedVariants(searchText, variants, tokens);
					return {
						...row,
						archived: archivedAt !== null,
						matchedCount: matched.length,
						variantCount: activeCount(variants),
						variants: matched
							.slice(0, searchLimits.variantsShown)
							.map((variant) => ({
								archived: variant.archivedAt !== null,
								code: variant.code,
								id: variant.id,
								name: variant.name,
								priceCents: variant.priceCents.toString(),
							})),
					};
				}),
		total: () =>
			db.select({ total: count() }).from(product).where(where).get()?.total ??
			0,
	};
};

const materialSource: SourceFactory<ParentHit<MaterialVariantHit>> = (
	db,
	tokens,
	archived
) => {
	const where = and(
		onlyActive(archived, material.archivedAt),
		...materialMatches(db, tokens)
	);
	return {
		page: (offset, limit) =>
			db
				.select({
					archivedAt: material.archivedAt,
					category: material.category,
					id: material.id,
					name: material.name,
					searchText: material.searchText,
				})
				.from(material)
				.where(where)
				.orderBy(
					activeFirst(material.archivedAt),
					asc(material.searchText),
					asc(material.id)
				)
				.limit(limit)
				.offset(offset)
				.all()
				.map(({ archivedAt, searchText, ...row }) => {
					const variants = listMaterialVariants(db, row.id);
					const totals = variantBalanceTotals(db, row.id);
					const matched = matchedVariants(searchText, variants, tokens);
					return {
						...row,
						archived: archivedAt !== null,
						matchedCount: matched.length,
						variantCount: activeCount(variants),
						variants: matched
							.slice(0, searchLimits.variantsShown)
							.map((variant) => ({
								archived: variant.archivedAt !== null,
								baseUnit: variant.baseUnit,
								code: variant.code,
								displayPrecision: variant.displayPrecision,
								id: variant.id,
								name: variant.name,
								quantityMicros: totals.get(variant.id)?.quantityMicros ?? "0",
							})),
					};
				}),
		total: () =>
			db.select({ total: count() }).from(material).where(where).get()?.total ??
			0,
	};
};

const serviceSource: SourceFactory<ServiceHit> = (db, tokens, archived) => {
	const where = and(
		onlyActive(archived, service.archivedAt),
		...serviceMatches(tokens)
	);
	return {
		page: (offset, limit) =>
			db
				.select({
					archivedAt: service.archivedAt,
					category: service.category,
					id: service.id,
					name: service.name,
					outsourced: service.outsourced,
					priceCents: service.priceCents,
				})
				.from(service)
				.where(where)
				.orderBy(
					activeFirst(service.archivedAt),
					asc(service.searchText),
					asc(service.id)
				)
				.limit(limit)
				.offset(offset)
				.all()
				.map(({ archivedAt, priceCents, ...row }) => ({
					...row,
					archived: archivedAt !== null,
					priceCents: priceCents.toString(),
				})),
		total: () =>
			db.select({ total: count() }).from(service).where(where).get()?.total ??
			0,
	};
};

const quoteSource: SourceFactory<QuoteHit> = (db, tokens, archived) => {
	const where = and(
		onlyActive(archived, quote.archivedAt),
		isNull(client.anonymizedAt),
		...quoteMatches(db, tokens)
	);
	return {
		page: (offset, limit) =>
			db
				.select({
					archivedAt: quote.archivedAt,
					clientName: client.name,
					code: quote.code,
					discount: quote.discount,
					id: quote.id,
					lines: quote.lines,
					refusedOn: quote.refusedOn,
					revisionNumber: latestRevision.number,
					revisionTotalCents: latestRevision.totalCents,
					validUntil: latestRevision.validUntil,
				})
				.from(quote)
				.innerJoin(client, eq(client.id, quote.clientId))
				.where(where)
				.orderBy(
					activeFirst(quote.archivedAt),
					desc(quote.createdAt),
					desc(quote.id)
				)
				.limit(limit)
				.offset(offset)
				.all()
				.map(
					({
						archivedAt,
						discount,
						lines,
						refusedOn,
						revisionTotalCents,
						...row
					}) => ({
						...row,
						archived: archivedAt !== null,
						refused: refusedOn !== null,
						totalCents: revisionTotalCents ?? draftTotalCents(lines, discount),
					})
				),
		total: () =>
			db
				.select({ total: count() })
				.from(quote)
				.innerJoin(client, eq(client.id, quote.clientId))
				.where(where)
				.get()?.total ?? 0,
	};
};

const sources: { [G in SearchGroupName]: SourceFactory<GroupHits[G]> } = {
	clients: clientSource,
	materials: materialSource,
	products: productSource,
	profiles: profileSource,
	quotes: quoteSource,
	services: serviceSource,
};

function firstPage<T>(source: GroupSource<T>): SearchGroup<T> {
	return {
		items: source.page(0, searchLimits.perGroup),
		total: source.total(),
	};
}

function nothing<T>(): SearchGroup<T> {
	return { items: [], total: 0 };
}

export function globalSearch(
	db: Reader,
	{ archived, query }: z.output<typeof globalSearchInput>
): GlobalSearchResult {
	const tokens = searchTokens(query);
	if (tokens.length === 0) {
		return {
			clients: nothing(),
			materials: nothing(),
			products: nothing(),
			profiles: nothing(),
			quotes: nothing(),
			services: nothing(),
		};
	}
	return {
		clients: firstPage(sources.clients(db, tokens, archived)),
		materials: firstPage(sources.materials(db, tokens, archived)),
		products: firstPage(sources.products(db, tokens, archived)),
		profiles: firstPage(sources.profiles(db, tokens, archived)),
		quotes: firstPage(sources.quotes(db, tokens, archived)),
		services: firstPage(sources.services(db, tokens, archived)),
	};
}

function pageOf<G extends SearchGroupName>(
	group: G,
	source: GroupSource<GroupHits[G]> | null,
	offset: number
): {
	group: G;
	items: GroupHits[G][];
	nextOffset: number | null;
	total: number;
} {
	if (!source) {
		return { group, items: [], nextOffset: null, total: 0 };
	}
	const rows = source.page(offset, searchLimits.pageSize + 1);
	return {
		group,
		items: rows.slice(0, searchLimits.pageSize),
		nextOffset:
			rows.length > searchLimits.pageSize
				? offset + searchLimits.pageSize
				: null,
		total: source.total(),
	};
}

export function groupSearch(
	db: Reader,
	{ archived, group, offset, query }: z.output<typeof groupSearchInput>
): GroupSearchResult {
	const tokens = searchTokens(query);
	const ready = tokens.length > 0;
	switch (group) {
		case "clients":
			return pageOf(
				group,
				ready ? sources.clients(db, tokens, archived) : null,
				offset
			);
		case "materials":
			return pageOf(
				group,
				ready ? sources.materials(db, tokens, archived) : null,
				offset
			);
		case "products":
			return pageOf(
				group,
				ready ? sources.products(db, tokens, archived) : null,
				offset
			);
		case "profiles":
			return pageOf(
				group,
				ready ? sources.profiles(db, tokens, archived) : null,
				offset
			);
		case "quotes":
			return pageOf(
				group,
				ready ? sources.quotes(db, tokens, archived) : null,
				offset
			);
		case "services":
			return pageOf(
				group,
				ready ? sources.services(db, tokens, archived) : null,
				offset
			);
		default:
			return group satisfies never;
	}
}
