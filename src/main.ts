import { EMOJI, STATUS, TYPES, esc, filterProperties, leaseAlerts, normalizeProperty, portfolioStats, validateProperty, type Filter, type Property, type PropType, type SortKey, type Status } from './domain';
import { SEED } from './seed';

const KEY = 'rentora_v2';
const $ = (id: string) => document.getElementById(id)!;
const eur = (n: number) => `€${n.toLocaleString('sr-RS')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('sr-RS');

let properties: Property[] = (() => { try { const d = localStorage.getItem(KEY); return d ? JSON.parse(d) : SEED; } catch { return SEED; } })();
const filter: Filter = { status: 'all', type: 'all', query: '', sort: 'newest' };
let editingId: string | null = null;

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(properties)); } catch { /* privatni režim */ } };

function renderStats() {
  const s = portfolioStats(properties);
  $('navStat').textContent = `${s.rented} iznajmljenih · ${eur(s.monthlyRevenue)}/mes`;
  $('statsRow').innerHTML = [
    { n: s.total, l: 'Ukupno' },
    { n: `${s.occupancyRate}%`, l: 'Popunjenost' },
    { n: eur(s.monthlyRevenue), l: 'Mesečni prihod' },
    { n: eur(s.vacancyLoss), l: 'Propušteno (prazne)' }
  ].map(x => `<div><div class="stat-num">${x.n}</div><div class="stat-label">${x.l}</div></div>`).join('');

  const alerts = leaseAlerts(properties);
  $('alerts').innerHTML = alerts.length ? `<div style="margin-top:22px;color:#1f1f1f">${alerts.map(a => {
    const txt = a.kind === 'expired' ? `ugovor je istekao pre ${-a.days!} dana` : a.kind === 'expiring' ? `ugovor ističe za ${a.days} dana` : 'iznajmljeno, ali nema datuma kraja ugovora';
    const color = a.kind === 'expired' ? '#c0392b' : a.kind === 'expiring' ? '#b7791f' : '#6b7280';
    return `<div onclick="openDetail('${esc(a.property.id)}')" style="cursor:pointer;display:flex;gap:10px;align-items:center;padding:10px 14px;margin-bottom:6px;border-radius:10px;background:#fff;border-left:4px solid ${color};font-size:.88rem">⚠️ <b>${esc(a.property.name)}</b> <span style="color:${color}">${txt}</span>${a.property.tenant ? `<span style="margin-left:auto;color:#888">👤 ${esc(a.property.tenant)}</span>` : ''}</div>`;
  }).join('')}</div>` : '';
}

function renderFilters() {
  const statuses: (Status | 'all')[] = ['all', 'available', 'rented', 'maintenance'];
  $('statusFilters').innerHTML = statuses.map(s => `<button class="filter-btn ${filter.status === s ? 'active' : ''}" onclick="setStatus('${s}')">${s === 'all' ? 'Sve' : STATUS[s].label}</button>`).join('');
  const types: (PropType | 'all')[] = ['all', 'apartment', 'house', 'studio', 'room', 'commercial'];
  $('typeFilters').innerHTML = types.map(t => `<button class="filter-btn ${filter.type === t ? 'active' : ''}" onclick="setType('${t}')">${t === 'all' ? 'Sve vrste' : TYPES[t]}</button>`).join('');
}

function card(p: Property) {
  const sc = STATUS[p.status];
  return `
  <div class="card" onclick="openDetail('${esc(p.id)}')">
    <div class="card-img" style="background:${p.status === 'rented' ? '#fdf8ee' : 'var(--cream)'}">
      <span>${esc(p.image)}</span>
      <span class="card-badge" style="background:${sc.bg};color:${sc.color}"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${sc.dot};margin-right:5px"></span>${sc.label}</span>
      ${p.floor > 0 ? `<span class="card-floor">${p.floor}. sprat</span>` : ''}
    </div>
    <div class="card-body">
      <div class="card-name">${esc(p.name)}</div>
      <div class="card-addr">📍 ${esc(p.address)}</div>
      <div class="card-meta">
        ${p.rooms > 0 ? `<span class="meta-item">🛏 ${p.rooms} sobe</span>` : ''}
        <span class="meta-item">📐 ${p.sqm}m²</span>
        ${p.furnished ? '<span class="meta-item">🪑 Namešteno</span>' : ''}
        ${p.parking ? '<span class="meta-item">🚗 Parking</span>' : ''}
        ${p.pets ? '<span class="meta-item">🐾 Ljubimci</span>' : ''}
      </div>
      ${p.tenant ? `<div class="card-tenant"><span>👤</span><span>${esc(p.tenant)}</span>${p.leaseEnd ? `<span style="margin-left:auto">do ${fmtDate(p.leaseEnd)}</span>` : ''}</div>` : ''}
      <div class="card-footer">
        <div>
          <div class="card-rent">${eur(p.rent)}<span style="font-family:var(--dm);font-weight:400;font-size:.85rem;color:var(--muted)">/mes</span></div>
          <div class="card-rent-sub">${TYPES[p.type]} · ${esc(p.city)}</div>
        </div>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="icon-btn" title="Uredi" onclick="openModal('edit','${esc(p.id)}')">✏️</button>
          <button class="icon-btn danger" title="Obriši" onclick="openModal('delete','${esc(p.id)}')">🗑</button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderAll() {
  filter.query = ($('searchInput') as HTMLInputElement).value || '';
  renderStats(); renderFilters();
  const list = filterProperties(properties, filter);
  $('propertyGrid').innerHTML = list.length ? list.map(card).join('') :
    '<div class="empty-state"><div style="font-size:3rem;margin-bottom:12px">🔍</div><div style="font-family:var(--fraunces);font-weight:700;font-size:1.2rem;margin-bottom:8px">Nema rezultata</div><div>Probaj drugi filter ili pretragu.</div></div>';
}

const field = (label: string, html: string) => `<div><label class="form-label">${label}</label>${html}</div>`;

function formHtml(mode: 'add' | 'edit', v: Partial<Property>) {
  const opt = <K extends string>(map: Record<K, string>, cur?: string) => (Object.entries(map) as [K, string][]).map(([k, l]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${l}</option>`).join('');
  return `
  <div class="modal-header"><div class="modal-title">${mode === 'add' ? '+ Nova nekretnina' : 'Uredi nekretninu'}</div><button class="close-btn" onclick="closeModal()">×</button></div>
  <form class="modal-body" onsubmit="submitForm(event,'${mode}')">
    <div id="formErrors"></div>
    <div class="form-group"><label class="form-label">Naziv</label><input required class="form-input" name="name" value="${esc(v.name)}" placeholder="npr. Elegantan stan u centru"></div>
    <div class="form-row3" style="margin-bottom:16px">
      ${field('Vrsta', `<select class="form-input" name="type">${opt(TYPES, v.type)}</select>`)}
      ${field('Status', `<select class="form-input" name="status" onchange="toggleTenantFields(this.value)">${opt(Object.fromEntries(Object.entries(STATUS).map(([k, s]) => [k, s.label])) as Record<Status, string>, v.status)}</select>`)}
      ${field('Kirija (€/mes)', `<input required type="number" min="1" class="form-input" name="rent" value="${esc(v.rent)}">`)}
    </div>
    <div class="form-row3" style="margin-bottom:16px">
      ${field('Sobe', `<input type="number" min="0" class="form-input" name="rooms" value="${esc(v.rooms ?? 1)}">`)}
      ${field('Površina (m²)', `<input required type="number" min="1" class="form-input" name="sqm" value="${esc(v.sqm)}">`)}
      ${field('Sprat', `<input type="number" min="0" class="form-input" name="floor" value="${esc(v.floor ?? 0)}">`)}
    </div>
    <div class="form-row" style="margin-bottom:16px">
      ${field('Grad', `<input required class="form-input" name="city" value="${esc(v.city)}">`)}
      ${field('Adresa', `<input class="form-input" name="address" value="${esc(v.address)}">`)}
    </div>
    <div class="form-group"><label class="form-label">Opis</label><textarea class="form-input" name="desc">${esc(v.desc)}</textarea></div>
    <div class="form-group"><label class="form-label">Karakteristike</label><div class="check-row">
      <label class="check-item"><input type="checkbox" name="furnished" ${v.furnished ? 'checked' : ''}> 🪑 Namešteno</label>
      <label class="check-item"><input type="checkbox" name="parking" ${v.parking ? 'checked' : ''}> 🚗 Parking</label>
      <label class="check-item"><input type="checkbox" name="pets" ${v.pets ? 'checked' : ''}> 🐾 Ljubimci</label>
    </div></div>
    <div id="tenantFields" style="display:${v.status === 'rented' ? 'block' : 'none'}"><div class="form-row" style="margin-bottom:16px">
      ${field('Stanar', `<input class="form-input" name="tenant" value="${esc(v.tenant)}">`)}
      ${field('Kraj ugovora', `<input type="date" class="form-input" name="leaseEnd" value="${esc(v.leaseEnd)}">`)}
    </div></div>
    <div class="form-group"><label class="form-label">Napomene</label><input class="form-input" name="notes" value="${esc(v.notes)}"></div>
    <button type="submit" class="submit-btn">${mode === 'add' ? 'Dodaj nekretninu' : 'Sačuvaj promene'}</button>
  </form>`;
}

function detailHtml(p: Property) {
  const sc = STATUS[p.status];
  const item = (k: string, v: string) => `<div class="detail-item"><div class="detail-key">${k}</div><div class="detail-val">${v}</div></div>`;
  return `
  <div class="modal-header"><div>
    <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${TYPES[p.type]} · ${esc(p.city)}</div>
    <div class="modal-title">${esc(p.name)}</div></div><button class="close-btn" onclick="closeModal()">×</button></div>
  <div class="modal-body">
    <div style="display:flex;align-items:center;gap:16px;margin:12px 0 16px"><span style="font-size:3rem">${esc(p.image)}</span><div>
      <span style="display:inline-flex;align-items:center;gap:6px;background:${sc.bg};color:${sc.color};padding:4px 12px;border-radius:100px;font-size:.78rem;font-weight:700"><span style="width:6px;height:6px;border-radius:50%;background:${sc.dot};display:inline-block"></span>${sc.label}</span>
      <div style="font-family:var(--fraunces);font-size:2rem;font-weight:700;margin-top:4px">${eur(p.rent)}<span style="font-size:1rem;font-weight:400;color:var(--muted)">/mes · ${(p.rent / p.sqm).toFixed(1)} €/m²</span></div></div></div>
    <div style="color:var(--muted);font-size:.875rem;margin-bottom:16px">📍 ${esc(p.address)}</div>
    ${p.desc ? `<div style="background:var(--cream);border-radius:10px;padding:14px;margin-bottom:16px;font-size:.875rem;line-height:1.6;color:#3a3830">${esc(p.desc)}</div>` : ''}
    <div class="detail-grid">
      ${p.rooms > 0 ? item('Sobe', String(p.rooms)) : ''}${item('Površina', `${p.sqm} m²`)}${item('Sprat', p.floor === 0 ? 'Prizemlje' : `${p.floor}. sprat`)}
      ${item('Namešteno', p.furnished ? '✓ Da' : '✗ Ne')}${item('Parking', p.parking ? '✓ Da' : '✗ Ne')}${item('Ljubimci', p.pets ? '✓ OK' : '✗ Ne')}
    </div>
    ${p.tenant ? `<div style="background:#fdf8ee;border:1px solid rgba(200,168,75,.2);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Stanar</div>
      <div style="font-weight:600">👤 ${esc(p.tenant)}</div>${p.leaseEnd ? `<div style="color:var(--muted);font-size:.82rem;margin-top:4px">Ugovor ističe: ${fmtDate(p.leaseEnd)}</div>` : ''}</div>` : ''}
    ${p.notes ? `<div style="color:var(--muted);font-size:.82rem;font-style:italic;margin-bottom:16px">📝 ${esc(p.notes)}</div>` : ''}
    <div style="display:flex;gap:10px;margin-top:12px">
      <button class="submit-btn" style="flex:1" onclick="openModal('edit','${esc(p.id)}')">✏️ Uredi</button>
      <button class="submit-btn delete-btn" style="flex:0;padding:13px 20px" onclick="openModal('delete','${esc(p.id)}')">🗑</button>
    </div>
  </div>`;
}

function openModal(mode: 'add' | 'edit' | 'delete' | 'detail', id?: string) {
  editingId = id ?? null;
  const p = id ? properties.find(x => x.id === id) : undefined;
  if (mode !== 'add' && !p) return;
  $('modalContent').innerHTML =
    mode === 'add' ? formHtml('add', { type: 'apartment', status: 'available' }) :
    mode === 'edit' ? formHtml('edit', p!) :
    mode === 'detail' ? detailHtml(p!) : `
    <div class="modal-header"><div class="modal-title">Obriši nekretninu</div><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body"><div class="delete-confirm">Da li sigurno želiš da obrišeš <strong>${esc(p!.name)}</strong>?<br>Ova radnja je nepovratna.</div>
      <div style="display:flex;gap:10px"><button class="submit-btn cancel" onclick="closeModal()">Odustani</button><button class="submit-btn delete-btn" onclick="deleteProperty('${esc(p!.id)}')">Da, obriši</button></div></div>`;
  $('modalOverlay').classList.remove('hidden');
}

function submitForm(e: SubmitEvent, mode: 'add' | 'edit') {
  e.preventDefault();
  const fd = new FormData(e.target as HTMLFormElement);
  const s = (k: string) => String(fd.get(k) ?? '').trim();
  const type = s('type') as PropType;
  const data = normalizeProperty({
    id: mode === 'add' ? `p${Date.now()}` : editingId!,
    name: s('name'), type, status: s('status') as Status,
    rent: Number(s('rent')), rooms: Number(s('rooms')), sqm: Number(s('sqm')), floor: Number(s('floor')),
    city: s('city'), address: s('address'), desc: s('desc'), notes: s('notes'),
    furnished: fd.get('furnished') === 'on', parking: fd.get('parking') === 'on', pets: fd.get('pets') === 'on',
    tenant: s('tenant') || null, leaseEnd: s('leaseEnd') || null, image: EMOJI[type]
  });
  const errors = validateProperty(data);
  if (errors.length) {
    $('formErrors').innerHTML = `<div style="background:#fdecea;color:#c0392b;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:.85rem">${errors.map(esc).join('<br>')}</div>`;
    return;
  }
  properties = mode === 'add' ? [data, ...properties] : properties.map(p => (p.id === editingId ? data : p));
  showToast(mode === 'add' ? '✓ Nekretnina dodata' : '✓ Izmene sačuvane');
  save(); closeModal(); renderAll();
}

function deleteProperty(id: string) {
  properties = properties.filter(p => p.id !== id);
  save(); closeModal(); showToast('Nekretnina obrisana.'); renderAll();
}

function toggleTenantFields(v: string) { const el = document.getElementById('tenantFields'); if (el) el.style.display = v === 'rented' ? 'block' : 'none'; }
function closeModal() { $('modalOverlay').classList.add('hidden'); }
function closeModalIfBg(e: MouseEvent) { if (e.target === $('modalOverlay')) closeModal(); }
function showToast(msg: string) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
const setStatus = (s: Status | 'all') => { filter.status = s; renderAll(); };
const setType = (t: PropType | 'all') => { filter.type = t; renderAll(); };
const setSort = (s: SortKey) => { filter.sort = s; renderAll(); };
const openDetail = (id: string) => openModal('detail', id);

Object.assign(window, { openModal, openDetail, closeModal, closeModalIfBg, submitForm, deleteProperty, toggleTenantFields, setStatus, setType, setSort, renderAll });
renderAll();
