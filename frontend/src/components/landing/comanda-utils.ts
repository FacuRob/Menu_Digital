export type Linea = { qty: number; name: string; amount: number };

// Precios de demo: enteros con punto de miles ("$8.900" → 8900).
export const parsePrecio = (p: string) => Number(p.replace(/\D/g, "")) || 0;

// Siempre con punto de miles, también en 4 cifras ($8.900 y no $8900), en
// cualquier navegador (algunos no agrupan 4 cifras en español).
export const pesos = (n: number) => `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export const totalDe = (lineas: Linea[]) => lineas.reduce((s, l) => s + l.amount, 0);

