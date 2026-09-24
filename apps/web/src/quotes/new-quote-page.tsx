import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@costura-pro/ui/components/alert";
import { Button } from "@costura-pro/ui/components/button";
import { Panel, PanelContent } from "@costura-pro/ui/components/panel";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Heading, Text } from "@costura-pro/ui/components/typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { clientDetailQuery } from "@/atendimento/client-queries";
import {
	type ClientCommandFailure,
	clientCommandFailure,
} from "@/lib/client-command-error";
import { useDrafts } from "@/lib/drafts";
import { localDay } from "@/lib/measurements";
import { createQuoteFields } from "@/lib/quote-drafts";
import { usePageHeader } from "@/shell/page-header";
import { client as api } from "@/utils/orpc";

import { ClientPicker } from "./client-picker";
import { failedQuoteCommand, refreshQuotes } from "./quote-queries";

function ChosenClient({
	clientId,
	onChange,
}: {
	clientId: string;
	onChange: () => void;
}) {
	const detail = useQuery(clientDetailQuery(clientId));
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex min-w-0 flex-col gap-0.5">
				<Text size="xs" tone="subtle">
					Cliente
				</Text>
				{detail.isPending ? <Skeleton className="h-6 w-48" /> : null}
				{detail.isError ? (
					<Text tone="danger">
						{clientCommandFailure(detail.error, "cliente").message}
					</Text>
				) : null}
				{detail.data ? (
					<Text weight="semibold">{detail.data.client.name}</Text>
				) : null}
			</div>
			<Button onClick={onChange} variant="outline">
				Trocar cliente
			</Button>
		</div>
	);
}

export function NewQuotePage({ clientId }: { clientId: string | undefined }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { draftFor, forget } = useDrafts();
	const [failure, setFailure] = useState<ClientCommandFailure | null>(null);
	const [pending, setPending] = useState(false);
	const failureRef = useRef<HTMLDivElement>(null);
	usePageHeader({
		backHref: "/orcamentos/rascunhos",
		eyebrow: "Orçamentos",
		heading: "Novo orçamento",
	});

	useEffect(() => {
		if (failure) {
			failureRef.current?.focus();
		}
	}, [failure]);

	const choose = (cliente: string | undefined) => {
		setFailure(null);
		navigate({ search: { cliente }, to: "/orcamentos/rascunhos/novo" });
	};

	const create = async (chosen: string) => {
		setFailure(null);
		setPending(true);
		const draft = draftFor(chosen);
		const quoteId = draft.movementId;
		const createdOn = localDay(new Date());
		let existed = false;
		try {
			await api.quotes.create({
				...createQuoteFields(chosen, createdOn),
				opId: draft.opIdFor(`${quoteId}:${chosen}:${createdOn}`),
				quoteId,
			});
		} catch (error) {
			const failed = await failedQuoteCommand(queryClient, error);
			if (failed.kind !== "exists") {
				setFailure(failed);
				setPending(false);
				return;
			}
			existed = true;
		}
		forget(chosen);
		await refreshQuotes(queryClient);
		if (existed) {
			toast.info("Este orçamento já tinha sido criado.");
		} else {
			toast.success("Orçamento criado");
		}
		await navigate({
			params: { orcamentoId: quoteId },
			replace: true,
			to: "/orcamentos/$orcamentoId",
		});
	};

	return (
		<div className="flex flex-col gap-4">
			<Heading className="max-md:sr-only">Novo orçamento</Heading>
			<Panel>
				<PanelContent className="flex flex-col gap-4">
					{clientId ? (
						<ChosenClient
							clientId={clientId}
							onChange={() => choose(undefined)}
						/>
					) : (
						<ClientPicker onPick={choose} />
					)}
				</PanelContent>
			</Panel>
			{failure ? (
				<Alert
					ref={failureRef}
					role="alert"
					tabIndex={-1}
					tone={failure.kind === "anonymized" ? "warning" : "danger"}
				>
					<AlertTitle>Não foi possível criar o orçamento</AlertTitle>
					<AlertDescription>{failure.message}</AlertDescription>
				</Alert>
			) : null}
			{clientId ? (
				<Button
					className="self-start max-md:w-full"
					disabled={pending}
					onClick={() => create(clientId)}
				>
					Criar orçamento
				</Button>
			) : null}
		</div>
	);
}
