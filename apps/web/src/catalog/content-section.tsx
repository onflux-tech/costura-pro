import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { CodeTag } from "@costura-pro/ui/components/code-tag";
import { Mono } from "@costura-pro/ui/components/typography";
import { PlusIcon } from "lucide-react";

import { CatalogSection } from "./catalog-section";

export function ContentSection() {
	return (
		<CatalogSection heading="Ações e avisos" id="acoes">
			<div className="flex flex-wrap items-center gap-2">
				<Button>Novo atendimento</Button>
				<Button variant="outline">Novo orçamento</Button>
				<Button size="sm" variant="outline">
					Abrir OS
				</Button>
				<Button variant="dashed">
					<PlusIcon aria-hidden="true" />
					Serviço
				</Button>
				<Button variant="destructive">Cancelar venda</Button>
				<Button variant="link">Ver comprovante</Button>
				<Button disabled>Emitir orçamento A4</Button>
			</div>
			<div className="grid gap-2 md:max-w-sm">
				<Button size="touch">Receber e emitir comprovante</Button>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Badge tone="danger">Prazo vencido</Badge>
				<Badge tone="warning">Reconciliação pendente</Badge>
				<Badge tone="success">Entregue 12/09</Badge>
				<Badge>Entrega pendente</Badge>
				<CodeTag>OS-2026-PC-0031</CodeTag>
				<Mono size="2xs" tone="muted">
					CST-4471 · recebido 02/09
				</Mono>
			</div>
			<div className="grid gap-3 md:grid-cols-2">
				<Alert tone="danger">
					<AlertTitle>Backup de ontem falhou</AlertTitle>
					<AlertDescription>
						A pasta <Mono>E:\Backups\CosturaPro</Mono> não foi encontrada às
						02:00. A última cópia válida é de 14/09. Nenhuma cópia foi apagada.
					</AlertDescription>
					<AlertActions>
						<Button size="sm">Escolher pasta</Button>
						<Button size="sm" variant="outline">
							Rodar agora
						</Button>
					</AlertActions>
				</Alert>
				<Alert tone="warning">
					<AlertTitle>Snapshot de medidas congelado</AlertTitle>
					<AlertDescription>
						Editar o perfil não muda a <Mono>OS-2026-PC-0031</Mono>. Para valer
						na produção, abra revisão da OS.
					</AlertDescription>
				</Alert>
				<Alert tone="success">
					<AlertTitle>Excedente a reembolsar</AlertTitle>
					<AlertDescription>
						R$ 40,00 recebidos acima do devido, nunca aplicados a outra
						cobrança.
					</AlertDescription>
				</Alert>
			</div>
		</CatalogSection>
	);
}
