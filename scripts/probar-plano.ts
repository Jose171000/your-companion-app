// Prueba de la clasificación del plano de pantallas. Se ejecuta con: node scripts/probar-plano.ts
import { armarPlano, clasificarBloque, MAX_BLOQUES } from '../src/lib/activity-layout.ts';
import type { DescriptorDeBloque } from '../src/lib/activity-layout.ts';

let fallos = 0;
const igual = (nombre: string, obtenido: unknown, esperado: unknown) => {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? 'OK ' : 'MAL'} ${nombre}${ok ? '' : ` -> ${JSON.stringify(obtenido)} (esperado ${JSON.stringify(esperado)})`}`);
};

const base: DescriptorDeBloque = { tag: 'div', role: null, type: null, x: 0, y: 0, w: 300, h: 100, tieneBordeRedondeado: false, dentroDeBoton: false };
const d = (x: Partial<DescriptorDeBloque>): DescriptorDeBloque => ({ ...base, ...x });

igual('título', clasificarBloque(d({ tag: 'H2', w: 200, h: 24 })), 'titulo');
igual('tabla', clasificarBloque(d({ tag: 'TABLE', w: 900, h: 400 })), 'tabla');
igual('tabla por rol', clasificarBloque(d({ role: 'grid', w: 900, h: 400 })), 'tabla');
igual('pestañas', clasificarBloque(d({ role: 'tablist', w: 300, h: 36 })), 'pestanas');
igual('gráfico (svg grande)', clasificarBloque(d({ tag: 'svg', w: 600, h: 300 })), 'grafico');
igual('un icono (svg chico) no es nada', clasificarBloque(d({ tag: 'svg', w: 16, h: 16 })), null);
igual('un svg dentro de un botón no es gráfico', clasificarBloque(d({ tag: 'svg', w: 300, h: 300, dentroDeBoton: true })), null);
igual('imagen', clasificarBloque(d({ tag: 'IMG', w: 80, h: 80 })), 'imagen');
igual('campo de texto', clasificarBloque(d({ tag: 'INPUT', type: 'text', w: 240, h: 36 })), 'campo');
igual('casilla y campo oculto no son campos', [clasificarBloque(d({ tag: 'input', type: 'checkbox', w: 40, h: 20 })), clasificarBloque(d({ tag: 'input', type: 'hidden', w: 40, h: 20 }))], [null, null]);
igual('selector', clasificarBloque(d({ role: 'combobox', w: 200, h: 36 })), 'campo');
igual('botón', clasificarBloque(d({ tag: 'BUTTON', w: 120, h: 36 })), 'boton');
igual('enlace', clasificarBloque(d({ tag: 'a', w: 100, h: 24 })), 'boton');
igual('botón diminuto se ignora', clasificarBloque(d({ tag: 'button', w: 8, h: 8 })), null);
igual('tarjeta: div con borde y esquinas redondeadas', clasificarBloque(d({ tieneBordeRedondeado: true, w: 400, h: 160 })), 'tarjeta');
igual('div sin borde no es tarjeta', clasificarBloque(d({ w: 400, h: 160 })), null);
igual('tarjeta chica se ignora', clasificarBloque(d({ tieneBordeRedondeado: true, w: 60, h: 20 })), null);

// Armado: milésimas, sin repetidos, tope por tipo y total.
const plano = armarPlano([d({ tag: 'h1', x: 100, y: 50, w: 300, h: 30 }), d({ tag: 'table', x: 0, y: 500, w: 1000, h: 1000 })], 1000, 2000);
igual('milésimas respecto al ancho y al alto de la zona', plano, [
  { k: 'tabla', x: 0, y: 250, w: 1000, h: 500 },
  { k: 'titulo', x: 100, y: 25, w: 300, h: 15 },
]);
igual('repetidos exactos se juntan', armarPlano([d({ tag: 'h1', w: 300, h: 30 }), d({ tag: 'h1', w: 300, h: 30 })], 1000, 1000).length, 1);
igual('un bloque diminuto respecto a la página se descarta', armarPlano([d({ tag: 'h1', w: 20, h: 8 })], 10000, 10000), []);
const botones = Array.from({ length: 400 }, (_, k) => d({ tag: 'button', x: (k % 40) * 20, y: Math.floor(k / 40) * 20, w: 18 + (k % 3), h: 18 }));
igual('tope por tipo: 60 botones', armarPlano(botones, 1000, 1000).length, 60);
const mezcla = [
  ...Array.from({ length: 80 }, (_, k) => d({ tieneBordeRedondeado: true, x: k * 10, y: 0, w: 200, h: 100 })),
  ...Array.from({ length: 100 }, (_, k) => d({ tag: 'input', type: 'text', x: k * 5, y: 300, w: 100 + k % 7, h: 30 })),
  ...botones,
];
igual('tope total', armarPlano(mezcla, 1000, 1000).length <= MAX_BLOQUES, true);
igual('ningún bloque lleva texto', armarPlano([{ ...d({ tag: 'h1', w: 300, h: 30 }), texto: 'Luis Chavez 999888777' } as any], 1000, 1000).map((b) => Object.keys(b).sort()), [['h', 'k', 'w', 'x', 'y']]);

console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
