const KEY = 'herd.v1';
let db = JSON.parse(localStorage.getItem(KEY) || '{"animals":[],"events":[]}');
db.pastures = db.pastures || [];
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EVENT_TYPES = ['Vaccination', 'Treatment', 'Weight', 'Breeding', 'Calving', 'Pregnancy check', 'Note'];
const SEXES = ['Cow', 'Heifer', 'Bull', 'Steer', 'Calf'];
const STATUSES = ['Active', 'Sold', 'Deceased'];

let view = 'home', cur = null, q = '', filter = 'Active';

const getAnimal = id => db.animals.find(a => a.id === id);
const eventsFor = id => db.events.filter(e => e.aid === id).sort((a, b) => b.date.localeCompare(a.date));
const lastWeight = id => { const e = eventsFor(id).find(e => e.type === 'Weight'); return e ? e.value : null; };
const pending = () => db.events.filter(e => e.due && !e.done).sort((a, b) => a.due.localeCompare(b.due));
function age(d) {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d)) / 2629800000);
  return m < 24 ? m + ' mo' : (m / 12).toFixed(1) + ' yr';
}
const opts = (list, sel) => list.map(s => `<option ${s === sel ? 'selected' : ''}>${s}</option>`).join('');

function go(v, c) { view = v; cur = c || null; render(); }
function render() {
  document.querySelectorAll('nav button').forEach(b => {
    const herdish = ['herd', 'animal', 'edit', 'event'].includes(view);
    const pastureish = ['pastures', 'pasture', 'pedit'].includes(view);
    b.classList.toggle('on', b.dataset.v === view || (herdish && b.dataset.v === 'herd') || (pastureish && b.dataset.v === 'pastures'));
  });
  $('#back').hidden = !['animal', 'edit', 'event', 'pasture', 'pedit'].includes(view);
  $('#fab').hidden = !['herd', 'home', 'pastures'].includes(view);
  ({ home: viewHome, herd: viewHerd, animal: viewAnimal, edit: viewEdit, event: viewEvent, tasks: viewTasks, data: viewData, pastures: viewPastures, pasture: viewPasture, pedit: viewPastureEdit })[view]();
  window.scrollTo(0, 0);
}
$('#back').onclick = () => {
  if (view === 'pedit') return cur ? go('pasture', cur) : go('pastures');
  if (view === 'pasture') return go('pastures');
  if (view === 'edit') return cur ? go('animal', cur) : go('herd');
  if (view === 'event') return go('animal', cur);
  go('herd');
};
$('#fab').onclick = () => go(view === 'pastures' ? 'pedit' : 'edit');

const headIn = name => db.animals.filter(a => a.status === 'Active' && a.group === name);

function viewPastures() {
  $('#title').textContent = 'Pastures';
  const unassigned = db.animals.filter(a => a.status === 'Active' && !db.pastures.some(p => p.name === a.group)).length;
  $('#app').innerHTML = (db.pastures.length ? db.pastures.map(p => {
    const n = headIn(p.name).length;
    const dens = p.acres > 0 && n ? ` · ${(p.acres / n).toFixed(1)} ac/head` : '';
    return `<div class="card row" onclick="go('pasture','${p.id}')"><div class="grow"><div class="tag">${esc(p.name)}</div><div class="sub">${p.acres ? esc(p.acres) + ' acres' : 'Acres not set'}${dens}${p.notes ? ' · ' + esc(p.notes) : ''}</div></div><span class="pill">${n} head</span></div>`;
  }).join('') : '<div class="empty">No pastures yet. Tap + to add one.</div>') +
    (unassigned ? `<div class="card sub">${unassigned} active animal(s) not in a pasture.</div>` : '');
}

function viewPasture() {
  const p = db.pastures.find(x => x.id === cur); if (!p) return go('pastures');
  $('#title').textContent = p.name;
  const list = headIn(p.name);
  $('#app').innerHTML = `<div class="card"><div class="tag">${esc(p.name)}</div><div class="sub">${p.acres ? esc(p.acres) + ' acres · ' : ''}${list.length} head</div>${p.notes ? `<p>${esc(p.notes)}</p>` : ''}</div>
  <button class="btn sec" onclick="go('pedit','${p.id}')">Edit pasture</button>
  <h2>Animals here</h2>${list.length ? list.map(a => `<div class="card row" onclick="go('animal','${a.id}')"><div class="grow"><div class="tag">${esc(a.tag)}${a.name ? ' · ' + esc(a.name) : ''}</div><div class="sub">${esc([a.sex, a.breed].filter(Boolean).join(' · '))}</div></div></div>`).join('') : '<div class="card sub">No animals in this pasture.</div>'}`;
}

function viewPastureEdit() {
  const p = db.pastures.find(x => x.id === cur) || {};
  $('#title').textContent = cur ? 'Edit pasture' : 'New pasture';
  $('#app').innerHTML = `<label>Name *</label><input id="pn" value="${esc(p.name)}">
  <label>Acres</label><input id="pa" type="number" step="any" inputmode="decimal" value="${esc(p.acres)}">
  <label>Notes (water, fencing, forage…)</label><textarea id="pt" rows="3">${esc(p.notes)}</textarea>
  <button class="btn" id="sv">Save</button>${cur ? '<button class="btn del" id="rm">Delete pasture</button>' : ''}`;
  $('#sv').onclick = () => {
    const name = $('#pn').value.trim();
    if (!name) return alert('Name is required');
    if (db.pastures.some(x => x.name === name && x.id !== cur)) return alert('That pasture already exists');
    const rec = { id: cur || uid(), name, acres: $('#pa').value.trim(), notes: $('#pt').value.trim() };
    if (cur) {
      if (p.name !== name) db.animals.forEach(a => { if (a.group === p.name) a.group = name; });
      db.pastures[db.pastures.findIndex(x => x.id === cur)] = rec;
    } else db.pastures.push(rec);
    save(); go('pasture', rec.id);
  };
  if (cur) $('#rm').onclick = () => {
    if (confirm('Delete this pasture? Animals in it become unassigned.')) {
      db.animals.forEach(a => { if (a.group === p.name) a.group = ''; });
      db.pastures = db.pastures.filter(x => x.id !== cur); save(); go('pastures');
    }
  };
}
document.querySelectorAll('nav button').forEach(b => b.onclick = () => go(b.dataset.v));

function taskCard(e) {
  const a = getAnimal(e.aid), late = e.due < today();
  return `<div class="card row"><div class="grow" onclick="go('animal','${e.aid}')"><div class="tag">${esc(a ? a.tag : '?')} · ${esc(e.type)}</div><div class="sub">${esc(e.notes || '')}</div></div><span class="pill ${late ? 'bad' : ''}">${e.due}</span><button class="pill" onclick="markDone('${e.id}')">Done</button></div>`;
}
window.markDone = id => { db.events.find(e => e.id === id).done = true; save(); render(); };
window.go = go;

function viewHome() {
  $('#title').textContent = 'RamTech Cattle Log';
  const act = db.animals.filter(a => a.status === 'Active');
  const n = f => act.filter(f).length;
  const due = pending().slice(0, 5);
  $('#app').innerHTML = `<div class="stats">
    <div class="stat"><b>${act.length}</b>Total head</div>
    <div class="stat"><b>${n(a => a.sex === 'Cow' || a.sex === 'Heifer')}</b>Cows / Heifers</div>
    <div class="stat"><b>${n(a => a.sex === 'Bull' || a.sex === 'Steer')}</b>Bulls / Steers</div>
    <div class="stat"><b>${n(a => a.sex === 'Calf')}</b>Calves</div></div>
    <h2>Upcoming health tasks</h2>${due.length ? due.map(taskCard).join('') : '<div class="card sub">Nothing due 🎉</div>'}`;
}

function viewHerd() {
  $('#title').textContent = 'Herd';
  const list = db.animals.filter(a => (filter === 'All' || a.status === filter) &&
    (!q || [a.tag, a.name, a.breed, a.group].join(' ').toLowerCase().includes(q.toLowerCase())));
  $('#app').innerHTML = `<input id="q" type="search" placeholder="Search tag, name, breed, pasture" value="${esc(q)}">
  <select id="fl">${opts(['Active', 'Sold', 'Deceased', 'All'], filter)}</select>
  <div id="list">${list.length ? list.map(a => `<div class="card row" onclick="go('animal','${a.id}')"><div class="grow"><div class="tag">${esc(a.tag)}${a.name ? ' · ' + esc(a.name) : ''}</div><div class="sub">${esc([a.sex, a.breed, age(a.dob), a.group].filter(Boolean).join(' · '))}</div></div>${lastWeight(a.id) ? `<span class="pill">${esc(lastWeight(a.id))} lb</span>` : ''}</div>`).join('') : '<div class="empty">No animals. Tap + to add one.</div>'}</div>`;
  $('#q').oninput = e => { q = e.target.value; const p = e.target.selectionStart; viewHerd(); const i = $('#q'); i.focus(); i.setSelectionRange(p, p); };
  $('#fl').onchange = e => { filter = e.target.value; viewHerd(); };
}

function viewAnimal() {
  const a = getAnimal(cur); if (!a) return go('herd');
  $('#title').textContent = a.tag;
  const ev = eventsFor(a.id);
  $('#app').innerHTML = `<div class="card"><div class="tag">${esc(a.tag)}${a.name ? ' · ' + esc(a.name) : ''}</div>
  <div class="sub">${esc([a.sex, a.breed, a.dob ? 'Born ' + a.dob + ' (' + age(a.dob) + ')' : '', a.group, a.status].filter(Boolean).join(' · '))}</div>
  ${a.dam || a.sire ? `<div class="sub">Dam: ${esc(a.dam || '-')} · Sire: ${esc(a.sire || '-')}</div>` : ''}
  ${a.notes ? `<p>${esc(a.notes)}</p>` : ''}</div>
  <button class="btn" onclick="go('event','${a.id}')">+ Add health event / weight</button>
  <button class="btn sec" onclick="go('edit','${a.id}')">Edit animal</button>
  <h2>History</h2>${ev.length ? ev.map(e => `<div class="card row"><div class="grow"><div class="tag" style="font-size:15px">${esc(e.type)}${e.value ? ' · ' + esc(e.value) + (e.type === 'Weight' ? ' lb' : '') : ''}</div><div class="sub">${e.date}${e.notes ? ' · ' + esc(e.notes) : ''}${e.due ? ` · due ${e.due}${e.done ? ' ✓' : ''}` : ''}</div></div><button class="pill bad" onclick="delEvent('${e.id}')">✕</button></div>`).join('') : '<div class="card sub">No history yet.</div>'}`;
}
window.delEvent = id => { if (confirm('Delete this record?')) { db.events = db.events.filter(e => e.id !== id); save(); render(); } };

function viewEdit() {
  const a = getAnimal(cur) || { status: 'Active', sex: 'Cow' };
  $('#title').textContent = cur ? 'Edit animal' : 'New animal';
  const f = (id, label, v, type = 'text') => `<label>${label}</label><input id="${id}" type="${type}" value="${esc(v)}">`;
  $('#app').innerHTML = `${f('tag', 'Ear tag / ID *', a.tag)}${f('name', 'Name', a.name)}
  <label>Sex / class</label><select id="sex">${opts(SEXES, a.sex)}</select>
  ${f('breed', 'Breed', a.breed)}${f('dob', 'Date of birth', a.dob, 'date')}
  <label>Pasture</label><select id="group"><option value="">— None —</option>${db.pastures.map(p => p.name).concat(a.group && !db.pastures.some(p => p.name === a.group) ? [a.group] : []).map(n => `<option ${n === a.group ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
  <div class="sub" style="margin-bottom:10px">Add pastures in the Pastures tab.</div>
  ${f('dam', 'Dam (mother tag)', a.dam)}${f('sire', 'Sire (father tag)', a.sire)}
  <label>Status</label><select id="status">${opts(STATUSES, a.status)}</select>
  <label>Notes</label><textarea id="notes" rows="3">${esc(a.notes)}</textarea>
  <button class="btn" id="sv">Save</button>${cur ? '<button class="btn del" id="rm">Delete animal</button>' : ''}`;
  $('#sv').onclick = () => {
    const tag = $('#tag').value.trim();
    if (!tag) return alert('Ear tag is required');
    if (db.animals.some(x => x.tag === tag && x.id !== cur)) return alert('That tag already exists');
    const rec = { id: cur || uid(), tag };
    ['name', 'sex', 'breed', 'dob', 'group', 'dam', 'sire', 'status', 'notes'].forEach(k => rec[k] = $('#' + k).value.trim());
    if (cur) db.animals[db.animals.findIndex(x => x.id === cur)] = rec; else db.animals.push(rec);
    save(); go('animal', rec.id);
  };
  if (cur) $('#rm').onclick = () => {
    if (confirm('Delete this animal and its history?')) {
      db.animals = db.animals.filter(x => x.id !== cur); db.events = db.events.filter(e => e.aid !== cur); save(); go('herd');
    }
  };
}

function viewEvent() {
  const a = getAnimal(cur); $('#title').textContent = 'Add event · ' + a.tag;
  $('#app').innerHTML = `<label>Type</label><select id="type">${opts(EVENT_TYPES)}</select>
  <label>Date</label><input id="date" type="date" value="${today()}">
  <label id="vl">Value (weight in lb / product / bull tag)</label><input id="value">
  <label>Notes</label><textarea id="notes" rows="2"></textarea>
  <label>Follow-up due date (optional reminder)</label><input id="due" type="date">
  <button class="btn" id="sv">Save</button>`;
  $('#sv').onclick = () => {
    db.events.push({ id: uid(), aid: cur, type: $('#type').value, date: $('#date').value || today(), value: $('#value').value.trim(), notes: $('#notes').value.trim(), due: $('#due').value, done: false });
    save(); go('animal', cur);
  };
}

function viewTasks() {
  $('#title').textContent = 'Health tasks';
  const p = pending();
  $('#app').innerHTML = p.length ? p.map(taskCard).join('') : '<div class="empty">No upcoming tasks. Add a follow-up due date when logging an event.</div>';
}

function viewData() {
  $('#title').textContent = 'Data';
  $('#app').innerHTML = `<div class="card sub">Data is stored only on this device. Export backups regularly.</div>
  <button class="btn" id="ex">Export backup (JSON)</button>
  <button class="btn sec" id="csv">Export herd (CSV)</button>
  <button class="btn sec" id="im">Import backup</button>
  <input id="file" type="file" accept="application/json" hidden>`;
  const dl = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  };
  $('#ex').onclick = () => dl('herd-backup-' + today() + '.json', JSON.stringify(db), 'application/json');
  $('#csv').onclick = () => {
    const cols = ['tag', 'name', 'sex', 'breed', 'dob', 'group', 'dam', 'sire', 'status', 'notes'];
    const c = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    dl('herd-' + today() + '.csv', [cols.join(','), ...db.animals.map(a => cols.map(k => c(a[k])).join(','))].join('\n'), 'text/csv');
  };
  $('#im').onclick = () => $('#file').click();
  $('#file').onchange = async e => {
    try {
      const d = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(d.animals) || !Array.isArray(d.events)) throw 0;
      if (confirm('Replace all current data with this backup?')) { d.pastures = d.pastures || []; db = d; save(); go('home'); }
    } catch { alert('Invalid backup file'); }
  };
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();
