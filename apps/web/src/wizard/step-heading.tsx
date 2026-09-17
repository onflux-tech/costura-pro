import { Heading, Text } from "@costura-pro/ui/components/typography";
import type * as React from "react";
import { useEffect, useRef } from "react";

export function StepHeading({
	children,
	description,
}: {
	children: React.ReactNode;
	description: React.ReactNode;
}) {
	const heading = useRef<HTMLHeadingElement>(null);

	useEffect(() => {
		heading.current?.focus();
	}, []);

	return (
		<div className="flex flex-col gap-1.5">
			<Heading
				className="rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid focus-visible:outline-offset-2"
				ref={heading}
				tabIndex={-1}
			>
				{children}
			</Heading>
			<Text tone="subtle">{description}</Text>
		</div>
	);
}
