import { useState } from "react";
import { Card, EmptyState } from "./ui";
import { IconAlert, IconCheck } from "../lib/icons";
import { useLang } from "../lib/i18n";
import type { CuentaRiesgo } from "../services/api";
import { useMotivoTexto } from "../lib/plataforma";

// Panel Tech: cuentas que conviene ayudar antes de que se vayan.
// Rojo (--err) = urgente: pago o prueba. Ámbar (--warn) = uso flojo.

const VISIBLES = 5;

export default function RiesgoPanel({
  cuentas,
  loading,
  entrando,
  onVerComo,
  onVerTodas,
}: {
  cuentas: CuentaRiesgo[];
  loading: boolean;
  entrando: number | null;
  onVerComo: (c: { id: number; nombre: string }) => void;
  // Si está, "ver más" lleva a la lista completa en vez de desplegarla acá.
  onVerTodas?: () => void;
}) {
  const { t } = useLang();
  const [todas, setTodas] = useState(false);

  const motivoTexto = useMotivoTexto();

  const altas = cuentas.filter((c) => c.nivel === "alto").length;
  const lista = todas ? cuentas : cuentas.slice(0, VISIBLES);

  return (
    <Card
      className="mb-6"
      title={
        <span className="flex items-center gap-2">
          {t("pfRiskTitle")}
          {cuentas.length > 0 && (
            <span className="pn-num rounded-full bg-err-bg px-2 py-0.5 text-xs font-bold text-err">
              {cuentas.length}
            </span>
          )}
        </span>
      }
      desc={t("pfRiskDesc")}
      action={
        altas > 0 ? (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-err">
            <IconAlert size={15} /> {altas} {t("pfRiskHigh").toLowerCase()}
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <p className="text-sm text-fg-3">{t("subLoading")}</p>
      ) : cuentas.length === 0 ? (
        <EmptyState icon={<IconCheck size={20} />} title={t("pfRiskNone")} desc={t("pfRiskNoneDesc")} />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {lista.map((c) => {
              const color = c.nivel === "alto" ? "var(--err)" : "var(--warn)";
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <span aria-hidden className="h-9 w-1 shrink-0 rounded-full" style={{ background: color }} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 font-semibold text-fg">
                      {c.nombre}
                      <span className="text-xs font-normal text-fg-3">
                        <span className="capitalize">{c.tipo_plan}</span>
                        {c.email ? ` · ${c.email}` : ""}
                      </span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.motivos.map((m) => (
                        <span
                          key={m.tipo}
                          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{
                            color: m.nivel === "alto" ? "var(--err)" : "var(--warn)",
                            background: m.nivel === "alto" ? "var(--err-bg)" : "var(--warn-bg)",
                          }}
                        >
                          {motivoTexto(m)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onVerComo(c)}
                    disabled={entrando !== null}
                    aria-busy={entrando === c.id}
                    className="inline-flex min-h-[40px] cursor-pointer items-center whitespace-nowrap rounded-lg border border-line px-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
                  >
                    {entrando === c.id ? t("pfOpening") : t("pfViewAs")}
                  </button>
                </li>
              );
            })}
          </ul>
          {cuentas.length > VISIBLES && (
            <button
              type="button"
              onClick={() => (onVerTodas ? onVerTodas() : setTodas(!todas))}
              className="mt-3 min-h-[40px] cursor-pointer text-sm font-semibold text-info hover:underline"
            >
              {onVerTodas
                ? `${t("pfSeeAllRisk")} (${cuentas.length})`
                : todas
                  ? t("pfRiskLess")
                  : t("pfRiskMore", { n: cuentas.length - VISIBLES })}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
