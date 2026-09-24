import { formatCentimeters } from "@costura-pro/domain/measurement";
import { Stat } from "@costura-pro/ui/components/stat";
import { Text } from "@costura-pro/ui/components/typography";

import {
	describeDelta,
	fieldDelta,
	type MeasurementView,
} from "@/lib/measurements";

export function MeasurementValues({
	current,
	previous,
}: {
	current: Pick<MeasurementView, "fields">;
	previous: Pick<MeasurementView, "fields"> | null;
}) {
	return (
		<div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
			{current.fields.flatMap((field) => {
				if (field.valueMm === null) {
					return [];
				}
				const delta = fieldDelta(current, previous, field.fieldId);
				const described = delta === null ? null : describeDelta(delta);
				return [
					<Stat
						hint={
							described ? (
								<>
									<Text aria-hidden="true" inline size="xs" tone="warning">
										{described.text}
									</Text>
									<Text className="sr-only" inline size="xs">
										{described.label}
									</Text>
								</>
							) : undefined
						}
						key={field.fieldId}
						label={field.label}
						value={formatCentimeters(field.valueMm)}
					/>,
				];
			})}
		</div>
	);
}
