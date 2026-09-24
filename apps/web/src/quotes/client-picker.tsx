import { formatPhone } from "@costura-pro/domain/client";
import { Button } from "@costura-pro/ui/components/button";
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { clientCommandFailure } from "@/lib/client-command-error";

import { clientOptionsQuery } from "./quote-queries";

export function ClientPicker({
	onPick,
}: {
	onPick: (clientId: string) => void;
}) {
	const [query, setQuery] = useState("");
	const [search, setSearch] = useState("");
	useEffect(() => {
		const timer = setTimeout(() => setSearch(query.trim()), 300);
		return () => clearTimeout(timer);
	}, [query]);
	const options = useQuery(clientOptionsQuery(search));
	const items = (options.data?.items ?? []).filter(
		(client) => client.anonymizedAt === null
	);

	return (
		<div className="flex flex-col gap-3">
			<Field>
				<FieldLabel>Buscar cliente</FieldLabel>
				<Input
					maxLength={100}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Nome, telefone ou e-mail"
					type="search"
					value={query}
				/>
			</Field>
			{options.isPending ? <Skeleton className="h-10" /> : null}
			{options.isError ? (
				<Text tone="danger">
					{clientCommandFailure(options.error, "cliente").message}
				</Text>
			) : null}
			{options.isSuccess && items.length === 0 ? (
				<Text tone="subtle">
					Nenhum cliente encontrado. Cadastre o cliente em Atendimento.
				</Text>
			) : null}
			<div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
				{items.map((client) => (
					<Button
						className="h-auto min-h-11 flex-col items-start justify-center gap-0.5 whitespace-normal py-2 text-left"
						key={client.id}
						onClick={() => onPick(client.id)}
						type="button"
						variant="ghost"
					>
						<Text inline weight="semibold">
							{client.name}
						</Text>
						<Text inline size="xs" tone="subtle">
							{client.phone ? formatPhone(client.phone) : "Sem telefone"}
						</Text>
					</Button>
				))}
			</div>
		</div>
	);
}
