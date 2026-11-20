const { z } = require("zod");

// ── Auth ─────────────────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().trim().min(1, "El usuario es requerido").max(50),
  password: z.string().min(1, "La contraseña es requerida").max(200),
});

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(50),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(200),
  nombre: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email("Email inválido").max(120).optional().nullable(),
  rol: z.enum(["admin", "manager", "staff"]).optional(),
});

// Alta self-serve (crear cuenta nueva). Público, con rate-limit.
const signupSchema = z.object({
  negocio: z
    .string()
    .trim()
    .min(2, "El nombre del negocio es muy corto")
    .max(120),
  email: z.string().trim().toLowerCase().email("Email inválido").max(160),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(200),
});

// Alta / login con Google (se recibe el ID token de Google Identity Services).
const googleAuthSchema = z.object({
  credential: z.string().min(10, "Token de Google requerido").max(4000),
});

const forgotPasswordSchema = z.object({
  username: z.string().trim().min(1, "El usuario es requerido").max(50),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requerido").max(200),
  newPassword: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(200),
});

const changePasswordSchema = z.object({
  // Obligatoria salvo cuando el sistema exige el cambio (contraseña temporal).
  currentPassword: z.string().max(200).optional(),
  newPassword: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(200),
});

// Perfil propio: nombre visible y usuario de acceso.
const updateProfileSchema = z.object({
  nombre: z.string().trim().max(120).optional().nullable(),
  username: z
    .string()
    .trim()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(50)
    .regex(
      /^[A-Za-z0-9._@+-]+$/,
      "El usuario sólo puede tener letras, números y . _ @ + -",
    )
    .optional(),
});

// Cambio de email propio: pide la contraseña actual.
const changeEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido").max(120),
  currentPassword: z.string().min(1, "Ingresá tu contraseña actual").max(200),
});

// ── Productos ────────────────────────────────────────────────
// atributos: objeto libre por rubro. Acotado para evitar payloads abusivos
// (bloat de JSONB): máx. 30 claves, claves ≤60 y valores ≤300 caracteres.
const atributosSchema = z
  .record(
    z.string().max(60),
    z.union([z.string().max(300), z.number(), z.boolean(), z.null()]),
  )
  .refine((o) => Object.keys(o).length <= 30, {
    message: "Máximo 30 atributos por producto",
  });

const productoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido").max(150),
  descripcion: z.string().max(2000).optional().nullable(),
  precio: z.coerce.number().min(0).max(99999999),
  costo: z.coerce.number().min(0).max(99999999).optional(),
  imagen_url: z.string().max(500).optional().nullable(),
  // Varias fotos en orden (la primera es la principal). Ver db/producto_imagenes.sql.
  imagenes: z
    .array(z.string().trim().url().startsWith("https://", "Las fotos tienen que ser https").max(500))
    .max(6, "Máximo 6 fotos por producto")
    .optional(),
  categoria_id: z.coerce.number().int().positive(),
  disponible: z.coerce.boolean().optional(),
  orden: z.coerce.number().int().min(0).max(999999).optional(),
  // Por peso el stock va en kg con decimales (0.350 = 350 g).
  stock: z.coerce.number().min(0).max(9999999).optional(),
  controlar_stock: z.coerce.boolean().optional(),
  // "unidad" (como siempre) o "kg" (precio por kilo).
  unidad_venta: z.enum(["unidad", "kg"]).optional(),
  sku: z.string().trim().max(60).optional().nullable(),
  atributos: atributosSchema.optional(),
});

// ── Variantes / Modificadores (multi-rubro) ──────────────────
// Un grupo es un eje de elección del producto (Talle, Color, Extras).
// Sus opciones tienen precio_extra y stock opcional.
const varianteOpcionSchema = z.object({
  id: z.number().int().positive().optional(), // presente al editar
  nombre: z.string().trim().min(1, "La opción requiere nombre").max(80),
  precio_extra: z.coerce.number().min(0).max(9999999).optional().default(0),
  stock: z.coerce.number().int().min(0).max(9999999).optional().nullable(),
  activo: z.coerce.boolean().optional().default(true),
  orden: z.coerce.number().int().min(0).max(9999).optional().default(0),
});

const varianteGrupoSchema = z.object({
  nombre: z.string().trim().min(1, "El grupo requiere nombre").max(80),
  tipo: z.enum(["single", "multi"]).optional().default("single"),
  obligatorio: z.coerce.boolean().optional().default(false),
  orden: z.coerce.number().int().min(0).max(9999).optional().default(0),
  opciones: z.array(varianteOpcionSchema).max(100).optional().default([]),
});

const updateVarianteGrupoSchema = varianteGrupoSchema.partial().extend({
  opciones: z.array(varianteOpcionSchema).max(100).optional(),
});

// ── Pedidos (endpoint público) ───────────────────────────────
// Permisivo con la forma de los items (el controller recalcula precios reales
// desde la BD), pero acota tipos y longitudes para evitar payloads abusivos.
const pedidoItemSchema = z.object({
  producto_id: z.number().int().positive().optional(),
  // Unidades enteras, o kg con decimales si el producto se vende por peso
  // (el controller decide según el producto real).
  cantidad: z.coerce.number().positive().max(999).optional(),
  precio: z.coerce.number().min(0).optional(),
  nombre: z.string().max(200).optional(),
  // Ids de opciones de variante elegidas (multi-rubro). El backend
  // recalcula el precio_extra real desde la BD; no se confía en el cliente.
  opciones: z.array(z.coerce.number().int().positive()).max(30).optional(),
  // Personalización: valores por campo. El backend los valida contra los
  // campos reales del producto (utils/personalizacion.js).
  personalizacion: z
    .array(
      z.object({
        campo_id: z.number().int().positive(),
        valor: z
          .union([z.string().max(1000), z.number(), z.array(z.string().max(100)).max(30), z.null()])
          .optional(),
        adjunto: z.string().regex(/^[a-f0-9]{48}$/).optional(),
      }),
    )
    .max(20)
    .optional(),
});

const createPedidoSchema = z.object({
  items: z
    .array(pedidoItemSchema)
    .min(1, "El pedido debe incluir al menos un producto")
    .max(100),
  mesa: z.union([z.string().max(50), z.number()]).optional().nullable(),
  // Firma del QR de la mesa (?t=). Sin una firma válida no se acepta "mesa".
  mesa_token: z.string().max(64).optional().nullable(),
  cliente: z.string().trim().max(120).optional().nullable(),
  nota: z.string().trim().max(1000).optional().nullable(),
  tipo_entrega: z.enum(["mesa", "retiro", "delivery", "mostrador", "envio"]).optional().nullable(),
  // Para cuándo lo quiere (retiro o entrega programada).
  programado_para: z.string().datetime({ offset: true }).optional().nullable(),
  direccion_entrega: z.string().trim().max(300).optional().nullable(),
  telefono_cliente: z.string().trim().max(40).optional().nullable(),
  // Opt-in del cliente para recibir avisos del pedido por WhatsApp.
  acepta_whatsapp: z.boolean().optional(),
  // Medio de pago (si el local tiene alguno activo). Efectivo: con cuánto paga.
  metodo_pago: z.enum(["efectivo", "transferencia"]).optional().nullable(),
  paga_con: z.number().positive().max(10_000_000).optional().nullable(),
  // Transferencia: quién la hizo y el comprobante (token de /api/adjuntos?uso=comprobante).
  transfirio: z.string().trim().max(80).optional().nullable(),
  comprobante: z.string().max(64).optional().nullable(),
});

// ── Campos de personalización de un producto ─────────────────
const { TIPOS, TIPOS_ARCHIVO } = require("../utils/personalizacion");
const campoSchema = z
  .object({
    id: z.number().int().positive().optional(), // campo que ya existe
    tipo: z.enum(TIPOS),
    etiqueta: z.string().trim().min(1, "Cada campo necesita una etiqueta").max(80),
    ayuda: z.string().trim().max(200).optional().nullable(),
    opciones: z.array(z.string().trim().min(1).max(60)).max(30).optional().default([]),
    obligatorio: z.boolean().optional().default(false),
    validaciones: z
      .object({
        max_largo: z.number().int().min(1).max(1000).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        tipos: z.array(z.enum(TIPOS_ARCHIVO)).max(3).optional(),
      })
      .refine((v) => v.min === undefined || v.max === undefined || v.min <= v.max, {
        message: "El mínimo no puede ser mayor que el máximo",
      })
      .optional()
      .default({}),
  })
  .refine((c) => !["opcion", "multiple"].includes(c.tipo) || c.opciones.length > 0, {
    message: "Las listas de opciones necesitan al menos una opción",
  });
const camposSchema = z.object({ campos: z.array(campoSchema).max(20) });

// ── Servicios ────────────────────────────────────────────────
const servicioSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es requerido").max(150),
    descripcion: z.string().max(2000).optional().nullable(),
    imagen_url: z.string().url().startsWith("https://").max(500).optional().nullable(),
    categoria: z.string().trim().max(80).optional().nullable(),
    tipo_precio: z.enum(["fijo", "desde", "variable"]).optional().default("fijo"),
    precio: z.coerce.number().min(0).max(99999999).optional().nullable(),
    duracion_min: z.coerce.number().int().min(5).max(1440).optional().nullable(),
    modalidades: z.array(z.enum(["presencial", "domicilio", "virtual", "visita"])).min(1).max(4).optional().default(["presencial"]),
    requiere_turno: z.boolean().optional().default(false),
    requiere_presupuesto: z.boolean().optional().default(false),
    activo: z.boolean().optional().default(true),
    orden: z.coerce.number().int().min(0).max(999999).optional().default(0),
  })
  .refine((s) => s.tipo_precio === "variable" || (s.precio !== undefined && s.precio !== null), {
    message: "Indicá el precio (o elegí precio a consultar)",
    path: ["precio"],
  });

// ── Presupuestos ─────────────────────────────────────────────
const tokenAdjunto = z.string().regex(/^[a-f0-9]{48}$/);
const presupuestoSchema = z
  .object({
    producto_id: z.number().int().positive().optional().nullable(),
    servicio_id: z.number().int().positive().optional().nullable(),
    cliente_nombre: z.string().trim().min(1, "Poné tu nombre").max(120),
    telefono: z.string().trim().max(40).optional().nullable(),
    email: z.string().trim().email("Email inválido").max(160).optional().nullable().or(z.literal("")),
    acepta_whatsapp: z.boolean().optional(),
    descripcion: z.string().trim().min(5, "Contanos un poco más qué necesitás").max(3000),
    cantidad: z.coerce.number().int().min(1).max(100000).optional().default(1),
    medidas: z.string().trim().max(300).optional().nullable(),
    adjuntos: z.array(tokenAdjunto).max(5).optional(),
  })
  .refine((p) => !!(p.telefono || p.email), { message: "Dejá un teléfono o un email para responderte", path: ["telefono"] });
const respuestaPresupuestoSchema = z.object({ decision: z.enum(["aceptar", "rechazar"]) });
const estadoPresupuestoSchema = z.object({
  estado: z.enum(["en_revision", "rechazado", "cancelado"]),
  nota: z.string().trim().max(500).optional().nullable(),
});
const cotizacionSchema = z.object({
  precio: z.coerce.number().min(0).max(999999999),
  observaciones: z.string().trim().max(2000).optional().nullable(),
  valido_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// ── Reservas ─────────────────────────────────────────────────
const reservaSchema = z
  .object({
    servicio_id: z.number().int().positive(),
    inicio: z.string().datetime({ offset: true }),
    cliente_nombre: z.string().trim().min(1, "Poné tu nombre").max(120),
    telefono: z.string().trim().max(40).optional().nullable(),
    email: z.string().trim().email("Email inválido").max(160).optional().nullable().or(z.literal("")),
    acepta_whatsapp: z.boolean().optional(),
    notas: z.string().trim().max(500).optional().nullable(),
  })
  .refine((r) => !!(r.telefono || r.email), { message: "Dejá un teléfono o un email", path: ["telefono"] });
// Turno que carga el negocio: el contacto es opcional (cliente de mostrador).
const reservaManualSchema = z.object({
  servicio_id: z.number().int().positive(),
  inicio: z.string().datetime({ offset: true }),
  cliente_nombre: z.string().trim().min(1, "Poné el nombre del cliente").max(120),
  telefono: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email("Email inválido").max(160).optional().nullable().or(z.literal("")),
  notas: z.string().trim().max(500).optional().nullable(),
});
const reprogramarSchema = z.object({ inicio: z.string().datetime({ offset: true }) });
const estadoReservaSchema = z.object({ estado: z.enum(["confirmada", "cancelada", "completada", "ausente"]) });
const bloqueoSchema = z
  .object({
    desde: z.string().datetime({ offset: true }),
    hasta: z.string().datetime({ offset: true }),
    motivo: z.string().trim().max(120).optional().nullable(),
  })
  .refine((b) => new Date(b.hasta) > new Date(b.desde), { message: "El fin tiene que ser después del inicio", path: ["hasta"] });

// ── Onboarding (progreso por negocio) ────────────────────────
const { OFRECE, FUNCIONES } = require("../utils/rubros");
const onboardingSchema = z.object({
  paso: z.number().int().min(2).max(8).optional(),
  ofrece: z.array(z.enum(OFRECE)).max(OFRECE.length).optional(),
  funciones: z.array(z.enum(FUNCIONES)).max(FUNCIONES.length).optional(),
  completado: z.boolean().optional(),
});

// ── Doble factor (2FA) ───────────────────────────────────────
// Código de la app (6 dígitos) o de respaldo (xxxxx-xxxxx).
const codigo2fa = z.string().trim().min(6, "Ingresá el código").max(20);
const codigo2faSchema = z.object({ codigo: codigo2fa });
const verificar2faSchema = z.object({
  desafio: z.string().min(10).max(1000),
  codigo: codigo2fa,
});

module.exports = {
  codigo2faSchema,
  verificar2faSchema,
  loginSchema,
  registerSchema,
  signupSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  changeEmailSchema,
  createPedidoSchema,
  onboardingSchema,
  presupuestoSchema,
  respuestaPresupuestoSchema,
  estadoPresupuestoSchema,
  cotizacionSchema,
  reservaSchema,
  reservaManualSchema,
  reprogramarSchema,
  estadoReservaSchema,
  bloqueoSchema,
  camposSchema,
  servicioSchema,
  productoSchema,
  varianteGrupoSchema,
  updateVarianteGrupoSchema,
};
