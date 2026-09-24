import { useEffect } from "react";

import { isSearchShortcut } from "@/lib/search";

const dialogs = '[role="dialog"], [role="alertdialog"]';

export function useSearchShortcut(onShortcut: (() => void) | null) {
	useEffect(() => {
		if (!onShortcut) {
			return;
		}
		const listener = (event: KeyboardEvent) => {
			if (!isSearchShortcut(event)) {
				return;
			}
			event.preventDefault();
			const insideDialog =
				event.target instanceof Element && event.target.closest(dialogs);
			if (!insideDialog) {
				onShortcut();
			}
		};
		window.addEventListener("keydown", listener);
		return () => window.removeEventListener("keydown", listener);
	}, [onShortcut]);
}
