import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService, getApiErrorMessage } from "../../services/api";
import { AccesoLayout, CampoClave, ErrorAcceso } from "../../components/Acceso";
import { useLang } from "../../lib/i18n";
import { IconCheck } from "../../lib/icons";

// Página pública para restablecer la contraseña con el token de un solo uso
// que llega por email (link ?token=...). No cambia nada hasta que el usuario
// envía una contraseña nueva válida.
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { t } = useLang();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(t("rpErrMin8"));
      return;
    }
    if (password !== confirm) {
      setError(t("rpErrMismatch"));
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, t("rpErrReset")));
    } finally {
      setLoading(false);
    }
  };

  const irAlLogin = (
    <button type="button" onClick={() => navigate("/admin/login")} className="hp-btn w-full">
      {t("authTabLogin")}
    </button>
  );

  return (
    <AccesoLayout
      titulo={done ? t("rpDone") : t("newPassword")}
      subtitulo={!token || done ? undefined : t("rpSubtitle")}
      icono={done ? <IconCheck size={28} /> : undefined}
    >
      {!token ? (
        <div className="flex flex-col gap-5">
          <ErrorAcceso>{t("rpInvalidLink")}</ErrorAcceso>
          <button type="button" onClick={() => navigate("/admin/login")} className="hp-btn w-full">
            {t("rpGoLogin")}
          </button>
        </div>
      ) : done ? (
        <div role="status">
          <p className="sr-only">{t("rpDone")}</p>
          {irAlLogin}
        </div>
      ) : (
        <form onSubmit={handleSubmit} aria-busy={loading} className="flex flex-col gap-5">
          <CampoClave
            label={t("newPassword")}
            value={password}
            onChange={setPassword}
            placeholder={t("rpPwPh8")}
            invalido={!!error}
            descripcion={error ? "error-clave" : undefined}
          />
          <CampoClave
            label={t("repeatPassword")}
            value={confirm}
            onChange={setConfirm}
            placeholder={t("repeatPassword")}
            invalido={!!error}
            descripcion={error ? "error-clave" : undefined}
          />

          {error && <ErrorAcceso id="error-clave">{error}</ErrorAcceso>}

          <button type="submit" disabled={loading} className="hp-btn w-full">
            {loading ? t("saving") : t("rpSave")}
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin/login")}
            className="mx-auto min-h-11 cursor-pointer text-[0.9375rem] font-semibold text-[var(--tinta)] underline decoration-[1.5px] underline-offset-4 hover:text-[var(--cobalto)]"
          >
            {t("backToLogin")}
          </button>
        </form>
      )}
    </AccesoLayout>
  );
}
