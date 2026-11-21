import { useState, useEffect } from "react";
import RegistroCambios from "../../components/RegistroCambios";
import { useDialogos } from "../../lib/dialogos";
import { usuariosService, getApiErrorMessage, type Usuario, type RolPermiso } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import AdminLayout from "../../components/AdminLayout";
import { useStyles } from "../../components/sharedStyles";
import Modal from "../../components/Modal";
import { useLang, LOCALE } from "../../lib/i18n";
import { Switch } from "../../components/ui";
import { Campo } from "../../components/InfoTip";
import { SideNav, SectionCard, SeccionPanel } from "../../components/SeccionesUi";
import { abrirSeccionInvalida } from "../../lib/secciones";
import { SearchIcon, ListIcon, GridIcon, Highlight } from "../../lib/listUi";
import { MOBILE_QUERY, useIsMobile } from "../../lib/useIsMobile";
import { IconEye, IconEyeOff, IconAlert, IconUser, IconX, IconLock, IconList } from "../../lib/icons";
import { ROL_TONO, rolLabel } from "../../lib/roles";

type Mode = "crear" | "editar" | null;
type ViewMode = "lista" | "cards";
type UsrSeccion = "datos" | "rol" | "acceso";

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} style={{ width: 14, height: 14 }}>
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

// Roles que puede asignar el usuario logueado. Dueño (SuperAdmin / Tech) →
// Admin y Empleado. Admin → sólo Empleado. El dueño nace en el registro.
const rolesAsignablesPara = (rol?: string, esPlataforma?: boolean): string[] => {
  if (esPlataforma || rol === "admin") return ["manager", "staff"];
  if (rol === "manager") return ["staff"];
  return [];
};

// La descripción y los permisos llegan del backend en español: se traducen
// por código; si no está mapeado se usa el texto original.
const ROLE_DESC_KEY: Record<string, string> = {
  admin: "roleDescAdmin",
  manager: "roleDescManager",
  staff: "roleDescStaff",
  superadmin: "roleDescAdmin",
  editor: "roleDescStaff",
  visor: "roleDescStaff",
};
const PERM_KEY: Record<string, string> = {
  productos: "navProductos",
  categorias: "navCategorias",
  pedidos: "navPedidos",
  stock: "permStock",
  qr: "navQr",
  usuarios: "navUsuarios",
  configuracion: "pageConfig",
  negocios: "navNegocios",
  analiticas: "subPerkAnalytics",
  suscripcion: "navSuscripcion",
  plataforma: "navPlataforma",
  servicios: "navServicios",
  presupuestos: "navPresupuestos",
  reservas: "navTurnos",
  cotizar: "permCotizar",
  clientes: "navClientes",
};

const FORM_VACIO = { username: "", nombre: "", email: "", password: "", rol: "staff", activo: true };

// Rol como texto con un punto de su color: se lee sin pintar toda la fila.
function RolTag({ rol }: { rol: string }) {
  const tono = ROL_TONO[rol] || "var(--fg-3)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: tono, flexShrink: 0 }} />
      {rolLabel(rol)}
    </span>
  );
}

export default function Usuarios() {
  const S = useStyles();
  const { t, lang } = useLang();
  const { confirmar, avisar } = useDialogos();
  const { user: me } = useAuth();
  const isMobile = useIsMobile();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<RolPermiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<Usuario | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(FORM_VACIO);
  // Valores al abrir: marcan con un punto las secciones con cambios.
  const [inicial, setInicial] = useState(FORM_VACIO);
  const [seccion, setSeccion] = useState<UsrSeccion>("datos");
  const [showPwd, setShowPwd] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const g = localStorage.getItem("usr_view");
      if (g === "lista" || g === "cards") return g;
    } catch {
      /* sin storage */
    }
    return window.matchMedia(MOBILE_QUERY).matches ? "cards" : "lista";
  });

  const setViewMode = (v: ViewMode) => {
    try {
      localStorage.setItem("usr_view", v);
    } catch {
      /* sin storage */
    }
    setView(v);
  };

  useEffect(() => {
    fetch_();
  }, []);

  const fetch_ = async () => {
    try {
      setLoading(true);
      const [u, r] = await Promise.all([usuariosService.getAll(), usuariosService.getRoles()]);
      setUsuarios(u);
      setRoles(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const asignables = rolesAsignablesPara(me?.rol, me?.es_plataforma);
  const rolesAsignables = roles.filter((r) => asignables.includes(r.rol));
  const puedeGestionar = (u: Usuario) => u.id === me?.id || asignables.includes(u.rol);
  const esYo = selected?.id === me?.id;

  const rolDesc = (rol: string, fallback?: string) => (ROLE_DESC_KEY[rol] ? t(ROLE_DESC_KEY[rol]) : fallback || "");
  const permLabel = (p: string) => (p === "*" ? t("usrPermAll") : PERM_KEY[p] ? t(PERM_KEY[p]) : p);
  const fecha = (s?: string) => (s ? new Date(s).toLocaleDateString(LOCALE[lang]) : "—");

  const q = search.trim().toLowerCase();
  const filtrados = usuarios.filter(
    (u) =>
      !q ||
      [u.username, u.nombre, u.email].some((v) => typeof v === "string" && v.toLowerCase().includes(q)),
  );

  const open = (m: Exclude<Mode, null>, u?: Usuario) => {
    const valores =
      m === "editar" && u
        ? { username: u.username, nombre: u.nombre || "", email: u.email || "", password: "", rol: u.rol, activo: u.activo }
        : { ...FORM_VACIO, rol: asignables.includes("staff") ? "staff" : asignables[0] || "staff" };
    setSelected(u || null);
    setForm(valores);
    setInicial(valores);
    setError("");
    setShowPwd(false);
    setSeccion("datos");
    setMode(m);
  };

  const close = () => {
    setMode(null);
    setSelected(null);
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (mode === "crear") {
        await usuariosService.create({
          username: form.username,
          password: form.password,
          nombre: form.nombre || undefined,
          email: form.email || undefined,
          rol: form.rol,
        });
      }
      if (mode === "editar" && selected) {
        await usuariosService.update(selected.id, {
          nombre: form.nombre || undefined,
          email: form.email || undefined,
          rol: form.rol,
          activo: form.activo,
        });
        if (form.password) await usuariosService.cambiarPassword(selected.id, form.password);
      }
      await fetch_();
      close();
    } catch (err) {
      setError(getApiErrorMessage(err, t("errSaveGeneric")));
    } finally {
      setSaving(false);
    }
  };

  const del = async (u: Usuario) => {
    if (!(await confirmar({ mensaje: t("usrConfirmDelete", { name: u.username }), peligro: true }))) return;
    try {
      await usuariosService.delete(u.id);
      await fetch_();
    } catch (err) {
      void avisar({ mensaje: getApiErrorMessage(err, t("usrDeleteError")), tipo: "error" });
    }
  };

  const toggle = async (u: Usuario) => {
    try {
      await usuariosService.update(u.id, { activo: !u.activo });
      await fetch_();
    } catch (err) {
      void avisar({ mensaje: getApiErrorMessage(err, t("dlgErrorTitle")), tipo: "error" });
    }
  };

  // Estado: misma pastilla que Categorías; se cambia con un clic.
  const EstadoBtn = ({ u }: { u: Usuario }) => {
    const bloqueado = u.id === me?.id || !puedeGestionar(u);
    return (
      <button className="tap-area"
        onClick={() => toggle(u)}
        disabled={bloqueado}
        title={bloqueado ? undefined : u.activo ? t("clickToDeactivate") : t("clickToActivate")}
        style={{ ...(u.activo ? S.badgeGreen : S.badgeRed), cursor: bloqueado ? "default" : "pointer", border: "none" }}
      >
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: u.activo ? "var(--ok)" : "var(--err)" }} />
        {u.activo ? t("statusActive") : t("statusInactive")}
      </button>
    );
  };

  const Nombre = ({ u }: { u: Usuario }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13.5, color: "var(--fg)" }}>
        <Highlight text={u.nombre || u.username} query={search} />
        {u.id === me?.id && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", background: "var(--surface-3)", borderRadius: 6, padding: "1px 7px" }}>
            {t("usrYou")}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        @<Highlight text={u.username} query={search} />
        {u.email && (
          <>
            {" · "}
            <Highlight text={u.email} query={search} />
          </>
        )}
      </div>
    </div>
  );

  const Acciones = ({ u }: { u: Usuario }) =>
    puedeGestionar(u) ? (
      <div style={{ display: "flex", gap: 16 }}>
        <button className="tap-area"
          onClick={() => open("editar", u)}
          style={{ background: "none", border: "none", color: "var(--info)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
        >
          {t("actionEdit")}
        </button>
        {u.id !== me?.id && (
          <button className="tap-area"
            onClick={() => del(u)}
            style={{ background: "none", border: "none", color: "var(--err)", fontSize: 13, cursor: "pointer", padding: 0 }}
          >
            {t("actionDelete")}
          </button>
        )}
      </div>
    ) : (
      <span style={{ color: "var(--fg-3)", fontSize: 13 }}>—</span>
    );

  // Opciones de rol: tarjetas para elegir, con lo que cada uno puede usar.
  const rolEditable = !esYo && (mode === "crear" || asignables.includes(form.rol));

  return (
    <AdminLayout title={t("navUsuarios")}>
      {/* Toolbar: búsqueda + vista + nuevo (igual que Categorías) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180, maxWidth: 340 }}>
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--fg-3)",
              display: "flex",
              pointerEvents: "none",
            }}
          >
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("usrSearchPh")}
            aria-label={t("usrSearchPh")}
            style={{ ...S.input, padding: "8px 30px 8px 32px" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label={t("actionCancel")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--fg-3)",
                display: "flex",
                padding: 2,
              }}
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        <span style={{ color: "var(--fg-3)", fontSize: 12 }}>{t("usrCount", { n: filtrados.length })}</span>

        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            background: "var(--surface)",
            borderRadius: 10,
            padding: 3,
            border: "1px solid var(--line)",
          }}
        >
          {(
            [
              { key: "lista", label: t("viewList"), Icon: ListIcon },
              { key: "cards", label: t("viewCards"), Icon: GridIcon },
            ] as const
          ).map((v) => (
            <button className="tap-area"
              key={v.key}
              onClick={() => setViewMode(v.key)}
              title={v.label}
              aria-pressed={view === v.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 12.5,
                fontWeight: 600,
                transition: "all 0.15s",
                background: view === v.key ? "var(--surface-3)" : "transparent",
                color: view === v.key ? "var(--info)" : "var(--fg-3)",
              }}
            >
              <v.Icon />
              {v.label}
            </button>
          ))}
        </div>

        {asignables.length > 0 && (
          <button
            style={S.btnPrimary}
            onClick={() => open("crear")}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
          >
            <PlusIcon /> {t("usrNew")}
          </button>
        )}
      </div>

      {/* ── Resultados ── */}
      {loading ? (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <div
              style={{
                width: 28,
                height: 28,
                border: "2px solid var(--focus)",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div style={S.card}>
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--fg-3)" }}>
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}>
              {q ? <SearchIcon size={30} /> : <IconUser size={30} />}
            </div>
            <div style={{ fontSize: 14 }}>{q ? t("searchNoResults") : t("usrEmpty")}</div>
          </div>
        </div>
      ) : view === "cards" ? (
        /* ── Vista Tarjetas ── */
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))" }}>
          {filtrados.map((u) => (
            <div key={u.id} style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <Nombre u={u} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <RolTag rol={u.rol} />
                <EstadoBtn u={u} />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  paddingTop: 10,
                  borderTop: "1px solid var(--line)",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                  {t("usrColCreated")} {fecha(u.created_at)}
                </span>
                <Acciones u={u} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Vista Lista (tabla) ── */
        <div style={{ ...S.card, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
            <thead style={S.thead}>
              <tr>
                {[t("usrColUser"), t("colRole"), t("colStatus"), t("usrColCreated"), t("colActions")].map((h) => (
                  <th key={h} scope="col" style={S.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr
                  key={u.id}
                  style={S.tr}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ ...S.td, maxWidth: 320 }}>
                    <Nombre u={u} />
                  </td>
                  <td style={S.td}>
                    <RolTag rol={u.rol} />
                  </td>
                  <td style={S.td}>
                    <EstadoBtn u={u} />
                  </td>
                  <td style={S.tdMuted}>{fecha(u.created_at)}</td>
                  <td style={S.td}>
                    <Acciones u={u} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: mismo diseño que Categorías (secciones a la izquierda). */}
      {mode && (
        <Modal
          title={mode === "crear" ? t("usrNew") : t("usrEditName", { name: selected?.username || "" })}
          subtitle={mode === "editar" ? selected?.nombre || undefined : undefined}
          onClose={close}
          maxWidth={760}
          icon={<IconUser />}
        >
          <form onSubmit={submit} onInvalidCapture={abrirSeccionInvalida(seccion, setSeccion)}>
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
              <SideNav<UsrSeccion>
                value={seccion}
                onChange={setSeccion}
                isMobile={isMobile}
                dirtyTitle={t("cfgUnsaved")}
                groups={[
                  {
                    label: t("usrNavGroup"),
                    color: "var(--info)",
                    items: [
                      {
                        id: "datos",
                        label: t("usrSecData"),
                        accent: "var(--info)",
                        Icon: IconUser,
                        dirty: mode === "editar" && (form.nombre !== inicial.nombre || form.email !== inicial.email),
                      },
                      {
                        id: "rol",
                        label: t("usrSecRole"),
                        accent: "var(--violet)",
                        Icon: IconList,
                        dirty: mode === "editar" && form.rol !== inicial.rol,
                      },
                      {
                        id: "acceso",
                        label: t("usrSecAccess"),
                        accent: "var(--ok)",
                        Icon: IconLock,
                        dirty: mode === "editar" && (form.activo !== inicial.activo || !!form.password),
                      },
                    ],
                  },
                ]}
              />

              <div style={{ flex: 1, minWidth: 0, display: "grid" }}>
                <SeccionPanel id="datos" visible={seccion === "datos"}>
                  <SectionCard accent="var(--info)" title={t("usrSecData")} subtitle={t("usrSecDataSub")}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {mode === "crear" ? (
                        <Campo label={t("usrUsernameField")} info={t("usrUsernameInfo")}>
                          <input
                            style={S.input}
                            required
                            autoComplete="off"
                            value={form.username}
                            placeholder={t("usrUsernamePh")}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                          />
                        </Campo>
                      ) : (
                        <Campo label={t("usrColUser")} info={t("usrUsernameInfo")}>
                          <input style={{ ...S.input, opacity: 0.6 }} value={form.username} disabled />
                        </Campo>
                      )}
                      <Campo label={t("colName")}>
                        <input
                          style={S.input}
                          value={form.nombre}
                          placeholder={t("usrNamePh")}
                          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        />
                      </Campo>
                      <Campo label={t("colEmail")} info={t("usrEmailInfo")}>
                        <input
                          style={S.input}
                          type="email"
                          value={form.email}
                          placeholder={t("usrEmailPh")}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </Campo>
                    </div>
                  </SectionCard>
                </SeccionPanel>

                <SeccionPanel id="rol" visible={seccion === "rol"}>
                  <SectionCard accent="var(--violet)" title={t("usrSecRole")} subtitle={t("usrSecRoleSub")}>
                    {rolEditable ? (
                      <div role="radiogroup" aria-label={t("usrSecRole")} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {rolesAsignables.map((r) => {
                          const elegido = form.rol === r.rol;
                          const permisos = Array.isArray(r.permisos) ? r.permisos : [r.permisos];
                          return (
                            <label
                              key={r.rol}
                              style={{
                                display: "flex",
                                gap: 12,
                                alignItems: "flex-start",
                                padding: "12px 14px",
                                borderRadius: 10,
                                cursor: "pointer",
                                background: elegido ? "var(--surface-2)" : "var(--surface)",
                                border: `1.5px solid ${elegido ? ROL_TONO[r.rol] || "var(--info)" : "var(--line)"}`,
                              }}
                            >
                              <input
                                type="radio"
                                name="rol"
                                value={r.rol}
                                checked={elegido}
                                onChange={() => setForm({ ...form, rol: r.rol })}
                                style={{ marginTop: 3, accentColor: ROL_TONO[r.rol] }}
                              />
                              <span style={{ minWidth: 0 }}>
                                <RolTag rol={r.rol} />
                                <span style={{ display: "block", fontSize: 12.5, color: "var(--fg-2)", marginTop: 4, lineHeight: 1.5 }}>
                                  {rolDesc(r.rol, r.descripcion)}
                                </span>
                                <span style={{ display: "block", fontSize: 12, color: "var(--fg-3)", marginTop: 6, lineHeight: 1.5 }}>
                                  {t("usrRoleCan")}: {permisos.map(permLabel).join(", ")}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <RolTag rol={form.rol} />
                        <span style={{ fontSize: 12.5, color: "var(--fg-3)" }}>
                          {esYo ? t("usrRoleOwn") : t("usrRoleNotManaged")}
                        </span>
                      </div>
                    )}
                  </SectionCard>
                </SeccionPanel>

                <SeccionPanel id="acceso" visible={seccion === "acceso"}>
                  <SectionCard
                    accent="var(--ok)"
                    title={t("usrSecAccess")}
                    subtitle={mode === "crear" ? t("usrSecAccessSub") : t("usrSecAccessSubEdit")}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <Campo label={mode === "crear" ? `${t("password")} *` : t("usrNewPwOptional")}>
                        <div style={{ position: "relative" }}>
                          <input
                            style={{ ...S.input, paddingRight: 44 }}
                            type={showPwd ? "text" : "password"}
                            required={mode === "crear"}
                            minLength={6}
                            autoComplete="new-password"
                            value={form.password}
                            placeholder={mode === "crear" ? t("usrPwPh6") : t("usrNewPwHint")}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPwd(!showPwd)}
                            aria-label={t("showPwd")}
                            aria-pressed={showPwd}
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: 44,
                              height: 44,
                              display: "grid",
                              placeItems: "center",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--fg-2)",
                            }}
                          >
                            {showPwd ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                          </button>
                        </div>
                      </Campo>
                      {mode === "editar" && (
                        <div>
                          <Switch
                            checked={!!form.activo}
                            onChange={(v) => setForm({ ...form, activo: v })}
                            label={t("usrActiveToggle")}
                            disabled={esYo}
                          />
                          {!form.activo && (
                            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--fg-3)" }}>{t("usrInactiveHint")}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </SeccionPanel>

                {error && (
                  <div
                    role="alert"
                    style={{
                      fontSize: 12.5,
                      color: "var(--err)",
                      background: "var(--err-bg)",
                      border: "1px solid color-mix(in srgb, var(--err) 25%, transparent)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <IconAlert size={14} style={{ flexShrink: 0 }} /> {error}
                  </div>
                )}
              </div>
            </div>
            <div style={S.modalFooter}>
              <button
                type="button"
                onClick={close}
                style={{ ...S.btnGhost, flex: 1, justifyContent: "center" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              >
                {t("actionCancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ ...S.btnPrimary, flex: 1, justifyContent: "center", opacity: saving ? 0.6 : 1 }}
                onMouseEnter={(e) => {
                  if (!saving) (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-hover)";
                }}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--accent)")}
              >
                {saving ? t("saving") : mode === "crear" ? t("usrCreate") : t("saveChanges")}
              </button>
            </div>
          </form>
        </Modal>
      )}
      <RegistroCambios />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </AdminLayout>
  );
}
