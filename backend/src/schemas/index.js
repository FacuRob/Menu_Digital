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
  rol: z.enum(["superadmin", "editor", "visor"]).optional(),
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

// ── Pedidos (endpoint público) ───────────────────────────────
// Permisivo con la forma de los items (el controller recalcula precios reales
// desde la BD), pero acota tipos y longitudes para evitar payloads abusivos.
const pedidoItemSchema = z.object({
  producto_id: z.number().int().positive().optional(),
  cantidad: z.coerce.number().int().min(1).max(999).optional(),
  precio: z.coerce.number().min(0).optional(),
  nombre: z.string().max(200).optional(),
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
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  createPedidoSchema,
};
