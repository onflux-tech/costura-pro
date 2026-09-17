import { afterEach, describe, expect, test } from "bun:test";
import { maxExactInteger } from "@costura-pro/domain/quantity";

import {
	inSequence,
	newOpId,
	type SyncSetup,
	syncSetup,
	type TestServer,
} from "./support";

const servers: TestServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

type OperationInput = {
	aggregateId: string;
	aggregateType: string;
	baseVersion: number | null;
	command: string;
	payload: unknown;
};

function envelope(setup: SyncSetup, input: OperationInput) {
	return {
		...input,
		deviceId: setup.device.id,
		epoch: setup.epoch,
		occurredAt: "2026-09-17T12:00:00.000Z",
		opId: newOpId(),
	};
}

function hash(seed: string) {
	return seed.repeat(64).slice(0, 64);
}

function createMaterial(
	setup: SyncSetup,
	payload: unknown,
	id = crypto.randomUUID()
) {
	return envelope(setup, {
		aggregateId: id,
		aggregateType: "material",
		baseVersion: null,
		command: "material.create",
		payload,
	});
}

function createVariant(
	setup: SyncSetup,
	payload: unknown,
	id = crypto.randomUUID()
) {
	return envelope(setup, {
		aggregateId: id,
		aggregateType: "materialVariant",
		baseVersion: null,
		command: "materialVariant.create",
		payload,
	});
}

function updateVariant(
	setup: SyncSetup,
	id: string,
	baseVersion: number,
	payload: unknown
) {
	return envelope(setup, {
		aggregateId: id,
		aggregateType: "materialVariant",
		baseVersion,
		command: "materialVariant.update",
		payload,
	});
}

function variantPayload(
	materialId: string,
	overrides: Record<string, unknown> = {}
) {
	return {
		baseUnit: "m",
		code: "GR-AZ",
		displayPrecision: 2,
		materialId,
		minQuantityMicros: "1500000",
		name: "Azul marinho",
		packaging: { label: "Rolo", quantityMicros: "50000000" },
		photo: { photoHash: hash("a"), thumbnailHash: hash("b") },
		referenceCostCents: "1250",
		...overrides,
	};
}

function opHash(server: TestServer, opId: string) {
	return server
		.native()
		.query<{ op_hash: string }, [string]>(
			"SELECT op_hash FROM operation WHERE op_id = ?"
		)
		.get(opId)?.op_hash;
}

async function pushedMaterial(setup: SyncSetup) {
	const materialId = crypto.randomUUID();
	await setup.sync.sync.push({
		operations: [
			createMaterial(
				setup,
				{ category: "Tecido", name: "Gorgurão" },
				materialId
			),
		],
	});
	return materialId;
}

describe("materials over sync", () => {
	test("creates and updates by push and pulls the snapshot with integer strings", async () => {
		const setup = await syncSetup(servers);
		const materialId = await pushedMaterial(setup);
		const variantId = crypto.randomUUID();
		const created = createVariant(setup, variantPayload(materialId), variantId);
		const updated = updateVariant(setup, variantId, 1, {
			referenceCostCents: "990",
			targetQuantityMicros: "20000000",
		});
		const result = await setup.sync.sync.push({
			operations: [created, updated],
		});
		expect(result.accepted).toEqual([
			{ newVersion: 1, opId: created.opId },
			{ newVersion: 2, opId: updated.opId },
		]);
		const pulled = await setup.sync.sync.pull({
			cursor: "0",
			epoch: setup.epoch,
			limit: 500,
		});
		expect(
			pulled.changes
				.filter((change) => change.aggregateType === "material")
				.map((change) => change.data)
		).toMatchObject([{ category: "Tecido", name: "Gorgurão", version: 1 }]);
		const variants = pulled.changes.filter(
			(change) => change.aggregateType === "materialVariant"
		);
		expect(variants.map((change) => change.version)).toEqual([1, 2]);
		expect(variants[1]?.data).toMatchObject({
			baseUnit: "m",
			code: "GR-AZ",
			displayPrecision: 2,
			materialId,
			minQuantityMicros: "1500000",
			packaging: { label: "Rolo", quantityMicros: "50000000" },
			photo: { photoHash: hash("a"), thumbnailHash: hash("b") },
			referenceCostCents: "990",
			targetQuantityMicros: "20000000",
		});
		expect(opHash(setup.server, created.opId)).not.toBe("redacted");
	});

	test("quarantines a missing material, invalid values, a repeated id and a base unit change", async () => {
		const setup = await syncSetup(servers);
		const materialId = await pushedMaterial(setup);
		const variantId = crypto.randomUUID();
		await setup.sync.sync.push({
			operations: [createVariant(setup, variantPayload(materialId), variantId)],
		});
		const orphan = createVariant(setup, variantPayload(crypto.randomUUID()));
		const unknownUnit = createVariant(
			setup,
			variantPayload(materialId, { baseUnit: "rolo" })
		);
		const deepPrecision = createVariant(
			setup,
			variantPayload(materialId, { displayPrecision: 7 })
		);
		const hugeCost = createVariant(
			setup,
			variantPayload(materialId, {
				referenceCostCents: (maxExactInteger + 1n).toString(),
			})
		);
		const halfPackaging = createVariant(
			setup,
			variantPayload(materialId, { packaging: { label: "Rolo" } })
		);
		const repeated = createVariant(
			setup,
			variantPayload(materialId),
			variantId
		);
		const unitChange = updateVariant(setup, variantId, 1, {
			baseUnit: "cm",
		});
		const result = await setup.sync.sync.push({
			operations: [
				orphan,
				unknownUnit,
				deepPrecision,
				hugeCost,
				halfPackaging,
				repeated,
				unitChange,
			],
		});
		expect(result.quarantined).toEqual([
			{ opId: orphan.opId, reason: "aggregateNotFound" },
			{ opId: unknownUnit.opId, reason: "invalidPayload" },
			{ opId: deepPrecision.opId, reason: "invalidPayload" },
			{ opId: hugeCost.opId, reason: "invalidPayload" },
			{ opId: halfPackaging.opId, reason: "invalidPayload" },
			{ opId: repeated.opId, reason: "aggregateExists" },
			{ opId: unitChange.opId, reason: "invalidPayload" },
		]);
		expect(opHash(setup.server, orphan.opId)).not.toBe("redacted");
	});

	test("opens a conflict with integer strings and resolves it by keepLocal", async () => {
		const setup = await syncSetup(servers);
		const materialId = await pushedMaterial(setup);
		const variantId = crypto.randomUUID();
		await setup.sync.sync.push({
			operations: [createVariant(setup, variantPayload(materialId), variantId)],
		});
		await setup.local.materialVariants.update({
			baseVersion: 1,
			opId: newOpId(),
			patch: { name: "Azul royal" },
			variantId,
		});
		const stale = updateVariant(setup, variantId, 1, {
			minQuantityMicros: null,
			referenceCostCents: "1500",
		});
		const pushed = await setup.sync.sync.push({ operations: [stale] });
		expect(pushed.conflicts).toHaveLength(1);
		expect(
			setup.server
				.native()
				.query<{ local_values: string }, []>(
					"SELECT local_values FROM sync_conflict WHERE aggregate_type = 'materialVariant'"
				)
				.all()
				.map((row) => JSON.parse(row.local_values))
		).toEqual([{ minQuantityMicros: null, referenceCostCents: "1500" }]);
		await inSequence(pushed.conflicts, (conflict) =>
			setup.sync.sync.resolve({
				choice: "keepLocal",
				conflictId: conflict.conflictId,
				opId: newOpId(),
				reason: "Vale o custo do celular",
			})
		);
		const { variants } = await setup.local.materials.get({ materialId });
		expect(variants[0]).toMatchObject({
			minQuantityMicros: null,
			name: "Azul royal",
			referenceCostCents: "1500",
			version: 3,
		});
	});
});
