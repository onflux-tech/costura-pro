export const baseUnitCodes = [
	"m",
	"cm",
	"m2",
	"un",
	"par",
	"g",
	"kg",
	"ml",
	"l",
] as const;

export type BaseUnitCode = (typeof baseUnitCodes)[number];

export type BaseUnit = {
	abbreviation: string;
	code: BaseUnitCode;
	defaultPrecision: number;
	label: string;
};

const unitDetails: Record<BaseUnitCode, Omit<BaseUnit, "code">> = {
	cm: { abbreviation: "cm", defaultPrecision: 1, label: "Centímetro" },
	g: { abbreviation: "g", defaultPrecision: 0, label: "Grama" },
	kg: { abbreviation: "kg", defaultPrecision: 3, label: "Quilograma" },
	l: { abbreviation: "L", defaultPrecision: 3, label: "Litro" },
	m: { abbreviation: "m", defaultPrecision: 2, label: "Metro" },
	m2: { abbreviation: "m²", defaultPrecision: 2, label: "Metro quadrado" },
	ml: { abbreviation: "mL", defaultPrecision: 0, label: "Mililitro" },
	par: { abbreviation: "par", defaultPrecision: 0, label: "Par" },
	un: { abbreviation: "un", defaultPrecision: 0, label: "Unidade" },
};

export const baseUnits: readonly BaseUnit[] = baseUnitCodes.map((code) => ({
	code,
	...unitDetails[code],
}));

export function baseUnitByCode(code: string): BaseUnit | undefined {
	return baseUnits.find((unit) => unit.code === code);
}
