import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import { localDay } from "@/lib/measurements";
import type { ServiceOrderDetailView } from "@/lib/service-orders";
import { usePeople } from "@/quotes/use-people";
import { usePageHeader } from "@/shell/page-header";

import { ClosingPanel } from "./closing-panel";
import { ReceivablePanel } from "./receivable-panel";
import { ServiceOrderHeader } from "./service-order-header";
import { ServiceOrderInternalPanel } from "./service-order-internal-panel";
import { ServiceOrderItemCard } from "./service-order-item-card";
import { serviceOrderQuery } from "./service-order-queries";
import { ServiceOrderStates } from "./service-order-states";

function ServiceOrderView({ detail }: { detail: ServiceOrderDetailView }) {
	const { people } = usePeople(detail.client.id);
	const [today] = useState(() => localDay(new Date()));
	return (
		<div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div className="flex min-w-0 flex-col gap-4">
				<ServiceOrderHeader detail={detail} />
				<ServiceOrderStates detail={detail} />
				{detail.items.length === 0 ? (
					<Panel>
						<PanelContent>
							<Text tone="subtle">
								Esta OS só tem cobrança: a revisão não tem serviço, peça nem
								material.
							</Text>
						</PanelContent>
					</Panel>
				) : (
					detail.items.map((item, index) => (
						<ServiceOrderItemCard
							item={item}
							key={item.id}
							number={index + 1}
							people={people}
							today={today}
						/>
					))
				)}
			</div>
			<div className="flex min-w-0 flex-col gap-4">
				<ReceivablePanel detail={detail} />
				<ServiceOrderInternalPanel revision={detail.revision} />
				<ClosingPanel detail={detail} />
			</div>
		</div>
	);
}

export function ServiceOrderPage({
	serviceOrderId,
}: {
	serviceOrderId: string;
}) {
	const detail = useQuery(serviceOrderQuery(serviceOrderId));
	usePageHeader({
		backHref: "/os",
		eyebrow: "OS",
		heading: detail.data?.serviceOrder.code ?? "OS",
	});

	if (detail.isPending) {
		return <Skeleton className="h-96" />;
	}
	if (!detail.data) {
		return (
			<Alert tone="danger">
				<AlertTitle>Não dá para abrir esta OS</AlertTitle>
				<AlertDescription>
					{clientCommandFailure(detail.error, "OS").message}
				</AlertDescription>
				<AlertActions>
					<ButtonLink render={<Link to="/os" />} variant="outline">
						Voltar para as OS
					</ButtonLink>
				</AlertActions>
			</Alert>
		);
	}
	return <ServiceOrderView detail={detail.data} />;
}
