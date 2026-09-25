import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import {
	Tabs,
	TabsList,
	TabsPanel,
	TabsTab,
} from "@costura-pro/ui/components/tabs";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useId, useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import { localDay } from "@/lib/measurements";
import {
	type BoardColumn,
	type BoardItemView,
	boardColumns,
	boardTab,
	itemProduction,
} from "@/lib/production";
import { lineTitle } from "@/lib/quotes";
import { subitemsLabel } from "@/lib/service-orders";
import { ReconcileDialog } from "@/service-orders/reconcile-dialog";
import {
	type ReconciliationActions,
	useReconciliationActions,
} from "@/service-orders/use-reconciliation-actions";
import { usePageHeader } from "@/shell/page-header";
import type { client } from "@/utils/orpc";

import {
	BoardCard,
	type BoardCardActions,
	type BoardOrderView,
} from "./board-card";
import { boardQuery } from "./production-queries";
import { StartProductionDialog } from "./start-dialog";
import { useProductionActions } from "./use-production-actions";

const route = getRouteApi("/_app/producao/quadro");

type BoardRead = Awaited<ReturnType<typeof client.serviceOrderItems.board>>;

function focusTarget(
	itemId: string,
	attributes: readonly string[]
): HTMLElement | null {
	const selectors = [
		...attributes.map((name) => `[${name}="${itemId}"]`),
		"[data-board-fallback]",
	];
	for (const selector of selectors) {
		const found = [...document.querySelectorAll<HTMLElement>(selector)].find(
			(element) => element.offsetParent !== null
		);
		if (found !== undefined) {
			return found;
		}
	}
	return null;
}

function asBoardItems(items: BoardRead["items"]): BoardItemView[] {
	return items.flatMap((item) =>
		item.kind === "material" ? [] : [{ ...item, kind: item.kind }]
	);
}

type Chosen = { id: string; open: boolean } | null;

type CardContext = {
	actionsFor: (item: BoardItemView) => BoardCardActions;
	orders: ReadonlyMap<string, BoardOrderView>;
	today: string;
};

function CardList({
	column,
	context,
	headingLevel,
}: {
	column: BoardColumn;
	context: CardContext;
	headingLevel: 2 | 3;
}) {
	if (column.items.length === 0) {
		return (
			<Text size="xs" tone="muted">
				Nenhum subitem.
			</Text>
		);
	}
	return (
		<div className="flex flex-col gap-2">
			{column.items.map((item) => (
				<BoardCard
					actions={context.actionsFor(item)}
					headingLevel={headingLevel}
					item={item}
					key={item.id}
					order={context.orders.get(item.serviceOrderId)}
					today={context.today}
				/>
			))}
		</div>
	);
}

function ColumnPanel({
	column,
	context,
}: {
	column: BoardColumn;
	context: CardContext;
}) {
	const titleId = useId();
	return (
		<Panel aria-labelledby={titleId}>
			<PanelHeader>
				<PanelTitle id={titleId}>{column.label}</PanelTitle>
				<PanelMeta className="tabular-nums">{column.items.length}</PanelMeta>
			</PanelHeader>
			<PanelContent className="p-3">
				<CardList column={column} context={context} headingLevel={3} />
			</PanelContent>
		</Panel>
	);
}

function EmptyBoard() {
	return (
		<Panel>
			<PanelContent className="flex flex-col items-start gap-3 p-6">
				<Text tone="subtle">
					Nenhum subitem de produção ainda. A OS nasce da aprovação do
					orçamento.
				</Text>
				<ButtonLink
					render={<Link to="/orcamentos/emitidos" />}
					variant="outline"
				>
					Ver orçamentos emitidos
				</ButtonLink>
			</PanelContent>
		</Panel>
	);
}

function BoardFrame({
	children,
	summary,
}: {
	children: ReactNode;
	summary: string | null;
}) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Heading className="max-md:sr-only">Quadro por etapa</Heading>
					{summary === null ? null : <Text tone="subtle">{summary}</Text>}
				</div>
				<ButtonLink render={<Link to="/producao/fluxo" />} variant="outline">
					Editar fluxo
				</ButtonLink>
			</div>
			{children}
		</div>
	);
}

function StartDialog({
	items,
	onClose,
	orders,
	pendingId,
	start,
	starting,
}: {
	items: readonly BoardItemView[];
	onClose: () => void;
	orders: ReadonlyMap<string, BoardOrderView>;
	starting: Chosen;
} & Pick<ReturnType<typeof useProductionActions>, "pendingId" | "start">) {
	const item = items.find((candidate) => candidate.id === starting?.id);
	const flowStages =
		item === undefined
			? null
			: (orders.get(item.serviceOrderId)?.flowStages ?? null);
	if (item === undefined || flowStages === null) {
		return null;
	}
	return (
		<StartProductionDialog
			finalFocus={() =>
				focusTarget(item.id, ["data-board-start", "data-board-card"])
			}
			flowStages={flowStages}
			item={item}
			itemTitle={lineTitle(item.line)}
			key={item.id}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={
				starting?.open === true &&
				itemProduction(item, flowStages).next.kind === "start"
			}
			pendingId={pendingId}
			start={start}
		/>
	);
}

function ReconcileFromBoard({
	actions,
	chosen,
	items,
	onClose,
	orders,
}: {
	actions: ReconciliationActions;
	chosen: Chosen;
	items: readonly BoardItemView[];
	onClose: () => void;
	orders: ReadonlyMap<string, BoardOrderView>;
}) {
	const item = items.find((candidate) => candidate.id === chosen?.id);
	const order =
		item === undefined ? undefined : orders.get(item.serviceOrderId);
	if (item === undefined || order === undefined) {
		return null;
	}
	return (
		<ReconcileDialog
			actions={actions}
			finalFocus={() =>
				focusTarget(item.id, ["data-board-reconcile", "data-board-card"])
			}
			item={item}
			itemTitle={lineTitle(item.line)}
			key={item.id}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={chosen?.open === true}
			openedOn={order.openedOn}
			orderCode={order.code}
		/>
	);
}

function closed(current: Chosen): Chosen {
	return current === null ? null : { ...current, open: false };
}

function Board({ data, etapa }: { data: BoardRead; etapa?: string }) {
	const navigate = route.useNavigate();
	const { advance, back, pendingId, start } = useProductionActions();
	const reconciliation = useReconciliationActions();
	const { forgetSettled } = reconciliation;
	const [today] = useState(() => localDay(new Date()));
	const [starting, setStarting] = useState<Chosen>(null);
	const [reconciling, setReconciling] = useState<Chosen>(null);
	const [settledId, setSettledId] = useState<string | null>(null);

	useEffect(() => {
		forgetSettled(data.items);
	}, [data.items, forgetSettled]);

	useEffect(() => {
		if (settledId === null) {
			return;
		}
		setSettledId(null);
		if (document.activeElement === document.body) {
			focusTarget(settledId, ["data-board-card"])?.focus();
		}
	}, [settledId]);

	const items = asBoardItems(data.items);
	const summary = `fluxo v${data.flow.version} · ${subitemsLabel(items.length)}`;
	if (items.length === 0) {
		return (
			<BoardFrame summary={summary}>
				<EmptyBoard />
			</BoardFrame>
		);
	}

	const orders = new Map(data.orders.map((order) => [order.id, order]));
	const columns = boardColumns(data.flow.stages, items);
	const step = async (command: typeof advance, item: BoardItemView) => {
		await command(item);
		setSettledId(item.id);
	};
	const context: CardContext = {
		actionsFor: (item) => ({
			onAdvance: () => step(advance, item),
			onBack: () => step(back, item),
			onReconcile: () => setReconciling({ id: item.id, open: true }),
			onStart: () => setStarting({ id: item.id, open: true }),
			pending: pendingId === item.id,
		}),
		orders,
		today,
	};

	return (
		<BoardFrame summary={summary}>
			<div className="hidden gap-4 xl:grid xl:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] xl:items-start">
				{columns.map((column) => (
					<ColumnPanel column={column} context={context} key={column.id} />
				))}
			</div>
			<Tabs
				className="xl:hidden"
				onValueChange={(value) =>
					navigate({ replace: true, search: { etapa: String(value) } })
				}
				value={boardTab(columns, etapa)}
			>
				<TabsList aria-label="Etapas de produção">
					{columns.map((column) => (
						<TabsTab
							count={column.items.length}
							key={column.id}
							value={column.id}
						>
							{column.label}
						</TabsTab>
					))}
				</TabsList>
				{columns.map((column) => (
					<TabsPanel data-board-fallback="" key={column.id} value={column.id}>
						<CardList column={column} context={context} headingLevel={2} />
					</TabsPanel>
				))}
			</Tabs>
			<StartDialog
				items={items}
				onClose={() => setStarting(closed)}
				orders={orders}
				pendingId={pendingId}
				start={start}
				starting={starting}
			/>
			<ReconcileFromBoard
				actions={reconciliation}
				chosen={reconciling}
				items={items}
				onClose={() => setReconciling(closed)}
				orders={orders}
			/>
		</BoardFrame>
	);
}

export function BoardPage() {
	usePageHeader({ eyebrow: "Produção", heading: "Quadro por etapa" });
	const { etapa } = route.useSearch();
	const board = useQuery(boardQuery());

	if (board.data !== undefined) {
		return <Board data={board.data} etapa={etapa} />;
	}
	if (board.isError) {
		return (
			<BoardFrame summary={null}>
				<Panel>
					<PanelContent>
						<Text role="alert" tone="danger">
							{clientCommandFailure(board.error, "OS").message}
						</Text>
					</PanelContent>
				</Panel>
			</BoardFrame>
		);
	}
	return (
		<BoardFrame summary={null}>
			<div className="flex flex-col gap-2">
				<Skeleton className="h-24" />
				<Skeleton className="h-24" />
			</div>
		</BoardFrame>
	);
}
