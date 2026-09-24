import { formatMarginPercent } from "@costura-pro/domain/pricing";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Stat } from "@costura-pro/ui/components/stat";
import { Text } from "@costura-pro/ui/components/typography";

import { moneyLabel } from "@/lib/finance";
import type { QuoteSummary } from "@/lib/quotes";

const followUp = "Você pode seguir assim; a confirmação fica na emissão.";

function marginText(summary: QuoteSummary): string {
	const margin = summary.pricing?.marginBasisPoints;
	if (margin === undefined) {
		return "sem custo completo";
	}
	return margin === null ? "sem preço" : formatMarginPercent(margin);
}

function marginTone(summary: QuoteSummary) {
	if (summary.pricing?.belowCost) {
		return "danger" as const;
	}
	return summary.pricing?.belowTarget ? ("warning" as const) : undefined;
}

function PricingAlerts({
	summary,
	target,
}: {
	summary: QuoteSummary;
	target: number;
}) {
	const { pricing, totals } = summary;
	if (summary.costStatus === "incomplete") {
		return (
			<Alert tone="warning">
				<AlertTitle>Custo incompleto</AlertTitle>
				<AlertDescription>
					Sem o custo destes itens, a margem não aparece:
				</AlertDescription>
				{summary.missing.map((item) => (
					<Text key={item} size="xs">
						{item}
					</Text>
				))}
			</Alert>
		);
	}
	if (pricing?.belowCost) {
		return (
			<Alert tone="danger">
				<AlertTitle>Abaixo do custo</AlertTitle>
				<AlertDescription>
					{`O total ao cliente, ${moneyLabel(totals.totalCents)}, não cobre o custo estimado de ${moneyLabel(totals.costCents ?? 0n)}. ${followUp}`}
				</AlertDescription>
			</Alert>
		);
	}
	if (pricing?.belowTarget && summary.shortOfTargetCents !== null) {
		return (
			<Alert tone="warning">
				<AlertTitle>Abaixo da meta de margem</AlertTitle>
				<AlertDescription>
					{`Faltam ${moneyLabel(summary.shortOfTargetCents)} para atingir ${formatMarginPercent(target)}. ${followUp}`}
				</AlertDescription>
			</Alert>
		);
	}
	return null;
}

export function QuoteInternalPanel({
	summary,
	target,
	targetFailed,
}: {
	summary: QuoteSummary;
	target: number | null;
	targetFailed: boolean;
}) {
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Só para você</PanelTitle>
				<PanelMeta>Não sai no documento.</PanelMeta>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-4">
				{summary.costStatus === "empty" ? (
					<Text tone="subtle">Acrescente itens para ver custo e margem.</Text>
				) : null}
				{summary.costStatus !== "empty" && target === null && targetFailed ? (
					<Text tone="danger">
						Não foi possível ler a meta de margem do ateliê. Recarregue a
						página.
					</Text>
				) : null}
				{summary.costStatus !== "empty" && target === null && !targetFailed ? (
					<Skeleton className="h-24" />
				) : null}
				{summary.costStatus !== "empty" && target !== null ? (
					<>
						<div className="grid grid-cols-2 gap-4">
							<Stat
								label="Custo estimado"
								value={
									summary.totals.costCents === null
										? "incompleto"
										: moneyLabel(summary.totals.costCents)
								}
							/>
							<Stat
								label="Meta de margem"
								value={formatMarginPercent(target)}
							/>
							<Stat
								label="Preço sugerido"
								value={
									summary.pricing
										? moneyLabel(summary.pricing.suggestedCents)
										: "sem custo completo"
								}
							/>
							<Stat
								label="Margem deste orçamento"
								tone={marginTone(summary)}
								value={marginText(summary)}
							/>
						</div>
						<PricingAlerts summary={summary} target={target} />
					</>
				) : null}
			</PanelContent>
		</Panel>
	);
}
