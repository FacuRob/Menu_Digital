import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import QRCodeLib from "qrcode";
import Modal from "./Modal";
import { useStyles } from "./sharedStyles";
import { SideNav, SectionCard, SeccionPanel as Panel } from "./SeccionesUi";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/api";
import { useLang } from "../lib/i18n";
import { useIsMobile } from "../lib/useIsMobile";
import { IconAlert, IconCheck, IconEye, IconEyeOff, IconLock, IconUser } from "../lib/icons";

export type CuentaTab = "perfil" | "email" | "password" | "seguridad";

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

const IconShield = ({ size = 16 }: { size?: number }) => (
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
    <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
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
  const { user, token, setSession } = useAuth();
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
                { id: "seguridad", label: t("tfaTab"), accent: "var(--ok)", Icon: IconShield },
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

          <Panel visible={tab === "seguridad"}>
            <SectionCard accent="var(--ok)" title={t("tfaTitle")} subtitle={t("tfaSub")}>
              <DosFactores
                S={S}
                activo={!!user?.totp_activo}
                avisar={avisar}
                errorDe={errorDe}
                // Refresca el usuario de la sesión (totp_activo) tras activar/desactivar.
                refrescar={async () => {
                  const res = await authService.verify();
                  if (token && res?.user) setSession(token, res.user);
                }}
              />
            </SectionCard>
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

// Verificación en dos pasos: QR para la app de autenticación + códigos de respaldo.
function DosFactores({
  S,
  activo,
  avisar,
  errorDe,
  refrescar,
}: {
  S: Estilos;
  activo: boolean;
  avisar: (type: "ok" | "err", text: string) => void;
  errorDe: (err: unknown) => string;
  refrescar: () => Promise<void>;
}) {
  const { t } = useLang();
  const [paso, setPaso] = useState<"inicio" | "qr" | "codigos">("inicio");
  const [qr, setQr] = useState("");
  const [secreto, setSecreto] = useState("");
  const [codigo, setCodigo] = useState("");
  const [respaldo, setRespaldo] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const correr = async (fn: () => Promise<void>) => {
    setOcupado(true);
    try {
      await fn();
    } catch (err) {
      avisar("err", errorDe(err));
    } finally {
      setOcupado(false);
    }
  };

  const empezar = () =>
    correr(async () => {
      const r = await authService.iniciar2fa();
      setSecreto(r.secreto);
      setQr(await QRCodeLib.toDataURL(r.otpauth, { width: 200, margin: 1 }));
      setCodigo("");
      setPaso("qr");
    });

  const confirmar = (e: FormEvent) => {
    e.preventDefault();
    void correr(async () => {
      const r = await authService.activar2fa(codigo);
      setRespaldo(r.codigos);
      setCodigo("");
      setPaso("codigos");
      await refrescar();
      avisar("ok", t("tfaActivated"));
    });
  };

  const apagar = (e: FormEvent) => {
    e.preventDefault();
    void correr(async () => {
      await authService.desactivar2fa(codigo);
      setCodigo("");
      setPaso("inicio");
      await refrescar();
      avisar("ok", t("tfaDeactivated"));
    });
  };

  const texto: React.CSSProperties = { margin: 0, fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 };
  const btn = (label: string, extra?: React.CSSProperties) => (
    <button type="submit" disabled={ocupado} style={{ ...S.btnPrimary, padding: "9px 18px", opacity: ocupado ? 0.6 : 1, ...extra }}>
      {ocupado ? t("saving") : label}
    </button>
  );
  const inputCodigo = (
    <input
      style={{ ...S.input, letterSpacing: "0.2em", maxWidth: 220 }}
      value={codigo}
      inputMode="text"
      autoComplete="one-time-code"
      placeholder="123456"
      onChange={(e) => setCodigo(e.target.value.slice(0, 20))}
      aria-label={t("tfaCode")}
    />
  );

  if (paso === "codigos") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={texto}>{t("tfaBackupInfo")}</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 8,
            padding: 14,
            borderRadius: 10,
            background: "var(--surface-2)",
            fontFamily: "ui-monospace, Consolas, monospace",
            fontSize: 14,
          }}
        >
          {respaldo.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            style={{ ...S.btnGhost, padding: "9px 18px" }}
            onClick={() => {
              void navigator.clipboard?.writeText(respaldo.join("\n"));
              avisar("ok", t("tfaCopied"));
            }}
          >
            {t("tfaCopy")}
          </button>
          <button type="button" style={{ ...S.btnPrimary, padding: "9px 18px" }} onClick={() => setPaso("inicio")}>
            {t("tfaSavedThem")}
          </button>
        </div>
      </div>
    );
  }

  if (activo) {
    return (
      <form onSubmit={apagar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ ...texto, color: "var(--ok)", fontWeight: 600 }}>✓ {t("tfaOn")}</p>
        <p style={texto}>{t("tfaOffInfo")}</p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {inputCodigo}
          {btn(t("tfaDeactivate"), { background: "var(--err)" })}
        </div>
      </form>
    );
  }

  if (paso === "qr") {
    return (
      <form onSubmit={confirmar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={texto}>{t("tfaScan")}</p>
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          {qr && (
            <img src={qr} alt={t("tfaQrAlt")} width={168} height={168} style={{ borderRadius: 10, background: "#fff", padding: 6 }} />
          )}
          <div style={{ flex: 1, minWidth: 180 }}>
            <p style={{ ...texto, fontSize: 12 }}>{t("tfaManual")}</p>
            <code style={{ display: "block", marginTop: 6, fontSize: 12.5, wordBreak: "break-all", color: "var(--fg)" }}>{secreto}</code>
          </div>
        </div>
        <p style={texto}>{t("tfaEnterFirst")}</p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {inputCodigo}
          {btn(t("tfaActivate"))}
        </div>
      </form>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={texto}>{t("tfaIntro")}</p>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={empezar} disabled={ocupado} style={{ ...S.btnPrimary, padding: "9px 18px", opacity: ocupado ? 0.6 : 1 }}>
          {ocupado ? t("saving") : t("tfaStart")}
        </button>
      </div>
    </div>
  );
}

// Contenido de una pestaña. Las ocultas siguen ocupando lugar (visibility)
// para que la ventana tenga siempre el alto de la pestaña más larga.
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
