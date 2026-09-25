import { Button } from "@costura-pro/ui/components/button";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Text } from "@costura-pro/ui/components/typography";
import { useRef } from "react";

import { serviceOrderFlow } from "@/lib/production";
import type { ServiceOrderDetailView } from "@/lib/service-orders";
import { useProductionActions } from "@/production/use-production-actions";

export function ServiceOrderFlow({
	detail,
}: {
	detail: ServiceOrderDetailView;
}) {
	const { adoptCurrentFlow, pendingId } = useProductionActions();
	const status = useRef<HTMLParagraphElement>(null);
	const { serviceOrder } = detail;
	const flow = serviceOrderFlow(serviceOrder, detail.currentFlowVersion);
	const hasFlow = serviceOrder.flowVersion !== null;
	const pending = pendingId === serviceOrder.id;

	const adopt = async () => {
		if (await adoptCurrentFlow(serviceOrder)) {
			status.current?.focus();
		}
	};

	return (
		<Panel aria-label="Fluxo de produção">
			<PanelContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<Text ref={status} tabIndex={-1} tone={hasFlow ? "default" : "subtle"}>
					{flow.text}
				</Text>
				{flow.action ? (
					<Button
						disabled={pending}
						onClick={adopt}
						size={hasFlow ? "sm" : "default"}
						variant={hasFlow ? "outline" : "default"}
					>
						{flow.action}
					</Button>
				) : null}
			</PanelContent>
		</Panel>
	);
}
