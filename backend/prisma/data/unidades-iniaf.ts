/**
 * Organigrama real del INIAF (grupo MOF). Cada unidad referencia a su padre por
 * SIGLA (null = raiz). Lo consume `prisma/seed.ts` (dos pasadas: crea todas y
 * despues resuelve el padre), asi el orden del array no importa.
 */
export interface UnidadSeed {
  nombre: string;
  sigla: string;
  /** Sigla del padre, o null si es raiz. */
  padre: string | null;
}

export const UNIDADES_INIAF: UnidadSeed[] = [
  // --- Raices ---
  { nombre: 'DIRECCIÓN GENERAL EJECUTIVA', sigla: 'INIAF/DGE/', padre: null },
  { nombre: 'COORDINACIÓN GENERAL', sigla: 'CO-DGE/', padre: null },
  { nombre: 'UNIDAD DE ASESORIA LEGAL', sigla: 'UAL/', padre: null },
  {
    nombre: 'UNIDAD DE PLANIFICACIÓN Y GESTIÓN INSTITUCIONAL',
    sigla: 'UPGI/',
    padre: null,
  },
  { nombre: 'UNIDAD DE TRANSPARENCIA', sigla: 'UT/', padre: null },
  { nombre: 'UNIDAD DEL SNIAF', sigla: 'SNIAF/', padre: null },
  { nombre: 'UNIDAD DE AUDITORÍA INTERNA', sigla: 'UAI/', padre: null },
  {
    nombre: 'UNIDAD DE IMAGEN INSTITUCIONAL Y DIFUSIÓN',
    sigla: 'UIID/',
    padre: null,
  },
  { nombre: 'DIRECCIÓN NACIONAL DE INNOVACIÓN', sigla: 'DNI/', padre: null },
  { nombre: 'DIRECCIÓN NACIONAL DE SEMILLAS', sigla: 'DNS/', padre: null },
  { nombre: 'DIRECCIÓN ADMINISTRATIVA FINANCIERA', sigla: 'DAF/', padre: null },

  // --- DNI ---
  { nombre: 'DIRECCIÓN CENACA', sigla: 'DNI/CENACA/', padre: 'DNI/' },
  { nombre: 'UNIDAD RECURSOS GENÉTICOS', sigla: 'DNI/RE-GEN/', padre: 'DNI/' },
  {
    nombre: 'UNIDAD DE INVESTIGACIÓN Y VALIDACIÓN',
    sigla: 'DNI/UIV/',
    padre: 'DNI/',
  },
  {
    nombre: 'UNIDAD TRANSFERENCIA TECNOLÓGICA',
    sigla: 'DNI/UTT/',
    padre: 'DNI/',
  },
  { nombre: 'UNIDAD PRODUCCIÓN Y SERVICIOS', sigla: 'DNI/UPS/', padre: 'DNI/' },

  // --- Recursos Genéticos ---
  {
    nombre: 'BANCO NACIONAL DE GERMOPLASMA',
    sigla: 'DNI/RE-GEN/BNG/',
    padre: 'DNI/RE-GEN/',
  },

  // --- UIV (CITs) ---
  {
    nombre: 'CIT CAFÉ - VILLA EL CARMEN',
    sigla: 'DNI/UIV/CIT-VI/',
    padre: 'DNI/UIV/',
  },
  { nombre: 'CIT CACAO - BAURES', sigla: 'DNI/UIV/CIT-CAB/', padre: 'DNI/UIV/' },
  {
    nombre: 'CIT TUBÉRCULOS - TARATA',
    sigla: 'DNI/UIV/CIT-TU/',
    padre: 'DNI/UIV/',
  },
  {
    nombre: 'CIT CACAO - SAN MIGUEL DE HUACHI',
    sigla: 'DNI/UIV/CIT-CAS/',
    padre: 'DNI/UIV/',
  },
  {
    nombre: 'CIT FRUTAS TROP. - CHIMORÉ',
    sigla: 'DNI/UIV/CIT-FT/',
    padre: 'DNI/UIV/',
  },
  {
    nombre: 'CIT GRANOS ANDINOS - SIVINGANI',
    sigla: 'DNI/UIV/CIT-GA/',
    padre: 'DNI/UIV/',
  },
  { nombre: 'CIT FRUTAS VALLE - TARATA', sigla: 'DNI/UIV/FVT/', padre: 'DNI/UIV/' },
  {
    nombre: 'CIT OLEÍFERAS - SAN BUENAVENTURA',
    sigla: 'DNI/UIV/CIT-OIL/',
    padre: 'DNI/UIV/',
  },
  {
    nombre: 'CIT PISCÍCOLA - PALOS BLANCOS',
    sigla: 'DNI/UIV/CIT-PPB/',
    padre: 'DNI/UIV/',
  },
  {
    nombre: 'CIT APÍCOLA - PALOS BLANCOS',
    sigla: 'DNI/UIV/CIT-APIP/',
    padre: 'DNI/UIV/',
  },
  {
    nombre: 'CIT APÍCOLA - CHAGUAYA',
    sigla: 'DNI/UIV/CIT-APIC/',
    padre: 'DNI/UIV/',
  },
  { nombre: 'CEMIVIT', sigla: 'DNI/UIV/CEM/', padre: 'DNI/UIV/' },

  // --- UPS (CPS) ---
  {
    nombre: 'CPS PAPA - CHACHACOMANI',
    sigla: 'DNI/UPS/CPS-PAPAC/',
    padre: 'DNI/UPS/',
  },
  {
    nombre: 'CPS PAPA - ZUDAÑEZ',
    sigla: 'DNI/UPS/CPS-PAPAZ/',
    padre: 'DNI/UPS/',
  },
  {
    nombre: 'CPS HORTALIZAS - SIPE SIPE (CNPSH)',
    sigla: 'DNI/UPS/CPS-CNPSH/',
    padre: 'DNI/UPS/',
  },
  { nombre: 'CPS ALGODÓN', sigla: 'DNI/UPS/CPS-ALG/', padre: 'DNI/UPS/' },
  { nombre: 'CPS WARNES', sigla: 'DNI/UPS/CPS-WAR/', padre: 'DNI/UPS/' },
  { nombre: 'CPS PALMAR', sigla: 'DNI/UPS/CPS-PAL/', padre: 'DNI/UPS/' },
  { nombre: 'CPS BAJO PALMAR', sigla: 'DNI/UPS/CPS-BPA/', padre: 'DNI/UPS/' },
  { nombre: 'CPS-CHACALA', sigla: 'DNI/UPS/CPS-CHA/', padre: 'DNI/UPS/' },
  { nombre: 'SEPA', sigla: 'DNI/UPS/SEPA/', padre: 'DNI/UPS/' },

  // --- DNS ---
  {
    nombre: 'UNIDAD DE CERTIFICACIÓN DE SEMILLAS',
    sigla: 'DNS/UCS/',
    padre: 'DNS/',
  },
  {
    nombre: 'UNIDAD DE FISCALIZACIÓN Y REGISTRO DE SEMILLAS',
    sigla: 'DNS/FRS/',
    padre: 'DNS/',
  },
  {
    nombre:
      'UNIDAD DE CONTROL DE COMERCIO DE SEMILLAS Y ASISTENCIA TÉCNICA SEMILLERA',
    sigla: 'DNS/CCSAT/',
    padre: 'DNS/',
  },
  {
    nombre: 'OFICINA DEPARTAMENTAL DE SEMILLAS (ODS) LA PAZ',
    sigla: 'DNS/ODS-LP/',
    padre: 'DNS/',
  },
  {
    nombre: 'OFICINA DEPARTAMENTAL DE SEMILLAS (ODS) COCHABAMBA',
    sigla: 'DNS/ODS-CB/',
    padre: 'DNS/',
  },
  {
    nombre: 'OFICINA DEPARTAMENTAL DE SEMILLAS (ODS) SANTA CRUZ',
    sigla: 'DNS/ODS-SC/',
    padre: 'DNS/',
  },
  {
    nombre: 'OFICINA DEPARTAMENTAL DE SEMILLAS (ODS) PANDO',
    sigla: 'DNS/ODS-PD/',
    padre: 'DNS/',
  },
  {
    nombre: 'OFICINA DEPARTAMENTAL DE SEMILLAS (ODS) BENI',
    sigla: 'DNS/ODS-BN/',
    padre: 'DNS/',
  },
  {
    nombre: 'OFICINA DEPARTAMENTAL DE SEMILLAS (ODS) ORURO',
    sigla: 'DNS/ODS-OR/',
    padre: 'DNS/',
  },
  {
    nombre: 'OFICINA DEPARTAMENTAL DE SEMILLAS (ODS) POTOSÍ',
    sigla: 'DNS/ODS-PT/',
    padre: 'DNS/',
  },
  {
    nombre: 'OFICINA DEPARTAMENTAL DE SEMILLAS (ODS) TARIJA',
    sigla: 'DNS/ODS-TJ/',
    padre: 'DNS/',
  },
  {
    nombre: 'OFICINA DEPARTAMENTAL DE SEMILLAS (ODS) CHUQUISACA',
    sigla: 'DNS/ODS-CH/',
    padre: 'DNS/',
  },
  {
    nombre: 'OFICINA REGIONAL DE SEMILLAS (ORS) CHACO',
    sigla: 'DNS/ORS-CHA/',
    padre: 'DNS/',
  },

  // --- DAF ---
  { nombre: 'UNIDAD ADMINISTRATIVA', sigla: 'DAF/UAD/', padre: 'DAF/' },
  { nombre: 'UNIDAD DE RECURSOS HUMANOS', sigla: 'DAF/RRHH/', padre: 'DAF/' },
  { nombre: 'UNIDAD FINANCIERA', sigla: 'DAF/UFIN/', padre: 'DAF/' },
];
