// Prueba de la edición de roles (marcar, quitar con dependientes, volver a un rol de fábrica). Se ejecuta con: node scripts/probar-permisos.ts
import { desmarcar, marcar, rolDeFabricaIgualA, PERMISOS_DE_FABRICA } from '../src/lib/store-permissions.ts';
import type { Permiso, PermisoDelCatalogo, RolDeFabrica } from '../src/lib/store-permissions.ts';

let fallos = 0;
const igual = (nombre: string, obtenido: unknown, esperado: unknown) => {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? 'OK ' : 'MAL'} ${nombre}${ok ? '' : ` -> ${JSON.stringify(obtenido)} (esperado ${JSON.stringify(esperado)})`}`);
};

const REQUIERE: Partial<Record<Permiso, Permiso[]>> = {
  'ventas.contacto': ['ventas.ver'], 'productos.editar': ['productos.ver'], 'productos.eliminar': ['productos.ver'], 'productos.descargar': ['productos.ver'],
  'inventario.editar': ['productos.ver', 'canales.ver'], 'canales.publicar': ['productos.ver', 'canales.ver'], 'canales.conectar': ['canales.ver'],
  'cambios.aprobar': ['canales.ver'], 'ventas.registrar': ['ventas.ver'], 'ventas.descargar': ['ventas.ver'],
};
const CATALOGO: PermisoDelCatalogo[] = PERMISOS_DE_FABRICA.owner.map((clave) => ({ clave, titulo: clave, ayuda: '', grupo: 'x', requiere: REQUIERE[clave] ?? [] }));
const FABRICA: RolDeFabrica[] = (['viewer', 'editor', 'owner'] as const).map((clave) => ({ clave, nombre: clave, permisos: [...PERMISOS_DE_FABRICA[clave]] }));
const set = (...p: Permiso[]) => new Set<Permiso>(p);
const lista = (s: Set<Permiso>) => [...s].sort();

igual('marcar un permiso marca lo que necesita', lista(marcar(set(), 'inventario.editar', CATALOGO)), ['canales.ver', 'inventario.editar', 'productos.ver']);
igual('marcar uno que ya estaba no cambia nada', lista(marcar(set('productos.ver', 'productos.editar'), 'productos.editar', CATALOGO)), ['productos.editar', 'productos.ver']);
igual('marcar sin dependencias solo marca ese', lista(marcar(set(), 'productos.ver', CATALOGO)), ['productos.ver']);

const r1 = desmarcar(set('productos.ver', 'canales.ver', 'inventario.editar', 'canales.publicar', 'ventas.ver'), 'productos.ver', CATALOGO);
igual('quitar «ver productos» quita también lo que lo necesita', lista(r1.resultado), ['canales.ver', 'ventas.ver']);
igual('y avisa cuáles se quitaron de rebote', r1.tambienQuitados.sort(), ['canales.publicar', 'inventario.editar']);
const r2 = desmarcar(set('productos.ver', 'canales.ver', 'inventario.editar'), 'inventario.editar', CATALOGO);
igual('quitar un permiso del que nada depende solo quita ese', [lista(r2.resultado), r2.tambienQuitados], [['canales.ver', 'productos.ver'], []]);
igual('quitar uno que no estaba no rompe nada', desmarcar(set('ventas.ver'), 'productos.ver', CATALOGO).tambienQuitados, []);

igual('los permisos de un rol de fábrica son ese rol', rolDeFabricaIgualA(new Set(PERMISOS_DE_FABRICA.editor), FABRICA)?.clave, 'editor');
igual('el lector también', rolDeFabricaIgualA(new Set(PERMISOS_DE_FABRICA.viewer), FABRICA)?.clave, 'viewer');
const sinEliminar = new Set(PERMISOS_DE_FABRICA.editor); sinEliminar.delete('productos.eliminar');
igual('quitar un permiso al Editor lo vuelve personalizado', rolDeFabricaIgualA(sinEliminar, FABRICA), null);
igual('y si se vuelve a marcar, vuelve a ser el Editor', rolDeFabricaIgualA(marcar(sinEliminar, 'productos.eliminar', CATALOGO), FABRICA)?.clave, 'editor');
igual('agregar un permiso al Lector lo vuelve personalizado', rolDeFabricaIgualA(marcar(new Set(PERMISOS_DE_FABRICA.viewer), 'productos.descargar', CATALOGO), FABRICA), null);
igual('un conjunto vacío no es ningún rol de fábrica', rolDeFabricaIgualA(set(), FABRICA), null);

console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
