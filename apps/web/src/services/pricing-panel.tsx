import { formatMarginPercent } from "@costura-pro/domain/pricing";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Stat } from "@costura-pro/ui/components/stat";
import { Text } from "@costura-pro/ui/components/typography";

import { moneyLabel } from "@/lib/finance";
import type { PricingPreview } from "@/lib/services";

function targetSource(preview: PricingPreview): string {
	const origin = preview.ownTarget ? "própria" : "do ateliê";
	return `Pela meta ${origin} de ${formatMarginPercent(preview.targetMarginBasisPoints)}`;
}

function marginTone(preview: PricingPreview) {
	if (preview.pricing?.belowCost) {
		return "danger" as const;
	}
	return preview.pricing?.belowTarget ? ("warning" as const) : undefined;
}

export function PricingPanel({
	hint,
	onUseSuggestion,
	preview,
	suggestionApplied,
}: {
	hint: string;
	onUseSuggestion: () => void;
	preview: PricingPreview | null;
	suggestionApplied: boolean;
}) {
	const margin = preview?.pricing?.marginBasisPoints;
	const marginValue =
		margin === null || margin === undefined
			? "Sem preço"
			: formatMarginPercent(margin);
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Preço sugerido</PanelTitle>
				<PanelMeta>Custo e margem aparecem só para você.</PanelMeta>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-4">
				{preview ? (
					<>
						<div className="grid gap-4 sm:grid-cols-2">
							<Stat
								hint={targetSource(preview)}
								label="Sugerido"
								value={moneyLabel(preview.suggestedCents)}
							/>
							<Stat
								hint="Sobre o preço praticado"
								label="Margem do preço"
								tone={marginTone(preview)}
								value={marginValue}
							/>
						</div>
						{preview.pricing?.belowCost ? (
							<Alert tone="danger">
								<AlertTitle>Preço abaixo do custo</AlertTitle>
								<AlertDescription>
									Cada venda deste serviço sai no prejuízo. O preço continua
									sendo o que você escolher.
								</AlertDescription>
							</Alert>
						) : null}
						{preview.pricing?.belowTarget && !preview.pricing.belowCost ? (
							<Alert tone="warning">
								<AlertTitle>Preço abaixo da meta</AlertTitle>
								<AlertDescription>
									{`Para a meta de ${formatMarginPercent(preview.targetMarginBasisPoints)}, o preço precisa ser de pelo menos ${moneyLabel(preview.suggestedCents)}.`}
								</AlertDescription>
							</Alert>
						) : null}
						<Button
							className="sm:self-start"
							disabled={suggestionApplied}
							onClick={onUseSuggestion}
							variant="outline"
						>
							Usar preço sugerido
						</Button>
					</>
				) : (
					<Text tone="subtle">{hint}</Text>
				)}
			</PanelContent>
		</Panel>
	);
}
