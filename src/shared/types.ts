// Client-safe enums for reports (PLAN §5). Arrays, not TS enums: Node type stripping has no enums.
export const INSTITUTIONS = ['MCB', 'SBM', 'MAURITIUS_POST', 'CEB', 'CWA', 'MRA', 'EMTEL', 'MYT', 'POLICE', 'OTHER'] as const;
export const VECTORS = ['SMS', 'WHATSAPP', 'CALL', 'EMAIL'] as const;
export const DISTRICTS = [
  'PORT_LOUIS', 'PAMPLEMOUSSES', 'RIVIERE_DU_REMPART', 'FLACQ', 'GRAND_PORT',
  'SAVANNE', 'PLAINES_WILHEMS', 'MOKA', 'BLACK_RIVER', 'RODRIGUES',
] as const;
