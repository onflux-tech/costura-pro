import z from "zod";

export const optionalUuidSearch = z.uuid().optional().catch(undefined);

export function isUuid(value: string): boolean {
	return z.uuid().safeParse(value).success;
}
