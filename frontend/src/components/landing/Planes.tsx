import { ADMIN_SIGNUP_URL } from "../../lib/links";
import { IconArrow, IconCheck } from "./icons";
import { MODULOS, PLANES, nombreConRequisito, pesos, planesQueIncluyen, precioConTodo } from "../../lib/planes";

// Tarjetas de planes y de módulos: las usan la landing (sección Precios) y
// /precios, así se ven igual en los dos lados. Como en Fudo: las tres tarjetas
// de plan quedan parejas y los módulos van abajo, en su propia fila.

const ESTILO_PLAN = {
  claro: { card: "bg-white text-[var(--tinta)]", sub: "text-[var(--gris)]", linea: "border-[var(--tinta)]/12", chip: "bg-[var(--hueso)]", btn: "bg-[var(--tinta)] text-white hover:bg-[var(--cobalto)]" },
  aji: { card: "bg-[var(--aji)] text-[var(--tinta)] dx-sobre-aji", sub: "text-[var(--tinta)]/80", linea: "border-[var(--tinta)]/20", chip: "bg-[var(--tinta)]/10", btn: "bg-[var(--tinta)] text-white hover:bg-[var(--cobalto)]" },
  tinta: { card: "bg-[var(--tinta)] text-[var(--hueso)] dx-sobre-oscuro", sub: "text-[var(--gris-claro)]", linea: "border-white/15", chip: "bg-white/10", btn: "bg-[var(--aji)] text-[var(--tinta)] hover:bg-[var(--aji-deep)]" },
} as const;

type Nivel = "h2" | "h3" | "h4";

export function TarjetasPlanes({ nivel = "h3", className = "" }: { nivel?: Nivel; className?: string }) {
  const H = nivel;
  return (
    <ul className={`grid gap-5 lg:grid-cols-3 ${className}`}>
      {PLANES.map((p) => {
        const e = ESTILO_PLAN[p.estilo];
        const conTodo = precioConTodo(p);
        const todoIncluido = conTodo === p.mensual;
        const ningunoIncluido = p.incluye.length === 0;
        return (
          <li key={p.code}>
            <article aria-labelledby={`plan-${p.code}`} className={`flex h-full flex-col rounded-[var(--radio)] p-7 xl:p-8 ${e.card}`}>
              <div className="flex min-h-[2.75rem] flex-wrap items-center gap-x-3 gap-y-2">
                <H id={`plan-${p.code}`} className="dx-display text-[2.25rem]">
                  {p.name}
                </H>
                {p.estilo === "aji" && <span className="dx-label rounded-full bg-[var(--tinta)] px-3 py-1 text-white">Recomendado</span>}
              </div>
              <p className={`mt-1.5 ${e.sub}`}>{p.desc}</p>
              <div className="mt-7 flex flex-wrap items-baseline gap-x-1.5">
                <span className={`dx-label ${e.sub}`}>$</span>
                <span className="dx-display dx-tabular text-[clamp(2.5rem,4.2vw,3.5rem)]">{pesos(p.mensual)}</span>
                <span className={e.sub}>/mes</span>
              </div>
              <p className={`mt-1 text-sm ${e.sub}`}>
                {todoIncluido ? "Con todos los módulos incluidos." : <>Con todos los módulos: <span className="dx-tabular font-semibold">$ {pesos(conTodo)}</span>/mes</>}
              </p>
              <a href={ADMIN_SIGNUP_URL} className={`mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 font-semibold transition-colors ${e.btn}`}>
                Probar gratis
                <span className="sr-only"> con el plan {p.name}</span>
                <IconArrow className="h-4 w-4" />
              </a>

              <p className="mt-7 font-semibold">{p.base ?? "Incluye:"}</p>
              <ul className="mt-3 flex-1 space-y-2.5">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5">
                    <IconCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    {perk}
                  </li>
                ))}
              </ul>

              <div className={`mt-7 border-t pt-5 ${e.linea}`}>
                <p className={`dx-label ${e.sub}`}>{todoIncluido ? "Módulos incluidos" : ningunoIncluido ? "Sumale módulos" : "Módulos"}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {MODULOS.map((m) => {
                    const incluido = p.incluye.includes(m.codigo);
                    // "(con WhatsApp)" sólo si el plan no lo trae.
                    const nombre = incluido || (m.requiere && p.incluye.includes(m.requiere)) ? m.nombre : nombreConRequisito(m);
                    return (
                      <li key={m.codigo} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium ${e.chip}`}>
                        {incluido ? (
                          <>
                            <IconCheck className="h-4 w-4" />
                            <span className="sr-only">Incluido: </span>
                          </>
                        ) : (
                          <span className="whitespace-nowrap font-semibold">+$ {pesos(m.precio)}/mes</span>
                        )}
                        {nombre}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

// Fila de módulos. `tema`: claro (sobre hueso) u oscuro (sobre tinta).
export function TarjetasModulos({ tema = "claro", nivel = "h3", className = "" }: { tema?: "claro" | "oscuro"; nivel?: Nivel; className?: string }) {
  const H = nivel;
  const oscuro = tema === "oscuro";
  return (
    <ul className={`grid gap-5 md:grid-cols-3 ${className}`}>
      {MODULOS.map((m) => {
        const req = m.requiere && MODULOS.find((x) => x.codigo === m.requiere);
        return (
          <li key={m.codigo} className={`flex flex-col rounded-[var(--radio)] p-7 ${oscuro ? "bg-[var(--tinta-2)]" : "bg-[var(--hueso-2)]"}`}>
            <H className="text-2xl font-bold">{m.nombre}</H>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
              <span className="dx-display dx-tabular whitespace-nowrap text-[clamp(1.875rem,2.8vw,2.5rem)]">+$ {pesos(m.precio)}</span>
              <span className={oscuro ? "text-[var(--gris-claro)]" : "text-[var(--gris)]"}>/mes</span>
            </p>
            <p className={`mt-4 flex-1 leading-relaxed ${oscuro ? "text-[var(--gris-claro)]" : "text-[var(--gris)]"}`}>{m.desc}</p>
            <ul className="mt-6 flex flex-wrap gap-2 text-sm font-medium">
              <li className={`rounded-full px-3 py-1.5 ${oscuro ? "bg-white/10" : "bg-[var(--hueso)]"}`}>Incluido en {planesQueIncluyen(m.codigo)}</li>
              {req && <li className="rounded-full bg-[var(--aji)] px-3 py-1.5 text-[var(--tinta)]">Necesita {req.nombre}</li>}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
