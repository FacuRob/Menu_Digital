import { useEffect, type ReactNode } from "react";

// Política de privacidad de DinexFlow. Meta la exige para publicar la app de
// WhatsApp. La sección #eliminar-datos sirve también como "URL de
// instrucciones para eliminar datos".
const BRAND = "DinexFlow";
const CONTACTO = "roblesfacundo7@gmail.com";
const ACTUALIZADA = "1 de noviembre de 2026";

function Seccion({ id, titulo, children }: { id?: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="mb-3 mt-10 text-xl font-bold text-white">{titulo}</h2>
      <div className="space-y-3 leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default function Privacidad() {
  useEffect(() => {
    const prev = document.title;
    document.title = `Política de privacidad · ${BRAND}`;
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#060912] font-sans text-slate-200 antialiased">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <a href="/" className="text-sm text-cyan-400 hover:text-cyan-300">
          ← Volver a {BRAND}
        </a>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Política de privacidad</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: {ACTUALIZADA}</p>

        <Seccion titulo="1. Quiénes somos">
          <p>
            {BRAND} es una plataforma que permite a restaurantes, bares y comercios gastronómicos (“los negocios”)
            publicar su menú digital, recibir pedidos y comunicarse con sus clientes, incluso por WhatsApp. Esta
            política explica qué datos tratamos, para qué y cuáles son tus derechos.
          </p>
        </Seccion>

        <Seccion titulo="2. Qué datos recolectamos">
          <p>
            <strong className="text-white">De los negocios (usuarios del panel):</strong> nombre, email, datos del
            negocio (nombre, dirección, teléfono, horarios, productos y precios) y datos de la suscripción. Los pagos se
            procesan a través de un proveedor externo; no guardamos datos de tarjetas.
          </p>
          <p>
            <strong className="text-white">De los clientes que hacen un pedido:</strong> nombre, teléfono, dirección
            (solo para delivery), el detalle del pedido y, si lo aceptan, su consentimiento para recibir avisos por
            WhatsApp.
          </p>
          <p>
            <strong className="text-white">De las conversaciones por WhatsApp:</strong> número de teléfono, nombre de
            perfil de WhatsApp, el contenido de los mensajes intercambiados con el negocio y su estado (enviado,
            entregado, leído).
          </p>
        </Seccion>

        <Seccion titulo="3. Para qué usamos los datos">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Mostrar el menú y gestionar los pedidos.</li>
            <li>Enviar avisos sobre el estado del pedido a quienes lo aceptaron.</li>
            <li>Permitir que el negocio responda las consultas de sus clientes por WhatsApp.</li>
            <li>Operar, mantener y mejorar la plataforma, y brindar soporte.</li>
          </ul>
          <p>No vendemos datos personales ni los usamos para publicidad de terceros.</p>
        </Seccion>

        <Seccion titulo="4. WhatsApp">
          <p>
            Los mensajes se envían y reciben mediante la API oficial de WhatsApp Business de Meta. Al usar WhatsApp,
            también se aplican las condiciones y la política de privacidad de WhatsApp/Meta. Solo enviamos avisos
            automáticos a clientes que lo aceptaron al hacer su pedido, y podés pedir que no te escriban más en
            cualquier momento respondiendo al mensaje o escribiéndonos.
          </p>
        </Seccion>

        <Seccion titulo="5. Con quién compartimos datos">
          <p>Solo con proveedores necesarios para que el servicio funcione:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Meta (WhatsApp Business API), para la mensajería.</li>
            <li>Proveedores de hosting y base de datos donde se aloja la plataforma.</li>
            <li>El procesador de pagos de las suscripciones.</li>
          </ul>
          <p>
            Cada negocio accede únicamente a los datos de sus propios pedidos y clientes. También podemos compartir
            datos si una ley o autoridad competente lo exige.
          </p>
        </Seccion>

        <Seccion titulo="6. Cuánto tiempo los guardamos">
          <p>
            Mientras la cuenta del negocio esté activa o mientras sea necesario para brindar el servicio y cumplir
            obligaciones legales. Después se eliminan o se anonimizan.
          </p>
        </Seccion>

        <Seccion titulo="7. Seguridad">
          <p>
            Usamos conexiones cifradas (HTTPS), control de acceso por usuario y almacenamos las credenciales de forma
            segura. Ningún sistema es 100% infalible, pero trabajamos para proteger tus datos.
          </p>
        </Seccion>

        <Seccion id="eliminar-datos" titulo="8. Tus derechos y cómo eliminar tus datos">
          <p>
            Podés pedir acceder, corregir o eliminar tus datos personales, o dejar de recibir mensajes por WhatsApp.
          </p>
          <p>Para pedir la eliminación de tus datos:</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Escribinos a{" "}
              <a href={`mailto:${CONTACTO}?subject=Eliminar%20mis%20datos`} className="text-cyan-400 hover:text-cyan-300">
                {CONTACTO}
              </a>{" "}
              con el asunto “Eliminar mis datos”.
            </li>
            <li>Indicá el teléfono o email con el que hiciste pedidos o te registraste.</li>
            <li>Eliminamos tus datos dentro de los 30 días y te confirmamos por el mismo medio.</li>
          </ol>
          <p>Si sos un negocio, también podés pedir la baja completa de tu cuenta y de todos sus datos.</p>
        </Seccion>

        <Seccion titulo="9. Cambios y contacto">
          <p>
            Si cambiamos esta política, actualizaremos la fecha de arriba. Por cualquier consulta escribinos a{" "}
            <a href={`mailto:${CONTACTO}`} className="text-cyan-400 hover:text-cyan-300">
              {CONTACTO}
            </a>
            .
          </p>
        </Seccion>

        <p className="mt-12 border-t border-white/5 pt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} {BRAND}
        </p>
      </div>
    </div>
  );
}
