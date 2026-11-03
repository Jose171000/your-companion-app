// Prueba de la lógica de nombres del rastreador. Se ejecuta con: node scripts/probar-etiquetas.ts
import { aEtiqueta, aMilesimas, etiquetaDeClic, pantallaCompuesta, parecePersonal } from '../src/lib/activity-naming.ts';
import type { DescriptorDeElemento } from '../src/lib/activity-naming.ts';

let fallos = 0;
const igual = (nombre: string, obtenido: unknown, esperado: unknown) => {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? 'OK ' : 'MAL'} ${nombre}${ok ? '' : ` -> ${JSON.stringify(obtenido)} (esperado ${JSON.stringify(esperado)})`}`);
};

const base: DescriptorDeElemento = { tag: 'button', role: null, type: null, track: null, ariaLabel: null, placeholder: null, name: null, title: null, texto: '', dentroDeFila: false, dentroDeIgnorado: false, hijosComplejos: false };
const d = (x: Partial<DescriptorDeElemento>): DescriptorDeElemento => ({ ...base, ...x });

igual('botón con texto fijo', etiquetaDeClic(d({ texto: 'Registrar ventas' })), 'registrar-ventas');
igual('botón con tilde', etiquetaDeClic(d({ texto: 'Envío gratis' })), 'envio-gratis');
igual('data-track manda sobre el texto', etiquetaDeClic(d({ track: 'ventas.descargar', texto: 'Descargar' })), 'ventas.descargar');
igual('pestaña', etiquetaDeClic(d({ tag: 'button', role: 'tab', texto: 'Ventas' })), 'ventas');
igual('enlace del menú', etiquetaDeClic(d({ tag: 'a', texto: 'Analíticas' })), 'analiticas');
igual('botón con icono y sin texto, con etiqueta accesible', etiquetaDeClic(d({ ariaLabel: 'Cerrar' })), 'cerrar');
igual('botón con icono y sin nada', etiquetaDeClic(d({})), 'icono');

// Privacidad
igual('botón cuyo texto es un correo', etiquetaDeClic(d({ tag: 'a', texto: 'juan@correo.com' })), 'boton');
igual('botón cuyo texto es un teléfono', etiquetaDeClic(d({ tag: 'a', texto: '999 888 777' })), 'boton');
igual('botón con número de pedido', etiquetaDeClic(d({ texto: 'Pedido 3259674549' })), 'boton');
igual('tarjeta clicable con datos adentro', etiquetaDeClic(d({ texto: 'Almohada Luz Morante S/ 179', hijosComplejos: true })), 'tarjeta');
igual('control dentro de una fila: no usa el texto', etiquetaDeClic(d({ texto: 'Luis Enrique Chavez', dentroDeFila: true })), 'control-en-fila');
igual('control dentro de una fila con etiqueta accesible', etiquetaDeClic(d({ texto: 'Luis', dentroDeFila: true, ariaLabel: 'Ver detalle' })), 'ver-detalle');
igual('celda de una tabla', etiquetaDeClic(d({ tag: 'td', texto: 'Luis Enrique Chavez' })), 'fila-de-tabla');
igual('fila de una tabla', etiquetaDeClic(d({ tag: 'tr', texto: 'Luis Enrique Chavez 179' })), 'fila-de-tabla');
igual('texto suelto dentro de una fila de datos', etiquetaDeClic(d({ tag: 'span', texto: 'Luis', dentroDeFila: true })), 'fila-de-tabla');
igual('texto suelto fuera de controles', etiquetaDeClic(d({ tag: 'p', texto: 'Hola' })), null);
igual('zona ignorada', etiquetaDeClic(d({ texto: 'Descargar', dentroDeIgnorado: true })), null);
igual('campo de texto: solo qué campo es', etiquetaDeClic(d({ tag: 'input', type: 'text', placeholder: 'Buscar cliente, pedido, SKU o producto…' })), 'campo-buscar-cliente-pedido-sku-o-producto');
igual('campo de contraseña', etiquetaDeClic(d({ tag: 'input', type: 'password', ariaLabel: 'Mi clave secreta' })), 'campo-contrasena');
igual('rango de fechas no usa su texto', etiquetaDeClic(d({ texto: '1 oct - 31 oct 2026' })), 'boton');
igual('atajo con una cifra es rótulo fijo', etiquetaDeClic(d({ texto: '30 días' })), '30-dias');
igual('rango con etiqueta accesible fija', etiquetaDeClic(d({ texto: '1 oct - 31 oct 2026', ariaLabel: 'Fechas' })), 'fechas');
igual('filtro con contador pegado', etiquetaDeClic(d({ texto: 'Cancelados 2' })), 'cancelados');
igual('contador entre paréntesis', etiquetaDeClic(d({ texto: 'Clientes (12)' })), 'clientes');
igual('el contador no cambia el nombre', etiquetaDeClic(d({ texto: 'Cancelados 37' })), etiquetaDeClic(d({ texto: 'Cancelados 2' })));
igual('un número solo se conserva', etiquetaDeClic(d({ texto: '7' })), '7');
igual('selector', etiquetaDeClic(d({ tag: 'button', role: 'combobox', texto: 'Todos los canales' })), 'todos-los-canales');

igual('pantalla con pestaña', pantallaCompuesta('marketplaces', 'Ventas'), 'marketplaces.ventas');
igual('pantalla sin pestaña', pantallaCompuesta('analytics', null), 'analytics');
igual('pestaña con dato personal se ignora', pantallaCompuesta('crm', 'Lead 9998887776'), 'crm');
igual('etiqueta larga se corta', (aEtiqueta('a'.repeat(200), 60) ?? '').length, 60);
igual('parecePersonal', [parecePersonal('a@b.c'), parecePersonal('12345'), parecePersonal('Fecha 12/11'), parecePersonal('30 días')], [true, true, false, false]);
igual('milésimas dentro', aMilesimas(250, 100, 300), 500);
igual('milésimas fuera', aMilesimas(50, 100, 300), null);
igual('milésimas sin referencia', aMilesimas(50, 0, 0), null);

console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
