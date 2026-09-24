import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { NumberField } from "@costura-pro/ui/components/number-field";
import { Text } from "@costura-pro/ui/components/typography";

import {
	countError,
	type DraftPoint,
	pointKey,
	pointLabel,
} from "@/lib/inventory";
import { unitAbbreviation } from "@/lib/materials";

export function pointDetails(
	point: Pick<DraftPoint, "code" | "lotLabel">
): string {
	return [point.code, point.lotLabel ? `lote ${point.lotLabel}` : null]
		.filter(Boolean)
		.join(" · ");
}

export function CountRow({
	countedText,
	onChange,
	onRemove,
	point,
}: {
	countedText: string;
	onChange: (text: string) => void;
	onRemove?: () => void;
	point: DraftPoint;
}) {
	const error = countError(countedText);
	return (
		<Field
			className="border-divider border-b py-3 last:border-b-0"
			invalid={Boolean(error)}
			name={pointKey(point)}
		>
			<div className="flex flex-wrap items-center gap-2">
				<FieldLabel>{pointLabel(point)}</FieldLabel>
				{point.archived ? <Badge tone="neutral">arquivada</Badge> : null}
			</div>
			{point.code ? (
				<Text size="sm" tone="subtle">
					{point.code}
				</Text>
			) : null}
			<div className="flex items-center gap-2">
				<div className="w-full md:w-48">
					<NumberField
						aria-invalid={Boolean(error) || undefined}
						enterKeyHint="next"
						onChange={(event) => onChange(event.target.value)}
						suffix={unitAbbreviation(point.baseUnit)}
						value={countedText}
					/>
				</div>
				{onRemove ? (
					<Button onClick={onRemove} size="sm" type="button" variant="ghost">
						Tirar
					</Button>
				) : null}
			</div>
			{error ? <FieldError match>{error}</FieldError> : null}
		</Field>
	);
}
