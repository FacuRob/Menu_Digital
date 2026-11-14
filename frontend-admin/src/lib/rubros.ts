import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { rubrosService, type RubroCategoria } from "../services/api";
import {
  IconUtensils, IconBag, IconBox, IconSparkle, IconHeart, IconBriefcase,
  IconTools, IconCar, IconBook, IconMap, IconGrid,
} from "./icons";

// Catálogo de rubros: viene del backend (tabla rubros_categorias /
// rubros_especialidades). Se pide una vez por sesión.
let cache: Promise<RubroCategoria[]> | null = null;
const cargar = () => {
  cache ||= rubrosService.getAll().catch((e) => {
    cache = null; // reintenta la próxima vez
    throw e;
  });
  return cache;
};

export function useRubros() {
  const [categorias, setCategorias] = useState<RubroCategoria[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    cargar()
      .then((c) => vivo && setCategorias(c))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, []);
  return { categorias, error };
}

// El ícono es un nombre en la base; acá sólo se traduce a dibujo.
const ICONOS: Record<string, ComponentType<{ size?: number }>> = {
  utensils: IconUtensils, bag: IconBag, box: IconBox, sparkle: IconSparkle,
  heart: IconHeart, briefcase: IconBriefcase, tools: IconTools, car: IconCar,
  book: IconBook, map: IconMap, grid: IconGrid,
};
export const iconoRubro = (nombre: string | null | undefined) => ICONOS[nombre || ""] || IconGrid;

// "Gastronomía · Pizzería" para mostrar en listas.
export const nombreRubro = (
  categorias: RubroCategoria[] | null,
  categoria: string | null | undefined,
  especialidad: string | null | undefined,
) => {
  const cat = categorias?.find((c) => c.codigo === categoria);
  if (!cat) return null;
  const esp = cat.especialidades.find((e) => e.codigo === especialidad);
  return esp ? `${cat.nombre} · ${esp.nombre}` : cat.nombre;
};
