import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";

import { moneyLabel } from "@/lib/finance";
import {
	baseEstimate,
	type ProductReferences,
	type ProductView,
} from "@/lib/products";

import { MissingCosts } from "./missing-costs";
import { SheetLines } from "./sheet-lines";

const pendingMeta = { empty: "vazia", incomplete: "Custo incompleto" } as const;

export function SheetPanel({
	product,
	references,
}: {
	product: ProductView;
	references: ProductReferences;
}) {
	const estimate = baseEstimate(product.sheet, references);
	const empty = estimate.status === "empty";
	const metaText =
		estimate.status === "complete"
			? `Custo da base ${moneyLabel(estimate.totalCents)}`
			: pendingMeta[estimate.status];
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Ficha técnica</PanelTitle>
				<PanelMeta>{metaText}</PanelMeta>
			</PanelHeader>
			{empty ? (
				<PanelContent>
					<Text tone="subtle">
						A ficha lista os materiais, com a perda normal, e os serviços de uma
						peça. É dela que sai o custo estimado de cada variante.
					</Text>
				</PanelContent>
			) : (
				<SheetLines
					label="Ficha técnica"
					references={references}
					rows={estimate.lines.map((line) => ({
						cost: line.cost,
						item: line.item,
					}))}
				/>
			)}
			{estimate.missing.length > 0 ? (
				<PanelContent>
					<MissingCosts lines={estimate.missing} references={references} />
				</PanelContent>
			) : null}
			<PanelContent className="border-divider border-t">
				<ButtonLink
					render={
						<Link
							params={{ produtoId: product.id }}
							to="/catalogo-produtos/produtos/$produtoId/ficha"
						/>
					}
					variant="outline"
				>
					Editar ficha
				</ButtonLink>
			</PanelContent>
		</Panel>
	);
}
