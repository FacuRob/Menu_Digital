// Transformaciones de entrega de Cloudinary (recorte inteligente + optimización).
// Ver frontend/src/lib/cloudinary.ts para el detalle. Solo actúa sobre URLs de
// res.cloudinary.com; cualquier otra (p. ej. un data: URL de preview) vuelve igual.
export interface CldOpts {
  w?: number;
  h?: number;
  fill?: boolean;
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
