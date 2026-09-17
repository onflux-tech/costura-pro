import { Button } from "@costura-pro/ui/components/button";
import { Checkbox } from "@costura-pro/ui/components/checkbox";
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
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";

import { CatalogSection } from "./catalog-section";

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
			</div>
		</CatalogSection>
	);
}
