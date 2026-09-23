import { Button } from "@costura-pro/ui/components/button";
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Skeleton } from "@costura-pro/ui/components/skeleton";
import { Text } from "@costura-pro/ui/components/typography";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { unitAbbreviation } from "@/lib/materials";
import type { VariantOptionView } from "@/lib/purchases";

import { variantSearchQuery } from "./material-queries";

export function VariantPicker({
	emptyHint,
	onPick,
}: {
	emptyHint: string;
	onPick: (variant: VariantOptionView) => void;
}) {
	const [query, setQuery] = useState("");
	const [search, setSearch] = useState("");
	useEffect(() => {
		const timer = setTimeout(() => setSearch(query.trim()), 300);
		return () => clearTimeout(timer);
	}, [query]);
	const options = useQuery(variantSearchQuery(search));
	const items = options.data?.items ?? [];

	return (
		<div className="flex flex-col gap-3">
			<Field>
				<FieldLabel>Buscar material</FieldLabel>
				<Input
					maxLength={100}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Material, variante ou código"
					type="search"
					value={query}
				/>
			</Field>
			{options.isPending ? <Skeleton className="h-10" /> : null}
			{options.isSuccess && items.length === 0 ? (
				<Text tone="subtle">{emptyHint}</Text>
			) : null}
			<div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
				{items.map((variant) => (
					<Button
						className="h-auto min-h-11 flex-col items-start justify-center gap-0.5 whitespace-normal py-2 text-left"
						key={variant.id}
						onClick={() => onPick(variant)}
						type="button"
						variant="ghost"
					>
						<Text inline weight="semibold">
							{`${variant.materialName} · ${variant.name}`}
						</Text>
						<Text inline size="sm" tone="subtle">
							{[
								variant.code,
								variant.packaging
									? `${variant.packaging.label}`
									: unitAbbreviation(variant.baseUnit),
								variant.tracksLots ? "por lote" : null,
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
