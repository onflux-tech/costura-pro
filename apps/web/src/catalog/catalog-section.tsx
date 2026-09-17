import { Heading } from "@costura-pro/ui/components/typography";
import type * as React from "react";

export function CatalogSection({
	children,
	id,
	heading,
}: {
	children: React.ReactNode;
	id: string;
	heading: string;
}) {
	return (
		<section aria-labelledby={id} className="flex flex-col gap-4">
			<Heading id={id} level={2} size="section">
				{heading}
			</Heading>
			{children}
		</section>
	);
}
