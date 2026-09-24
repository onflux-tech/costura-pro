export interface ReservationPlan {
	reservedMicros: bigint;
	shortageMicros: bigint;
}

/** Plans a reservation without mutating or inventing physical stock. */
export function planReservation(
	physicalMicros: bigint,
	alreadyReservedMicros: bigint,
	neededMicros: bigint
): ReservationPlan {
	if (alreadyReservedMicros < 0n || neededMicros < 0n) {
		throw new RangeError("Reserva inválida");
	}

	const availableMicros = physicalMicros - alreadyReservedMicros;
	let reservedMicros = 0n;
	if (availableMicros > 0n) {
		reservedMicros =
			availableMicros < neededMicros ? availableMicros : neededMicros;
	}

	return {
		reservedMicros,
		shortageMicros: neededMicros - reservedMicros,
	};
}

export type ReservationNeed = {
	key: string;
	quantityMicros: bigint;
	variantId: string;
};

export function planReservations<T extends ReservationNeed>(
	needs: readonly T[],
	physicalByVariant: ReadonlyMap<string, bigint>,
	reservedByVariant: ReadonlyMap<string, bigint>
): (T & ReservationPlan)[] {
	const reserved = new Map(reservedByVariant);
	return needs.map((need) => {
		const already = reserved.get(need.variantId) ?? 0n;
		const plan = planReservation(
			physicalByVariant.get(need.variantId) ?? 0n,
			already,
			need.quantityMicros
		);
		reserved.set(need.variantId, already + plan.reservedMicros);
		return { ...need, ...plan };
	});
}
