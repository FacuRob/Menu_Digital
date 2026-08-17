// Inserta transformaciones de Cloudinary en la URL de entrega para
// estandarizar el tamaño/recorte del catálogo (sin importar el rubro) y
// optimizar el peso. No baja/re-sube nada: transforma en el CDN al servir.
//
//   f_auto,q_auto,dpr_auto → formato y calidad óptimos según el navegador.
//   c_fill,g_auto          → recorte inteligente al aspecto pedido.
//   c_limit                → limita el tamaño sin recortar (si no se pide fill).
//
// Solo actúa sobre URLs de res.cloudinary.com; cualquier otra se devuelve igual.
export interface CldOpts {
  w?: number;
  h?: number;
  fill?: boolean; // recorte a un aspecto fijo (c_fill + g_auto)
}

export function cld(
  url: string | null | undefined,
  opts: CldOpts = {},
): string | null | undefined {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }
  const t: string[] = ["f_auto", "q_auto", "dpr_auto"];
  if (opts.w) t.push(`w_${Math.round(opts.w)}`);
  if (opts.h) t.push(`h_${Math.round(opts.h)}`);
  if (opts.fill && (opts.w || opts.h)) t.push("c_fill", "g_auto");
  else if (opts.w || opts.h) t.push("c_limit");
  return url.replace("/upload/", `/upload/${t.join(",")}/`);
}
