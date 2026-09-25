import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { opIdsByTarget } from "@/lib/op-id";
import {
	flowAdoptionInput,
	type ProductionTarget,
	productionFailureMessage,
	productionOutcome,
	productionStartInput,
	productionStepInput,
	unchangedItemMessage,
} from "@/lib/production";
import { client as api } from "@/utils/orpc";

import {
	failedProductionCommand,
	refreshProduction,
} from "./production-queries";

type Saved = { version: number };

export function useProductionActions() {
	const queryClient = useQueryClient();
	const [opIdsOf] = useState(() => opIdsByTarget(() => crypto.randomUUID()));
	const [pendingId, setPendingId] = useState<string | null>(null);

	const run = async (
		id: string,
		command: () => Promise<Saved>,
		messageOf: typeof productionFailureMessage
	): Promise<Saved | null> => {
		setPendingId(id);
		let saved: Saved;
		try {
			saved = await command();
		} catch (error) {
			const failure = await failedProductionCommand(queryClient, error);
			toast.error(messageOf(failure));
			return null;
		} finally {
			setPendingId(null);
		}
		await refreshProduction(queryClient);
		return saved;
	};

	const onItem = async (
		item: ProductionTarget,
		command: () => Promise<Saved>
	): Promise<boolean> => {
		const saved = await run(item.id, command, productionFailureMessage);
		if (saved === null) {
			return false;
		}
		if (productionOutcome(saved, item.version) === "unchanged") {
			toast.info(unchangedItemMessage);
			return false;
		}
		return true;
	};

	const step = (item: ProductionTarget, action: "advance" | "back") =>
		onItem(item, () =>
			api.serviceOrderItems[action](
				productionStepInput(item, action, opIdsOf(item.id))
			)
		);

	return {
		adoptCurrentFlow: async (order: ProductionTarget) =>
			(await run(
				order.id,
				() =>
					api.serviceOrders.adoptCurrentFlow(
						flowAdoptionInput(order, opIdsOf(order.id))
					),
				(failure) => failure.message
			)) !== null,
		advance: (item: ProductionTarget) => step(item, "advance"),
		back: (item: ProductionTarget) => step(item, "back"),
		pendingId,
		start: (item: ProductionTarget, stageIds: readonly string[]) =>
			onItem(item, () =>
				api.serviceOrderItems.start(
					productionStartInput(item, stageIds, opIdsOf(item.id))
				)
			),
	};
}
