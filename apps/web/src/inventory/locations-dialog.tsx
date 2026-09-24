import { Button } from "@costura-pro/ui/components/button";
import { Checkbox } from "@costura-pro/ui/components/checkbox";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@costura-pro/ui/components/dialog";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
	type InventoryDraft,
	locationsError,
	lockedLocationIds,
	withLocations,
} from "@/lib/inventory";
import { stockLocationsQuery } from "@/stock/stock-queries";

export function LocationsDialog({
	draft,
	onOpenChange,
	onSave,
	open,
}: {
	draft: InventoryDraft;
	onOpenChange: (open: boolean) => void;
	onSave: (locationIds: string[]) => void;
	open: boolean;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				{open ? (
					<LocationsForm
						close={() => onOpenChange(false)}
						draft={draft}
						onSave={onSave}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function LocationsForm({
	close,
	draft,
	onSave,
}: {
	close: () => void;
	draft: InventoryDraft;
	onSave: (locationIds: string[]) => void;
}) {
	const locations = useQuery(stockLocationsQuery());
	const locked = lockedLocationIds(draft);
	const [chosen, setChosen] = useState<string[]>(() => draft.locationIds);
	const [error, setError] = useState<string | null>(null);
	const items = locations.data?.items ?? [];

	const toggle = (locationId: string, checked: boolean) => {
		setError(null);
		setChosen((current) =>
			checked
				? [...current, locationId]
				: current.filter((item) => item !== locationId)
		);
	};

	const save = () => {
		const found = locationsError(withLocations(draft, chosen).locationIds);
		if (found) {
			setError(found);
			return;
		}
		onSave(chosen);
		close();
	};

	return (
		<div className="flex flex-col gap-4">
			<DialogTitle>Locais da contagem</DialogTitle>
			<DialogDescription>
				Locais com itens contados não saem da contagem.
			</DialogDescription>
			<Fieldset>
				<FieldsetLegend className="sr-only">Locais</FieldsetLegend>
				<div className="flex flex-col">
					{items.map((location) => (
						<Checkbox
							checked={chosen.includes(location.id) || locked.has(location.id)}
							disabled={locked.has(location.id)}
							key={location.id}
							onCheckedChange={(checked) => toggle(location.id, checked)}
						>
							{location.name}
						</Checkbox>
					))}
				</div>
			</Fieldset>
			{error ? (
				<Text role="alert" tone="danger">
					{error}
				</Text>
			) : null}
			<DialogActions>
				<DialogClose render={<Button variant="outline" />}>
					Cancelar
				</DialogClose>
				<Button onClick={save} type="button">
					Salvar locais
				</Button>
			</DialogActions>
		</div>
	);
}
