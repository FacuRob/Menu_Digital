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
  newPassword: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(200),
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
  categoria_id: z.coerce.number().int().positive(),
  disponible: z.coerce.boolean().optional(),
  orden: z.coerce.number().int().min(0).max(999999).optional(),
  stock: z.coerce.number().int().min(0).max(9999999).optional(),
  controlar_stock: z.coerce.boolean().optional(),
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
  cantidad: z.coerce.number().int().min(1).max(999).optional(),
  precio: z.coerce.number().min(0).optional(),
  nombre: z.string().max(200).optional(),
  // Ids de opciones de variante elegidas (multi-rubro). El backend
  // recalcula el precio_extra real desde la BD; no se confía en el cliente.
  opciones: z.array(z.coerce.number().int().positive()).max(30).optional(),
});

const createPedidoSchema = z.object({
  items: z
    .array(pedidoItemSchema)
    .min(1, "El pedido debe incluir al menos un producto")
    .max(100),
  mesa: z.union([z.string().max(50), z.number()]).optional().nullable(),
  cliente: z.string().trim().max(120).optional().nullable(),
  nota: z.string().trim().max(1000).optional().nullable(),
  tipo_entrega: z.enum(["mesa", "retiro", "delivery"]).optional().nullable(),
  direccion_entrega: z.string().trim().max(300).optional().nullable(),
  telefono_cliente: z.string().trim().max(40).optional().nullable(),
});

module.exports = {
  loginSchema,
  registerSchema,
  signupSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  createPedidoSchema,
  productoSchema,
  varianteGrupoSchema,
  updateVarianteGrupoSchema,
};
