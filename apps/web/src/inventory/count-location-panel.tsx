import { Button } from "@costura-pro/ui/components/button";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Text } from "@costura-pro/ui/components/typography";

import {
	countRows,
	type DraftPoint,
	type InventoryDraft,
	type InventoryPointView,
	locationProgress,
	pointMatches,
} from "@/lib/inventory";

import { CountRow } from "./count-row";

export function CountLocationPanel({
	draft,
	filter,
	location,
	onAdd,
	onCount,
	onRemove,
	points,
}: {
	draft: InventoryDraft;
	filter: string;
	location: { id: string; name: string };
	onAdd: () => void;
	onCount: (point: DraftPoint, expectedMicros: string, text: string) => void;
	onRemove: (key: string) => void;
	points: readonly InventoryPointView[];
}) {
	const progress = locationProgress(draft, points, location.id);
	const rows = countRows(draft, points, location.id).filter((row) =>
		pointMatches(row.point, filter)
	);
	const empty = filter.trim()
		? "Nenhum item com esse nome aqui."
		: "Nenhum item com saldo aqui. Acrescente o que encontrar.";

	return (
		<Panel>
			<PanelHeader>
				<div className="flex flex-col gap-0.5">
					<PanelTitle>{location.name}</PanelTitle>
					<PanelMeta>{`${progress.counted} de ${progress.total} contados`}</PanelMeta>
				</div>
				<Button onClick={onAdd} size="sm" type="button" variant="outline">
					Acrescentar item
				</Button>
			</PanelHeader>
			<PanelContent className="flex flex-col py-1">
				{rows.length === 0 ? (
					<Text className="py-3" tone="subtle">
						{empty}
					</Text>
				) : null}
				{rows.map((row) => (
					<CountRow
						countedText={draft.lines[row.key]?.countedText ?? ""}
						key={row.key}
						onChange={(text) => onCount(row.point, row.expectedMicros, text)}
						onRemove={row.removable ? () => onRemove(row.key) : undefined}
						point={row.point}
					/>
				))}
			</PanelContent>
		</Panel>
	);
}
