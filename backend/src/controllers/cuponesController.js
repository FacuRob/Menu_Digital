const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const mp = require("../utils/mercadoPago");
const {
  PCT_MIN,
  PCT_MAX,
  MESES_MAX,
  CANTIDAD_MAX,
  generarCodigo,
  normalizarCodigo,
  tieneDescuento,
} = require("../utils/cupones");
const { montoProximoCobro } = require("../utils/modulosPagos");

const entero = (v) => (Number.isInteger(Number(v)) ? Number(v) : NaN);

// ── Tech (panel de plataforma) ────────────────────────────────

// POST /api/plataforma/cupones  { porcentaje, meses, cantidad }
const crearCupones = async (req, res) => {
  try {
    const porcentaje = entero(req.body?.porcentaje);
    const meses = entero(req.body?.meses);
    const cantidad = entero(req.body?.cantidad ?? 1);

    if (!(porcentaje >= PCT_MIN && porcentaje <= PCT_MAX)) {
      return res.status(400).json({ message: `El descuento va de ${PCT_MIN} a ${PCT_MAX} %.` });
    }
    if (!(meses >= 1 && meses <= MESES_MAX)) {
      return res.status(400).json({ message: `Los meses van de 1 a ${MESES_MAX}.` });
    }
    if (!(cantidad >= 1 && cantidad <= CANTIDAD_MAX)) {
      return res.status(400).json({ message: `Podés generar de 1 a ${CANTIDAD_MAX} cupones por vez.` });
    }

    const filas = Array.from({ length: cantidad }, () => ({
      codigo: generarCodigo(),
      porcentaje,
      meses,
      creado_por: req.user?.id ?? null,
    }));
    const { data, error } = await supabase.from("cupones").insert(filas).select();
    if (error) throw error;
    res.status(201).json(data || []);
  } catch (error) {
    return respondError(res, error, "cupones");
  }
};

// GET /api/plataforma/cupones  → { disponibles, usados }
const listarCupones = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cupones")
      .select("*, cuenta:usado_por_cuenta_id(id, nombre, email)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const todos = data || [];
    res.json({
      disponibles: todos.filter((c) => !c.usado_por_cuenta_id),
      usados: todos
        .filter((c) => c.usado_por_cuenta_id)
        .sort((a, b) => String(b.usado_at).localeCompare(String(a.usado_at))),
    });
  } catch (error) {
    return respondError(res, error, "cupones");
  }
};

// DELETE /api/plataforma/cupones/:id  → solo cupones sin usar.
const eliminarCupon = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cupones")
      .delete()
      .eq("id", Number(req.params.id))
      .is("usado_por_cuenta_id", null)
      .select();
    if (error) throw error;
    if (!data?.length) {
      return res.status(404).json({ message: "Cupón no encontrado o ya usado." });
    }
    res.json({ message: "Cupón eliminado" });
  } catch (error) {
    return respondError(res, error, "cupones");
  }
};

// ── Cliente (Suscripción) ─────────────────────────────────────

// POST /api/suscripcion/cupon  { codigo }
const canjearCupon = async (req, res) => {
  try {
    const codigo = normalizarCodigo(req.body?.codigo);
    if (!codigo) return res.status(400).json({ message: "Escribí el código del cupón." });

    const cuentaId = req.user?.cuenta_id;
    if (!cuentaId) return res.status(403).json({ message: "Usuario sin cuenta asociada" });

    const { data: cuenta } = await supabase
      .from("cuentas")
      .select("*")
      .eq("id", cuentaId)
      .maybeSingle();
    if (!cuenta) return res.status(404).json({ message: "Cuenta no encontrada" });
    if (tieneDescuento(cuenta)) {
      return res.status(409).json({ message: "Ya tenés un descuento activo." });
    }

    // Se marca como usado solo si nadie lo usó antes (atómico en la BD).
    const ahora = new Date(Date.now()).toISOString();
    const { data: cupon, error } = await supabase
      .from("cupones")
      .update({ usado_por_cuenta_id: cuenta.id, usado_at: ahora })
      .eq("codigo", codigo)
      .is("usado_por_cuenta_id", null)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!cupon) return res.status(404).json({ message: "El cupón no existe o ya fue usado." });

    const descuento = { descuento_pct: cupon.porcentaje, descuento_meses_restantes: cupon.meses, cupon_id: cupon.id };
    const { error: errCuenta } = await supabase.from("cuentas").update(descuento).eq("id", cuenta.id);
    if (errCuenta) throw errCuenta;

    // Si ya paga una suscripción, los próximos cobros pasan a tener descuento.
    const pagaHoy = cuenta.estado_suscripcion === "activo" && cuenta.mp_preapproval_id;
    if (pagaHoy) {
      try {
        // El cupón descuenta el plan (precio de fundador si lo tiene), no los módulos.
        await mp.cambiarMonto(cuenta.mp_preapproval_id, montoProximoCobro({ ...cuenta, ...descuento }));
      } catch (e) {
        // Sin el cambio en MP cobraría precio lleno: se deshace el canje.
        console.error("[Cupones] No se pudo aplicar el descuento en MP:", e.message);
        await supabase
          .from("cuentas")
          .update({ descuento_pct: 0, descuento_meses_restantes: 0, cupon_id: null })
          .eq("id", cuenta.id);
        await supabase.from("cupones").update({ usado_por_cuenta_id: null, usado_at: null }).eq("id", cupon.id);
        return res.status(502).json({ message: "No se pudo aplicar el descuento en Mercado Pago. Probá de nuevo." });
      }
    }

    res.json({ message: "Cupón aplicado", porcentaje: cupon.porcentaje, meses: cupon.meses });
  } catch (error) {
    return respondError(res, error, "cupones");
  }
};

module.exports = { crearCupones, listarCupones, eliminarCupon, canjearCupon };
