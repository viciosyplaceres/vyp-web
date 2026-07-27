"use client";

import { useCallback, useRef } from "react";

/** Cuánto hay que mantener el dedo para que cuente como pulsación larga. */
const MS_PULSACION = 450;
/** Si el dedo se mueve más que esto, es un scroll y no una pulsación. */
const TOLERANCIA_PX = 10;

/**
 * Detecta "mantener pulsado" sin confundirlo con desplazar la lista.
 *
 * En el chat es la única forma de llegar a responder, editar o borrar desde el
 * móvil: las acciones estaban colgadas de `:hover`, que en una pantalla táctil
 * no existe, así que sencillamente no había manera de usarlas.
 *
 * Lo delicado es que el dedo baja sobre un mensaje también cuando lo que se
 * quiere es desplazar la conversación. Por eso se cancela en cuanto el punto de
 * contacto se aparta más de unos píxeles del sitio donde empezó.
 *
 * Devuelve además el gesto de ratón: en escritorio, un clic normal abre lo
 * mismo, que es bastante más fácil de descubrir que un botón que solo aparece
 * al pasar por encima.
 */
export function usePulsacionLarga(alActivar: () => void) {
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origen = useRef<{ x: number; y: number } | null>(null);
  const yaDisparado = useRef(false);

  const cancelar = useCallback(() => {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
    origen.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Solo el botón principal: con el derecho ya sale el menú del navegador.
      if (e.button !== 0) return;
      yaDisparado.current = false;
      origen.current = { x: e.clientX, y: e.clientY };
      temporizador.current = setTimeout(() => {
        yaDisparado.current = true;
        alActivar();
      }, MS_PULSACION);
    },
    [alActivar],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!origen.current) return;
      const dx = Math.abs(e.clientX - origen.current.x);
      const dy = Math.abs(e.clientY - origen.current.y);
      if (dx > TOLERANCIA_PX || dy > TOLERANCIA_PX) cancelar();
    },
    [cancelar],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const eraPulsacionCorta = temporizador.current !== null;
      cancelar();

      // Con ratón, la pulsación corta (un clic de toda la vida) también abre
      // el menú. Con el dedo no: ahí un toque suelto no debe hacer nada, igual
      // que en cualquier app de mensajería.
      if (eraPulsacionCorta && !yaDisparado.current && e.pointerType === "mouse") {
        alActivar();
      }
    },
    [alActivar, cancelar],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: cancelar,
    onPointerLeave: cancelar,
    /** El menú propio sustituye al del navegador al mantener pulsado. */
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
