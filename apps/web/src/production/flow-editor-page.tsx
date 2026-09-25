import { canonicalJson } from "@costura-pro/domain/canonical-json";
import { Heading } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { ClientCommandFailure } from "@/lib/client-command-error";
import {
	type FlowDraft,
	flowPayload,
	type ProductionFlowView,
} from "@/lib/production";
import { useOpId } from "@/lib/use-op-id";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { FlowEditor } from "./flow-editor";
import { FlowPending } from "./flow-pending";
import {
	failedProductionCommand,
	productionFlowQuery,
	refreshProduction,
} from "./production-queries";

export function FlowEditorPage() {
	const queryClient = useQueryClient();
	const { opIdFor, reset } = useOpId();
	const flow = useQuery(productionFlowQuery());
	const [opened, setOpened] = useState<ProductionFlowView | null>(null);
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const live = flow.data;
	useEffect(() => {
		if (!opened && live) {
			setOpened(live);
		}
	}, [opened, live]);
	const current = opened ?? live;
	usePageHeader({ eyebrow: "Produção", heading: "Fluxo de produção" });

	if (!current) {
		return <FlowPending error={flow.error} onRetry={() => flow.refetch()} />;
	}

	const reloadCurrent = async () => {
		setFailure(null);
		const fresh = await flow.refetch();
		if (fresh.data) {
			setOpened(fresh.data);
		}
	};

	const submit = async (draft: FlowDraft) => {
		setFailure(null);
		const payload = flowPayload(draft);
		let saved: { version: number };
		try {
			saved = await api.productionFlow.update({
				baseVersion: current.version,
				opId: opIdFor(`${current.version}:${canonicalJson(payload)}`),
				stages: payload.stages,
			});
		} catch (error) {
			setFailure(await failedProductionCommand(queryClient, error, "fluxo"));
			return;
		}
		reset();
		toast.success(`Fluxo salvo na versão ${saved.version}`);
		await refreshProduction(queryClient);
		const fresh = queryClient.getQueryData(productionFlowQuery().queryKey);
		setOpened(fresh ?? null);
	};

	return (
		<div className="flex flex-col gap-4">
			<Heading className="max-md:sr-only">Fluxo de produção</Heading>
			<FlowEditor
				failure={failure}
				key={current.version}
				onReloadCurrent={reloadCurrent}
				onSubmit={submit}
				stages={current.stages}
				version={current.version}
			/>
		</div>
	);
}
