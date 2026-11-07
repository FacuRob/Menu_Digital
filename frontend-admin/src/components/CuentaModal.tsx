import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal";
import { useStyles } from "./sharedStyles";
import { SideNav, SectionCard } from "./SeccionesUi";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/api";
import { useLang } from "../lib/i18n";
import { useIsMobile } from "../lib/useIsMobile";
import { IconAlert, IconCheck, IconEye, IconEyeOff, IconLock, IconUser } from "../lib/icons";

export type CuentaTab = "perfil" | "email" | "password";

const IconMail = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6 8.5-6" />
  </svg>
);

// "Mi cuenta": el usuario logueado edita su perfil, su email y su contraseña.
// Mismo diseño que "Configuración del menú": menú lateral + tarjeta.
// Cada guardado devuelve un token nuevo con los datos al día.
export default function CuentaModal({
  inicial,
  onClose,
}: {
  inicial: CuentaTab;
  onClose: () => void;
}) {
  const { t } = useLang();
  const S = useStyles();
  const isMobile = useIsMobile();
  const { user, setSession } = useAuth();
  const [tab, setTab] = useState<CuentaTab>(inicial);

  const [nombre, setNombre] = useState(user?.nombre || "");
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState("");
  const [actualEmail, setActualEmail] = useState("");
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");

  const [saving, setSaving] = useState(false);
  const [enviandoLink, setEnviandoLink] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.type === "ok" ? 3000 : 4500);
    return () => clearTimeout(id);
  }, [toast]);

  const avisar = (type: "ok" | "err", text: string) => setToast({ type, text });
  const errorDe = (err: unknown) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || t("acctErr");

  // Ejecuta el guardado y deja la sesión al día con lo que devuelve el servidor.
  const ejecutar = async (
    accion: () => ReturnType<typeof authService.updateProfile>,
    mensajeOk: string,
    limpiar: () => void,
  ) => {
    setSaving(true);
    try {
      const res = await accion();
      if (res.token && res.user) setSession(res.token, res.user);
      limpiar();
      avisar("ok", mensajeOk);
    } catch (err) {
      avisar("err", errorDe(err));
    } finally {
      setSaving(false);
    }
  };

  const guardarPerfil = (e: FormEvent) => {
    e.preventDefault();
    const n = nombre.trim();
    const u = username.trim();
    if (u.length < 3) return avisar("err", t("acctErrUser"));
    if (n === (user?.nombre || "") && u === user?.username) {
      return avisar("err", t("acctNoChanges"));
    }
    void ejecutar(
      () => authService.updateProfile({ nombre: n || null, username: u }),
      t("acctSavedProfile"),
      () => {},
    );
  };

  const guardarEmail = (e: FormEvent) => {
    e.preventDefault();
    const nuevo = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo)) return avisar("err", t("acctErrEmail"));
    if (!actualEmail) return avisar("err", t("acctErrCurrent"));
    void ejecutar(() => authService.changeEmail(nuevo, actualEmail), t("acctSavedEmail"), () => {
      setEmail("");
      setActualEmail("");
    });
  };

  const guardarPassword = (e: FormEvent) => {
    e.preventDefault();
    if (!actual) return avisar("err", t("acctErrCurrent"));
    if (nueva.length < 8) return avisar("err", t("rpErrMin8"));
    if (nueva !== confirmar) return avisar("err", t("pwMismatch"));
    void ejecutar(() => authService.changePassword(nueva, actual), t("acctSavedPw"), () => {
      setActual("");
      setNueva("");
      setConfirmar("");
    });
  };

  // Para quien no sabe su contraseña actual (por ejemplo, entra con Google):
  // le mandamos el enlace de "Olvidé mi contraseña" a su email.
  const enviarLink = async () => {
    if (!user) return;
    if (!user.email) return avisar("err", t("acctLinkNoEmail"));
    setEnviandoLink(true);
    try {
      await authService.forgotPassword(user.username);
      avisar("ok", t("acctLinkSent", { email: user.email }));
    } catch (err) {
      avisar("err", errorDe(err));
    } finally {
      setEnviandoLink(false);
    }
  };

  const muted = "var(--fg-3)";
  const hint: React.CSSProperties = { margin: "6px 0 0", fontSize: 11.5, color: muted, lineHeight: 1.45 };
  const fila: React.CSSProperties = {
    display: "grid",
    gap: 14,
    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
  };

  const ayudaPassword = (
    <p style={hint}>
      {t("acctNoPw")}{" "}
      <button
        type="button"
        onClick={enviarLink}
        disabled={enviandoLink}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: "var(--info)",
          fontSize: 11.5,
          fontWeight: 600,
          cursor: enviandoLink ? "default" : "pointer",
          textDecoration: "underline",
        }}
      >
        {enviandoLink ? t("saving") : t("acctSendLink")}
      </button>
    </p>
  );

  const boton = (texto: string) => (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
      <button
        type="submit"
        disabled={saving}
        style={{ ...S.btnPrimary, padding: "9px 18px", opacity: saving ? 0.6 : 1 }}
      >
        {saving ? t("saving") : texto}
      </button>
    </div>
  );

  const perfilCambiado =
    nombre.trim() !== (user?.nombre || "") || username.trim() !== (user?.username || "");

  return (
    <Modal
      title={t("acctTitle")}
      subtitle={user ? `@${user.username}` : undefined}
      icon={<IconUser />}
      onClose={onClose}
      maxWidth={820}
    >
      <style>{`@keyframes acctTabIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      <div
        style={{
          background: "var(--surface-3)",
          padding: isMobile ? 12 : 22,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 12 : 20,
          alignItems: isMobile ? "stretch" : "flex-start",
        }}
      >
        <SideNav<CuentaTab>
          value={tab}
          onChange={setTab}
          isMobile={isMobile}
          dirtyTitle={t("cfgUnsaved")}
          groups={[
            {
              label: t("acctNavGroup"),
              color: "var(--info)",
              items: [
                { id: "perfil", label: t("acctTabProfile"), accent: "var(--info)", Icon: IconUser, dirty: perfilCambiado },
                { id: "email", label: t("acctTabEmail"), accent: "var(--violet)", Icon: IconMail, dirty: !!(email || actualEmail) },
                {
                  id: "password",
                  label: t("acctTabPassword"),
                  accent: "var(--warn)",
                  Icon: IconLock,
                  dirty: !!(actual || nueva || confirmar),
                },
              ],
            },
          ]}
        />

        {/* Las tres tarjetas se apilan en la misma celda y sólo se ve la
            activa: la ventana no cambia de tamaño al pasar de una a otra. */}
        <div style={{ flex: 1, minWidth: 0, display: "grid" }}>
          <Panel visible={tab === "perfil"}>
            <form onSubmit={guardarPerfil}>
              <SectionCard accent="var(--info)" title={t("acctTabProfile")} subtitle={t("acctProfileSub")}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Campo label={t("colName")} S={S}>
                    <input
                      style={S.input}
                      value={nombre}
                      maxLength={120}
                      placeholder={t("usrNamePh")}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                    <p style={hint}>{t("acctNameHint")}</p>
                  </Campo>
                  <Campo label={t("acctUsername")} S={S}>
                    <input
                      style={S.input}
                      value={username}
                      maxLength={50}
                      autoComplete="username"
                      onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                    />
                    <p style={hint}>{t("acctUsernameHint")}</p>
                  </Campo>
                  {boton(t("saveChanges"))}
                </div>
              </SectionCard>
            </form>
          </Panel>

          <Panel visible={tab === "email"}>
            <form onSubmit={guardarEmail}>
              <SectionCard
                accent="var(--violet)"
                title={t("acctTabEmail")}
                subtitle={
                  user?.email ? t("acctEmailSub", { email: user.email }) : t("acctNoEmail")
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Campo label={t("acctNewEmail")} S={S}>
                    <input
                      style={S.input}
                      type="email"
                      value={email}
                      maxLength={120}
                      autoComplete="email"
                      placeholder={t("usrEmailPh")}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <p style={hint}>{t("acctEmailHint")}</p>
                  </Campo>
                  <Campo label={t("acctCurrentPw")} S={S}>
                    <InputPassword
                      S={S}
                      value={actualEmail}
                      onChange={setActualEmail}
                      autoComplete="current-password"
                    />
                    {ayudaPassword}
                  </Campo>
                  {boton(t("saveChanges"))}
                </div>
              </SectionCard>
            </form>
          </Panel>

          <Panel visible={tab === "password"}>
            <form onSubmit={guardarPassword}>
              <SectionCard accent="var(--warn)" title={t("acctTabPassword")} subtitle={t("acctPwSub")}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Campo label={t("acctCurrentPw")} S={S}>
                    <InputPassword S={S} value={actual} onChange={setActual} autoComplete="current-password" />
                    {ayudaPassword}
                  </Campo>
                  <div style={fila}>
                    <Campo label={t("newPassword")} S={S}>
                      <InputPassword
                        S={S}
                        value={nueva}
                        onChange={setNueva}
                        autoComplete="new-password"
                        placeholder={t("min8")}
                      />
                    </Campo>
                    <Campo label={t("confirmPassword")} S={S}>
                      <InputPassword
                        S={S}
                        value={confirmar}
                        onChange={setConfirmar}
                        autoComplete="new-password"
                        placeholder={t("repeatPassword")}
                      />
                    </Campo>
                  </div>
                  {/* Siempre ocupa su lugar para que aparecer no agrande nada. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <p
                      style={{
                        ...hint,
                        margin: 0,
                        flex: 1,
                        color: "var(--err)",
                        visibility: confirmar && confirmar !== nueva ? "visible" : "hidden",
                      }}
                    >
                      {t("pwMismatch")}
                    </p>
                    <button
                      type="submit"
                      disabled={saving}
                      style={{ ...S.btnPrimary, padding: "9px 18px", opacity: saving ? 0.6 : 1 }}
                    >
                      {saving ? t("saving") : t("usrChangePw")}
                    </button>
                  </div>
                </div>
              </SectionCard>
            </form>
          </Panel>
        </div>
      </div>

      {/* Aviso arriba a la derecha (igual que en "Configuración del menú"). */}
      {toast &&
        createPortal(
          <div
            role="status"
            style={{
              position: "fixed",
              top: 20,
              right: 20,
              zIndex: 400,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderRadius: 12,
              background: toast.type === "ok" ? "var(--ok)" : "var(--err)",
              color: "var(--surface)",
              fontSize: 13.5,
              fontWeight: 600,
              boxShadow: "0 12px 34px rgba(0,0,0,0.28)",
              animation: "acctToastIn .25s ease",
              maxWidth: "min(360px, calc(100vw - 32px))",
            }}
          >
            <style>{`@keyframes acctToastIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}`}</style>
            <span style={{ display: "flex", flexShrink: 0 }}>
              {toast.type === "ok" ? <IconCheck size={18} /> : <IconAlert size={18} />}
            </span>
            {toast.text}
          </div>,
          document.body,
        )}
    </Modal>
  );
}

type Estilos = ReturnType<typeof useStyles>;

// Contenido de una pestaña. Las ocultas siguen ocupando lugar (visibility)
// para que la ventana tenga siempre el alto de la pestaña más larga.
function Panel({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      aria-hidden={!visible}
      style={{
        gridArea: "1 / 1",
        visibility: visible ? "visible" : "hidden",
        animation: visible ? "acctTabIn .22s ease both" : undefined,
      }}
    >
      {children}
    </div>
  );
}

function Campo({ label, S, children }: { label: string; S: Estilos; children: ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={S.label}>{label}</span>
      {children}
    </label>
  );
}

function InputPassword({
  S,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  S: Estilos;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        style={{ ...S.input, paddingRight: 38 }}
        type={ver ? "text" : "password"}
        value={value}
        maxLength={200}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVer(!ver)}
        aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--fg-3)",
          display: "flex",
          padding: 0,
        }}
      >
        {ver ? <IconEyeOff size={16} /> : <IconEye size={16} />}
      </button>
    </div>
  );
}
