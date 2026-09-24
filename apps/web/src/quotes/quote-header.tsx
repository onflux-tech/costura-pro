import {
	Alert,
	AlertActions,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import {
	AlertDialog,
	AlertDialogActions,
	AlertDialogClose,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
} from "@costura-pro/ui/components/alert-dialog";
import { Badge } from "@costura-pro/ui/components/badge";
import { Button } from "@costura-pro/ui/components/button";
import { ButtonLink } from "@costura-pro/ui/components/button-link";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";

import { formatDay, localDay } from "@/lib/measurements";
import {
	latestRevisionOf,
	type QuoteDetailView,
	quoteStatusOf,
	sameContent,
	statusLabels,
	statusTone,
} from "@/lib/quotes";

function factsOf(detail: QuoteDetailView): string[] {
	const { quote, revisions } = detail;
	const latest = latestRevisionOf(revisions);
	const facts = [`Criado em ${formatDay(quote.createdOn)}`];
	if (latest) {
		facts.push(
			`rev. ${latest.number} emitida em ${formatDay(latest.emittedOn)} · válida até ${formatDay(latest.validUntil)}`
		);
	}
	if (quote.refusedOn) {
		facts.push(
			quote.refusalReason
				? `Recusado em ${formatDay(quote.refusedOn)} · ${quote.refusalReason}`
				: `Recusado em ${formatDay(quote.refusedOn)}`
		);
	}
	return facts;
}

function DiscardDialog({
	number,
	onConfirm,
	onOpenChange,
	open,
}: {
	number: number;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<AlertDialog onOpenChange={onOpenChange} open={open}>
			<AlertDialogContent>
				<AlertDialogTitle>Descartar as alterações?</AlertDialogTitle>
				<AlertDialogDescription>
					{`O rascunho volta a ser igual à revisão ${number} emitida. O que mudou depois dela se perde.`}
				</AlertDialogDescription>
				<AlertDialogActions>
					<AlertDialogClose render={<Button variant="outline" />}>
						Cancelar
					</AlertDialogClose>
					<Button
						onClick={() => {
							onOpenChange(false);
							onConfirm();
						}}
						variant="destructive"
					>
						Descartar alterações
					</Button>
				</AlertDialogActions>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export function QuoteHeader({
	actions,
	busy,
	detail,
	editable,
	onDiscard,
}: {
	actions?: ReactNode;
	busy: boolean;
	detail: QuoteDetailView;
	editable: boolean;
	onDiscard: () => void;
}) {
	const [discarding, setDiscarding] = useState(false);
	const { client, quote, revisions } = detail;
	const status = quoteStatusOf(
		quote,
		revisions,
		localDay(new Date()),
		detail.approval !== null
	);
	const latest = latestRevisionOf(revisions);
	const changed = latest !== undefined && !sameContent(quote, latest);
	return (
		<Panel>
			<PanelContent className="flex flex-col gap-3">
				<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div className="flex min-w-0 flex-col gap-1.5">
						<Heading className="font-mono max-md:text-xl">{quote.code}</Heading>
						<div className="flex flex-wrap gap-1.5">
							<Badge tone={statusTone(status)}>{statusLabels[status]}</Badge>
							{quote.archivedAt ? (
								<Badge tone="warning">arquivado</Badge>
							) : null}
							{client.anonymized ? (
								<Badge tone="danger">cliente anonimizado</Badge>
							) : null}
						</div>
						<div className="flex flex-wrap items-center gap-x-2">
							<Text inline tone="subtle">
								Cliente
							</Text>
							<ButtonLink
								className="h-auto min-h-11 px-0 md:min-h-0"
								render={
									<Link
										params={{ clienteId: client.id }}
										to="/atendimento/clientes/$clienteId"
									/>
								}
								variant="link"
							>
								{client.name}
							</ButtonLink>
						</div>
						<Text size="xs" tone="subtle">
							{factsOf(detail).join(" · ")}
						</Text>
					</div>
					{actions}
				</div>
				{latest && editable ? (
					<Text size="xs" tone="subtle">
						{`Editar aqui prepara a revisão ${latest.number + 1}; a revisão ${latest.number} emitida não muda.`}
					</Text>
				) : null}
				{changed && latest ? (
					<Alert tone="warning">
						<AlertTitle>Alterações não emitidas</AlertTitle>
						<AlertDescription>
							{`O rascunho está diferente da revisão ${latest.number}. O cliente só vê o que for emitido.`}
						</AlertDescription>
						{editable ? (
							<AlertActions>
								<Button
									disabled={busy}
									onClick={() => setDiscarding(true)}
									variant="outline"
								>
									Descartar alterações
								</Button>
							</AlertActions>
						) : null}
					</Alert>
				) : null}
			</PanelContent>
			{latest ? (
				<DiscardDialog
					number={latest.number}
					onConfirm={onDiscard}
					onOpenChange={setDiscarding}
					open={discarding}
				/>
			) : null}
		</Panel>
	);
}
