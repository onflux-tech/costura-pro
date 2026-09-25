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

function statusText(item: ServiceOrderItemView, label: string): string {
	return item.kind === "material" ? label : `Etapa atual: ${label}`;
}

function NextStep({
	next,
	onAdvance,
	onStart,
	pending,
	startButton,
}: {
	next: ItemProductionView["next"];
	onAdvance: () => void;
	onStart: () => void;
	pending: boolean;
	startButton: RefObject<HTMLButtonElement | null>;
}) {
	switch (next.kind) {
		case "start":
			return (
				<Button disabled={pending} onClick={onStart} ref={startButton}>
					Iniciar produção
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
}: {
	flowStages: readonly FlowStageView[] | null;
	item: ServiceOrderItemView;
	itemTitle: string;
	number: number;
}) {
	const view = itemProduction(item, flowStages);
	const { advance, back, pendingId, start } = useProductionActions();
	const [starting, setStarting] = useState(false);
	const [settled, setSettled] = useState(0);
	const startButton = useRef<HTMLButtonElement>(null);
	const status = useRef<HTMLParagraphElement>(null);
	const pending = pendingId === item.id;

	useEffect(() => {
		if (settled > 0 && document.activeElement === document.body) {
			status.current?.focus();
		}
	}, [settled]);

	const act = async (command: typeof advance) => {
		if (await command(item)) {
			setSettled((count) => count + 1);
		}
	};

	const actions =
		view.next.kind === "start" ||
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
						onAdvance={() => act(advance)}
						onStart={() => setStarting(true)}
						pending={pending}
						startButton={startButton}
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
					finalFocus={() =>
						startButton.current?.isConnected
							? startButton.current
							: status.current
					}
					flowStages={flowStages}
					item={item}
					itemTitle={itemTitle}
					onOpenChange={setStarting}
					open={starting && view.next.kind === "start"}
					pendingId={pendingId}
					start={start}
				/>
			)}
		</div>
	);
}
