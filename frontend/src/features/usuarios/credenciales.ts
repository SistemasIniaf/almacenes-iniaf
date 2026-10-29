/**
 * El texto con los datos de acceso, para pegar en WhatsApp o un correo. Uno
 * solo para el diálogo de «Usuario creado» y para el ícono de la tabla.
 *
 * El ENLACE sale del origen desde el que se usa el sistema, no de una
 * constante: en el servidor definitivo es el dominio de la institución y en la
 * VM de la demo su IP — el mismo criterio que la URL de la API (`urlBaseApi()`).
 *
 * Sin contraseña (`null`) no se escribe la línea: el usuario ya eligió la suya,
 * y una contraseña equivocada en el mensaje es peor que ninguna.
 */
export function textoCredenciales(
  usuario: string,
  contrasena: string | null
): string {
  return [
    "SISTEMA ALMACENES",
    `ENLACE: ${window.location.origin}/`,
    `USUARIO: ${usuario}`,
    ...(contrasena ? [`CONTRASEÑA: ${contrasena}`] : []),
  ].join("\n")
}
