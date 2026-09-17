import {
	AlertDialog,
	AlertDialogActions,
	AlertDialogClose,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@costura-pro/ui/components/alert-dialog";
import { Button } from "@costura-pro/ui/components/button";
import { Checkbox } from "@costura-pro/ui/components/checkbox";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@costura-pro/ui/components/dialog";
import { Field, FieldLabel } from "@costura-pro/ui/components/field";
import { Input } from "@costura-pro/ui/components/input";
import { Monogram } from "@costura-pro/ui/components/monogram";
import { Textarea } from "@costura-pro/ui/components/textarea";
import { useState } from "react";

export function DialogSamples() {
	const [understood, setUnderstood] = useState(false);
	return (
		<div className="flex flex-wrap items-center gap-3">
			<Monogram initials="MB" />
			<Monogram initials="HA" size="sm" />
			<Dialog>
				<DialogTrigger render={<Button variant="dashed" />}>
					Adicionar perfil
				</DialogTrigger>
				<DialogContent>
					<DialogTitle>Adicionar perfil</DialogTitle>
					<DialogDescription>
						Nome e observações de quem veste a peça.
					</DialogDescription>
					<Field>
						<FieldLabel requirement="required">Nome</FieldLabel>
						<Input defaultValue="Helena Alencar" />
					</Field>
					<Field>
						<FieldLabel requirement="optional">Notas</FieldLabel>
						<Textarea defaultValue="Infantil, 8 anos." />
					</Field>
					<DialogActions>
						<DialogClose render={<Button variant="outline" />}>
							Cancelar
						</DialogClose>
						<DialogClose render={<Button />}>Salvar perfil</DialogClose>
					</DialogActions>
				</DialogContent>
			</Dialog>
			<AlertDialog>
				<AlertDialogTrigger render={<Button variant="destructive" />}>
					Anonimizar
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogTitle>Anonimizar Maria Beatriz Alencar?</AlertDialogTitle>
					<AlertDialogDescription>
						Nome, telefones, e-mail, endereço, notas e nomes dos perfis serão
						apagados de todos os registros. Não dá para desfazer.
					</AlertDialogDescription>
					<Checkbox
						checked={understood}
						onCheckedChange={(checked) => setUnderstood(checked)}
					>
						Entendo que não dá para desfazer
					</Checkbox>
					<AlertDialogActions>
						<AlertDialogClose render={<Button variant="outline" />}>
							Cancelar
						</AlertDialogClose>
						<AlertDialogClose
							disabled={!understood}
							render={<Button variant="destructive" />}
						>
							Anonimizar
						</AlertDialogClose>
					</AlertDialogActions>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
