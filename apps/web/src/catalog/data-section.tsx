import { Badge } from "@costura-pro/ui/components/badge";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import { Meter } from "@costura-pro/ui/components/meter";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { StageTrack } from "@costura-pro/ui/components/stage-track";
import { Stat } from "@costura-pro/ui/components/stat";
import { Mono, Text } from "@costura-pro/ui/components/typography";

import { CatalogSection } from "./catalog-section";

const receivables = [
	{
		client: "Zuleide Barros",
		code: "OS-2026-PC-0019",
		due: "12/09 · 4 dias",
		received: "R$ 0,00",
		status: { label: "vencida", tone: "danger" },
		value: "R$ 180,00",
	},
	{
		client: "Maria Beatriz Alencar",
		code: "OS-2026-PC-0031",
		due: "26/09",
		received: "R$ 624,00",
		status: { label: "parcial", tone: "warning" },
		value: "R$ 620,00",
	},
	{
		client: "Venda balcão",
		code: "VND-2026-PC-0071",
		due: "à vista",
		received: "R$ 190,00",
		status: { label: "quitada", tone: "success" },
		value: "R$ 190,00",
	},
] as const;

const productionStages = [
	{ id: "corte", label: "Corte" },
	{ id: "montagem", label: "Montagem" },
	{ id: "prova", label: "Prova" },
	{ id: "acabamento", label: "Acabamento" },
	{ id: "pronto", label: "Pronto" },
];

export function DataSection() {
	return (
		<CatalogSection heading="Dados e progresso" id="dados">
			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<Panel>
					<PanelContent>
						<Stat label="Faturamento" value="R$ 7.420,00" />
					</PanelContent>
				</Panel>
				<Panel>
					<PanelContent>
						<Stat label="A receber" value="R$ 2.180,00" />
					</PanelContent>
				</Panel>
				<Panel>
					<PanelContent>
						<Stat label="Abaixo do mínimo" tone="warning" value="7" />
					</PanelContent>
				</Panel>
				<Panel>
					<PanelContent>
						<Stat
							hint="3 pendências"
							label="Vencido"
							tone="danger"
							value="R$ 180,00"
						/>
					</PanelContent>
				</Panel>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<Panel>
					<PanelHeader>
						<PanelTitle>Capacidade diária</PanelTitle>
						<PanelMeta className="font-medium text-danger-foreground">
							sobrecarga de 50 min hoje
						</PanelMeta>
					</PanelHeader>
					<PanelContent className="flex flex-col gap-3">
						{[
							{ day: "Hoje · 16/09", used: 410 },
							{ day: "Quinta · 17/09", used: 300 },
							{ day: "Sexta · 18/09", used: 190 },
						].map((entry) => (
							<div className="flex flex-col gap-1.5" key={entry.day}>
								<div className="flex justify-between gap-3">
									<Text inline tone="subtle">
										{entry.day}
									</Text>
									<Text inline numeric tone="subtle">
										{entry.used} de 360 min
									</Text>
								</div>
								<Meter
									label={`Capacidade de ${entry.day}`}
									max={360}
									unit="min"
									value={entry.used}
								/>
							</div>
						))}
					</PanelContent>
				</Panel>
				<Panel>
					<PanelHeader>
						<PanelTitle>Subitem 1 · Vestido de festa</PanelTitle>
						<Badge tone="danger">prazo vencido</Badge>
					</PanelHeader>
					<PanelContent>
						<StageTrack
							current={2}
							label="Etapas de produção"
							stages={productionStages}
						/>
					</PanelContent>
				</Panel>
			</div>
			<Panel>
				<PanelHeader>
					<PanelTitle>Recebíveis</PanelTitle>
					<PanelMeta>competência</PanelMeta>
				</PanelHeader>
				<DataList
					aria-label="Recebíveis"
					columns="minmax(0,1fr) 8rem 7rem 7rem 7rem"
				>
					<DataListHeader>
						<DataListHeaderCell>Cliente e origem</DataListHeaderCell>
						<DataListHeaderCell>Vencimento</DataListHeaderCell>
						<DataListHeaderCell align="end">Valor</DataListHeaderCell>
						<DataListHeaderCell align="end">Recebido</DataListHeaderCell>
						<DataListHeaderCell align="end">Situação</DataListHeaderCell>
					</DataListHeader>
					{receivables.map((row) => (
						<DataListRow key={row.code}>
							<DataListCell label="Cliente e origem">
								{row.client} · <Mono>{row.code}</Mono>
							</DataListCell>
							<DataListCell label="Vencimento">{row.due}</DataListCell>
							<DataListCell align="end" label="Valor">
								{row.value}
							</DataListCell>
							<DataListCell align="end" label="Recebido">
								{row.received}
							</DataListCell>
							<DataListCell align="end" label="Situação">
								<Badge tone={row.status.tone}>{row.status.label}</Badge>
							</DataListCell>
						</DataListRow>
					))}
				</DataList>
			</Panel>
		</CatalogSection>
	);
}
