import { Meter as MeterPrimitive } from "@base-ui/react/meter";
import { cn } from "@costura-pro/ui/lib/utils";

function Meter({
	className,
	label,
	max,
	unit,
	value,
}: {
	className?: string;
	label: string;
	max: number;
	unit: string;
	value: number;
}) {
	const total = Math.max(value, max);
	const within = (Math.min(value, max) / total) * 100;
	const excess = 100 - within;
	return (
		<MeterPrimitive.Root
			aria-label={label}
			className={cn("w-full", className)}
			data-slot="meter"
			getAriaValueText={() =>
				value > max
					? `${value} de ${max} ${unit}, ${value - max} acima`
					: `${value} de ${max} ${unit}`
			}
			max={total}
			value={value}
		>
			<MeterPrimitive.Track className="flex h-2 overflow-hidden rounded-full bg-divider">
				<div className="h-full bg-secondary" style={{ width: `${within}%` }} />
				{value > max && (
					<div
						className="h-full border-card border-l-2 bg-danger"
						style={{ width: `${excess}%` }}
					/>
				)}
			</MeterPrimitive.Track>
		</MeterPrimitive.Root>
	);
}

export { Meter };
