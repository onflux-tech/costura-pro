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
