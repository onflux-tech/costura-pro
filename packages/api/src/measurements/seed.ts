import type { Database } from "@costura-pro/db";
import { measurementTemplate } from "@costura-pro/db/schema/measurements";
import { initialMeasurementTemplates } from "@costura-pro/domain/measurement";

import { readInstallation } from "../installation/store";
import { insertTemplate } from "./store";

export function ensureMeasurementTemplates(db: Database, now: Date): void {
	db.transaction((tx) => {
		const existing = tx
			.select({ id: measurementTemplate.id })
			.from(measurementTemplate)
			.limit(1)
			.get();
		if (existing) {
			return;
		}
		const stamp = { epoch: readInstallation(tx).epoch, now, opId: null };
		for (const template of initialMeasurementTemplates) {
			insertTemplate(
				tx,
				crypto.randomUUID(),
				{
					fields: template.fields.map((label) => ({
						active: true,
						id: crypto.randomUUID(),
						label,
					})),
					name: template.name,
				},
				stamp
			);
		}
	});
}
