import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";

import {
	type BoardItemView,
	boardDueLabel,
	type FlowStageView,
	itemProduction,
	type ProductionAction,
	productionBlocked,
	productionLate,
} from "@/lib/production";
import { lineTitle } from "@/lib/quotes";

export type BoardOrderView = {
	clientName: string;
	code: string;
	flowStages: FlowStageView[] | null;
	flowVersion: number | null;
	id: string;
};

export type BoardCardActions = {
	onAdvance: () => void;
	onBack: () => void;
	onStart: () => void;
	pending: boolean;
};

function NextAction({
	actions,
	context,
	item,
	next,
}: {
	actions: BoardCardActions;
	context: string;
	item: BoardItemView;
	next: ProductionAction;
}) {
	switch (next.kind) {
		case "start":
			return (
				<Button
					aria-label={`Iniciar: ${context}`}
					data-board-start={item.id}
					disabled={actions.pending}
					onClick={actions.onStart}
					size="sm"
				>
					Iniciar
				</Button>
			);
		case "advance":
			return (
				<Button
					aria-label={`${next.label}: ${context}`}
					disabled={actions.pending}
					onClick={actions.onAdvance}
					size="sm"
				>
					Avançar
				</Button>
			);
		case "ready":
			return (
				<Button
					aria-label={`Marcar pronto: ${context}`}
					disabled={actions.pending}
					onClick={actions.onAdvance}
					size="sm"
				>
					Marcar pronto
				</Button>
			);
		case "useFlow":
			return (
				<ButtonLink
					aria-label={`Abrir OS: ${context}`}
					render={
						<Link params={{ osId: item.serviceOrderId }} to="/os/$osId" />
					}
					size="sm"
					variant="outline"
				>
					Abrir OS
				</ButtonLink>
			);
		default:
			return null;
	}
}

export function BoardCard({
	actions,
	headingLevel,
	item,
	order,
	today,
}: {
	actions: BoardCardActions;
	headingLevel: 2 | 3;
	item: BoardItemView;
	order: BoardOrderView | undefined;
	today: string;
}) {
	const title = lineTitle(item.line);
	const reference = `${order?.code ?? "OS"} · subitem ${item.position + 1}`;
	const context = `${title} (${reference})`;
	const view = itemProduction(item, order?.flowStages ?? null);
	const late = productionLate(item, today);
	const missing = productionBlocked(item);

	return (
		<article className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
			<div className="flex min-w-0 flex-col items-start gap-0.5">
				<Heading
					className="break-words"
					data-board-card={item.id}
					level={headingLevel}
					size="title"
					tabIndex={-1}
				>
					{title}
				</Heading>
				<ButtonLink
					className="h-auto min-h-11 justify-start px-0 text-xs md:min-h-0"
					render={
						<Link params={{ osId: item.serviceOrderId }} to="/os/$osId" />
					}
					variant="link"
				>
					{reference}
				</ButtonLink>
				<Text size="xs" tone="subtle">
					{`${order?.clientName ?? ""} · ${boardDueLabel(item.dueOn)}`}
				</Text>
			</div>
			{late || missing !== null ? (
				<div className="flex flex-wrap gap-1">
					{late ? <Badge tone="danger">atrasado</Badge> : null}
					{missing === null ? null : (
						<Badge className="whitespace-normal text-left" tone="danger">
							{`bloqueado · falta ${missing}`}
						</Badge>
					)}
				</div>
			) : null}
			{view.next.kind === "blocked" ? (
				<Text size="xs" tone="warning">
					Pronto espera a reconciliação.
				</Text>
			) : null}
			<div className="flex flex-wrap gap-2 empty:hidden">
				<NextAction
					actions={actions}
					context={context}
					item={item}
					next={view.next}
				/>
				{view.back ? (
					<Button
						aria-label={`Voltar: ${context}`}
						disabled={actions.pending}
						onClick={actions.onBack}
						size="sm"
						variant="ghost"
					>
						Voltar
					</Button>
				) : null}
			</div>
		</article>
	);
}
