/**
 * Aviso de privacidad sobre el registro de actividad. La versión debe ser la misma que PRIVACY_VERSION del servidor
 * (src/activity/activity.constants.ts): si el texto cambia, se sube en los dos lados y todos vuelven a aceptarlo.
 */
export const PRIVACY_VERSION = '2026-11-03';
export const PRIVACY_EMAIL = 'synkroaiecom@gmail.com';

export const PRIVACY_TITLE = 'Aviso de privacidad y uso de datos';

export const PRIVACY_PARAGRAPHS: string[] = [
  'Para mejorar Synkro y darte mejor soporte, registramos cómo usas la plataforma: tus ingresos, las secciones que abres, los botones que tocas y las acciones que realizas, con su fecha y hora.',
  'No guardamos lo que escribes, tus contraseñas ni los datos personales de tus clientes.',
  'Esta información la ven solo los administradores de Synkro y se usa únicamente para analizar el uso del servicio. Se conserva 90 días en detalle; después solo se guardan resúmenes (por ejemplo, cuántas veces se usó cada sección), hasta por 2 años.',
  `Puedes escribirnos a ${PRIVACY_EMAIL} para consultar, corregir o pedir la eliminación de tus datos.`,
];
