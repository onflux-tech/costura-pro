import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";

import {
	type CostedLine,
	itemTitle,
	materialReferenceFor,
	type ProductReferences,
} from "@/lib/products";

function MissingItem({
	line,
	references,
}: {
	line: CostedLine;
	references: ProductReferences;
}) {
	const { item } = line;
	const material =
		item.kind === "material"
			? materialReferenceFor(references, item.materialVariantId)
			: undefined;
	if (!material) {
		return (
			<Text size="sm" tone="subtle">
				{itemTitle(item, references)}
			</Text>
		);
	}
	return (
		<ButtonLink
			className="h-auto min-h-11 justify-start whitespace-normal px-0 text-left md:min-h-0"
			render={
				<Link
					params={{ materialId: material.materialId, varianteId: material.id }}
					to="/catalogo-produtos/materiais/$materialId/variantes/$varianteId"
				/>
			}
			variant="link"
		>
			{`Informar o custo de ${itemTitle(item, references)}`}
		</ButtonLink>
	);
}

export function MissingCosts({
	lines,
	references,
}: {
	lines: readonly CostedLine[];
	references: ProductReferences;
}) {
	if (lines.length === 0) {
		return null;
	}
	return (
		<Alert tone="warning">
			<AlertTitle>Custo incompleto</AlertTitle>
			<AlertDescription>
				Sem o custo de referência destes itens não dá para sugerir preço nem
				calcular a margem.
			</AlertDescription>
			<AlertActions className="flex-col items-start gap-1">
				{lines.map((line) => (
					<MissingItem key={line.item.id} line={line} references={references} />
				))}
			</AlertActions>
		</Alert>
	);
}
