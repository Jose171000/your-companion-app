/**
 * Reglas de las fotos de producto: solo JPG, hasta 2000 × 2000 px y 10 MB (lo que aceptan los canales y nuestro servidor).
 * Una foto JPG más grande se ajusta sola; cualquier otro formato se rechaza con un mensaje claro.
 */
export const LADO_MAXIMO = 2000;
export const PESO_MAXIMO = 10 * 1024 * 1024;
export const TEXTO_FORMATO_FOTOS = "Solo JPG · hasta 2000 px por lado · máx. 10 MB";
export const ACEPTAR_FOTOS = "image/jpeg,.jpg,.jpeg";

const esJpg = (f: File) => f.type === "image/jpeg" || (!f.type && /\.jpe?g$/i.test(f.name));

async function ajustar(file: File, bitmap: ImageBitmap): Promise<File | null> {
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const calidad of [0.92, 0.85, 0.75]) {
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", calidad));
    if (blob && blob.size <= PESO_MAXIMO) return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  }
  return null;
}

/** Devuelve las fotos listas para subir y un mensaje por cada una que no se pudo aceptar. */
export async function prepararFotos(archivos: File[]): Promise<{ validas: File[]; errores: string[] }> {
  const validas: File[] = [];
  const errores: string[] = [];
  for (const file of archivos) {
    if (!esJpg(file)) {
      errores.push(`«${file.name}» no es JPG: solo se aceptan fotos JPG.`);
      continue;
    }
    try {
      const bitmap = await createImageBitmap(file);
      if (file.size <= PESO_MAXIMO && Math.max(bitmap.width, bitmap.height) <= LADO_MAXIMO) {
        validas.push(file);
        continue;
      }
      const ajustada = await ajustar(file, bitmap);
      if (ajustada) validas.push(ajustada);
      else errores.push(`«${file.name}» es demasiado pesada incluso reducida (máx. 10 MB).`);
    } catch {
      // Si el navegador no puede leerla para medirla, el servidor la validará al subirla.
      if (file.size <= PESO_MAXIMO) validas.push(file);
      else errores.push(`«${file.name}» supera los 10 MB.`);
    }
  }
  return { validas, errores };
}

/** Un solo mensaje para mostrar los rechazos (máximo tres líneas). */
export function resumenDeErrores(errores: string[]): string {
  return errores.slice(0, 3).join("\n") + (errores.length > 3 ? `\n… y ${errores.length - 3} más` : "");
}
