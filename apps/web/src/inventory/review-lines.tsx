import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import {
	DataList,
	DataListCell,
	DataListHeader,
	DataListHeaderCell,
	DataListRow,
} from "@costura-pro/ui/components/data-list";
import {
	Field,
	FieldError,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { NumberField } from "@costura-pro/ui/components/number-field";
import { Text } from "@costura-pro/ui/components/typography";
import { useState } from "react";

import {
	type DraftPoint,
	type FinalizeField,
	type InventoryPointView,
	pointKey,
	pointLabel,
	type ReviewLine,
	shortageValueText,
	surplusValueText,
	valueHint,
} from "@/lib/inventory";
import { movementQuantity, pointQuantity } from "@/lib/stock";

import { pointDetails } from "./count-row";

type Register = (field: FinalizeField) => (element: HTMLElement | null) => void;

function quantityOf(micros: bigint, point: DraftPoint): string {
	return pointQuantity(
		micros.toString(),
		point.baseUnit,
		point.displayPrecision
	);
}

function ItemCell({ line }: { line: ReviewLine }) {
	const { point } = line.line;
	const details = pointDetails(point);
	return (
		<div className="flex flex-col gap-1">
			<Text weight="semibold">{`${point.materialName} · ${point.variantName}`}</Text>
			<Text size="sm" tone="subtle">
				{details ? `${point.locationName} · ${details}` : point.locationName}
			</Text>
			{line.changedSinceCount ? (
				<div className="flex flex-col items-start gap-1">
					<Badge tone="warning">saldo mudou</Badge>
					<Text size="sm" tone="subtle">
						{`Agora: ${quantityOf(line.currentMicros, point)}. O ajuste é a diferença do que você contou; se contou depois dessa mudança, volte à contagem e digite de novo.`}
					</Text>
				</div>
			) : null}
		</div>
	);
}

function ValueCell({
	error,
	line,
	onValueChange,
	register,
}: {
	error: string | undefined;
	line: ReviewLine;
	onValueChange: (key: string, text: string) => void;
	register: Register;
}) {
	if (line.outcome.kind === "shortage") {
		return (
			<Text size="sm" tone="subtle">
				{shortageValueText(line)}
			</Text>
		);
	}
	return (
		<Field
			invalid={Boolean(error)}
			name={`value:${line.key}`}
			ref={register(`value:${line.key}`)}
		>
			<FieldLabel className="sr-only">
				{`Valor da entrada de ${pointLabel(line.line.point)} em ${line.line.point.locationName}`}
			</FieldLabel>
			<NumberField
				aria-invalid={Boolean(error) || undefined}
				onChange={(event) => onValueChange(line.key, event.target.value)}
				suffix="R$"
				value={surplusValueText(line)}
			/>
			<Text size="sm" tone="subtle">
				{valueHint(line)}
			</Text>
			{error ? <FieldError match>{error}</FieldError> : null}
		</Field>
	);
}

export function DivergentList({
	errors,
	lines,
	onValueChange,
	register,
}: {
	errors: Partial<Record<FinalizeField, string>>;
	lines: readonly ReviewLine[];
	onValueChange: (key: string, text: string) => void;
	register: Register;
}) {
	return (
		<DataList
			aria-label="Divergências"
			columns="minmax(0,1fr) 7rem 7rem 7rem 11rem"
		>
			<DataListHeader>
				<DataListHeaderCell>Item</DataListHeaderCell>
				<DataListHeaderCell align="end">Esperado</DataListHeaderCell>
				<DataListHeaderCell align="end">Contado</DataListHeaderCell>
				<DataListHeaderCell align="end">Diferença</DataListHeaderCell>
				<DataListHeaderCell align="end">Valor</DataListHeaderCell>
			</DataListHeader>
			{lines.map((line) => (
				<DataListRow key={line.key}>
					<DataListCell label="Item">
						<ItemCell line={line} />
					</DataListCell>
					<DataListCell align="end" label="Esperado">
						<Text inline numeric>
							{quantityOf(line.expectedMicros, line.line.point)}
						</Text>
					</DataListCell>
					<DataListCell align="end" label="Contado">
						<Text inline numeric>
							{quantityOf(line.countedMicros, line.line.point)}
						</Text>
					</DataListCell>
					<DataListCell align="end" label="Diferença">
						<Text inline numeric weight="semibold">
							{movementQuantity(
								(line.countedMicros - line.expectedMicros).toString(),
								line.line.point.baseUnit,
								line.line.point.displayPrecision
							)}
						</Text>
					</DataListCell>
					<DataListCell align="end" label="Valor">
						<ValueCell
							error={errors[`value:${line.key}`]}
							line={line}
							onValueChange={onValueChange}
							register={register}
						/>
					</DataListCell>
				</DataListRow>
			))}
		</DataList>
	);
}

export function UncountedList({
	onZero,
	points,
}: {
	onZero: (point: InventoryPointView) => void;
	points: readonly InventoryPointView[];
}) {
	return (
		<DataList aria-label="Não contados" columns="minmax(0,1fr) 11rem">
			<DataListHeader>
				<DataListHeaderCell>Item</DataListHeaderCell>
				<DataListHeaderCell align="end">Ação</DataListHeaderCell>
			</DataListHeader>
			{points.map((point) => {
				const details = pointDetails(point);
				return (
					<DataListRow key={pointKey(point)}>
						<DataListCell label="Item">
							<div className="flex flex-col gap-1">
								<Text weight="semibold">{`${point.materialName} · ${point.variantName}`}</Text>
								<Text size="sm" tone="subtle">
									{details
										? `${point.locationName} · ${details}`
										: point.locationName}
								</Text>
							</div>
						</DataListCell>
						<DataListCell align="end" label="Ação">
							<Button
								onClick={() => onZero(point)}
								size="sm"
								type="button"
								variant="outline"
							>
								Contar como zero
							</Button>
						</DataListCell>
					</DataListRow>
				);
			})}
		</DataList>
	);
}

export function MatchedList({ lines }: { lines: readonly ReviewLine[] }) {
	const [open, setOpen] = useState(false);
	const summary =
		lines.length === 1 ? "1 item bateu" : `${lines.length} itens bateram`;
	const toggleLabel = open ? "Esconder" : "Mostrar";
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<Text>{summary}</Text>
				{lines.length > 0 ? (
					<Button
						onClick={() => setOpen(!open)}
						size="sm"
						type="button"
						variant="ghost"
					>
						{toggleLabel}
					</Button>
				) : null}
			</div>
			{open ? (
				<DataList aria-label="Itens que bateram" columns="minmax(0,1fr) 8rem">
					<DataListHeader>
						<DataListHeaderCell>Item</DataListHeaderCell>
						<DataListHeaderCell align="end">Contado</DataListHeaderCell>
					</DataListHeader>
					{lines.map((line) => (
						<DataListRow key={line.key}>
							<DataListCell label="Item">
								<ItemCell line={line} />
							</DataListCell>
							<DataListCell align="end" label="Contado">
								<Text inline numeric>
									{quantityOf(line.countedMicros, line.line.point)}
								</Text>
							</DataListCell>
						</DataListRow>
					))}
				</DataList>
			) : null}
		</div>
	);
}
