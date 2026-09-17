import { Button } from "@costura-pro/ui/components/button";
import type * as React from "react";
import { useRef } from "react";

function FilePickerButton({
	accept,
	capture,
	disabled,
	multiple,
	onFiles,
	...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "type"> & {
	accept: string;
	capture?: "environment" | "user";
	multiple?: boolean;
	onFiles: (files: File[]) => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	return (
		<>
			<input
				accept={accept}
				aria-hidden="true"
				capture={capture}
				className="sr-only"
				data-slot="file-picker-input"
				disabled={disabled}
				multiple={multiple}
				onChange={(event) => {
					const files = Array.from(event.currentTarget.files ?? []);
					event.currentTarget.value = "";
					if (files.length > 0) {
						onFiles(files);
					}
				}}
				ref={input}
				tabIndex={-1}
				type="file"
			/>
			<Button
				disabled={disabled}
				onClick={() => input.current?.click()}
				type="button"
				{...props}
			/>
		</>
	);
}

export { FilePickerButton };
