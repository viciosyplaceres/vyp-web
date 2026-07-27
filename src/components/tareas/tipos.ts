import type { MiembroSimple } from "../SelectorMiembros";

export type TareaListada = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string | null;
  hecha: boolean;
  documento_url: string | null;
  documento_nombre: string | null;
  asignados: MiembroSimple[];
};
