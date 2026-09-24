import { Button } from "@costura-pro/ui/components/button";
import { Text } from "@costura-pro/ui/components/typography";
import { useId, useState } from "react";

import { MeasurementValues } from "@/atendimento/measurement-values";
import { formatDay } from "@/lib/measurements";
import type { MeasurementSnapshotView } from "@/lib/service-orders";

function SnapshotEntry({ snapshot }: { snapshot: MeasurementSnapshotView }) {
	const [open, setOpen] = useState(false);
	const regionId = useId();
	const toggleLabel = open ? "Ocultar medidas" : "Ver medidas";
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Text size="xs">
					{`Medidas de ${formatDay(snapshot.takenOn)} · ${snapshot.templateName} v${snapshot.templateVersion}`}
				</Text>
				<Button
					aria-controls={regionId}
					aria-expanded={open}
					onClick={() => setOpen((current) => !current)}
					size="sm"
					variant="outline"
				>
					{toggleLabel}
				</Button>
			</div>
			<div className="flex flex-col gap-2" hidden={!open} id={regionId}>
				<MeasurementValues current={snapshot} previous={null} />
				{snapshot.notes ? (
					<Text size="xs" tone="subtle">
						{snapshot.notes}
					</Text>
				) : null}
			</div>
		</div>
	);
}

export function MeasurementSnapshot({
	snapshots,
}: {
	snapshots: readonly MeasurementSnapshotView[];
}) {
	if (snapshots.length === 0) {
		return (
			<Text size="xs" tone="warning">
				Sem medidas congeladas: o perfil não tinha medidas na aprovação.
			</Text>
		);
	}
	return (
		<div className="flex flex-col gap-3">
			{snapshots.map((snapshot) => (
				<SnapshotEntry key={snapshot.measurementId} snapshot={snapshot} />
			))}
		</div>
	);
}
