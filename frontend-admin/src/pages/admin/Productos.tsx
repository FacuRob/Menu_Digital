import { useState, useEffect, useRef } from "react";
import {
  productosService,
  categoriasService,
  uploadService,
  planService,
  getApiErrorMessage,
  type Producto,
  type Categoria,
  type PlanInfo,
} from "../../services/api";
import AdminLayout from "../../components/AdminLayout";
import VariantesEditor from "../../components/VariantesEditor";
import { useStyles } from "../../components/sharedStyles";
import { useNegocio } from "../../context/NegocioContext";
import { useTheme } from "../../context/ThemeContext";
import { fmtMoney } from "../../lib/money";
import { cld } from "../../lib/cloudinary";
import { useLang } from "../../lib/i18n";
import { SearchIcon, ListIcon, GridIcon, Highlight } from "../../lib/listUi";
import {
  IconPlus,
  IconX,
  IconInfo,
  IconCheck,
  IconBan,
  IconImage,
  IconAlert,
} from "../../lib/icons";

const PlusIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    style={{ width: 14, height: 14 }}
  >
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);
const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    style={{ width: 16, height: 16 }}
  >
    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
  </svg>
);

// Estado de stock (solo si el producto controla stock). Umbral bajo = 5,
// igual que el backend (getStockBajo).
type StockState = "out" | "low" | "ok" | null;
const getStockState = (p: Producto): StockState => {
  if (!p.controlar_stock) return null;
  const st = p.stock ?? 0;
  if (st === 0) return "out";
  if (st <= 5) return "low";
  return "ok";
};

type Vista = "disponibles" | "no_disponibles";
type ViewMode = "lista" | "cards";

export default function Productos() {
  const S = useStyles();
  const { moneda } = useNegocio();
  const { t } = useLang();
  const { isDark } = useTheme();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<Vista>("disponibles");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    precio: 0,
    costo: 0,
    imagen_url: "",
    categoria_id: 0,
    disponible: true,
    orden: 0,
    stock: 0,
    controlar_stock: false,
  });
  // Atributos libres por rubro (marca, material, duración…). Se editan como
  // pares clave/valor y se guardan como JSONB junto al producto.
  const [atributos, setAtributos] = useState<{ clave: string; valor: string }[]>(
    [],
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState<number | "all">("all");
  const [soloPorAgotarse, setSoloPorAgotarse] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem("prod_view") as ViewMode) || "lista",
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const setViewMode = (v: ViewMode) => {
    localStorage.setItem("prod_view", v);
    setView(v);
  };

  useEffect(() => {
    fetch_();
  }, []);

  const fetch_ = async () => {
    try {
      setLoading(true);
      const [p, c, pl] = await Promise.all([
        productosService.getAll(),
        categoriasService.getAll(),
        planService.get().catch(() => null),
      ]);
      setProductos(p);
      setCategorias(c);
      setPlan(pl);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Cantidad total de productos por agotarse (bajo o agotado), para el badge.
  const porAgotarseCount = productos.filter((p) => {
    const st = getStockState(p);
    return st === "out" || st === "low";
  }).length;

  // Filtrar por vista activos/inactivos + categoría + stock + texto de búsqueda
  const q = search.trim().toLowerCase();
  const filtrados = productos
    .filter((p) => (vista === "disponibles" ? p.disponible : !p.disponible))
    .filter((p) =>
      filterCategoria === "all" ? true : p.categoria_id === filterCategoria,
    )
    .filter((p) => {
      if (!soloPorAgotarse) return true;
      const st = getStockState(p);
      return st === "out" || st === "low";
    })
    .filter(
      (p) =>
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion || "").toLowerCase().includes(q) ||
        (p.categoria_nombre || "").toLowerCase().includes(q),
    );

  const totalDisponibles = productos.filter((p) => p.disponible).length;
  const totalNoDisponibles = productos.filter((p) => !p.disponible).length;

  // Uso del plan (para el badge y bloquear el alta al llegar al límite).
  const suscripcionCancelada = plan?.estado_suscripcion === "cancelado";
  const usados = plan ? plan.productos_usados : productos.length;
  const limite = plan?.limite_productos ?? null;
  const alLimite = limite !== null && usados >= limite;
  const bloqueadoNuevo = suscripcionCancelada || alLimite;

  // Toggle disponible directamente desde la tabla
  const toggleDisponible = async (p: Producto) => {
    try {
      await productosService.update(p.id, {
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: p.precio,
        costo: p.costo ?? 0,
        imagen_url: p.imagen_url,
        categoria_id: p.categoria_id,
        disponible: !p.disponible,
        orden: p.orden,
        stock: p.stock ?? 0,
        controlar_stock: p.controlar_stock ?? false,
      });
      fetch_();
    } catch {
      alert(t("errStatusChange"));
    }
  };

  const openModal = (p?: Producto) => {
    setEditing(p || null);
    setForm(
      p
        ? {
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio: p.precio,
            costo: p.costo ?? 0,
            imagen_url: p.imagen_url || "",
            categoria_id: p.categoria_id,
            disponible: p.disponible,
            orden: p.orden,
            stock: p.stock ?? 0,
            controlar_stock: p.controlar_stock ?? false,
          }
        : {
            nombre: "",
            descripcion: "",
            precio: 0,
            costo: 0,
            imagen_url: "",
            categoria_id: categorias[0]?.id || 0,
            disponible: true,
            orden: productos.length + 1,
            stock: 0,
            controlar_stock: false,
          },
    );
    setAtributos(
      p?.atributos
        ? Object.entries(p.atributos).map(([clave, valor]) => ({
            clave,
            valor: valor == null ? "" : String(valor),
          }))
        : [],
    );
    setImagePreview(p?.imagen_url || "");
    setImageFile(null);
    setUploadError("");
    setSaveError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setImageFile(null);
    setImagePreview("");
    setUploadError("");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    setForm((prev) => ({ ...prev, imagen_url: "" }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setUploadError("");
    setSaveError("");
    try {
      let url = form.imagen_url;
      if (imageFile) {
        setUploading(true);
        try {
          url = (await uploadService.uploadImagen(imageFile)).url;
        } catch {
          setUploadError(t("prodUploadError"));
          setSaving(false);
          setUploading(false);
          return;
        } finally {
          setUploading(false);
        }
      }
      // Pares clave/valor → objeto (descarta filas sin clave).
      const atributosObj = atributos.reduce<Record<string, string>>(
        (acc, { clave, valor }) => {
          const k = clave.trim();
          if (k) acc[k] = valor;
          return acc;
        },
        {},
      );
      const data = { ...form, imagen_url: url || null, atributos: atributosObj };
      editing
        ? await productosService.update(editing.id, data)
        : await productosService.create(data);
      await fetch_();
      closeModal();
    } catch (err) {
      // Muestra el mensaje real del backend (p. ej. límite de plan 403).
      setSaveError(getApiErrorMessage(err, t("prodSaveError")));
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => fmtMoney(n, moneda);
  const inputFocus = (e: React.FocusEvent<any>) =>
    (e.target.style.borderColor = "#3b82f6");
  const inputBlur = (e: React.FocusEvent<any>) =>
    (e.target.style.borderColor = "rgba(0,0,0,0.1)");

  const textPrimary = isDark ? "#f1f5f9" : "#1e293b";
  const textMuted = isDark ? "#94a3b8" : "#94a3b8";
  const cardBg = isDark ? "#1a1d27" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  // Badge de stock con parpadeo cuando está bajo/agotado, para que "salte" a
  // la vista. Si el producto no controla stock, no muestra nada.
  const renderStock = (p: Producto, big = false) => {
    const st = getStockState(p);
    if (!st) return null;
    const n = p.stock ?? 0;
    if (st === "ok") {
      return (
        <span style={{ fontSize: big ? 12 : 11, color: textMuted, fontWeight: 600 }}>
          {t("unitsShort", { n })}
        </span>
      );
    }
    const isOut = st === "out";
    const color = isOut ? "#ef4444" : "#f59e0b";
    const bg = isOut ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.14)";
    const label = isOut ? t("soldOut") : `${t("lowStock")} · ${t("unitsShort", { n })}`;
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: big ? 12 : 11,
          fontWeight: 700,
          padding: "3px 10px",
          borderRadius: 20,
          background: bg,
          color,
          border: `1px solid ${color}55`,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
            animation: `${isOut ? "stockPulseRed" : "stockPulseAmber"} 1.3s ease-in-out infinite`,
          }}
        />
        {label}
      </span>
    );
  };

  return (
    <AdminLayout title={t("navProductos")}>
      {/* ── Toolbar: búsqueda + filtros + vista ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Búsqueda por texto */}
        <div
          style={{
            position: "relative",
            flex: "1 1 220px",
            minWidth: 180,
            maxWidth: 340,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: textMuted,
              display: "flex",
              pointerEvents: "none",
            }}
          >
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("prodSearchPh")}
            style={{ ...S.input, padding: "8px 30px 8px 32px" }}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              title={t("actionCancel")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: textMuted,
                display: "flex",
                padding: 2,
              }}
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            background: cardBg,
            borderRadius: 10,
            padding: 3,
            border: `1px solid ${cardBorder}`,
          }}
        >
          <button
            onClick={() => setVista("disponibles")}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              transition: "all 0.15s",
              background: vista === "disponibles" ? "#f0f2f5" : "transparent",
              color: vista === "disponibles" ? "#059669" : "#64748b",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#10b981",
                display: "inline-block",
              }}
            />
            {t("prodAvailable")}
            <span
              style={{
                fontSize: 11,
                background: "rgba(16,185,129,0.15)",
                color: "#34d399",
                padding: "1px 7px",
                borderRadius: 99,
              }}
            >
              {totalDisponibles}
            </span>
          </button>
          <button
            onClick={() => setVista("no_disponibles")}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              transition: "all 0.15s",
              background:
                vista === "no_disponibles" ? "#f0f2f5" : "transparent",
              color: vista === "no_disponibles" ? "#dc2626" : "#64748b",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#ef4444",
                display: "inline-block",
              }}
            />
            {t("prodUnavailable")}
            <span
              style={{
                fontSize: 11,
                background: "rgba(239,68,68,0.12)",
                color: "#f87171",
                padding: "1px 7px",
                borderRadius: 99,
              }}
            >
              {totalNoDisponibles}
            </span>
          </button>
        </div>

        {/* Filtro por categoría */}
        <select
          value={filterCategoria}
          onChange={(e) =>
            setFilterCategoria(
              e.target.value === "all" ? "all" : Number(e.target.value),
            )
          }
          style={{
            ...S.input,
            width: "auto",
            padding: "7px 12px",
            fontSize: 12,
            cursor: "pointer",
          }}
          onFocus={inputFocus}
          onBlur={inputBlur}
        >
          <option value="all">{t("prodAllCategories")}</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        {/* Filtro rápido: productos por agotarse (stock bajo o agotado) */}
        <button
          onClick={() => setSoloPorAgotarse((v) => !v)}
          title={t("filterLowStock")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 12px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 12.5,
            fontWeight: 600,
            transition: "all 0.15s",
            border: `1px solid ${soloPorAgotarse ? "#f59e0b" : cardBorder}`,
            background: soloPorAgotarse
              ? "rgba(245,158,11,0.14)"
              : cardBg,
            color: soloPorAgotarse ? "#d97706" : textMuted,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: porAgotarseCount > 0 ? "#f59e0b" : "#cbd5e1",
              flexShrink: 0,
              animation:
                porAgotarseCount > 0 && !soloPorAgotarse
                  ? "stockPulseAmber 1.3s ease-in-out infinite"
                  : "none",
            }}
          />
          {t("filterLowStock")}
          {porAgotarseCount > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: soloPorAgotarse ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.16)",
                color: "#d97706",
                padding: "1px 7px",
                borderRadius: 99,
              }}
            >
              {porAgotarseCount}
            </span>
          )}
        </button>

        <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: 4 }}>
          {t("prodCount", { n: filtrados.length })}
        </span>

        {/* Uso del plan: X / límite */}
        {limite !== null && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 99,
              background: alLimite
                ? "rgba(239,68,68,0.12)"
                : "rgba(59,130,246,0.1)",
              color: alLimite ? "#dc2626" : "#3b82f6",
            }}
            title={t("prodPlanTitle", { plan: plan?.tipo_plan || "", limit: limite })}
          >
            {t("prodPlanUsage", {
              used: usados,
              limit: limite === 9999 ? "∞" : limite,
            })}
          </span>
        )}

        {/* Toggle de vista Lista / Tarjetas */}
        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            background: cardBg,
            borderRadius: 10,
            padding: 3,
            border: `1px solid ${cardBorder}`,
          }}
        >
          {(
            [
              { key: "lista", label: t("viewList"), Icon: ListIcon },
              { key: "cards", label: t("viewCards"), Icon: GridIcon },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              title={v.label}
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
                background:
                  view === v.key ? (isDark ? "#0f1117" : "#f0f2f5") : "transparent",
                color: view === v.key ? "#3b82f6" : textMuted,
              }}
            >
              <v.Icon />
              {v.label}
            </button>
          ))}
        </div>

        {/* Botón nuevo — a la derecha */}
        <button
          disabled={bloqueadoNuevo}
          style={{
            ...S.btnPrimary,
            opacity: bloqueadoNuevo ? 0.5 : 1,
            cursor: bloqueadoNuevo ? "not-allowed" : "pointer",
          }}
          title={
            suscripcionCancelada
              ? t("prodSubCancelled")
              : alLimite
                ? t("prodLimitReached", { limit: limite })
                : t("prodNew")
          }
          onClick={() => !bloqueadoNuevo && openModal()}
          onMouseEnter={(e) => {
            if (!bloqueadoNuevo) e.currentTarget.style.background = "#2563eb";
          }}
          onMouseLeave={(e) => {
            if (!bloqueadoNuevo) e.currentTarget.style.background = "#3b82f6";
          }}
        >
          <PlusIcon /> {t("prodNew")}
        </button>
      </div>

      {/* ── Resultados ── */}
      {loading ? (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <div
              style={{
                width: 28,
                height: 28,
                border: "2px solid #3b82f6",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
          </div>
        </div>
      ) : filtrados.length === 0 ? (
        <div style={S.card}>
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "center", color: "#cbd5e1" }}>
              {q || filterCategoria !== "all" || soloPorAgotarse ? (
                <SearchIcon size={30} />
              ) : vista === "disponibles" ? (
                <IconCheck size={32} />
              ) : (
                <IconBan size={32} />
              )}
            </div>
            <div style={{ fontSize: 14 }}>
              {q || filterCategoria !== "all" || soloPorAgotarse
                ? t("searchNoResults")
                : vista === "disponibles"
                  ? t("prodEmptyAvailable")
                  : t("prodEmptyUnavailable")}
            </div>
          </div>
        </div>
      ) : view === "cards" ? (
        /* ── Vista Tarjetas ── */
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          }}
        >
          {filtrados.map((p) => {
            const st = getStockState(p);
            const alertColor = st === "out" ? "#ef4444" : st === "low" ? "#f59e0b" : null;
            return (
              <div
                key={p.id}
                style={{
                  ...S.card,
                  padding: 0,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  border: alertColor ? `1px solid ${alertColor}66` : (S.card.border as string),
                }}
              >
                <div
                  style={{
                    position: "relative",
                    height: 128,
                    background: isDark ? "#0f1117" : "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {p.imagen_url ? (
                    <img
                      src={cld(p.imagen_url, { w: 360, h: 220, fill: true }) || p.imagen_url}
                      alt={p.nombre}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span style={{ color: "#94a3b8", opacity: 0.55 }}>
                      <IconImage size={30} />
                    </span>
                  )}
                  {alertColor && (
                    <div style={{ position: "absolute", top: 8, left: 8 }}>
                      {renderStock(p)}
                    </div>
                  )}
                </div>
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: textPrimary, fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
                      <Highlight text={p.nombre} query={search} />
                    </span>
                    <span style={{ color: textPrimary, fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap" }}>
                      {fmt(p.precio)}
                    </span>
                  </div>
                  {p.descripcion && (
                    <div
                      style={{
                        color: textMuted,
                        fontSize: 11.5,
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {p.descripcion}
                    </div>
                  )}
                  <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 2 }}>
                    <span style={{ ...S.badgeBlue, background: "rgba(59,130,246,0.08)" }}>
                      {p.categoria_nombre}
                    </span>
                    <button
                      onClick={() => openModal(p)}
                      style={{ background: "none", border: "none", color: "#60a5fa", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
                    >
                      {t("actionEdit")}
                    </button>
                  </div>
                  <button
                    onClick={() => toggleDisponible(p)}
                    title={p.disponible ? t("clickToDeactivate") : t("clickToActivate")}
                    style={{
                      ...(p.disponible ? S.badgeGreen : S.badgeRed),
                      justifyContent: "center",
                      cursor: "pointer",
                      border: "none",
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: p.disponible ? "#10b981" : "#ef4444" }} />
                    {p.disponible ? t("statusAvailable") : t("statusUnavailableShort")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Vista Lista (tabla) ── */
        <div style={S.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={S.thead}>
                <tr>
                  {[
                    { k: "img", label: "" },
                    { k: "prod", label: t("colProduct") },
                    { k: "cat", label: t("colCategory") },
                    { k: "price", label: t("colPrice") },
                    { k: "stock", label: t("stockLabel") },
                    { k: "status", label: t("colStatus") },
                    { k: "ord", label: t("colOrderShort") },
                    { k: "act", label: t("colActions") },
                  ].map((h) => (
                    <th key={h.k} style={S.th}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const st = getStockState(p);
                  const alertColor = st === "out" ? "#ef4444" : st === "low" ? "#f59e0b" : null;
                  return (
                  <tr
                    key={p.id}
                    style={S.tr}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(0,0,0,0.02)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <td
                      style={{
                        ...S.td,
                        width: 44,
                        borderLeft: `3px solid ${alertColor || "transparent"}`,
                      }}
                    >
                      {p.imagen_url ? (
                        <img
                          src={cld(p.imagen_url, { w: 72, h: 72, fill: true }) || p.imagen_url}
                          alt={p.nombre}
                          loading="lazy"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            objectFit: "cover",
                            border: "1px solid rgba(0,0,0,0.06)",
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: "rgba(0,0,0,0.04)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#94a3b8",
                          }}
                        >
                          <IconImage size={18} />
                        </div>
                      )}
                    </td>
                    <td style={{ ...S.td, maxWidth: 220 }}>
                      <div
                        style={{
                          color: textPrimary,
                          fontWeight: 600,
                          fontSize: 13.5,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Highlight text={p.nombre} query={search} />
                      </div>
                      {p.descripcion && (
                        <div
                          style={{
                            color: "#94a3b8",
                            fontSize: 11,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            marginTop: 2,
                          }}
                        >
                          {p.descripcion}
                        </div>
                      )}
                    </td>
                    <td style={S.td}>
                      <span style={{ ...S.badgeBlue, background: "rgba(59,130,246,0.08)" }}>
                        <Highlight text={p.categoria_nombre || ""} query={search} />
                      </span>
                    </td>
                    <td
                      style={{
                        ...S.td,
                        color: textPrimary,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmt(p.precio)}
                    </td>
                    <td style={S.td}>{renderStock(p) || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                    <td style={S.td}>
                      {/* Toggle disponible directamente */}
                      <button
                        onClick={() => toggleDisponible(p)}
                        title={
                          p.disponible
                            ? t("clickToDeactivate")
                            : t("clickToActivate")
                        }
                        style={{
                          ...(p.disponible ? S.badgeGreen : S.badgeRed),
                          cursor: "pointer",
                          border: "none",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.opacity = "0.75")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = "1")
                        }
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: p.disponible ? "#10b981" : "#ef4444",
                          }}
                        />
                        {p.disponible ? t("statusAvailable") : t("statusUnavailableShort")}
                      </button>
                    </td>
                    <td style={S.tdMuted}>{p.orden}</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 14 }}>
                        <button
                          onClick={() => openModal(p)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#60a5fa",
                            fontSize: 13,
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          {t("actionEdit")}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          style={{
            ...S.overlay,
            alignItems: "flex-start",
            paddingTop: 20,
            overflowY: "auto",
          }}
        >
          <div style={{ ...S.modal, maxWidth: 560, marginBottom: 20 }}>
            <div style={S.modalHeader}>
              <span style={{ color: "#1e293b", fontWeight: 600, fontSize: 15 }}>
                {editing ? t("prodEditTitle") : t("prodNew")}
              </span>
              <button
                onClick={closeModal}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  display: "flex",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              >
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={submit}>
              <div
                style={{
                  ...S.modalBody,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div>
                  <label style={S.label}>{t("prodNameField")}</label>
                  <input
                    style={S.input}
                    required
                    value={form.nombre}
                    placeholder={t("prodNamePh")}
                    onChange={(e) =>
                      setForm({ ...form, nombre: e.target.value })
                    }
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>
                <div>
                  <label style={S.label}>{t("prodDescField")}</label>
                  <textarea
                    style={
                      {
                        ...S.input,
                        resize: "none",
                        height: 70,
                        fontFamily: "inherit",
                      } as React.CSSProperties
                    }
                    value={form.descripcion}
                    placeholder={t("prodDescPh")}
                    onChange={(e) =>
                      setForm({ ...form, descripcion: e.target.value })
                    }
                    onFocus={inputFocus as any}
                    onBlur={inputBlur as any}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={S.label}>{t("prodPriceField")}</label>
                    <input
                      style={S.input}
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={form.precio}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          precio: parseFloat(e.target.value) || 0,
                        })
                      }
                      onFocus={inputFocus}
                      onBlur={inputBlur}
                    />
                  </div>
                  <div>
                    <label style={S.label}>{t("prodCategoryField")}</label>
                    <select
                      style={{ ...S.input, cursor: "pointer" }}
                      required
                      value={form.categoria_id}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          categoria_id: parseInt(e.target.value),
                        })
                      }
                      onFocus={inputFocus as any}
                      onBlur={inputBlur as any}
                    >
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Costo y stock */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={S.label}>{t("prodCostField")}</label>
                    <input
                      style={S.input}
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.costo}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          costo: parseFloat(e.target.value) || 0,
                        })
                      }
                      onFocus={inputFocus}
                      onBlur={inputBlur}
                    />
                  </div>
                  <div>
                    <label style={S.label}>{t("prodStockField")}</label>
                    <input
                      style={{
                        ...S.input,
                        opacity: form.controlar_stock ? 1 : 0.5,
                      }}
                      type="number"
                      min="0"
                      disabled={!form.controlar_stock}
                      value={form.stock}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          stock: parseInt(e.target.value) || 0,
                        })
                      }
                      onFocus={inputFocus}
                      onBlur={inputBlur}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    marginTop: -2,
                  }}
                  onClick={() =>
                    setForm({
                      ...form,
                      controlar_stock: !form.controlar_stock,
                    })
                  }
                >
                  <div
                    style={{
                      width: 38,
                      height: 22,
                      borderRadius: 11,
                      background: form.controlar_stock
                        ? "#10b981"
                        : "rgba(0,0,0,0.1)",
                      position: "relative",
                      transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 3,
                        left: form.controlar_stock ? 18 : 3,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      }}
                    />
                  </div>
                  <span style={{ color: "#64748b", fontSize: 13 }}>
                    {t("prodControlStock")}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <label style={S.label}>{t("prodOrderField")}</label>
                    <input
                      style={S.input}
                      type="number"
                      min="1"
                      value={form.orden}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          orden: parseInt(e.target.value) || 0,
                        })
                      }
                      onFocus={inputFocus}
                      onBlur={inputBlur}
                    />
                  </div>
                  <div style={{ paddingBottom: 2 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        setForm({ ...form, disponible: !form.disponible })
                      }
                    >
                      <div
                        style={{
                          width: 38,
                          height: 22,
                          borderRadius: 11,
                          background: form.disponible
                            ? "#3b82f6"
                            : "rgba(0,0,0,0.1)",
                          position: "relative",
                          transition: "background 0.2s",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 3,
                            left: form.disponible ? 18 : 3,
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "left 0.2s",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          }}
                        />
                      </div>
                      <span style={{ color: "#64748b", fontSize: 13 }}>
                        {t("prodAvailableField")}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <label style={S.label}>{t("prodImageField")}</label>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    {imagePreview && (
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <img
                          src={imagePreview}
                          alt="preview"
                          style={{
                            width: 72,
                            height: 72,
                            objectFit: "cover",
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.08)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "#ef4444",
                            border: "none",
                            color: "#fff",
                            fontSize: 10,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <div
                      onClick={() => fileRef.current?.click()}
                      style={{
                        flex: 1,
                        border: "2px dashed rgba(0,0,0,0.1)",
                        borderRadius: 10,
                        padding: 14,
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor =
                          "rgba(59,130,246,0.4)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor =
                          "rgba(0,0,0,0.1)")
                      }
                    >
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleFile}
                        style={{ display: "none" }}
                      />
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {imagePreview ? t("prodChangeImage") : t("prodSelectImage")}
                      </div>
                      <div
                        style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}
                      >
                        {t("prodImageHint")}
                      </div>
                    </div>
                  </div>
                  {uploadError && (
                    <div
                      style={{ fontSize: 11, color: "#f87171", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <IconAlert size={13} style={{ flexShrink: 0 }} /> {uploadError}
                    </div>
                  )}
                  {imageFile && !uploadError && (
                    <div
                      style={{ fontSize: 11, color: "#60a5fa", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <IconImage size={13} style={{ flexShrink: 0 }} /> {t("prodImageWillUpload", { name: imageFile.name })}
                    </div>
                  )}
                </div>

                {/* Atributos libres por rubro (marca, material, etc.) */}
                <div
                  style={{
                    borderTop: "1px solid rgba(0,0,0,0.08)",
                    paddingTop: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>
                        {t("attrTitle")}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
                        {t("attrSubtitle")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAtributos((a) => [...a, { clave: "", valor: "" }])
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "7px 10px",
                        borderRadius: 8,
                        border: "1px solid #3b82f6",
                        color: "#3b82f6",
                        background: "rgba(59,130,246,0.06)",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <IconPlus size={13} /> {t("attrAddField")}
                    </button>
                  </div>
                  {atributos.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {atributos.map((a, i) => (
                        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            style={{ ...S.input, flex: "0 0 40%" }}
                            placeholder={t("attrKeyPh")}
                            value={a.clave}
                            onChange={(e) =>
                              setAtributos((arr) =>
                                arr.map((x, j) =>
                                  j === i ? { ...x, clave: e.target.value } : x,
                                ),
                              )
                            }
                            onFocus={inputFocus}
                            onBlur={inputBlur}
                          />
                          <input
                            style={{ ...S.input, flex: 1 }}
                            placeholder={t("attrValuePh")}
                            value={a.valor}
                            onChange={(e) =>
                              setAtributos((arr) =>
                                arr.map((x, j) =>
                                  j === i ? { ...x, valor: e.target.value } : x,
                                ),
                              )
                            }
                            onFocus={inputFocus}
                            onBlur={inputBlur}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setAtributos((arr) => arr.filter((_, j) => j !== i))
                            }
                            title={t("attrRemove")}
                            style={{
                              border: "none",
                              background: "none",
                              color: "#ef4444",
                              cursor: "pointer",
                              display: "flex",
                              padding: "0 4px",
                            }}
                          >
                            <IconX size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Variantes/opciones — solo para productos ya creados. */}
                {editing ? (
                  <VariantesEditor productoId={editing.id} />
                ) : (
                  <div
                    style={{
                      borderTop: "1px solid rgba(0,0,0,0.08)",
                      paddingTop: 12,
                      fontSize: 12,
                      color: "#94a3b8",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <IconInfo size={14} /> {t("attrSaveFirst")}
                  </div>
                )}
              </div>
              {saveError && (
                <div
                  style={{
                    margin: "0 20px",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#dc2626",
                    fontSize: 12.5,
                    lineHeight: 1.4,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <IconAlert size={15} style={{ flexShrink: 0 }} /> {saveError}
                </div>
              )}
              <div style={S.modalFooter}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{ ...S.btnGhost, flex: 1, justifyContent: "center" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(0,0,0,0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(0,0,0,0.04)")
                  }
                >
                  {t("actionCancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...S.btnPrimary,
                    flex: 1,
                    justifyContent: "center",
                    opacity: saving ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!saving)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "#2563eb";
                  }}
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background =
                      "#3b82f6")
                  }
                >
                  {saving
                    ? uploading
                      ? t("prodUploading")
                      : t("saving")
                    : editing
                      ? t("actionUpdate")
                      : t("prodCreate")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes stockPulseRed{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.6)}70%{box-shadow:0 0 0 5px rgba(239,68,68,0)}}
        @keyframes stockPulseAmber{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.6)}70%{box-shadow:0 0 0 5px rgba(245,158,11,0)}}
      `}</style>
    </AdminLayout>
  );
}
