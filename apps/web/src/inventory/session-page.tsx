import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Badge } from "@costura-pro/ui/components/badge";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import {
	Panel,
	PanelHeader,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Stat } from "@costura-pro/ui/components/stat";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";

import { clientCommandFailure } from "@/lib/client-command-error";
import { moneyLabel } from "@/lib/finance";
import { linesByLocation, sessionSummary } from "@/lib/inventory";
import { formatDay } from "@/lib/measurements";
import { movementQuantity, pointQuantity } from "@/lib/stock";
import { usePageHeader } from "@/shell/page-header";

import { pointDetails } from "./count-row";
import { inventorySessionQuery } from "./inventory-queries";

const route = getRouteApi("/_app/estoque/inventario/$contagemId");

type SessionLine = NonNullable<
	ReturnType<typeof useSession>["data"]
>["lines"][number];

function useSession(sessionId: string) {
	return useQuery(inventorySessionQuery(sessionId));
}

function LineRow({ line }: { line: SessionLine }) {
	const details = pointDetails(line);
	const quantity = (micros: string) =>
		pointQuantity(micros, line.baseUnit, line.displayPrecision);
	const difference = (
		BigInt(line.countedMicros) - BigInt(line.expectedMicros)
	).toString();
	return (
		<DataListRow>
			<DataListCell label="Item">
				<div className="flex flex-col gap-1">
					<div className="flex flex-wrap items-center gap-2">
						<Text weight="semibold">{`${line.materialName} · ${line.variantName}`}</Text>
						{line.movementId === null ? (
							<Badge tone="neutral">bateu</Badge>
						) : null}
						{line.reversedByMovementId ? (
							<Badge tone="warning">estornado</Badge>
						) : null}
					</div>
					{details ? (
						<Text size="sm" tone="subtle">
							{details}
						</Text>
					) : null}
				</div>
			</DataListCell>
			<DataListCell align="end" label="Esperado">
				<Text inline numeric>
					{quantity(line.expectedMicros)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Contado">
				<Text inline numeric>
					{quantity(line.countedMicros)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Diferença">
				<Text inline numeric>
					{line.movementId === null
						? "sem ajuste"
						: movementQuantity(
								difference,
								line.baseUnit,
								line.displayPrecision
							)}
				</Text>
			</DataListCell>
			<DataListCell align="end" label="Valor">
				<Text inline numeric>
					{line.valueCents === null
						? "sem ajuste"
						: moneyLabel(line.valueCents)}
				</Text>
			</DataListCell>
		</DataListRow>
	);
}

function NotFound({ message }: { message: string }) {
	return (
		<Alert role="alert" tone="danger">
			<AlertTitle>{message}</AlertTitle>
			<AlertDescription>
				Confira o endereço ou abra a contagem pela lista do inventário.
			</AlertDescription>
			<AlertActions>
				<ButtonLink
					render={<Link to="/estoque/inventario" />}
					size="sm"
					variant="outline"
				>
					Voltar ao inventário
				</ButtonLink>
			</AlertActions>
		</Alert>
	);
}

export function SessionPage() {
	const { contagemId } = route.useParams();
	const session = useSession(contagemId);
	usePageHeader({
		backHref: "/estoque/inventario",
		eyebrow: "Inventário",
		heading: session.data?.session.reason ?? "Contagem",
	});

	if (session.isPending) {
		return (
			<div className="flex flex-col gap-2">
				<Skeleton className="h-10" />
				<Skeleton className="h-40" />
			</div>
		);
	}
	if (!session.data) {
		return (
			<NotFound
				message={clientCommandFailure(session.error, "contagem").message}
			/>
		);
	}

	const { lines, session: record } = session.data;
	const summary = sessionSummary(lines);
	const groups = linesByLocation(lines);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<Heading className="max-md:sr-only">{record.reason}</Heading>
				<Text tone="subtle">
					{`${formatDay(record.occurredOn)} · ${groups.map((group) => group.locationName).join(", ")}`}
				</Text>
				{record.notes ? <Text>{record.notes}</Text> : null}
			</div>
			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<Stat label="Itens contados" value={lines.length} />
				<Stat label="Divergências" value={summary.divergent} />
				<Stat label="Entradas" value={moneyLabel(summary.entryCents)} />
				<Stat label="Saídas" value={moneyLabel(summary.exitCents)} />
			</div>
			{groups.map((group) => (
				<Panel key={group.locationId}>
					<PanelHeader>
						<PanelTitle>{group.locationName}</PanelTitle>
					</PanelHeader>
					<DataList
						aria-label={`Contagem de ${group.locationName}`}
						columns="minmax(0,1fr) 7rem 7rem 7rem 8rem"
					>
						<DataListHeader>
							<DataListHeaderCell>Item</DataListHeaderCell>
							<DataListHeaderCell align="end">Esperado</DataListHeaderCell>
							<DataListHeaderCell align="end">Contado</DataListHeaderCell>
							<DataListHeaderCell align="end">Diferença</DataListHeaderCell>
							<DataListHeaderCell align="end">Valor</DataListHeaderCell>
						</DataListHeader>
						{group.lines.map((line) => (
							<LineRow
								key={`${line.variantId}|${line.lotId ?? "-"}`}
								line={line}
							/>
						))}
					</DataList>
				</Panel>
			))}
			<ButtonLink
				className="max-md:w-full md:self-start"
				render={<Link to="/estoque/inventario" />}
				variant="outline"
			>
				Voltar ao inventário
			</ButtonLink>
		</div>
	);
}
