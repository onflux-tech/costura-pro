import { Badge } from "@costura-pro/ui/components/badge";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { DataList, DataListRow } from "@costura-pro/ui/components/data-list";
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
import { LayersIcon } from "lucide-react";

import { type VariantWithBalance, variantSummary } from "@/lib/materials";
import { photoUrl } from "@/lib/media";
import { balanceQuantity, balanceValue } from "@/lib/stock";

function VariantRow({
	materialId,
	variant,
}: {
	materialId: string;
	variant: VariantWithBalance;
}) {
	return (
		<DataListRow>
			<div className="flex min-w-0 items-start gap-3">
				{variant.photo ? (
					<Photo
						alt=""
						className="size-12 shrink-0 rounded-md"
						height={96}
						src={photoUrl(variant.photo.thumbnailHash)}
						width={96}
					/>
				) : (
					<div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
						<LayersIcon aria-hidden="true" className="size-5" />
					</div>
				)}
				<div className="flex min-w-0 flex-col gap-0.5">
					<ButtonLink
						className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left font-semibold md:min-h-0"
						render={
							<Link
								params={{ materialId, varianteId: variant.id }}
								to="/catalogo-produtos/materiais/$materialId/variantes/$varianteId"
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
					<Text size="xs" tone="muted">
						{variantSummary(variant)}
					</Text>
					<ButtonLink
						className="h-auto min-h-11 justify-start px-0 text-left md:min-h-0"
						render={
							<Link
								search={{ busca: variant.code ?? variant.name }}
								to="/estoque/saldos"
							/>
						}
						variant="link"
					>
						{`Saldo ${balanceQuantity(variant)} · ${balanceValue(variant.valueCents)}`}
					</ButtonLink>
					{variant.archivedAt ? <Badge tone="warning">arquivada</Badge> : null}
				</div>
			</div>
		</DataListRow>
	);
}

export function VariantPanel({
	materialId,
	variants,
}: {
	materialId: string;
	variants: readonly VariantWithBalance[];
}) {
	const active = variants.filter((variant) => variant.archivedAt === null);
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Variantes</PanelTitle>
				<PanelMeta>{active.length}</PanelMeta>
			</PanelHeader>
			{variants.length === 0 ? (
				<PanelContent>
					<Text tone="subtle">
						Nenhuma variante ainda. A variante é o que tem código, unidade e
						saldo.
					</Text>
				</PanelContent>
			) : (
				<DataList aria-label="Variantes" columns="minmax(0,1fr)">
					{variants.map((variant) => (
						<VariantRow
							key={variant.id}
							materialId={materialId}
							variant={variant}
						/>
					))}
				</DataList>
			)}
			<PanelContent className="border-divider border-t">
				<ButtonLink
					render={
						<Link
							params={{ materialId }}
							to="/catalogo-produtos/materiais/$materialId/variantes/nova"
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
