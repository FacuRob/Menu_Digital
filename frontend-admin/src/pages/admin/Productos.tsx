import { useState, useEffect, useRef } from "react";
import { useDialogos } from "../../lib/dialogos";
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
import Modal from "../../components/Modal";
import { useNegocio } from "../../context/NegocioContext";
import { fmtMoney } from "../../lib/money";
import { cld } from "../../lib/cloudinary";
import { useLang } from "../../lib/i18n";
import { SearchIcon, ListIcon, GridIcon, Highlight } from "../../lib/listUi";
import { MOBILE_QUERY, useIsMobile } from "../../lib/useIsMobile";
import { SideNav, SectionCard, SeccionPanel } from "../../components/SeccionesUi";
import { abrirSeccionInvalida } from "../../lib/secciones";
import { Switch, Segmented } from "../../components/ui";
import { Campo, InfoTip } from "../../components/InfoTip";
import {
  IconPlus,
  IconX,
  IconInfo,
  IconCheck,
  IconBan,
  IconImage,
  IconAlert,
  IconBox,
  IconList,
  IconSparkle,
} from "../../lib/icons";

type ProdSeccion = "datos" | "precio" | "imagen" | "stock" | "atributos" | "opciones";

const IconCoin = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.7 0-2.8.8-2.8 2s1.1 1.7 2.8 2 2.8.8 2.8 2-1.1 2-2.8 2c-1.3 0-2.4-.5-2.9-1.3M12 6.5v11" />
  </svg>
);

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
  const { avisar } = useDialogos();
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
    unidad_venta: "unidad" as "unidad" | "kg",
  });
  // Valores al abrir el modal: marcan con un punto las secciones con cambios.
  const [inicial, setInicial] = useState(form);
  const [atributosIniciales, setAtributosIniciales] = useState("[]");
  const [seccion, setSeccion] = useState<ProdSeccion>("datos");
  const isMobile = useIsMobile();
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
  // Vista elegida; si nunca eligió: tarjetas en el celular (la tabla no entra).
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const g = localStorage.getItem("prod_view");
      if (g === "lista" || g === "cards") return g;
    } catch {
      /* sin storage */
    }
    return window.matchMedia(MOBILE_QUERY).matches ? "cards" : "lista";
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const setViewMode = (v: ViewMode) => {
    try {
      localStorage.setItem("prod_view", v);
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
      void avisar({ mensaje: t("errStatusChange"), tipo: "error" });
    }
  };

  // Producto nuevo con "Personalizable" encendido: al guardarlo, el formulario
  // queda abierto para cargar los grupos y valores.
  const [nuevoPersonalizable, setNuevoPersonalizable] = useState(false);
  const [abrirVariantes, setAbrirVariantes] = useState(false);

  const openModal = (p?: Producto) => {
    setNuevoPersonalizable(false);
    setAbrirVariantes(false);
    setSeccion("datos");
    setEditing(p || null);
    const valores: typeof form =
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
            unidad_venta: p.unidad_venta ?? "unidad",
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
            unidad_venta: "unidad",
          };
    setForm(valores);
    setInicial(valores);
    const attrs = p?.atributos
      ? Object.entries(p.atributos).map(([clave, valor]) => ({
          clave,
          valor: valor == null ? "" : String(valor),
        }))
      : [];
    setAtributos(attrs);
    setAtributosIniciales(JSON.stringify(attrs));
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
      // `unidad_venta` sólo viaja si es "kg" o si la base ya tiene la columna
      // (el producto la trae): así guardar no falla antes de la migración.
      const { unidad_venta, ...resto } = form;
      const mandarUnidad = unidad_venta === "kg" || editing?.unidad_venta !== undefined;
      const data = {
        ...resto,
        ...(mandarUnidad ? { unidad_venta } : {}),
        imagen_url: url || null,
        atributos: atributosObj,
      };
      if (editing) {
        await productosService.update(editing.id, data);
        await fetch_();
        closeModal();
      } else {
        const creado = await productosService.create(data);
        await fetch_();
        if (nuevoPersonalizable && creado?.id) {
          openModal(creado);
          setAbrirVariantes(true);
          setSeccion("opciones");
        } else {
          closeModal();
        }
      }
    } catch (err) {
      // Muestra el mensaje real del backend (p. ej. límite de plan 403).
      setSaveError(getApiErrorMessage(err, t("prodSaveError")));
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => fmtMoney(n, moneda);
  // ¿Cambió alguno de estos campos desde que se abrió? (sólo al editar)
  const cambio = (...campos: (keyof typeof form)[]) =>
    !!editing && campos.some((c) => form[c] !== inicial[c]);

  const textPrimary = "var(--fg)";
  const textMuted = "var(--fg-3)";
  const cardBg = "var(--surface)";
  const cardBorder = "var(--line)";

  // Badge de stock con parpadeo cuando está bajo/agotado, para que "salte" a
  // la vista. Si el producto no controla stock, no muestra nada.
  const renderStock = (p: Producto, big = false) => {
    const st = getStockState(p);
    if (!st) return null;
    const n = p.stock ?? 0;
    if (st === "ok") {
      return (
        <span style={{ fontSize: big ? 12 : 11, color: textMuted, fontWeight: 600 }}>
          {p.unidad_venta === "kg" ? `${n} kg` : t("unitsShort", { n })}
        </span>
      );
    }
    const isOut = st === "out";
    const color = isOut ? "var(--err)" : "var(--warn)";
    const bg = isOut ? "var(--err-bg)" : "var(--warn-bg)";
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
          border: `1px solid color-mix(in srgb, ${color} 33%, transparent)`,
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
            aria-label={t("prodSearchPh")}
            style={{ ...S.input, padding: "8px 30px 8px 32px" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label={t("clearSearch")}
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
              background: vista === "disponibles" ? "var(--surface-3)" : "transparent",
              color: vista === "disponibles" ? "var(--ok)" : "var(--fg-3)",
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
                background: "var(--ok)",
                display: "inline-block",
              }}
            />
            {t("prodAvailable")}
            <span
              style={{
                fontSize: 11,
                background: "var(--ok-bg)",
                color: "var(--ok)",
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
                vista === "no_disponibles" ? "var(--surface-3)" : "transparent",
              color: vista === "no_disponibles" ? "var(--err)" : "var(--fg-3)",
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
                background: "var(--err)",
                display: "inline-block",
              }}
            />
            {t("prodUnavailable")}
            <span
              style={{
                fontSize: 11,
                background: "var(--err-bg)",
                color: "var(--err)",
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
          aria-label={t("filterCategory")}
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
            border: `1px solid ${soloPorAgotarse ? "var(--warn)" : cardBorder}`,
            background: soloPorAgotarse
              ? "var(--warn-bg)"
              : cardBg,
            color: soloPorAgotarse ? "var(--warn)" : textMuted,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: porAgotarseCount > 0 ? "var(--warn)" : "var(--fg-3)",
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
                background: soloPorAgotarse ? "color-mix(in srgb, var(--warn) 25%, transparent)" : "var(--warn-bg)",
                color: "var(--warn)",
                padding: "1px 7px",
                borderRadius: 99,
              }}
            >
              {porAgotarseCount}
            </span>
          )}
        </button>

        <span style={{ color: "var(--fg-3)", fontSize: 12, marginLeft: 4 }}>
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
                ? "var(--err-bg)"
                : "var(--info-bg)",
              color: alLimite ? "var(--err)" : "var(--info)",
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
                  view === v.key ? "var(--surface-3)" : "transparent",
                color: view === v.key ? "var(--info)" : textMuted,
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
            if (!bloqueadoNuevo) e.currentTarget.style.background = "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            if (!bloqueadoNuevo) e.currentTarget.style.background = "var(--accent)";
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
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "center", color: "var(--fg-3)" }}>
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
            const alertColor = st === "out" ? "var(--err)" : st === "low" ? "var(--warn)" : null;
            return (
              <div
                key={p.id}
                style={{
                  ...S.card,
                  padding: 0,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  border: alertColor ? `1px solid color-mix(in srgb, ${alertColor} 40%, transparent)` : (S.card.border as string),
                }}
              >
                <div
                  style={{
                    position: "relative",
                    height: 128,
                    background: "var(--surface-2)",
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
                    <span style={{ color: "var(--fg-3)", opacity: 0.55 }}>
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
                      {p.unidad_venta === "kg" && <span style={{ color: textMuted, fontWeight: 500 }}> /kg</span>}
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
                    <span style={{ ...S.badgeBlue, background: "var(--info-bg)" }}>
                      {p.categoria_nombre}
                    </span>
                    <button
                      onClick={() => openModal(p)}
                      style={{ background: "none", border: "none", color: "var(--info)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
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
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: p.disponible ? "var(--ok)" : "var(--err)" }} />
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
                    <th key={h.k} scope="col" style={S.th}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const st = getStockState(p);
                  const alertColor = st === "out" ? "var(--err)" : st === "low" ? "var(--warn)" : null;
                  return (
                  <tr
                    key={p.id}
                    style={S.tr}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--surface-2)")
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
                            border: "1px solid var(--line)",
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
                            background: "var(--surface-2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--fg-3)",
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
                            color: "var(--fg-3)",
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
                      <span style={{ ...S.badgeBlue, background: "var(--info-bg)" }}>
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
                      {p.unidad_venta === "kg" && <span style={{ color: textMuted, fontWeight: 500 }}> /kg</span>}
                    </td>
                    <td style={S.td}>{renderStock(p) || <span style={{ color: "var(--fg-3)" }}>—</span>}</td>
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
                            background: p.disponible ? "var(--ok)" : "var(--err)",
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
                            color: "var(--info)",
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

      {/* Modal: mismo diseño que "Configuración del menú" y "Mi cuenta". */}
      {showModal && (
        <Modal
          title={editing ? t("prodEditTitle") : t("prodNew")}
          subtitle={editing ? editing.nombre : undefined}
          onClose={closeModal}
          maxWidth={980}
          icon={<IconBox size={19} />}
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
                <SideNav<ProdSeccion>
                  value={seccion}
                  onChange={setSeccion}
                  isMobile={isMobile}
                  dirtyTitle={t("cfgUnsaved")}
                  groups={[
                    {
                      label: t("prodNavProduct"),
                      color: "var(--info)",
                      items: [
                        { id: "datos", label: t("prodSecData"), accent: "var(--info)", Icon: IconBox, dirty: cambio("nombre", "descripcion", "categoria_id") },
                        { id: "precio", label: t("prodSecPrice"), accent: "var(--warn)", Icon: IconCoin, dirty: cambio("unidad_venta", "precio", "costo") },
                        { id: "imagen", label: t("prodSecImage"), accent: "var(--violet)", Icon: IconImage, dirty: !!editing && (!!imageFile || form.imagen_url !== inicial.imagen_url) },
                        { id: "stock", label: t("prodSecStock"), accent: "var(--ok)", Icon: IconCheck, dirty: cambio("controlar_stock", "stock", "orden", "disponible") },
                      ],
                    },
                    {
                      label: t("prodNavExtras"),
                      color: "var(--violet)",
                      items: [
                        { id: "atributos", label: t("attrTitle"), accent: "var(--teal)", Icon: IconList, dirty: !!editing && JSON.stringify(atributos) !== atributosIniciales },
                        { id: "opciones", label: t("prodSecOptions"), accent: "var(--chart-5)", Icon: IconSparkle },
                      ],
                    },
                  ]}
                />

                <div style={{ flex: 1, minWidth: 0, display: "grid" }}>
                  {/* ── Datos ── */}
                  <SeccionPanel id="datos" visible={seccion === "datos"}>
                    <SectionCard accent="var(--info)" title={t("prodSecData")} subtitle={t("prodSecDataSub")}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <Campo label={t("qProdName")}>
                          <input
                            style={S.input}
                            required
                            value={form.nombre}
                            placeholder={t("prodNamePh")}
                            onChange={(e) =>
                              setForm({ ...form, nombre: e.target.value })
                            }
                          />
                        </Campo>
                        <Campo label={t("qProdDesc")} info={t("iProdDesc")}>
                          <textarea
                            style={{ ...S.input, resize: "vertical", minHeight: 90, fontFamily: "inherit" }}
                            rows={3}
                            value={form.descripcion}
                            placeholder={t("prodDescPh")}
                            onChange={(e) =>
                              setForm({ ...form, descripcion: e.target.value })
                            }
                          />
                        </Campo>
                        <Campo label={t("qProdCat")}>
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
                          >
                            {categorias.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nombre}
                              </option>
                            ))}
                          </select>
                        </Campo>
                      </div>
                    </SectionCard>
                  </SeccionPanel>

                  {/* ── Precio y venta ── */}
                  <SeccionPanel id="precio" visible={seccion === "precio"}>
                    <SectionCard accent="var(--warn)" title={t("prodSecPrice")} subtitle={t("prodSecPriceSub")}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div>
                          <span className="dx-pregunta">{t("qProdSellBy")}</span>
                          <Segmented
                            label={t("qProdSellBy")}
                            value={form.unidad_venta}
                            options={[
                              { value: "unidad", label: t("qByUnit") },
                              { value: "kg", label: t("qByKg") },
                            ]}
                            onChange={(v) => setForm({ ...form, unidad_venta: v })}
                          />
                          {form.unidad_venta === "kg" && (
                            <div style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: 6 }}>{t("prodWeightHint")}</div>
                          )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                          <Campo
                            label={form.unidad_venta === "kg" ? t("qProdPriceKg") : t("qProdPrice")}
                            info={t("iProdPrice")}
                          >
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
                            />
                          </Campo>
                          <Campo
                            label={form.unidad_venta === "kg" ? t("qProdCostKg") : t("qProdCost")}
                            info={t("iProdCost")}
                          >
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
                            />
                          </Campo>
                        </div>
                        {form.costo > 0 && form.precio > 0 && (
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: form.precio >= form.costo ? "var(--ok)" : "var(--err)",
                            }}
                          >
                            {form.precio >= form.costo
                              ? t(form.unidad_venta === "kg" ? "prodMarginKg" : "prodMargin", {
                                  amount: fmt(form.precio - form.costo),
                                  pct: Math.round(((form.precio - form.costo) / form.precio) * 100),
                                })
                              : t(form.unidad_venta === "kg" ? "prodLossKg" : "prodLoss", {
                                  amount: fmt(form.costo - form.precio),
                                })}
                          </div>
                        )}
                      </div>
                    </SectionCard>
                  </SeccionPanel>

                  {/* ── Imagen ── */}
                  <SeccionPanel id="imagen" visible={seccion === "imagen"}>
                    <SectionCard accent="var(--violet)" title={t("prodSecImage")} subtitle={t("prodSecImageSub")}>
                      <div
                        style={{
                          display: "flex",
                          gap: 14,
                          alignItems: "stretch",
                          flexDirection: isMobile ? "column" : "row",
                        }}
                      >
                        {imagePreview && (
                          <div style={{ position: "relative", flexShrink: 0, alignSelf: isMobile ? "center" : "flex-start" }}>
                            <img
                              src={imagePreview}
                              alt={t("prodImageField")}
                              style={{
                                width: 140,
                                height: 140,
                                objectFit: "cover",
                                borderRadius: 12,
                                border: "1px solid var(--line)",
                                display: "block",
                              }}
                            />
                            <button
                              type="button"
                              onClick={removeImage}
                              aria-label={t("prodRemoveImage")}
                              style={{
                                position: "absolute",
                                top: -10,
                                right: -10,
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: "var(--err)",
                                border: "2px solid var(--surface)",
                                color: "var(--surface)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <IconX size={13} />
                            </button>
                          </div>
                        )}
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handleFile}
                          style={{ display: "none" }}
                          tabIndex={-1}
                          aria-hidden
                        />
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="hover:!border-[var(--focus)]"
                          style={{
                            flex: 1,
                            minHeight: 140,
                            border: "2px dashed var(--line-strong)",
                            borderRadius: 12,
                            padding: 18,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            textAlign: "center",
                            cursor: "pointer",
                            background: "var(--surface-2)",
                            font: "inherit",
                            color: "var(--fg-3)",
                            transition: "border-color 0.15s",
                          }}
                        >
                          <IconImage size={24} />
                          <span style={{ display: "block", color: "var(--fg-2)", fontSize: 13, fontWeight: 600 }}>
                            {imagePreview ? t("prodChangeImage") : t("prodSelectImage")}
                          </span>
                          <span style={{ display: "block", fontSize: 12 }}>
                            {t("prodImageHint")}
                          </span>
                        </button>
                      </div>
                      {uploadError && (
                        <div
                          style={{ fontSize: 11.5, color: "var(--err)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <IconAlert size={13} style={{ flexShrink: 0 }} /> {uploadError}
                        </div>
                      )}
                      {imageFile && !uploadError && (
                        <div
                          style={{ fontSize: 11.5, color: "var(--info)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <IconImage size={13} style={{ flexShrink: 0 }} /> {t("prodImageWillUpload", { name: imageFile.name })}
                        </div>
                      )}
                    </SectionCard>
                  </SeccionPanel>

                  {/* ── Stock y visibilidad ── */}
                  <SeccionPanel id="stock" visible={seccion === "stock"}>
                    <SectionCard accent="var(--ok)" title={t("prodSecStock")} subtitle={t("prodSecStockSub")}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Switch
                            checked={!!form.controlar_stock}
                            onChange={(v) => setForm({ ...form, controlar_stock: v })}
                            label={t("qProdTrackStock")}
                          />
                          <InfoTip texto={t("iProdTrackStock")} titulo={t("qProdTrackStock")} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                          {form.controlar_stock && (
                          <Campo label={form.unidad_venta === "kg" ? t("qProdStockKg") : t("qProdStock")}>
                            <input
                              style={S.input}
                              type="number"
                              min="0"
                              step={form.unidad_venta === "kg" ? "0.1" : "1"}
                              value={form.stock}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  stock:
                                    form.unidad_venta === "kg"
                                      ? Math.round((parseFloat(e.target.value) || 0) * 1000) / 1000
                                      : parseInt(e.target.value) || 0,
                                })
                              }
                            />
                          </Campo>
                          )}
                          <Campo label={t("qProdPos")} info={t("iProdPos")}>
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
                            />
                          </Campo>
                        </div>
                        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                          <Switch
                            checked={!!form.disponible}
                            onChange={(v) => setForm({ ...form, disponible: v })}
                            label={t("qProdAvailable")}
                            color="var(--info)"
                          />
                          <InfoTip texto={t("iProdAvailable")} titulo={t("qProdAvailable")} />
                        </div>
                      </div>
                    </SectionCard>
                  </SeccionPanel>

                  {/* ── Atributos libres por rubro (marca, material, etc.) ── */}
                  <SeccionPanel id="atributos" visible={seccion === "atributos"}>
                    <SectionCard accent="var(--teal)" title={t("attrTitle")} subtitle={t("prodSecAttrSub")} info={t("iAttr")}>
                      {atributos.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                          {atributos.map((a, i) => (
                            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <input
                                style={{ ...S.input, flex: "0 0 40%" }}
                                placeholder={t("attrKeyPh")}
                                aria-label={t("attrKeyPh")}
                                value={a.clave}
                                onChange={(e) =>
                                  setAtributos((arr) =>
                                    arr.map((x, j) =>
                                      j === i ? { ...x, clave: e.target.value } : x,
                                    ),
                                  )
                                }
                              />
                              <input
                                style={{ ...S.input, flex: 1, minWidth: 0 }}
                                placeholder={t("attrValuePh")}
                                aria-label={t("attrValuePh")}
                                value={a.valor}
                                onChange={(e) =>
                                  setAtributos((arr) =>
                                    arr.map((x, j) =>
                                      j === i ? { ...x, valor: e.target.value } : x,
                                    ),
                                  )
                                }
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setAtributos((arr) => arr.filter((_, j) => j !== i))
                                }
                                title={t("attrRemove")}
                                aria-label={t("attrRemove")}
                                style={{
                                  border: "none",
                                  background: "none",
                                  color: "var(--err)",
                                  cursor: "pointer",
                                  display: "grid",
                                  placeItems: "center",
                                  width: 36,
                                  height: 36,
                                  flexShrink: 0,
                                }}
                              >
                                <IconX size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setAtributos((a) => [...a, { clave: "", valor: "" }])
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--info)",
                          color: "var(--info)",
                          background: "var(--info-bg)",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        <IconPlus size={13} /> {t("prodAttrAdd")}
                      </button>
                    </SectionCard>
                  </SeccionPanel>

                  {/* ── Variantes/opciones — solo para productos ya creados. ── */}
                  <SeccionPanel id="opciones" visible={seccion === "opciones"}>
                    <SectionCard accent="var(--chart-5)" title={t("prodSecOptions")} subtitle={t("prodSecOptionsSub")} info={t("iOptions")}>
                      {editing ? (
                        <VariantesEditor key={editing.id} productoId={editing.id} iniciarActivo={abrirVariantes} />
                      ) : (
                        <div>
                          <Switch
                            checked={nuevoPersonalizable}
                            onChange={setNuevoPersonalizable}
                            label={<span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg)" }}>{t("varSwitch")}</span>}
                          />
                          <div style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: -4, display: "flex", alignItems: "center", gap: 6 }}>
                            <IconInfo size={13} /> {nuevoPersonalizable ? t("varNewHint") : t("varOffHint")}
                          </div>
                        </div>
                      )}
                    </SectionCard>
                  </SeccionPanel>
                </div>
              </div>
              {saveError && (
                <div
                  role="alert"
                  style={{
                    margin: "0 22px 16px",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "var(--err-bg)",
                    border: "1px solid color-mix(in srgb, var(--err) 35%, transparent)",
                    color: "var(--err)",
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
                      "var(--surface-2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "var(--surface)")
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
                        "var(--accent-hover)";
                  }}
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background =
                      "var(--accent)")
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
        </Modal>
      )}
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes stockPulseRed{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--err) 60%,transparent)}70%{box-shadow:0 0 0 5px transparent}}
        @keyframes stockPulseAmber{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--warn) 60%,transparent)}70%{box-shadow:0 0 0 5px transparent}}
        @media (prefers-reduced-motion: reduce){*{animation-name:none!important}}
      `}</style>
    </AdminLayout>
  );
}
