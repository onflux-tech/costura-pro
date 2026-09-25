import type { Database } from "@costura-pro/db";
import { productionFlow } from "@costura-pro/db/schema/production";
import { initialProductionStages } from "@costura-pro/domain/production";

import { readInstallation } from "../installation/store";
import { insertProductionFlow } from "./store";

export function ensureProductionFlow(db: Database, now: Date): void {
	db.transaction((tx) => {
		const existing = tx
			.select({ id: productionFlow.id })
			.from(productionFlow)
			.limit(1)
			.get();
		if (existing) {
			return;
		}
		insertProductionFlow(
			tx,
			crypto.randomUUID(),
			initialProductionStages.map((name) => ({
				active: true,
				id: crypto.randomUUID(),
				name,
			})),
			{ epoch: readInstallation(tx).epoch, now, opId: null }
		);
	});
}
