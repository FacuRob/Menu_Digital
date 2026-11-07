import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../lib/i18n";
import { IconLock } from "../../lib/icons";
import { AccesoLayout, AvisoAcceso, CampoClave, ErrorAcceso } from "../../components/Acceso";

export default function CambiarPassword() {
  const { t } = useLang();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, logout, setMustChangePassword, setSession } = useAuth();
  const navigate = useNavigate();

  const strength = (() => {
    if (newPassword.length === 0) return 0;
    let s = 0;
    if (newPassword.length >= 6) s++;
    if (newPassword.length >= 10) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();

  const strengthLabel = [
    "",
    t("strength1"),
    t("strength2"),
    t("strength3"),
    t("strength4"),
    t("strength5"),
  ][strength];
  // Colores de la barra (pantalla siempre clara: tonos con contraste sobre blanco).
  const strengthColor = ["", "#b8251a", "#b5370a", "#8f5400", "#0c6e49", "#0c6e49"][strength];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    // El servidor exige 8 caracteres.
    if (newPassword.length < 8) {
      return setError(t("rpErrMin8"));
    }
    if (newPassword !== confirm) {
      return setError(t("pwMismatch"));
    }

    setLoading(true);
    try {
      const res = await authService.changePassword(newPassword);
      if (res.token && res.user) setSession(res.token, res.user);
      else setMustChangePassword(false);
      navigate("/admin/dashboard");
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || t("errChangeFailed"));
    } finally {
      setLoading(false);
    }
  };

  const noCoinciden = !!confirm && confirm !== newPassword;

  return (
    <AccesoLayout
      titulo={t("changeTitle")}
      subtitulo={t("changeSubtitle", { name: user?.nombre || user?.username || "" })}
      icono={<IconLock size={26} />}
    >
      <form onSubmit={handleSubmit} aria-busy={loading} className="flex flex-col gap-5">
        <AvisoAcceso>{t("tempPwWarning")}</AvisoAcceso>

        <CampoClave
          label={t("newPassword")}
          value={newPassword}
          onChange={setNewPassword}
          placeholder={t("min8")}
          descripcion={newPassword ? "fuerza-clave" : undefined}
          debajo={
            <div aria-live="polite">
            {newPassword.length > 0 && (
              <div className="mt-2.5">
                <div className="flex gap-1" aria-hidden>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 flex-1 rounded-full transition-colors"
                      style={{ background: i <= strength ? strengthColor : "var(--hueso)" }}
                    />
                  ))}
                </div>
                <p id="fuerza-clave" className="mt-1.5 text-sm font-semibold" style={{ color: strengthColor }}>
                  {strengthLabel}
                  {newPassword.length < 8 && <span className="font-normal text-[var(--gris)]"> · {t("min8")}</span>}
                </p>
              </div>
            )}
            </div>
          }
        />

        <CampoClave
          label={t("confirmPassword")}
          value={confirm}
          onChange={setConfirm}
          placeholder={t("repeatPassword")}
          invalido={noCoinciden}
          descripcion={noCoinciden || (confirm && confirm.length >= 8) ? "coincide-clave" : undefined}
          debajo={
            <div aria-live="polite">
              {(noCoinciden || (!!confirm && confirm.length >= 8)) && (
                <p
                  id="coincide-clave"
                  className="mt-1.5 text-sm font-semibold"
                  style={{ color: noCoinciden ? "var(--error)" : "#0c6e49" }}
                >
                  {noCoinciden ? (
                    t("pwMismatch")
                  ) : (
                    <>
                      <span aria-hidden>✓ </span>
                      {t("pwMatch")}
                    </>
                  )}
                </p>
              )}
            </div>
          }
        />

        {error && <ErrorAcceso>{error}</ErrorAcceso>}

        <button type="submit" disabled={loading} className="hp-btn w-full">
          {loading && (
            <span
              aria-hidden
              className="inline-block h-4 w-4 rounded-full border-2 border-current/25 border-t-current"
              style={{ animation: "spin 0.7s linear infinite" }}
            />
          )}
          {loading ? t("saving") : t("setNewPassword")}
        </button>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/admin/login");
          }}
          className="mx-auto min-h-11 cursor-pointer text-[0.9375rem] font-semibold text-[var(--gris)] underline decoration-[1.5px] underline-offset-4 hover:text-[var(--error)]"
        >
          {t("logout")}
        </button>
      </form>
    </AccesoLayout>
  );
}
