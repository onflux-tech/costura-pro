import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
	type DraftPoint,
	type InventoryDraft,
	pointKey,
	withCount,
	withLocations,
	withoutLine,
} from "@/lib/inventory";
import { usePageHeader } from "@/shell/page-header";
import { stockLocationsQuery } from "@/stock/stock-queries";

import { AddItemDialog } from "./add-item-dialog";
import { CountLocationPanel } from "./count-location-panel";
import { DiscardDraftDialog } from "./discard-draft-dialog";
import { stockPointsQuery } from "./inventory-queries";
import { LocationsDialog } from "./locations-dialog";
import { useInventoryDraft } from "./use-inventory-draft";

type Location = { id: string; name: string };

function useLocationNames(locationIds: readonly string[]): Location[] {
	const active = useQuery(stockLocationsQuery());
	const archived = useQuery(stockLocationsQuery(true));
	const names = new Map(
		[...(active.data?.items ?? []), ...(archived.data?.items ?? [])].map(
			(location) => [location.id, location.name]
		)
	);
	return locationIds
		.map((id) => ({ id, name: names.get(id) ?? "Local" }))
		.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

function SaveStatus({ failed }: { failed: boolean }) {
	if (!failed) {
		return <Text tone="subtle">Salvo neste aparelho.</Text>;
	}
	return (
		<Alert tone="warning">
			<AlertTitle>O rascunho não está sendo salvo neste aparelho</AlertTitle>
			<AlertDescription>
				O navegador recusou guardar a contagem. Ela fica só enquanto esta página
				estiver aberta.
			</AlertDescription>
		</Alert>
	);
}

function CountBody({
	draft,
	failed,
	onDiscard,
	update,
}: {
	draft: InventoryDraft;
	failed: boolean;
	onDiscard: () => void;
	update: (change: (current: InventoryDraft) => InventoryDraft) => void;
}) {
	const queryClient = useQueryClient();
	const pointsQuery = stockPointsQuery(draft.locationIds);
	const points = useQuery(pointsQuery);
	const locations = useLocationNames(draft.locationIds);
	const [filter, setFilter] = useState("");
	const [adding, setAdding] = useState<Location | null>(null);
	const [addOpen, setAddOpen] = useState(false);
	const [locationsOpen, setLocationsOpen] = useState(false);

	const count = (point: DraftPoint, expectedMicros: string, text: string) =>
		update((current) =>
			withCount(
				current,
				point,
				text,
				expectedMicros,
				current.lines[pointKey(point)]?.movementId ?? crypto.randomUUID()
			)
		);

	const add = (point: DraftPoint, text: string, expectedMicros: string) => {
		if (Object.hasOwn(draft.lines, pointKey(point))) {
			toast.info("Este item já estava na lista; a contagem foi atualizada.");
		}
		count(point, expectedMicros, text);
		queryClient.invalidateQueries({ queryKey: pointsQuery.queryKey });
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<Heading className="max-md:sr-only">Contagem</Heading>
				<Text tone="subtle">
					Às cegas: o saldo do sistema aparece só na revisão.
				</Text>
				<SaveStatus failed={failed} />
			</div>
			<Field className="md:w-96">
				<FieldLabel>Filtrar itens</FieldLabel>
				<Input
					maxLength={100}
					onChange={(event) => setFilter(event.target.value)}
					placeholder="Material, variante, código ou lote"
					type="search"
					value={filter}
				/>
			</Field>
			{points.isPending ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
				</div>
			) : null}
			{points.isError && !points.data ? (
				<Alert role="alert" tone="danger">
					<AlertTitle>Não foi possível carregar os itens dos locais</AlertTitle>
					<AlertDescription>
						Os números já digitados continuam guardados neste aparelho.
					</AlertDescription>
					<AlertActions>
						<Button
							onClick={() => points.refetch()}
							size="sm"
							variant="outline"
						>
							Tentar de novo
						</Button>
					</AlertActions>
				</Alert>
			) : null}
			{points.data
				? locations.map((location) => (
						<CountLocationPanel
							draft={draft}
							filter={filter}
							key={location.id}
							location={location}
							onAdd={() => {
								setAdding(location);
								setAddOpen(true);
							}}
							onCount={count}
							onRemove={(key) => update((current) => withoutLine(current, key))}
							points={points.data.items}
						/>
					))
				: null}
			<div className="flex flex-wrap gap-2">
				<ButtonLink
					className="max-md:w-full"
					render={<Link to="/estoque/inventario/revisao" />}
				>
					Revisar divergências
				</ButtonLink>
				<Button
					className="max-md:w-full"
					onClick={() => setLocationsOpen(true)}
					variant="outline"
				>
					Mudar locais
				</Button>
				<Button className="max-md:w-full" onClick={onDiscard} variant="ghost">
					Descartar
				</Button>
			</div>
			<AddItemDialog
				location={adding}
				onAdd={add}
				onOpenChange={setAddOpen}
				open={addOpen}
			/>
			<LocationsDialog
				draft={draft}
				onOpenChange={setLocationsOpen}
				onSave={(locationIds) =>
					update((current) => withLocations(current, locationIds))
				}
				open={locationsOpen}
			/>
		</div>
	);
}

export function CountPage() {
	const { draft, failed, save, update } = useInventoryDraft();
	const [discarding, setDiscarding] = useState(false);
	usePageHeader({
		backHref: "/estoque/inventario",
		eyebrow: "Inventário",
		heading: "Contagem",
	});

	if (!draft) {
		return <Navigate replace to="/estoque/inventario" />;
	}

	return (
		<>
			<CountBody
				draft={draft}
				failed={failed}
				onDiscard={() => setDiscarding(true)}
				update={update}
			/>
			<DiscardDraftDialog
				onDiscard={() => save(null)}
				onOpenChange={setDiscarding}
				open={discarding}
			/>
		</>
	);
}
