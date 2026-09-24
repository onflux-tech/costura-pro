import {
	AlertDialog,
	AlertDialogActions,
	AlertDialogClose,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
} from "@costura-pro/ui/components/alert-dialog";
import { Button } from "@costura-pro/ui/components/button";

export function DiscardDraftDialog({
	onDiscard,
	onOpenChange,
	open,
}: {
	onDiscard: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<AlertDialog onOpenChange={onOpenChange} open={open}>
			<AlertDialogContent>
				<AlertDialogTitle>Descartar a contagem em andamento?</AlertDialogTitle>
				<AlertDialogDescription>
					Os números digitados neste aparelho serão apagados. O estoque não
					muda.
				</AlertDialogDescription>
				<AlertDialogActions>
					<AlertDialogClose render={<Button variant="outline" />}>
						Continuar contando
					</AlertDialogClose>
					<Button
						onClick={() => {
							onDiscard();
							onOpenChange(false);
						}}
						variant="destructive"
					>
						Descartar
					</Button>
				</AlertDialogActions>
			</AlertDialogContent>
		</AlertDialog>
	);
}
