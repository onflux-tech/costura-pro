import { materialCategorySuggestions } from "@costura-pro/domain/material";
import { baseUnits } from "@costura-pro/domain/unit";
import { Button } from "@costura-pro/ui/components/button";
import { Checkbox } from "@costura-pro/ui/components/checkbox";
import {
	CheckboxChip,
	CheckboxChips,
} from "@costura-pro/ui/components/checkbox-chips";
import { Checklist, ChecklistItem } from "@costura-pro/ui/components/checklist";
import {
	ChoiceChip,
	ChoiceChips,
} from "@costura-pro/ui/components/choice-chips";
import {
	Field,
	FieldError,
	FieldHint,
	FieldLabel,
} from "@costura-pro/ui/components/field";
import { Fieldset, FieldsetLegend } from "@costura-pro/ui/components/fieldset";
import { Input } from "@costura-pro/ui/components/input";
import { NumberField } from "@costura-pro/ui/components/number-field";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Select } from "@costura-pro/ui/components/select";
import { SuggestionField } from "@costura-pro/ui/components/suggestion-field";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { useState } from "react";

import { CatalogSection } from "./catalog-section";

const unitItems = baseUnits.map((unit) => ({
	label: `${unit.label} (${unit.abbreviation})`,
	value: unit.code,
}));

const stageItems = [
	{ label: "Corte", value: "corte" },
	{ label: "Montagem", value: "montagem" },
	{ label: "Prova", value: "prova" },
	{ label: "Acabamento", value: "acabamento" },
];

function StageChips({
	defaultValue,
	disabled,
	legend,
}: {
	defaultValue: string[];
	disabled?: boolean;
	legend: string;
}) {
	return (
		<Fieldset>
			<FieldsetLegend>{legend}</FieldsetLegend>
			<CheckboxChips defaultValue={defaultValue} disabled={disabled}>
				{stageItems.map((stage) => (
					<CheckboxChip key={stage.value} value={stage.value}>
						{stage.label}
					</CheckboxChip>
				))}
			</CheckboxChips>
		</Fieldset>
	);
}

function MaterialFieldsPanel() {
	const [unit, setUnit] = useState("m");
	const [category, setCategory] = useState("Tecido");
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Variante de material</PanelTitle>
				<PanelMeta>Número com unidade, opção fixa e sugestões</PanelMeta>
			</PanelHeader>
			<PanelContent className="flex flex-col gap-4">
				<Field>
					<FieldLabel requirement="required">Unidade base</FieldLabel>
					<Select items={unitItems} onValueChange={setUnit} value={unit} />
					<FieldHint>Escolhida uma vez: todo saldo nasce nela.</FieldHint>
				</Field>
				<Field>
					<FieldLabel requirement="optional">Categoria</FieldLabel>
					<SuggestionField
						items={materialCategorySuggestions}
						onValueChange={setCategory}
						placeholder="Tecido"
						value={category}
					/>
					<FieldHint>Aceita categoria nova, fora da lista.</FieldHint>
				</Field>
				<Field>
					<FieldLabel requirement="optional">
						Custo de referência (R$)
					</FieldLabel>
					<NumberField defaultValue="12,50" />
				</Field>
				<Field>
					<FieldLabel requirement="optional">Mínimo</FieldLabel>
					<NumberField defaultValue="1,50" suffix="m" />
				</Field>
				<Field invalid>
					<FieldLabel>Alvo</FieldLabel>
					<NumberField aria-invalid defaultValue="10,555" suffix="m" />
					<FieldError match>Use no máximo 2 casas</FieldError>
				</Field>
				<Field>
					<FieldLabel>Embalagem de compra</FieldLabel>
					<NumberField defaultValue="50" disabled suffix="m" />
					<Select disabled items={unitItems} value="m" />
				</Field>
			</PanelContent>
		</Panel>
	);
}

export function FormSection() {
	return (
		<CatalogSection heading="Formulários" id="formularios">
			<div className="grid gap-4 md:grid-cols-2">
				<Panel>
					<PanelHeader>
						<PanelTitle>Receber peça do cliente</PanelTitle>
						<PanelMeta>Maria Beatriz Alencar</PanelMeta>
					</PanelHeader>
					<PanelContent className="flex flex-col gap-4">
						<Field>
							<FieldLabel requirement="required">Descrição da peça</FieldLabel>
							<Input defaultValue="Vestido longo verde, alça fina" required />
						</Field>
						<Field>
							<FieldLabel requirement="optional">
								Acessórios recebidos
							</FieldLabel>
							<Input placeholder="Cinto, botões extras" />
							<FieldHint>Aparece no comprovante de recepção.</FieldHint>
						</Field>
						<Field invalid>
							<FieldLabel>Devolução prevista</FieldLabel>
							<Input aria-invalid defaultValue="31/02/2026" />
							<FieldError match>Data inválida</FieldError>
						</Field>
						<Fieldset>
							<FieldsetLegend>Estado na recepção</FieldsetLegend>
							<ChoiceChips defaultValue="bom">
								<ChoiceChip value="bom">Bom</ChoiceChip>
								<ChoiceChip value="avaria">Com avaria</ChoiceChip>
								<ChoiceChip value="desgaste">Desgastada</ChoiceChip>
							</ChoiceChips>
						</Fieldset>
						<StageChips
							defaultValue={["prova", "acabamento"]}
							legend="Etapas sugeridas"
						/>
						<StageChips defaultValue={[]} legend="Etapas (nenhuma marcada)" />
						<StageChips
							defaultValue={["corte"]}
							disabled
							legend="Etapas (desativado)"
						/>
						<Field>
							<FieldLabel requirement="optional">Observações</FieldLabel>
							<Textarea defaultValue="Forro descosturado na lateral esquerda." />
							<FieldHint>Só você vê.</FieldHint>
						</Field>
						<Field invalid>
							<FieldLabel>Notas do cliente</FieldLabel>
							<Textarea aria-invalid defaultValue={"x".repeat(12)} />
							<FieldError match>Use até 2000 caracteres</FieldError>
						</Field>
						<Button size="touch">Receber e emitir comprovante</Button>
					</PanelContent>
				</Panel>
				<Panel>
					<PanelHeader>
						<PanelTitle>Ateliê novo</PanelTitle>
						<PanelMeta>4 de 5 passos</PanelMeta>
					</PanelHeader>
					<PanelContent>
						<Checklist>
							<ChecklistItem state="done" step={1}>
								Nome do ateliê
							</ChecklistItem>
							<ChecklistItem state="done" step={2}>
								Conta do dono e senha
							</ChecklistItem>
							<ChecklistItem state="done" step={3}>
								Códigos de recuperação guardados
							</ChecklistItem>
							<ChecklistItem state="current" step={4}>
								Pasta de backup testada
							</ChecklistItem>
							<ChecklistItem state="pending" step={5}>
								Checklist de continuidade
							</ChecklistItem>
						</Checklist>
					</PanelContent>
				</Panel>
				<Panel>
					<PanelHeader>
						<PanelTitle>Confirmações</PanelTitle>
						<PanelMeta>Desmarcada, marcada e desligada</PanelMeta>
					</PanelHeader>
					<PanelContent className="flex flex-col gap-1">
						<Checkbox>Guardei os códigos em lugar seguro</Checkbox>
						<Checkbox defaultChecked>Cliente autorizou o ajuste</Checkbox>
						<Checkbox disabled>Enviar comprovante por mensagem</Checkbox>
					</PanelContent>
				</Panel>
				<MaterialFieldsPanel />
			</div>
		</CatalogSection>
	);
}
