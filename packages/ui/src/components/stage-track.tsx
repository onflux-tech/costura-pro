import { cn } from "@costura-pro/ui/lib/utils";

function StageTrack({
	className,
	current,
	label,
	stages,
}: {
	className?: string;
	current: number;
	label: string;
	stages: readonly { id: string; label: string }[];
}) {
	return (
		<div
			className={cn("flex flex-col gap-1.5", className)}
			data-slot="stage-track"
		>
			<ol
				aria-label={label}
				className="grid gap-1.5"
				style={{
					gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))`,
				}}
			>
				{stages.map((stage, index) => (
					<li
						aria-current={index === current ? "step" : undefined}
						className="flex min-w-0 flex-col gap-1.5"
						key={stage.id}
					>
						<span
							aria-hidden="true"
							className={cn(
								"h-1.5 rounded-full",
								index <= current ? "bg-secondary" : "bg-border"
							)}
						/>
						<span
							className={cn(
								"truncate text-xs max-md:sr-only",
								index === current
									? "font-semibold text-primary"
									: "text-muted-foreground"
							)}
						>
							{stage.label}
						</span>
					</li>
				))}
			</ol>
			<span
				aria-hidden="true"
				className="font-semibold text-primary text-xs md:hidden"
			>
				{stages[current]?.label}
			</span>
		</div>
	);
}

export { StageTrack };
