import { formatMarginPercent } from "@costura-pro/domain/pricing";
import { Badge } from "@costura-pro/ui/components/badge";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Photo } from "@costura-pro/ui/components/photo";
import { Mono, Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";
import { ShirtIcon } from "lucide-react";

import { moneyLabel } from "@/lib/finance";
import { photoUrl } from "@/lib/media";
import type { PricingPreview } from "@/lib/pricing";
import {
	displayPhotoOf,
	type ProductReferences,
	type ProductVariantView,
	type ProductView,
	type SheetEstimate,
	variantEstimate,
	variantPricing,
} from "@/lib/products";

const pendingCost = { empty: "sem ficha", incomplete: "incompleto" } as const;

const pendingMargin = {
	empty: "Sem ficha",
	incomplete: "Custo incompleto",
} as const;

function marginText(
	estimate: SheetEstimate,
	preview: PricingPreview | null
): string {
	if (estimate.status !== "complete") {
		return pendingMargin[estimate.status];
	}
	if (preview === null) {
		return "...";
	}
	const margin = preview.pricing?.marginBasisPoints;
	return margin === null || margin === undefined
		? "Sem preço"
		: formatMarginPercent(margin);
}

function targetMeta(
	ownTarget: number | null,
	atelierTarget: number | undefined
): string {
	if (ownTarget !== null) {
		return `Meta própria de ${formatMarginPercent(ownTarget)}`;
	}
	return atelierTarget === undefined
		? "Meta do ateliê"
		: `Meta do ateliê de ${formatMarginPercent(atelierTarget)}`;
}

function VariantRow({
	atelierTarget,
	product,
	references,
	variant,
}: {
	atelierTarget: number | undefined;
	product: ProductView;
	references: ProductReferences;
	variant: ProductVariantView;
}) {
	const estimate = variantEstimate(
		product.sheet,
		variant.sheetChanges,
		references
	);
	const preview =
		atelierTarget === undefined
			? null
			: variantPricing(product, estimate, variant.priceCents, atelierTarget);
	const facts = preview?.pricing ?? null;
	const photo = displayPhotoOf(product.photos, variant.coverPhotoHash);
	return (
		<DataListRow>
			<DataListCell label="Variante">
				<div className="flex min-w-0 items-start gap-3">
					{photo ? (
						<Photo
							alt=""
							className="size-12 shrink-0 rounded-md"
							height={96}
							src={photoUrl(photo.thumbnailHash)}
							width={96}
						/>
					) : (
						<div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
							<ShirtIcon aria-hidden="true" className="size-5" />
						</div>
					)}
					<div className="flex min-w-0 flex-col gap-0.5">
						<ButtonLink
							className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
							render={
								<Link
									params={{ produtoId: product.id, varianteId: variant.id }}
									to="/catalogo-produtos/produtos/$produtoId/variantes/$varianteId"
								/>
							}
							variant="link"
						>
							{variant.name}
						</ButtonLink>
						{variant.code ? (
							<Mono size="2xs" tone="muted">
								{variant.code}
							</Mono>
						) : null}
						<div className="flex flex-wrap gap-1">
							{variant.archivedAt ? (
								<Badge tone="warning">arquivada</Badge>
							) : null}
							{facts?.belowCost ? (
								<Badge tone="danger">abaixo do custo</Badge>
							) : null}
							{facts?.belowTarget && !facts.belowCost ? (
								<Badge tone="warning">abaixo da meta</Badge>
							) : null}
							{estimate.status === "incomplete" ? (
								<Badge tone="warning">custo incompleto</Badge>
							) : null}
						</div>
					</div>
				</div>
			</DataListCell>
			<DataListCell align="end" label="Custo">
				<Text inline numeric>
					{estimate.status === "complete"
						? moneyLabel(estimate.totalCents)
						: pendingCost[estimate.status]}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Preço">
				<Text inline numeric weight="semibold">
					{moneyLabel(variant.priceCents)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Margem">
				<Text inline numeric>
					{marginText(estimate, preview)}
				</Text>
			</DataListCell>
		</DataListRow>
	);
}

export function ProductVariantPanel({
	atelierTarget,
	product,
	references,
	variants,
}: {
	atelierTarget: number | undefined;
	product: ProductView;
	references: ProductReferences;
	variants: readonly ProductVariantView[];
}) {
	const active = variants.filter((variant) => variant.archivedAt === null);
	const archived = variants.filter((variant) => variant.archivedAt !== null);
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Variantes</PanelTitle>
				<PanelMeta>
					{targetMeta(product.targetMarginBasisPoints, atelierTarget)}
				</PanelMeta>
			</PanelHeader>
			{variants.length === 0 ? (
				<PanelContent>
					<Text tone="subtle">
						Nenhuma variante ainda. A variante é o que tem código e preço de
						venda, como um tamanho ou uma cor.
					</Text>
				</PanelContent>
			) : (
				<DataList aria-label="Variantes" columns="minmax(0,1fr) 8rem 8rem 8rem">
					<DataListHeader>
						<DataListHeaderCell>Variante</DataListHeaderCell>
						<DataListHeaderCell align="end">Custo</DataListHeaderCell>
						<DataListHeaderCell align="end">Preço</DataListHeaderCell>
						<DataListHeaderCell align="end">Margem</DataListHeaderCell>
					</DataListHeader>
					{[...active, ...archived].map((variant) => (
						<VariantRow
							atelierTarget={atelierTarget}
							key={variant.id}
							product={product}
							references={references}
							variant={variant}
						/>
					))}
				</DataList>
			)}
			<PanelContent className="border-divider border-t">
				<ButtonLink
					render={
						<Link
							params={{ produtoId: product.id }}
							to="/catalogo-produtos/produtos/$produtoId/variantes/nova"
						/>
					}
					variant="outline"
				>
					Nova variante
				</ButtonLink>
			</PanelContent>
		</Panel>
	);
}
