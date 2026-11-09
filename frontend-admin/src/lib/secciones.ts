import type { FormEvent } from "react";

// Al enviar, el navegador avisa de todos los campos inválidos a la vez:
// sólo se atiende el primero de cada envío.
let atendiendo = false;

// Para un <form> con secciones: si un campo obligatorio está en una sección
// oculta, el navegador no puede mostrar el aviso. Se abre esa sección y se
// vuelve a pedir el aviso sobre el campo.
export function abrirSeccionInvalida<T extends string>(actual: T, abrir: (id: T) => void) {
  return (e: FormEvent) => {
    if (atendiendo) return;
    const campo = e.target as HTMLInputElement;
    const id = campo.closest<HTMLElement>("[data-seccion]")?.dataset.seccion as T | undefined;
    if (!id || id === actual) return;
    atendiendo = true;
    abrir(id);
    // Esperar a que la sección ya se vea antes de pedir el aviso.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        campo.reportValidity();
        atendiendo = false;
      }),
    );
  };
}
