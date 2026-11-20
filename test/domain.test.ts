import { describe, it, expect } from 'vitest';
import { filterProperties, portfolioStats, leaseAlerts, validateProperty, normalizeProperty, esc, type Property } from '../src/domain';

const base: Property = { id: 'x', name: 'Stan', type: 'apartment', status: 'available', rent: 500, rooms: 2, sqm: 50, floor: 1, city: 'Beograd', address: 'Ulica 1', desc: '', furnished: false, parking: false, pets: false, image: '🏢' };
const p = (o: Partial<Property>): Property => ({ ...base, id: Math.random().toString(36), ...o });

describe('statistika portfolija', () => {
  const list = [p({ status: 'rented', rent: 800, sqm: 40 }), p({ status: 'rented', rent: 400, sqm: 20 }), p({ status: 'available', rent: 300 }), p({ status: 'maintenance', rent: 999 })];
  it('prihod, propušten prihod, popunjenost bez nekretnina u održavanju', () => {
    expect(portfolioStats(list)).toMatchObject({ total: 4, rented: 2, available: 1, maintenance: 1, monthlyRevenue: 1200, vacancyLoss: 300, occupancyRate: 67, avgRentPerSqm: 20 });
  });
  it('prazan portfolio ne deli nulom', () => {
    expect(portfolioStats([])).toMatchObject({ occupancyRate: 0, avgRentPerSqm: 0 });
  });
});

describe('ugovori', () => {
  const today = new Date(2026, 10, 20);
  it('istekli, uskoro ističu i bez datuma — sortirano po hitnosti', () => {
    const list = [
      p({ name: 'A', status: 'rented', tenant: 'X', leaseEnd: '2026-12-15' }),
      p({ name: 'B', status: 'rented', tenant: 'Y', leaseEnd: '2026-11-01' }),
      p({ name: 'C', status: 'rented', tenant: 'Z', leaseEnd: null }),
      p({ name: 'D', status: 'rented', tenant: 'W', leaseEnd: '2027-06-01' }),
      p({ name: 'E', status: 'available', leaseEnd: '2026-01-01' })
    ];
    const a = leaseAlerts(list, today);
    expect(a.map(x => [x.property.name, x.kind, x.days])).toEqual([['B', 'expired', -19], ['A', 'expiring', 25], ['C', 'missing', null]]);
  });
});

describe('filtriranje', () => {
  const list = [p({ name: 'Penthouse', rent: 2000, sqm: 180 }), p({ name: 'Soba', type: 'room', rent: 250, city: 'Novi Sad' }), p({ name: 'Kuća', type: 'house', status: 'rented', tenant: 'Marko Marković', rent: 900 })];
  it('pretraga uključuje i stanara', () => {
    expect(filterProperties(list, { status: 'all', type: 'all', query: 'marković', sort: 'newest' }).map(x => x.name)).toEqual(['Kuća']);
  });
  it('kombinuje status, vrstu i sortiranje', () => {
    expect(filterProperties(list, { status: 'available', type: 'all', query: '', sort: 'rent-asc' }).map(x => x.name)).toEqual(['Soba', 'Penthouse']);
  });
});

describe('validacija', () => {
  it('iznajmljeno traži stanara; brojevi moraju biti pozitivni', () => {
    expect(validateProperty({ ...base, status: 'rented', tenant: '' })).toContain('Za iznajmljenu nekretninu unesi stanara');
    expect(validateProperty({ ...base, rent: 0 })).toContain('Najam mora biti veći od 0');
    expect(validateProperty(base)).toEqual([]);
  });
  it('kad nekretnina više nije iznajmljena, stanar se briše', () => {
    expect(normalizeProperty({ ...base, status: 'available', tenant: 'X', leaseEnd: '2027-01-01' })).toMatchObject({ tenant: null, leaseEnd: null });
  });
});

it('esc sprečava XSS iz korisničkog unosa', () => {
  expect(esc('<img src=x onerror=alert(1)>"')).toBe('&lt;img src=x onerror=alert(1)&gt;&quot;');
});
