import Link from "next/link";
import { Shirt, Wallet, Coins, ArrowRight } from "lucide-react";
import Avatar from "./Avatar";

export type DeudaResumen = {
  id: string;
  cantidad: number;
  descripcion: string | null;
  pagada: boolean;
  /** La otra parte de la deuda; `null` significa la peña entera (VYP). */
  otro: { nombre: string | null; avatarUrl: string | null } | null;
  /** true si el dinero lo debo yo, false si me lo deben. */
  loDeboYo: boolean;
};

/**
 * Lo que le toca a cada uno de la parte "administrativa" de la peña: talla de
 * camiseta, si está al día con la cuota y las deudas en las que aparece.
 *
 * Es solo lectura a propósito. Marcar un pago es de la directiva y apuntar
 * deudas también; aquí se enseña para no tener que ir preguntando.
 */
export default function MiResumenPena({
  anio,
  tallas,
  pagado,
  deudas,
}: {
  anio: number;
  tallas: string[];
  pagado: boolean;
  deudas: DeudaResumen[];
}) {
  const debo = deudas.filter((d) => !d.pagada && d.loDeboYo);
  const meDeben = deudas.filter((d) => !d.pagada && !d.loDeboYo);

  const suma = (lista: DeudaResumen[]) =>
    lista.reduce((s, d) => s + Number(d.cantidad), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">Mi ficha de {anio}</h2>
        <Link
          href="/admin"
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-sm text-white/50 transition-colors duration-200 hover:text-white"
        >
          Gestión
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {/* Camisetas y tallas */}
        <div className="rounded-lg border border-white/10 px-4 py-3">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
            <Shirt size={14} aria-hidden="true" />
            Camisetas
          </p>
          {tallas.length === 0 ? (
            <p className="mt-1.5 text-sm text-white/50">
              No has pedido ninguna.
            </p>
          ) : (
            <p className="mt-1.5 text-sm">
              <span className="font-semibold tabular-nums">{tallas.length}</span>{" "}
              {tallas.length === 1 ? "camiseta" : "camisetas"} ·{" "}
              <span className="text-white/70">{tallas.join(", ")}</span>
            </p>
          )}
        </div>

        {/* Cuota */}
        <div className="rounded-lg border border-white/10 px-4 py-3">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
            <Wallet size={14} aria-hidden="true" />
            Cuota
          </p>
          <p className="mt-1.5 text-sm">
            {pagado ? (
              <span className="font-medium text-white">Pagada</span>
            ) : (
              <span className="text-white/60">Pendiente de pagar</span>
            )}
          </p>
        </div>
      </div>

      {/* Deudas */}
      <div>
        <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
          <Coins size={14} aria-hidden="true" />
          Deudas
        </p>

        {debo.length === 0 && meDeben.length === 0 ? (
          <p className="mt-2 text-sm text-white/50">
            No debes nada ni te deben nada. Todo en paz.
          </p>
        ) : (
          <div className="mt-2 space-y-4">
            {debo.length > 0 && (
              <div>
                <p className="text-sm text-white/70">
                  Debes{" "}
                  <span className="font-semibold tabular-nums">
                    {suma(debo).toFixed(2)} €
                  </span>
                </p>
                <ul className="mt-2 space-y-1.5">
                  {debo.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm"
                    >
                      <Avatar
                        nombre={d.otro?.nombre ?? "VYP"}
                        avatarUrl={d.otro?.avatarUrl}
                        tamano={24}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        a {d.otro?.nombre ?? "VYP"}
                        {d.descripcion && (
                          <span className="text-white/50"> · {d.descripcion}</span>
                        )}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {Number(d.cantidad).toFixed(2)} €
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {meDeben.length > 0 && (
              <div>
                <p className="text-sm text-white/70">
                  Te deben{" "}
                  <span className="font-semibold tabular-nums">
                    {suma(meDeben).toFixed(2)} €
                  </span>
                </p>
                <ul className="mt-2 space-y-1.5">
                  {meDeben.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm"
                    >
                      <Avatar
                        nombre={d.otro?.nombre ?? "VYP"}
                        avatarUrl={d.otro?.avatarUrl}
                        tamano={24}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {d.otro?.nombre ?? "VYP"}
                        {d.descripcion && (
                          <span className="text-white/50"> · {d.descripcion}</span>
                        )}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {Number(d.cantidad).toFixed(2)} €
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
