import { Checklist, ChecklistItem } from "@costura-pro/ui/components/checklist";
import {
	Panel,
	PanelContent,
	PanelHeader,
	PanelMeta,
	PanelTitle,
} from "@costura-pro/ui/components/panel";
import { Heading, Text } from "@costura-pro/ui/components/typography";

const continuityItems = [
	"Logo",
	"Telefone",
	"Endereço",
	"Cores dos documentos",
	"Contas financeiras",
	"Saldos de abertura",
	"Materiais",
	"Serviços",
	"Produtos",
	"Tunnel",
] as const;

export function TodayPage() {
	return (
		<>
			<Heading className="max-md:sr-only">Hoje</Heading>
			<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
				<Panel>
					<PanelContent className="flex flex-col gap-2 p-6">
						<Heading level={2} size="section">
							Nada por aqui ainda
						</Heading>
						<Text tone="subtle">
							Atendimentos, prazos e alertas aparecem aqui quando as primeiras
							áreas chegarem.
						</Text>
					</PanelContent>
				</Panel>
				<Panel>
					<PanelHeader>
						<PanelTitle>Checklist de continuidade</PanelTitle>
						<PanelMeta>
							Cada item ganha sua tela nas próximas entregas.
						</PanelMeta>
					</PanelHeader>
					<PanelContent>
						<Checklist>
							{continuityItems.map((item, index) => (
								<ChecklistItem key={item} state="pending" step={index + 1}>
									{item}
								</ChecklistItem>
							))}
						</Checklist>
					</PanelContent>
				</Panel>
			</div>
		</>
	);
}
