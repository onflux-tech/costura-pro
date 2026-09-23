import { Button } from "@costura-pro/ui/components/button";
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { moneyLabel } from "@/lib/finance";
import type { ServiceView } from "@/lib/services";

import { serviceOptionsQuery } from "./product-queries";

export function ServicePicker({
	onPick,
}: {
	onPick: (service: ServiceView) => void;
}) {
	const [query, setQuery] = useState("");
	const [search, setSearch] = useState("");
	useEffect(() => {
		const timer = setTimeout(() => setSearch(query.trim()), 300);
		return () => clearTimeout(timer);
	}, [query]);
	const options = useQuery(serviceOptionsQuery(search));
	const items = options.data?.items ?? [];

	return (
		<div className="flex flex-col gap-3">
			<Field>
				<FieldLabel>Buscar serviço</FieldLabel>
				<Input
					maxLength={100}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Nome ou categoria"
					type="search"
					value={query}
				/>
			</Field>
			{options.isPending ? <Skeleton className="h-10" /> : null}
			{options.isSuccess && items.length === 0 ? (
				<Text tone="subtle">
					Nenhum serviço encontrado. Cadastre o serviço em Catálogo antes de pôr
					na ficha.
				</Text>
			) : null}
			<div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
				{items.map((service) => (
					<Button
						className="h-auto min-h-11 flex-col items-start justify-center gap-0.5 whitespace-normal py-2 text-left"
						key={service.id}
						onClick={() => onPick(service)}
						type="button"
						variant="ghost"
					>
						<Text inline weight="semibold">
							{service.name}
						</Text>
						<Text inline size="sm" tone="subtle">
							{[
								service.category,
								`custo ${moneyLabel(service.costCents)}`,
								service.outsourced ? "terceirizado" : null,
							]
								.filter(Boolean)
								.join(" · ")}
						</Text>
					</Button>
				))}
			</div>
		</div>
	);
}
