import { Heading, Text } from "@costura-pro/ui/components/typography";
import type * as React from "react";

export function StepHeading({
	children,
	description,
}: {
	children: React.ReactNode;
	description: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Heading>{children}</Heading>
			<Text tone="subtle">{description}</Text>
		</div>
	);
}
