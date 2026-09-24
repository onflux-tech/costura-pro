import { stockLimits } from "@costura-pro/domain/stock";
import { Button } from "@costura-pro/ui/components/button";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { lotFormErrors } from "@/lib/stock";
import { useOpId } from "@/lib/use-op-id";
import { client as api } from "@/utils/orpc";

import { failedStockCommand, refreshStock } from "./stock-queries";

export function NewLot({
	onCreated,
	variantId,
}: {
	onCreated: (lotId: string) => void;
	variantId: string;
}) {
	const queryClient = useQueryClient();
	const { opIdFor } = useOpId();
	const [lotId, setLotId] = useState(() => crypto.randomUUID());
	const [label, setLabel] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const create = async () => {
		const found = lotFormErrors({ label, notes: "" }).label;
		if (found) {
			setError(found);
			return;
		}
		setError(null);
		setBusy(true);
		try {
			const fields = { label: label.trim(), notes: null, variantId };
			await api.stockLots.create({
				...fields,
				lotId,
				opId: opIdFor(`${lotId}:${JSON.stringify(fields)}`),
			});
			await refreshStock(queryClient);
			onCreated(lotId);
			setLabel("");
			setLotId(crypto.randomUUID());
		} catch (caught) {
			const failed = await failedStockCommand(queryClient, caught, "lote");
			setError(failed.message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Field invalid={Boolean(error)} name="newLot">
			<FieldLabel requirement="optional">Novo lote</FieldLabel>
			<div className="flex gap-2">
				<Input
					aria-invalid={Boolean(error) || undefined}
					maxLength={stockLimits.lotLabel.max}
					onChange={(event) => setLabel(event.target.value)}
					placeholder="Rolo 3"
					value={label}
				/>
				<Button
					disabled={busy}
					onClick={create}
					type="button"
					variant="outline"
				>
					Criar lote
				</Button>
			</div>
			{error ? <FieldError match>{error}</FieldError> : null}
		</Field>
	);
}
