export const remoteLockThreshold = 5;
export const remoteLockBaseMs = 60_000;
export const remoteLockMaxMs = 1_800_000;

export function remoteLockDurationMs(failures: number): number | null {
	if (!Number.isInteger(failures) || failures < 0) {
		throw new RangeError("Contagem de falhas inválida");
	}
	if (failures === 0 || failures % remoteLockThreshold !== 0) {
		return null;
	}
	const doublings = failures / remoteLockThreshold - 1;
	return Math.min(remoteLockBaseMs * 2 ** doublings, remoteLockMaxMs);
}
