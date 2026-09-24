import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Checkbox } from "@costura-pro/ui/components/checkbox";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";
import { locationsError, startDraft } from "@/lib/inventory";
import { localDay } from "@/lib/measurements";
import { usePageHeader } from "@/shell/page-header";
import { stockLocationsQuery } from "@/stock/stock-queries";

import { useInventoryDraft } from "./use-inventory-draft";

export function NewCountPage() {
	const navigate = useNavigate();
	const { draft, save } = useInventoryDraft();
	const locations = useQuery(stockLocationsQuery());
	const [chosen, setChosen] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);
	usePageHeader({
		backHref: "/estoque/inventario",
		eyebrow: "Inventário",
		heading: "Nova contagem",
	});

	if (draft) {
		return <Navigate replace to="/estoque/inventario/contagem" />;
	}

	const items = locations.data?.items ?? [];
	const allChosen = items.length > 0 && chosen.length === items.length;

	const toggle = (locationId: string, checked: boolean) => {
		setError(null);
		setChosen((current) =>
			checked
				? [...current, locationId]
				: current.filter((item) => item !== locationId)
		);
	};

	const start = () => {
		const locationIds = items
			.filter((item) => chosen.includes(item.id))
			.map((item) => item.id);
		const found = locationsError(locationIds);
		if (found) {
			setError(found);
			return;
		}
		const now = new Date();
		save(
			startDraft({
				locationIds,
				now,
				sessionId: crypto.randomUUID(),
				today: localDay(now),
			})
		);
		navigate({ to: "/estoque/inventario/contagem" });
	};

	return (
		<div className="flex flex-col gap-4">
			<Heading className="max-md:sr-only">Nova contagem</Heading>
			<Text tone="subtle">
				Escolha onde vai contar. A lista mostra o que o sistema acha que está em
				cada local, sem a quantidade, e o que você achar fora dela entra por
				Acrescentar.
			</Text>
			<Panel>
				<PanelContent className="flex flex-col gap-4">
					{locations.isPending ? <Skeleton className="h-24" /> : null}
					{locations.isError ? (
						<Text tone="danger">
							{clientCommandFailure(locations.error, "local").message}
						</Text>
					) : null}
					{locations.isSuccess && items.length === 0 ? (
						<div className="flex flex-col items-start gap-2">
							<Text>Cadastre um local antes de contar.</Text>
							<ButtonLink render={<Link to="/estoque/locais" />}>
								Ir para locais
							</ButtonLink>
						</div>
					) : null}
					{items.length > 0 ? (
						<Fieldset>
							<FieldsetLegend>Locais da contagem</FieldsetLegend>
							<div className="flex flex-col">
								{items.map((location) => (
									<Checkbox
										checked={chosen.includes(location.id)}
										key={location.id}
										onCheckedChange={(checked) => toggle(location.id, checked)}
									>
										{location.name}
									</Checkbox>
								))}
							</div>
							<Button
								className="self-start"
								onClick={() => {
									setError(null);
									setChosen(allChosen ? [] : items.map((item) => item.id));
								}}
								size="sm"
								type="button"
								variant="ghost"
							>
								{allChosen ? "Desmarcar todos" : "Marcar todos"}
							</Button>
						</Fieldset>
					) : null}
					{error ? (
						<Text role="alert" tone="danger">
							{error}
						</Text>
					) : null}
				</PanelContent>
			</Panel>
			{items.length > 0 ? (
				<Button className="max-md:w-full md:self-start" onClick={start}>
					Começar contagem
				</Button>
			) : null}
		</div>
	);
}
