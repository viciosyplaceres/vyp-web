/** Tipos compartidos por las piezas del chat. */

export type Mensaje = {
  id: string;
  texto: string;
  created_at: string;
  autor_id: string;
  autor: string | null;
  avatarUrl: string | null;
  respuestaA: string | null;
  respuestaTexto: string | null;
  respuestaAutor: string | null;
  editadoAt: string | null;
  borrado: boolean;
};

export type InfoAutor = { nombre: string | null; avatarUrl: string | null };

export type Reaccion = { emoji: string; perfilId: string; nombre: string | null };

/** Los seis de reacción rápida, al tocar un mensaje. */
export const EMOJIS_RAPIDOS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** Los del teclado de emojis de la barra de escritura. */
export const EMOJIS_PICKER = [
  "😀", "😂", "😍", "🥳", "😎", "😢", "😮", "😡", "👍", "👎",
  "🙏", "👏", "🎉", "🔥", "❤️", "💯", "🤝", "🍻", "⚽", "🎶",
  "😅", "🤔", "😴", "🥴", "😇", "🫡", "✅", "❌", "⏰", "📌",
];
