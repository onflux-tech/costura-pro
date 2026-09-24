import { cn } from "@costura-pro/ui/lib/utils";
import type * as React from "react";
import { Fragment } from "react";

type Segment = { key: number; marked: boolean; value: string };

function segmentsOf(
	text: string,
	ranges: readonly (readonly [number, number])[]
): Segment[] {
	const segments: Segment[] = [];
	let cursor = 0;
	for (const [start, end] of ranges) {
		if (start > cursor) {
			segments.push({
				key: cursor,
				marked: false,
				value: text.slice(cursor, start),
			});
		}
		segments.push({ key: start, marked: true, value: text.slice(start, end) });
		cursor = end;
	}
	if (cursor < text.length) {
		segments.push({ key: cursor, marked: false, value: text.slice(cursor) });
	}
	return segments;
}

function Highlight({
	className,
	ranges,
	text,
	...props
}: Omit<React.ComponentProps<"span">, "children"> & {
	ranges: readonly (readonly [number, number])[];
	text: string;
}) {
	return (
		<span className={cn(className)} data-slot="highlight" {...props}>
			{segmentsOf(text, ranges).map((segment) =>
				segment.marked ? (
					<mark
						className="rounded-sm bg-accent px-px text-inherit"
						key={segment.key}
					>
						{segment.value}
					</mark>
				) : (
					<Fragment key={segment.key}>{segment.value}</Fragment>
				)
			)}
		</span>
	);
}

export { Highlight };
