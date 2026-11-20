/** Rentora — domenska logika (čiste funkcije, testirane). */

export type Status = 'available' | 'rented' | 'maintenance';
export type PropType = 'apartment' | 'house' | 'studio' | 'room' | 'commercial';
export type SortKey = 'newest' | 'rent-asc' | 'rent-desc' | 'sqm';

export interface Property {
  id: string; name: string; type: PropType; status: Status;
  rent: number; rooms: number; sqm: number; floor: number;
  city: string; address: string; desc: string;
  furnished: boolean; parking: boolean; pets: boolean;
  tenant?: string | null; leaseEnd?: string | null; notes?: string;
  image: string;
}

export const STATUS: Record<Status, { label: string; color: string; bg: string; dot: string }> = {
  available: { label: 'Dostupno', color: '#2d5016', bg: 'rgba(45,80,22,.08)', dot: '#4a9c1e' },
  rented: { label: 'Iznajmljeno', color: '#c8a84b', bg: 'rgba(200,168,75,.1)', dot: '#c8a84b' },
  maintenance: { label: 'Održavanje', color: '#c0392b', bg: 'rgba(192,57,43,.08)', dot: '#c0392b' }
};
export const TYPES: Record<PropType, string> = { apartment: 'Apartman', house: 'Kuća', studio: 'Studio', room: 'Soba', commercial: 'Poslovni' };
export const EMOJI: Record<PropType, string> = { apartment: '🏢', house: '🏠', studio: '🏠', room: '🛏️', commercial: '🏪' };

export interface Filter { status: Status | 'all'; type: PropType | 'all'; query: string; sort: SortKey }

export function filterProperties(list: Property[], f: Filter): Property[] {
  const q = f.query.trim().toLowerCase();
  const out = list.filter(p =>
    (f.status === 'all' || p.status === f.status) &&
    (f.type === 'all' || p.type === f.type) &&
    (!q || [p.name, p.city, p.address, p.tenant || ''].some(s => s.toLowerCase().includes(q))));
  if (f.sort === 'rent-asc') out.sort((a, b) => a.rent - b.rent);
  else if (f.sort === 'rent-desc') out.sort((a, b) => b.rent - a.rent);
  else if (f.sort === 'sqm') out.sort((a, b) => b.sqm - a.sqm);
  return out;
}

export function portfolioStats(list: Property[]) {
  const rented = list.filter(p => p.status === 'rented');
  const available = list.filter(p => p.status === 'available');
  const rentable = list.filter(p => p.status !== 'maintenance').length;
  const revenue = rented.reduce((s, p) => s + p.rent, 0);
  return {
    total: list.length,
    available: available.length,
    rented: rented.length,
    maintenance: list.length - rented.length - available.length,
    monthlyRevenue: revenue,
    vacancyLoss: available.reduce((s, p) => s + p.rent, 0),          // propušten prihod mesečno
    occupancyRate: rentable ? Math.round((rented.length / rentable) * 100) : 0,
    avgRentPerSqm: rented.length ? Math.round((revenue / rented.reduce((s, p) => s + p.sqm, 0)) * 10) / 10 : 0
  };
}

export type LeaseAlert = { property: Property; kind: 'expired' | 'expiring' | 'missing'; days: number | null };

/** Ugovori koji su istekli, ističu u narednih `withinDays` dana, ili iznajmljeno bez datuma kraja ugovora. */
export function leaseAlerts(list: Property[], today = new Date(), withinDays = 60): LeaseAlert[] {
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const out: LeaseAlert[] = [];
  for (const p of list) {
    if (p.status !== 'rented') continue;
    if (!p.leaseEnd) { out.push({ property: p, kind: 'missing', days: null }); continue; }
    const [y, m, d] = p.leaseEnd.split('-').map(Number);
    const days = Math.round((Date.UTC(y, m - 1, d) - t0) / 864e5);
    if (days < 0) out.push({ property: p, kind: 'expired', days });
    else if (days <= withinDays) out.push({ property: p, kind: 'expiring', days });
  }
  const rank = { expired: 0, expiring: 1, missing: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || (a.days ?? 0) - (b.days ?? 0));
}

export function validateProperty(p: Partial<Property>): string[] {
  const e: string[] = [];
  if (!p.name?.trim()) e.push('Naziv je obavezan');
  if (!p.city?.trim()) e.push('Grad je obavezan');
  if (!(Number(p.rent) > 0)) e.push('Najam mora biti veći od 0');
  if (!(Number(p.sqm) > 0)) e.push('Površina mora biti veća od 0');
  if ((p.rooms ?? 0) < 0 || (p.floor ?? 0) < 0) e.push('Sobe i sprat ne mogu biti negativni');
  if (p.status === 'rented' && !p.tenant?.trim()) e.push('Za iznajmljenu nekretninu unesi stanara');
  if (p.leaseEnd && !/^\d{4}-\d{2}-\d{2}$/.test(p.leaseEnd)) e.push('Neispravan datum ugovora');
  return e;
}

/** Ako nekretnina više nije iznajmljena, podaci o stanaru se brišu. */
export function normalizeProperty(p: Property): Property {
  return p.status === 'rented' ? p : { ...p, tenant: null, leaseEnd: null };
}

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
