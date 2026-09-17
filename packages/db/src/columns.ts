import { customType } from "drizzle-orm/sqlite-core";

export const maxExactInteger = 9_007_199_254_740_991n;

export const bigintInteger = customType<{
	data: bigint;
	driverData: number;
}>({
	dataType: () => "integer",
	fromDriver: (value) => BigInt(value),
	toDriver: (value) => {
		if (value > maxExactInteger || value < -maxExactInteger) {
			throw new RangeError("Valor inteiro fora da faixa exata");
		}
		return Number(value);
	},
});
