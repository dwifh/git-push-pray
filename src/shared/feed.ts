// Feed display labels for the types.ts enums (PLAN §5), and the GET /api/reports reader.
import { DISTRICTS, INSTITUTIONS, INSTITUTION_LABEL, isOneOf, type District, type Institution, type Trending, type Vector } from './types.ts';

type Row = { key?: unknown; count?: unknown } & Record<string, unknown>;
function rows<T extends string>(list: unknown, field: string, ok: (x: unknown) => x is T) {
  if (!Array.isArray(list)) return [];
  return list.flatMap((r: Row | null) => {
    const value = r?.[field] ?? r?.key; // server sends { key, count } today; the types.ts contract says { [field], count }
    return ok(value) && typeof r?.count === 'number' ? [{ [field]: value, count: r.count } as Record<string, T | number>] : [];
  });
}

/** Reads GET /api/reports in either shape; bad rows are dropped so the Feed never crashes. */
export function toTrending(raw: unknown): Trending {
  const b = (raw ?? {}) as Record<string, unknown>;
  return {
    byInstitution: rows(b.byInstitution, 'institution', (x): x is Institution => isOneOf(INSTITUTIONS, x)),
    byDistrict: rows(b.byDistrict, 'district', (x): x is District => isOneOf(DISTRICTS, x)),
    topDomains: rows(b.topDomains, 'domain', (x): x is string => typeof x === 'string' && x.length > 0),
  } as Trending;
}

// INSTITUTION_LABEL is template wording ("the Police"); the Feed wants short names.
export const institutionLabel = (i: Institution) => ({ POLICE: 'Police', OTHER: 'Other' } as Partial<Record<Institution, string>>)[i] ?? INSTITUTION_LABEL[i];

// Official sites, mirrored from src/lib/extract.ts BRANDS (screens can't import src/lib). Unverified, like the
// backend list (CLAUDE.md): check them against the organisations' own pages before the demo.
// "parcel" / "post" are display-only hints: parcel-fee scams copy Mauritius Post (PLAN §8).
const OFFICIAL: { tokens: string[]; real: string; name: string }[] = [
  { tokens: ['mcb'], real: 'mcb.mu', name: 'MCB' },
  { tokens: ['sbm'], real: 'sbmgroup.mu', name: 'SBM Bank' },
  { tokens: ['ceb'], real: 'ceb.mu', name: 'CEB' },
  { tokens: ['cwa'], real: 'cwa.govmu.org', name: 'CWA' },
  { tokens: ['mra'], real: 'mra.mu', name: 'MRA' },
  { tokens: ['mauritiuspost', 'post', 'parcel'], real: 'mauritiuspost.mu', name: 'Mauritius Post' },
  { tokens: ['emtel'], real: 'emtel.com', name: 'Emtel' },
  { tokens: ['myt'], real: 'myt.mu', name: 'Mauritius Telecom' },
];

/** The official site a reported domain pretends to be, split so the screen can highlight what was added. */
export function realSiteFor(domain: string) {
  const host = domain.toLowerCase();
  if (OFFICIAL.some((o) => host === o.real || host.endsWith(`.${o.real}`))) return null;
  const words = host.split('.').flatMap((label) => [label, label.replaceAll('-', ''), ...label.split('-')]);
  const o = OFFICIAL.find((x) => x.tokens.some((tok) => words.includes(tok)));
  if (!o) return null;
  const brand = o.real.split('.')[0];
  const same = host.startsWith(brand) ? brand : '';
  return { real: o.real, name: o.name, same, extra: host.slice(same.length) };
}

export const VECTOR_LABEL: Record<Vector, string> = { SMS: 'SMS', WHATSAPP: 'WhatsApp', CALL: 'Phone call', EMAIL: 'Email' };

export const DISTRICT_LABEL: Record<District, string> = {
  PORT_LOUIS: 'Port Louis',
  PAMPLEMOUSSES: 'Pamplemousses',
  RIVIERE_DU_REMPART: 'Rivière du Rempart',
  FLACQ: 'Flacq',
  GRAND_PORT: 'Grand Port',
  SAVANNE: 'Savanne',
  PLAINES_WILHEMS: 'Plaines Wilhems',
  MOKA: 'Moka',
  BLACK_RIVER: 'Black River',
  RODRIGUES: 'Rodrigues',
};
