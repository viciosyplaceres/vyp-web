export default function CargandoChat() {
  return (
    <main
      aria-label="Cargando chat"
      className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 sm:px-6"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden py-4" aria-hidden="true">
        <div className="h-14 w-2/3 animate-pulse rounded-2xl bg-white/10" />
        <div className="ml-auto h-12 w-1/2 animate-pulse rounded-2xl bg-white/10" />
        <div className="h-20 w-3/4 animate-pulse rounded-2xl bg-white/10" />
      </div>
      <div className="mb-2 h-12 shrink-0 animate-pulse rounded-2xl bg-white/10" aria-hidden="true" />
    </main>
  );
}
