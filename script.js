/* ===== VibePlanner — state & util ===== */
const KEY = 'vibe_planner_activities_db', THEME = 'vibe_planner_theme';
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const PR = { High: 3, Medium: 2, Low: 1 };
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // zona waktu lokal
const today = () => keyOf(new Date());
const parse = k => { const [a, b, c] = k.split('-').map(Number); return new Date(a, b - 1, c); };
const dayDiff = k => Math.round((parse(k) - parse(today())) / 864e5);
const fmt = k => { const d = parse(k); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return keyOf(d); };

const S = { acts: [], year: 0, month: 0, sel: null, filter: 'all', q: '', prio: 'all',
            sort: { key: null, dir: 1 }, fx: null, ready: false, allDone: false };

const demo = () => [
    { id: 1, title: 'Review Algoritma & Flowchart', date: addDays(1), priority: 'High', completed: false },
    { id: 2, title: 'Praktek Looping & Array 2D', date: addDays(3), priority: 'Medium', completed: true },
    { id: 3, title: 'Setup Deployment Vercel', date: addDays(-2), priority: 'High', completed: false }
];
const metrics = () => {
    const t = S.acts.length, c = S.acts.filter(a => a.completed).length;
    return { total: t, completed: c, pending: t - c, progress: t ? Math.round(c / t * 1000) / 10 : 0 };
};

/* ===== Penyimpanan: localStorage + sinkron ke backend ===== */
let syncTimer;
function save() {
    localStorage.setItem(KEY, JSON.stringify(S.acts));
    setBadge('saving');
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 450);
}
async function sync() {
    try {
        const r = await fetch(`/api/sync?year=${S.year}&month=${S.month}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activities: S.acts })
        });
        if (!r.ok) throw 0;
        setBadge('ok');
    } catch { setBadge('offline'); }
}
function setBadge(st) {
    const b = $('#autosaveBadge');
    b.dataset.state = st;
    $('.autosave-text', b).textContent = { saving: 'Menyimpan…', ok: 'Tersimpan Otomatis', offline: 'Tersimpan di Browser' }[st];
}
async function load() {
    try { S.acts = JSON.parse(localStorage.getItem(KEY)); } catch { S.acts = null; }
    if (!Array.isArray(S.acts)) {
        try {
            const r = await fetch('/api/data');
            S.acts = r.ok ? (await r.json()).activities : demo();
        } catch { S.acts = demo(); }
        if (!Array.isArray(S.acts)) S.acts = demo();
        localStorage.setItem(KEY, JSON.stringify(S.acts));
    }
    sync();
}

/* ===== Jam, sapaan & tanggal ===== */
function tick() {
    const n = new Date(), h = n.getHours();
    $('#liveClock').textContent = `${pad(h)}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
    $('#currentDateStr').textContent = n.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const g = h >= 4 && h < 11 ? 'Selamat pagi' : h < 15 && h >= 11 ? 'Selamat siang' : h >= 15 && h < 18 ? 'Selamat sore' : 'Selamat malam';
    const p = S.acts.filter(a => !a.completed && a.date === today()).length;
    const late = S.acts.filter(a => !a.completed && a.date < today()).length;
    $('#greetingText').textContent = `${g}! ` + (late ? `${late} kegiatan terlambat, yuk kejar ⚡` :
        p ? `${p} kegiatan menantimu hari ini 🚀` : 'Hari ini bebas jadwal, santai dulu ✨');
}

/* ===== Render ===== */
function renderAll() { renderStats(); renderCal(); renderDay(); renderTable(); renderInsights(); tick(); }

function renderStats() {
    const m = metrics();
    count('statTotal', m.total); count('statCompleted', m.completed); count('statPending', m.pending);
    $('#statProgressLabel').textContent = `Selesai (${m.progress}%)` + (m.progress >= 100 ? ' 🏆' : m.progress >= 50 ? ' 🔥' : '');
    $('#progressBar').style.width = m.progress + '%';
    $('#countAll').textContent = m.total; $('#countCompleted').textContent = m.completed; $('#countPending').textContent = m.pending;
    const all = m.total > 0 && m.completed === m.total;
    if (all && !S.allDone && S.ready) {
        confetti(innerWidth / 2, innerHeight / 3, 180);
        toast('🎉 Semua kegiatan selesai! Luar biasa!', { ms: 4000 });
    }
    S.allDone = all;
}
function count(id, target) {
    const el = $('#' + id), from = +el.dataset.v || 0;
    el.dataset.v = target;
    if (from === target) { el.textContent = target; return; }
    const t0 = performance.now();
    (function step(now) {
        const p = Math.min((now - t0) / 600, 1), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(from + (target - from) * e);
        if (p < 1) requestAnimationFrame(step);
    })(t0);
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

function renderCal(dir = 0) {
    const { year: y, month: m } = S;
    $('#calendarTitle').textContent = `${BULAN[m - 1]} ${y}`;
    const first = (new Date(y, m - 1, 1).getDay() + 6) % 7, days = new Date(y, m, 0).getDate();
    const by = {}; S.acts.forEach(a => (by[a.date] ||= []).push(a));
    let html = '', d = 1 - first;
    for (let w = 0; w < Math.ceil((first + days) / 7); w++) {
        html += '<tr>';
        for (let i = 0; i < 7; i++, d++) {
            if (d < 1 || d > days) { html += '<td class="cal-empty"></td>'; continue; }
            const k = `${y}-${pad(m)}-${pad(d)}`, L = by[k] || [];
            html += `<td class="cal-cell${k === today() ? ' is-today' : ''}${k === S.sel ? ' selected-cell' : ''}${i > 4 ? ' weekend' : ''}" data-date="${k}" tabindex="0" style="--d:${w * 7 + i}">
                <span class="cal-day-num">${d}</span>
                ${L.slice(0, 2).map(a => `<div class="cal-badge ${a.completed ? 'badge-done' : 'badge-pending'} pr-${a.priority}" title="${esc(a.title)}">${a.completed ? '✓' : '•'} ${esc(a.title)}</div>`).join('')}
                ${L.length > 2 ? `<div class="cal-more">+${L.length - 2} lagi</div>` : ''}</td>`;
        }
        html += '</tr>';
    }
    const body = $('#calendarBody');
    body.innerHTML = html;
    body.classList.remove('slide-l', 'slide-r'); void body.offsetWidth;
    if (dir) body.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
}

function renderDay() {
    const p = $('#dayPanel');
    if (!S.sel) { p.innerHTML = '<div class="day-empty">👆 Klik tanggal di kalender untuk melihat agenda harinya</div>'; return; }
    const L = S.acts.filter(a => a.date === S.sel);
    p.innerHTML = `<div class="day-head"><b>${fmt(S.sel)}</b><span>${L.length} kegiatan</span></div>` +
        (L.length ? L.map(a => `<label class="day-item ${a.completed ? 'done' : ''}">
            <input type="checkbox" data-id="${a.id}" ${a.completed ? 'checked' : ''}>
            <span>${esc(a.title)}</span><i class="dot pr-${a.priority}"></i></label>`).join('')
            : '<div class="day-empty">Belum ada agenda — tulis di formulir lalu simpan ✨</div>');
}

function hl(t) {
    if (!S.q) return esc(t);
    const re = new RegExp(`(${S.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return t.split(re).map((p, i) => i % 2 ? `<mark>${esc(p)}</mark>` : esc(p)).join('');
}
function relChip(a) {
    if (a.completed) return '';
    const n = dayDiff(a.date);
    if (n < 0) return `<em class="chip late">Terlambat ${-n} hari</em>`;
    if (n === 0) return '<em class="chip soon">Hari ini</em>';
    if (n === 1) return '<em class="chip soon">Besok</em>';
    return n <= 3 ? `<em class="chip soon">${n} hari lagi</em>` : '';
}
function visible() {
    let L = S.acts.filter(a =>
        a.title.toLowerCase().includes(S.q) &&
        (S.filter === 'all' || (S.filter === 'completed') === !!a.completed) &&
        (S.prio === 'all' || a.priority === S.prio));
    const { key, dir } = S.sort;
    if (key) L = [...L].sort((a, b) => {
        let x = a[key], y = b[key];
        if (key === 'priority') { x = PR[x]; y = PR[y]; } else if (key === 'completed') { x = +x; y = +y; }
        return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir;
    });
    return L;
}
function renderTable() {
    $$('.sortable').forEach(th => {
        const on = th.dataset.sort === S.sort.key;
        th.classList.toggle('sorted', on);
        $('i', th).textContent = on ? (S.sort.dir > 0 ? '▲' : '▼') : '';
    });
    const L = visible(), tb = $('#activityTableBody');
    if (!L.length) {
        tb.innerHTML = `<tr><td colspan="5" class="empty-row"><div class="empty-emoji">🌱</div>${S.acts.length ? 'Tidak ada kegiatan yang cocok dengan pencarian atau filter.' : 'Belum ada rencana. Mulai dari formulir di atas!'}</td></tr>`;
        return;
    }
    tb.innerHTML = L.map(a => `<tr draggable="true" data-id="${a.id}" class="${S.fx && S.fx.id === a.id ? S.fx.cls : ''}">
        <td class="t-title ${a.completed ? 't-done' : ''}" title="Klik 2x untuk mengedit">${hl(a.title)} ${relChip(a)}</td>
        <td class="t-date">📅 ${fmt(a.date)}</td>
        <td><span class="priority-pill pr-${a.priority}">${{ High: '🔴 High', Medium: '🟡 Medium', Low: '🟢 Low' }[a.priority] || esc(a.priority)}</span></td>
        <td><span class="status-badge ${a.completed ? 'done' : 'pending'}">${a.completed ? '✓ Selesai' : '⏳ Tertunda'}</span></td>
        <td style="text-align:right"><div class="row-actions">
            <button class="btn-action ${a.completed ? 'btn-toggle-undo' : 'btn-toggle-done'}" data-act="toggle">${a.completed ? '↩️ Batal' : '✓ Ceklis'}</button>
            <button class="btn-action btn-delete" data-act="del" title="Hapus">🗑️</button></div></td></tr>`).join('');
    S.fx = null;
}

/* ===== Aksi ===== */
function toggle(id, ev) {
    const a = S.acts.find(x => x.id === id); if (!a) return;
    a.completed = !a.completed;
    S.fx = { id, cls: a.completed ? 'row-done' : 'row-flash' };
    save(); renderAll();
    if (a.completed) {
        const r = ev && ev.clientX ? { x: ev.clientX, y: ev.clientY } : { x: innerWidth / 2, y: innerHeight / 2 };
        confetti(r.x, r.y, 38);
        toast('✅ Kegiatan selesai, mantap!');
    }
}
function del(id) {
    const i = S.acts.findIndex(x => x.id === id); if (i < 0) return;
    const item = S.acts[i], row = $(`tr[data-id="${id}"]`);
    const finish = () => {
        S.acts.splice(i, 1); save(); renderAll();
        toast(`🗑️ "${item.title.slice(0, 28)}" dihapus`, { action: 'Urungkan', ms: 5500, fn: () => {
            S.acts.splice(Math.min(i, S.acts.length), 0, item);
            S.fx = { id: item.id, cls: 'row-new' }; save(); renderAll();
        } });
    };
    if (row) { row.classList.add('row-out'); setTimeout(finish, 300); } else finish();
}
function addActivity(e) {
    e.preventDefault();
    const t = $('#title'), title = t.value.trim(), date = $('#date').value;
    if (!title || !date) {
        const f = $('#addActivityForm'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
        (title ? $('#date') : t).focus(); toast('⚠️ Isi nama kegiatan dan tanggal dulu ya'); return;
    }
    const id = S.acts.length ? Math.max(...S.acts.map(a => a.id)) + 1 : 1;
    S.acts.unshift({ id, title, date, priority: $('#priority').value, completed: false });
    S.fx = { id, cls: 'row-new' }; S.sel = date;
    const [y, m] = date.split('-').map(Number); S.year = y; S.month = m;
    t.value = ''; $('#charCount').textContent = '0/80';
    save(); renderAll();
    const btn = $('.btn-submit'); btn.classList.add('ok'); setTimeout(() => btn.classList.remove('ok'), 900);
    toast('💾 Rencana baru tersimpan!');
}
function editTitle(td) {
    const id = +td.parentElement.dataset.id, a = S.acts.find(x => x.id === id);
    if (!a || $('input', td)) return;
    td.parentElement.draggable = false;
    td.innerHTML = `<input class="inline-edit" maxlength="80" value="${esc(a.title)}">`;
    const inp = $('input', td); inp.focus(); inp.select();
    let done = false;
    const end = ok => {
        if (done) return; done = true;
        const v = inp.value.trim();
        if (ok && v && v !== a.title) { a.title = v; S.fx = { id, cls: 'row-flash' }; save(); toast('✏️ Judul diperbarui'); }
        renderAll();
    };
    inp.onkeydown = e => { if (e.key === 'Enter') end(true); if (e.key === 'Escape') end(false); };
    inp.onblur = () => end(true);
}
function setFilter(f) {
    S.filter = f;
    $$('.tab-pill').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
    $$('.stat-card').forEach(c => c.classList.toggle('active-filter', c.dataset.filter === f));
    renderTable();
}
function selectDate(k, focus = true) {
    S.sel = k; $('#date').value = k;
    $$('.cal-cell').forEach(c => c.classList.toggle('selected-cell', c.dataset.date === k));
    renderDay();
    if (focus) $('#title').focus({ preventScroll: true });
}
function changeMonth(dir) {
    S.month += dir;
    if (S.month > 12) { S.month = 1; S.year++; } else if (S.month < 1) { S.month = 12; S.year--; }
    renderCal(dir);
}
function goToday() {
    const n = new Date(); S.year = n.getFullYear(); S.month = n.getMonth() + 1;
    renderCal(); selectDate(today(), false); toast('📅 Kembali ke hari ini');
}
function preset(v) {
    if (v === 'weekend') { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay() + 7) % 7); $('#date').value = keyOf(d); }
    else $('#date').value = addDays(+v);
}

/* ===== Efek visual ===== */
const cv = $('#confettiCanvas'), cx = cv.getContext('2d');
let P = [], running = false;
const sizeCv = () => { cv.width = innerWidth; cv.height = innerHeight; };
addEventListener('resize', sizeCv); sizeCv();
function confetti(x, y, n = 60) {
    const C = ['#0d9488', '#16a34a', '#f59e0b', '#3b82f6', '#ec4899', '#a855f7'];
    for (let i = 0; i < n; i++) P.push({ x, y, vx: (Math.random() - .5) * 14, vy: Math.random() * -13 - 3, s: Math.random() * 7 + 4,
        r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: C[i % C.length], life: 1 });
    if (!running) { running = true; requestAnimationFrame(loop); }
}
function loop() {
    cx.clearRect(0, 0, cv.width, cv.height);
    P = P.filter(p => p.life > 0 && p.y < cv.height + 20);
    P.forEach(p => {
        p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= .008;
        cx.save(); cx.globalAlpha = Math.max(p.life, 0); cx.translate(p.x, p.y); cx.rotate(p.r);
        cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); cx.restore();
    });
    if (P.length) requestAnimationFrame(loop); else { running = false; cx.clearRect(0, 0, cv.width, cv.height); }
}
function toast(msg, { action, fn, ms = 2800 } = {}) {
    const st = $('#toastStack'), t = document.createElement('div');
    t.className = 'toast'; t.innerHTML = `<span>${esc(msg)}</span>`;
    const rm = () => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
    if (action) { const b = document.createElement('button'); b.textContent = action; b.onclick = () => { fn(); rm(); }; t.appendChild(b); }
    st.appendChild(t); setTimeout(rm, ms);
    while (st.children.length > 4) st.firstChild.remove();
}
function setTheme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#themeToggle').textContent = dark ? '☀️' : '🌙';
    localStorage.setItem(THEME, dark ? 'dark' : 'light');
}

/* ===== Inisialisasi & event ===== */
document.addEventListener('DOMContentLoaded', async () => {
    const saved = localStorage.getItem(THEME);
    setTheme(saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
    const n = new Date(); S.year = n.getFullYear(); S.month = n.getMonth() + 1; S.sel = today();
    preset(0);
    await load();
    renderAll(); S.ready = true;
    setInterval(tick, 1000);

    $('#addActivityForm').addEventListener('submit', addActivity);
    $('#title').addEventListener('input', e => $('#charCount').textContent = `${e.target.value.length}/80`);
    $('#themeToggle').onclick = () => setTheme(document.documentElement.dataset.theme !== 'dark');
    $('#btnToday').onclick = goToday;
    $('#prioSeg').onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        $$('#prioSeg button').forEach(x => x.classList.toggle('on', x === b));
        $('#priority').value = b.dataset.p;
    };
    $('#searchInput').addEventListener('input', e => {
        S.q = e.target.value.toLowerCase();
        $('#clearSearchBtn').style.display = S.q ? 'block' : 'none'; renderTable();
    });
    $('#clearSearchBtn').onclick = () => { $('#searchInput').value = ''; S.q = ''; $('#clearSearchBtn').style.display = 'none'; renderTable(); };
    $('#priorityFilter').onchange = e => { S.prio = e.target.value; renderTable(); };

    document.addEventListener('click', e => {
        const r = e.target.closest('button, .stat-card'); // efek ripple
        if (r) {
            const b = r.getBoundingClientRect(), s = document.createElement('span');
            s.className = 'ripple'; s.style.left = e.clientX - b.left + 'px'; s.style.top = e.clientY - b.top + 'px';
            r.appendChild(s); setTimeout(() => s.remove(), 600);
        }
        const t = e.target;
        if (t.closest('[data-filter]')) return setFilter(t.closest('[data-filter]').dataset.filter);
        if (t.closest('[data-month]')) return changeMonth(+t.closest('[data-month]').dataset.month);
        if (t.closest('[data-preset]')) return preset(t.closest('[data-preset]').dataset.preset);
        const th = t.closest('.sortable');
        if (th) {
            const k = th.dataset.sort;
            S.sort = S.sort.key === k ? (S.sort.dir > 0 ? { key: k, dir: -1 } : { key: null, dir: 1 }) : { key: k, dir: 1 };
            return renderTable();
        }
        const cell = t.closest('.cal-cell'); if (cell) return selectDate(cell.dataset.date);
        const btn = t.closest('[data-act]');
        if (btn) { const id = +btn.closest('tr').dataset.id; btn.dataset.act === 'toggle' ? toggle(id, e) : del(id); }
    });
    document.addEventListener('change', e => { if (e.target.matches('.day-item input')) toggle(+e.target.dataset.id, e); });
    document.addEventListener('dblclick', e => { const td = e.target.closest('.t-title'); if (td) editTitle(td); });

    // spotlight kursor & kemiringan 3D
    $$('.stat-card, .card-panel').forEach(el => {
        el.addEventListener('pointermove', e => {
            const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
            el.style.setProperty('--mx', x + 'px'); el.style.setProperty('--my', y + 'px');
            if (el.classList.contains('stat-card') && e.pointerType === 'mouse')
                el.style.transform = `perspective(700px) rotateX(${(.5 - y / r.height) * 9}deg) rotateY(${(x / r.width - .5) * 9}deg) translateY(-3px)`;
        });
        el.addEventListener('pointerleave', () => el.style.transform = '');
    });

    // pintasan keyboard
    document.addEventListener('keydown', e => {
        const el = document.activeElement;
        if (el.matches('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) {
            if (e.key === 'Escape') el.blur(); return;
        }
        if (e.key === 'Enter' && el.matches('.cal-cell')) return selectDate(el.dataset.date);
        const k = e.key.toLowerCase();
        if (k === '/') { e.preventDefault(); $('#searchInput').focus(); }
        else if (k === 'n') { e.preventDefault(); $('#title').focus(); }
        else if (k === 't') goToday();
        else if (k === 'd') $('#themeToggle').click();
        else if (e.key === 'ArrowLeft') changeMonth(-1);
        else if (e.key === 'ArrowRight') changeMonth(1);
    });
});


/* ===== v3: grafik 7 hari, streak, mode fokus, drag & drop ===== */
const FKEY = 'vp_focus_', DOC_TITLE = document.title, CIRC = 2 * Math.PI * 52;
const F = { len: 1500, left: 1500, on: false, n: +localStorage.getItem(FKEY + today()) || 0 };
let ft;

function renderInsights() {
    const wk = [];
    for (let i = 6; i >= 0; i--) {
        const k = addDays(-i), L = S.acts.filter(a => a.date === k);
        wk.push({ k, t: L.length, d: L.filter(a => a.completed).length });
    }
    const mx = Math.max(1, ...wk.map(w => w.t));
    $('#weekChart').innerHTML = wk.map((w, i) => `<button class="wk${w.k === today() ? ' now' : ''}" data-wk="${w.k}" title="${fmt(w.k)}: ${w.d}/${w.t} selesai">
        <span class="wk-n">${w.t || ''}</span>
        <span class="wk-bar" style="height:${w.t ? 10 + w.t / mx * 74 : 4}px;--d:${i}"><i style="height:${w.t ? w.d / w.t * 100 : 0}%"></i></span>
        <span class="wk-l">${HARI[parse(w.k).getDay()]}</span></button>`).join('');
    let st = 0;
    for (let i = 0; i < 365; i++) {
        if (S.acts.some(a => a.date === addDays(-i) && a.completed)) st++; else if (i > 0) break;
    }
    $('#streakPill').textContent = `🔥 ${st} hari beruntun`;
    const sel = $('#focusTask'), cur = sel.value, P = S.acts.filter(a => !a.completed);
    sel.innerHTML = '<option value="">— Fokus bebas —</option>' + P.map(a => `<option value="${a.id}">${esc(a.title)}</option>`).join('');
    sel.value = P.some(a => String(a.id) === cur) ? cur : '';
    $('#focusCount').textContent = `${F.n} sesi hari ini`;
}
function focusDraw() {
    const m = pad(Math.floor(F.left / 60)), s = pad(F.left % 60);
    $('#focusTime').textContent = `${m}:${s}`;
    $('#ringFg').style.strokeDashoffset = CIRC * (1 - F.left / F.len);
    document.title = F.on ? `${m}:${s} • Fokus — VibePlanner` : DOC_TITLE;
}
function focusStop(label) {
    clearInterval(ft); F.on = false;
    document.body.classList.remove('focusing');
    $('#focusStart').textContent = label;
}
function beep() {
    try {
        const c = new AudioContext(), o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination); o.frequency.value = 880;
        g.gain.setValueAtTime(.15, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .6);
        o.start(); o.stop(c.currentTime + .6);
    } catch {}
}
function focusDone() {
    focusStop('▶ Mulai'); F.n++; F.left = F.len;
    localStorage.setItem(FKEY + today(), F.n);
    beep(); confetti(innerWidth / 2, innerHeight / 2, 120);
    const id = +$('#focusTask').value;
    toast('⏰ Sesi fokus selesai! Istirahat sebentar ☕', id ? { action: 'Tandai selesai', ms: 8000, fn: () => {
        const a = S.acts.find(x => x.id === id); if (a && !a.completed) toggle(id);
    } } : { ms: 5000 });
    renderInsights();
}
function focusToggle() {
    if (F.on) { focusStop('▶ Lanjut'); }
    else {
        F.on = true; $('#focusStart').textContent = '⏸ Jeda'; document.body.classList.add('focusing');
        ft = setInterval(() => { if (--F.left <= 0) focusDone(); focusDraw(); }, 1000);
    }
    focusDraw();
}

document.addEventListener('DOMContentLoaded', () => {
    $('#ringFg').style.strokeDasharray = CIRC;
    focusDraw();
    $('#focusStart').onclick = focusToggle;
    $('#focusReset').onclick = () => { focusStop('▶ Mulai'); F.left = F.len; focusDraw(); };
    $('#focusLen').onclick = e => {
        const b = e.target.closest('button'); if (!b || F.on) return;
        $$('#focusLen button').forEach(x => x.classList.toggle('on', x === b));
        F.len = F.left = +b.dataset.m * 60; focusDraw();
    };
    $('#weekChart').onclick = e => {
        const b = e.target.closest('[data-wk]'); if (!b) return;
        const k = b.dataset.wk; [S.year, S.month] = k.split('-').slice(0, 2).map(Number);
        renderCal(); selectDate(k, false);
        $('#dayPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    // seret baris kegiatan ke tanggal kalender
    const clearDrop = () => $$('.drop-hover').forEach(x => x.classList.remove('drop-hover'));
    document.addEventListener('dragstart', e => {
        const tr = e.target.closest && e.target.closest('tr[draggable="true"]'); if (!tr) return;
        e.dataTransfer.setData('text/plain', tr.dataset.id); e.dataTransfer.effectAllowed = 'move';
        tr.classList.add('dragging'); document.body.classList.add('dnd');
    });
    document.addEventListener('dragend', () => {
        $$('.dragging').forEach(x => x.classList.remove('dragging')); document.body.classList.remove('dnd'); clearDrop();
    });
    document.addEventListener('dragover', e => {
        const c = e.target.closest && e.target.closest('.cal-cell'); if (!c) return;
        e.preventDefault(); if (!c.classList.contains('drop-hover')) { clearDrop(); c.classList.add('drop-hover'); }
    });
    document.addEventListener('drop', e => {
        const c = e.target.closest && e.target.closest('.cal-cell'); if (!c) return;
        e.preventDefault(); clearDrop();
        const id = +e.dataTransfer.getData('text/plain'), a = S.acts.find(x => x.id === id);
        if (!a || a.date === c.dataset.date) return;
        const old = a.date; a.date = S.sel = c.dataset.date;
        S.fx = { id, cls: 'row-flash' }; save(); renderAll();
        toast(`📅 Dipindah ke ${fmt(a.date)}`, { action: 'Urungkan', ms: 5000, fn: () => { a.date = old; save(); renderAll(); } });
    });
});
