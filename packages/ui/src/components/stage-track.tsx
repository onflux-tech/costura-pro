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
		<ol
			aria-label={label}
			className={cn("grid gap-1.5", className)}
			data-slot="stage-track"
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
							"truncate text-xs",
							index === current
								? "font-semibold text-primary"
								: "text-muted-foreground max-md:sr-only"
						)}
					>
						{stage.label}
					</span>
				</li>
			))}
		</ol>
	);
}

export { StageTrack };
