/**
 * Fuentes de financiamiento del INIAF (lista entregada por el usuario el
 * 2026-11-04). Lo consume `prisma/seed.ts`, que las crea si no existen.
 *
 * Van en MAYÚSCULAS, como todo lo que se carga desde la UI (ver «Mayúsculas
 * automáticas» en CLAUDE.md): si no, una fuente creada a mano con el mismo
 * nombre no coincidiría con la sembrada.
 */
export const FUENTES_INIAF: string[] = [
  'REC.PROPIOS',
  'TGN',
  'DANIDA',
  'COSUDE',
  'FONTAGRO',
  'DANIDA-ADENDA3',
  'BANCO MUNDIAL',
  'PL-480',
  'KOPIA',
  'PISA',
  'EMBRAPA',
  'UNION EUROPEA',
  'KOLFACI',
  'DANIDA PROG.PAIS',
  'REC.ESPECIFICOS',
  'COSUDE-PISA',
  'CIMMYT',
  'REC.ESPECIF.PROG. PAIS',
  'TGN-PROG CAFE',
  'TGN PROGRAMA TRIGO',
  'TGN PROG.FRUTALES',
  'RECURSOS ESPECIFICOS CAFE',
  'FRUTOS AMAZONICOS',
  'TGN PROG CACAO',
  'DNPS-RECURSOS ESPECIFICOS',
  'DNS - RECURSOS ESPECIFICOS',
  'TGN HORTALIZAS',
  'TGN BANANO',
  'TGN PINA',
  'TGN GANADERIA',
  'TGN APICOLA',
  'TGN GRANOS ANDINOS',
  'TGN PAPA Y YUCA',
  'TGN ALGODON',
  'TGN AGRICULTURA',
  'TGN PISCICOLA',
  'TGN OLEIFERA',
  'MAQUINARIA',
  'TGN CEREALES',
  'TRIGO CIMMYT',
];
