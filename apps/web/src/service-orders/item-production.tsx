import { Button } from "@costura-pro/ui/components/button";
import { StageTrack } from "@costura-pro/ui/components/stage-track";
import { Text } from "@costura-pro/ui/components/typography";
import { type RefObject, useEffect, useRef, useState } from "react";

import {
	type FlowStageView,
	type ItemProduction as ItemProductionView,
	itemProduction,
} from "@/lib/production";
import type { ServiceOrderItemView } from "@/lib/service-orders";
import { StartProductionDialog } from "@/production/start-dialog";
import { useProductionActions } from "@/production/use-production-actions";

import { ReconcileDialog } from "./reconcile-dialog";
import type { ReconciliationActions } from "./use-reconciliation-actions";

function statusText(item: ServiceOrderItemView, label: string): string {
	return item.kind === "material" ? label : `Etapa atual: ${label}`;
}

function NextStep({
	next,
	onAdvance,
	onReconcile,
	onStart,
	pending,
	nextButton,
}: {
	next: ItemProductionView["next"];
	onAdvance: () => void;
	onReconcile: () => void;
	onStart: () => void;
	pending: boolean;
	nextButton: RefObject<HTMLButtonElement | null>;
}) {
	switch (next.kind) {
		case "start":
			return (
				<Button disabled={pending} onClick={onStart} ref={nextButton}>
					Iniciar produção
				</Button>
			);
		case "reconcile":
			return (
				<Button disabled={pending} onClick={onReconcile} ref={nextButton}>
					Reconciliar e marcar pronto
				</Button>
			);
		case "advance":
			return (
				<Button disabled={pending} onClick={onAdvance}>
					{next.label}
				</Button>
			);
		case "ready":
			return (
				<Button disabled={pending} onClick={onAdvance}>
					Marcar pronto
				</Button>
			);
		default:
			return null;
	}
}

function Notice({ next }: { next: ItemProductionView["next"] }) {
	if (next.kind === "reconcile") {
		return (
			<Text size="xs" tone="warning">
				Reconcilie os materiais para marcar pronto.
			</Text>
		);
	}
	if (next.kind === "useFlow") {
		return (
			<Text size="xs" tone="subtle">
				Use o fluxo de produção da OS para iniciar.
			</Text>
		);
	}
	return null;
}

export function ItemProduction({
	flowStages,
	item,
	itemTitle,
	number,
	order,
	reconciliation,
	status,
}: {
	flowStages: readonly FlowStageView[] | null;
	item: ServiceOrderItemView;
	itemTitle: string;
	number: number;
	order: { code: string; openedOn: string };
	reconciliation: ReconciliationActions;
	status: RefObject<HTMLParagraphElement | null>;
}) {
	const view = itemProduction(item, flowStages);
	const { advance, back, pendingId, start } = useProductionActions();
	const [starting, setStarting] = useState(false);
	const [reconciling, setReconciling] = useState(false);
	const [settled, setSettled] = useState(0);
	const nextButton = useRef<HTMLButtonElement>(null);
	const pending = pendingId === item.id;

	useEffect(() => {
		if (settled > 0 && document.activeElement === document.body) {
			status.current?.focus();
		}
	}, [settled, status]);

	const act = async (command: typeof advance) => {
		if (await command(item)) {
			setSettled((count) => count + 1);
		}
	};

	const finalFocus = () =>
		nextButton.current?.isConnected ? nextButton.current : status.current;

	const actions =
		view.next.kind === "start" ||
		view.next.kind === "reconcile" ||
		view.next.kind === "advance" ||
		view.next.kind === "ready" ||
		view.back;

	return (
		<div className="flex flex-col gap-2">
			<Text ref={status} size="sm" tabIndex={-1} weight="semibold">
				{statusText(item, view.label)}
			</Text>
			{view.track ? (
				<StageTrack
					current={view.track.current}
					label={`Etapas de produção do subitem ${number}`}
					stages={view.track.stages}
				/>
			) : null}
			<Notice next={view.next} />
			{actions ? (
				<div className="flex flex-wrap gap-2">
					<NextStep
						next={view.next}
						nextButton={nextButton}
						onAdvance={() => act(advance)}
						onReconcile={() => setReconciling(true)}
						onStart={() => setStarting(true)}
						pending={pending}
					/>
					{view.back ? (
						<Button
							disabled={pending}
							onClick={() => act(back)}
							variant="outline"
						>
							Voltar etapa
						</Button>
					) : null}
				</div>
			) : null}
			{flowStages === null ? null : (
				<StartProductionDialog
					finalFocus={finalFocus}
					flowStages={flowStages}
					item={item}
					itemTitle={itemTitle}
					onOpenChange={setStarting}
					open={starting && view.next.kind === "start"}
					pendingId={pendingId}
					start={start}
				/>
			)}
			<ReconcileDialog
				actions={reconciliation}
				finalFocus={finalFocus}
				item={item}
				itemTitle={itemTitle}
				onOpenChange={setReconciling}
				open={reconciling}
				openedOn={order.openedOn}
				orderCode={order.code}
			/>
		</div>
	);
}
