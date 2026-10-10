/* ==========================================================================
   SIPL — Komponen UI: toast, modal, konfirmasi, drawer, tabel data, form
   ========================================================================== */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

// --------------------------------------------------------------------------
// Toast
// --------------------------------------------------------------------------
function toast(title, msg, type) {
  type = type || 'success';
  const ic = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' }[type] || 'info';
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = icon(ic, 'lg') + '<div><b>' + esc(title) + '</b>' + (msg ? '<p>' + esc(msg) + '</p>' : '') + '</div><button class="x" aria-label="Tutup">' + icon('x', 'sm') + '</button>';
  const host = $('#toasts');
  host.appendChild(el);
  while (host.children.length > 4) host.firstElementChild.remove();
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  el.querySelector('.x').onclick = close;
  setTimeout(close, type === 'error' ? 7000 : 4200);
}
function toastRes(res, okTitle, okMsg) {
  if (res && res.success) toast(okTitle, okMsg || '', 'success');
  else toast('Gagal', (res && res.message) || 'Terjadi kesalahan.', 'error');
}

// --------------------------------------------------------------------------
// Modal / drawer / konfirmasi
// --------------------------------------------------------------------------
const _modals = [];
function openModal(o) {
  const ov = document.createElement('div');
  ov.className = 'overlay' + (o.drawer ? ' drawer-ov' : '');
  ov.innerHTML =
    '<div class="' + (o.drawer ? 'drawer' : 'modal ' + (o.size || '')) + '" role="dialog" aria-modal="true" aria-labelledby="mdl-t">' +
      '<div class="modal-head">' + (o.icon ? '<div class="icon-tile">' + icon(o.icon) + '</div>' : '') +
        '<div><h2 id="mdl-t">' + esc(o.title || '') + '</h2>' + (o.sub ? '<div class="sub">' + esc(o.sub) + '</div>' : '') + '</div>' +
        '<button class="btn icon" data-close aria-label="Tutup">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' + (o.body || '') + '</div>' +
      (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') +
    '</div>';
  $('#modal-root').appendChild(ov);
  hydrateIcons(ov);
  const prevFocus = document.activeElement;
  const handle = {
    el: ov, root: ov.firstElementChild,
    $: sel => ov.querySelector(sel),
    close(result) {
      if (!ov.isConnected) return;
      ov.remove();
      const i = _modals.indexOf(handle); if (i > -1) _modals.splice(i, 1);
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* abaikan */ }
      if (o.onClose) o.onClose(result);
    }
  };
  _modals.push(handle);
  ov.addEventListener('mousedown', e => { if (e.target === ov && !o.sticky) handle.close(); });
  ov.addEventListener('click', e => { if (e.target.closest('[data-close]')) handle.close(); });
  setTimeout(() => {
    const f = ov.querySelector('[autofocus], .modal-body input:not([type=hidden]):not([disabled]):not([readonly]), .modal-body select:not([disabled]), .modal-body textarea');
    if (f) f.focus(); else ov.querySelector('[data-close]').focus();
  }, 30);
  if (o.onOpen) o.onOpen(handle);
  return handle;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _modals.length) { e.preventDefault(); _modals[_modals.length - 1].close(); }
});

function confirmBox(o) {
  return new Promise(resolve => {
    let done = false;
    const m = openModal({
      title: o.title || 'Konfirmasi', icon: o.icon || (o.danger ? 'alert-triangle' : 'info'), size: 'narrow',
      body: '<p style="font-size:14.5px;line-height:1.6">' + (o.html || esc(o.text || '')) + '</p>',
      foot: '<button class="btn outline" data-close>' + esc(o.cancelText || 'Batal') + '</button>' +
            '<button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-ok>' + esc(o.okText || 'Ya, lanjutkan') + '</button>',
      onClose: () => { if (!done) resolve(false); }
    });
    m.$('[data-ok]').onclick = () => { done = true; m.close(); resolve(true); };
    setTimeout(() => m.$('[data-ok]').focus(), 40);
  });
}

// --------------------------------------------------------------------------
// Form helper
// --------------------------------------------------------------------------
function formValues(form) {
  const o = {};
  $$('input, select, textarea', form).forEach(el => {
    if (!el.name || el.disabled) return;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value.trim();
  });
  return o;
}
function clearErrors(root) {
  $$('.has-error', root).forEach(el => el.classList.remove('has-error'));
  $$('.err-text.auto', root).forEach(el => el.remove());
}
function fieldError(root, name, msg) {
  const el = root.querySelector('[name="' + name + '"]');
  const field = el ? el.closest('.field') : null;
  if (!field) return false;
  field.classList.add('has-error');
  const p = document.createElement('div');
  p.className = 'err-text auto';
  p.innerHTML = icon('alert-circle', 'sm') + '<span>' + esc(msg) + '</span>';
  field.appendChild(p);
  if (el.focus) el.focus();
  return true;
}
/** Tampilkan error server di field bila ada (res.data.field), selain itu di kotak alert. */
function showServerError(root, res, alertSel) {
  clearErrors(root);
  const field = res && res.data && res.data.field;
  if (field && fieldError(root, field, res.message)) return;
  const box = alertSel ? root.querySelector(alertSel) : null;
  if (box) { box.hidden = false; box.innerHTML = icon('alert-circle') + '<div>' + esc(res.message || 'Terjadi kesalahan.') + '</div>'; }
  else toast('Gagal', res.message || 'Terjadi kesalahan.', 'error');
}
function busy(btn, text) {
  if (!btn || !btn.style) return () => {};
  const html = btn.innerHTML, w = btn.offsetWidth;
  btn.disabled = true;
  btn.style.minWidth = w + 'px';
  btn.innerHTML = '<span class="spin"></span>' + (text ? '<span>' + esc(text) + '</span>' : '');
  return () => { btn.disabled = false; btn.innerHTML = html; btn.style.minWidth = ''; };
}
function options(list, valKey, labelFn, selected, placeholder) {
  let h = placeholder != null ? '<option value="">' + esc(placeholder) + '</option>' : '';
  list.forEach(o => {
    const v = typeof valKey === 'function' ? valKey(o) : o[valKey];
    h += '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + esc(labelFn(o)) + '</option>';
  });
  return h;
}
function strengthOf(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return pw ? Math.max(1, s) : 0;
}
function bindStrength(input, meter, label) {
  const names = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'];
  const upd = () => {
    const s = strengthOf(input.value);
    meter.className = 'strength s' + s;
    if (label) label.textContent = s ? names[s] + ' (' + input.value.length + ' karakter)' : 'Minimal 8 karakter';
  };
  input.addEventListener('input', upd); upd();
}
function bindEye(btn, input) {
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = icon(show ? 'eye-off' : 'eye');
    btn.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
  });
}

// --------------------------------------------------------------------------
// Potongan tampilan
// --------------------------------------------------------------------------
function roleBadge(role) {
  const r = String(role || '');
  const cls = r === 'Admin' ? 'admin' : r === 'Gadik' ? 'gadik' : 'pengasuh';
  return '<span class="role ' + cls + '">' + esc(r === 'Admin' ? 'Admin Satdik' : r) + '</span>';
}
function statusBadge(s) { return isAktif(s) ? '<span class="badge ok">Aktif</span>' : '<span class="badge off">Nonaktif</span>'; }
function emptyState(ic, title, text, actionHtml) {
  return '<div class="empty"><div class="art">' + icon(ic || 'info') + '</div><h3>' + esc(title) + '</h3>' + (text ? '<p>' + esc(text) + '</p>' : '') + (actionHtml || '') + '</div>';
}
function errorState(msg, retryAttr) {
  return '<div class="empty"><div class="art" style="background:var(--red-t);color:var(--red)">' + icon('wifi-off') + '</div><h3>Data belum bisa dimuat</h3><p>' + esc(msg || 'Periksa koneksi internet Anda.') + '</p><button class="btn outline" ' + (retryAttr || 'data-retry') + '>' + icon('refresh') + 'Coba lagi</button></div>';
}
function skeletonRows(n, cols) {
  let h = '<div class="card"><div class="card-body">';
  for (let i = 0; i < (n || 5); i++) {
    h += '<div style="display:grid;grid-template-columns:repeat(' + (cols || 4) + ',1fr);gap:16px;padding:12px 0;border-bottom:1px solid var(--border)">';
    for (let c = 0; c < (cols || 4); c++) h += '<span class="sk" style="width:' + (50 + ((i * 7 + c * 13) % 45)) + '%"></span>';
    h += '</div>';
  }
  return h + '</div></div>';
}
function pageHead(o) {
  return '<div class="' + (o.hero === false ? '' : 'hero') + '"><div class="page-head"><div class="titles">' +
    (o.eyebrow ? '<div class="eyebrow">' + esc(o.eyebrow) + '</div>' : '') +
    (o.chips ? '<div class="row" style="margin-top:8px;gap:8px">' + o.chips + '</div>' : '') +
    '<h1>' + esc(o.title) + '</h1>' + (o.desc ? '<p>' + o.desc + '</p>' : '') +
    '</div>' + (o.actions ? '<div class="actions">' + o.actions + '</div>' : '') + '</div></div>';
}
function stat(o) {
  return '<div class="stat ' + (o.tone || '') + '"><div class="top"><div class="label-mono">' + esc(o.label) + '</div>' +
    (o.icon ? '<div class="icon-tile' + (o.tone === 'red' ? ' red' : '') + '">' + icon(o.icon) + '</div>' : '') +
    '</div><div class="big">' + o.value + (o.unit ? '<small>' + esc(o.unit) + '</small>' : '') + '</div>' +
    (o.cap ? '<div class="cap">' + o.cap + '</div>' : '') + '</div>';
}

// --------------------------------------------------------------------------
// Tabel data: cari/urut/halaman di klien, tampil kartu di ponsel (US-13)
// --------------------------------------------------------------------------
class Table {
  constructor(host, o) {
    this.host = host;
    this.o = Object.assign({ pageSize: 10, sizes: [10, 25, 50, 100], key: 'id', cards: true }, o);
    this.rows = []; this.page = 1; this.size = this.o.pageSize; this.sort = this.o.sort || null;
    host.addEventListener('click', e => this._click(e));
    host.addEventListener('change', e => {
      if (e.target.matches('[data-size]')) { this.size = Number(e.target.value); this.page = 1; this.render(); }
    });
  }
  set(rows, keepPage) {
    this.rows = rows || [];
    if (!keepPage) this.page = 1;
    this.render();
    return this;
  }
  _value(col, row) {
    if (typeof col.sort === 'function') return col.sort(row);
    const v = row[col.key];
    return v == null ? '' : v;
  }
  sorted() {
    if (!this.sort) return this.rows;
    const col = this.o.columns.find(c => c.key === this.sort.key);
    if (!col) return this.rows;
    const dir = this.sort.dir === 'desc' ? -1 : 1;
    return this.rows.slice().sort((a, b) => {
      const x = this._value(col, a), y = this._value(col, b);
      const xe = x === '' || x == null, ye = y === '' || y == null;
      if (xe && ye) return 0; if (xe) return 1; if (ye) return -1;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return collator.compare(String(x), String(y)) * dir;
    });
  }
  pageRows() {
    const all = this.sorted();
    const pages = Math.max(1, Math.ceil(all.length / this.size));
    if (this.page > pages) this.page = pages;
    const start = (this.page - 1) * this.size;
    return { all, pages, start, list: all.slice(start, start + this.size) };
  }
  render() {
    const o = this.o, p = this.pageRows();
    if (!this.rows.length) { this.host.innerHTML = o.empty ? o.empty() : emptyState('search', 'Tidak ada data', ''); return; }
    let h = '<div class="table-wrap"><table class="dt' + (o.cards ? ' cards' : '') + (o.cls ? ' ' + o.cls : '') + '"><thead><tr>';
    o.columns.forEach(c => {
      const sortable = c.sort !== false && c.key;
      const sorted = this.sort && this.sort.key === c.key;
      h += '<th class="' + (c.num ? 'num ' : '') + (sortable ? 'sortable ' : '') + (sorted ? 'sorted ' : '') + (c.thCls || '') + '"' +
        (sortable ? ' data-sort="' + esc(c.key) + '"' : '') + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + (c.labelHtml || esc(c.label || '')) +
        (sortable ? '<span class="sort">' + (sorted ? (this.sort.dir === 'desc' ? '▼' : '▲') : '↕') + '</span>' : '') + '</th>';
    });
    h += '</tr></thead><tbody>';
    p.list.forEach((row, i) => {
      const id = row[o.key];
      h += '<tr data-id="' + esc(id) + '"' + (o.onRow ? ' class="clickable"' : '') + (o.rowAttr ? ' ' + o.rowAttr(row) : '') + '>';
      o.columns.forEach(c => {
        const val = c.render ? c.render(row, p.start + i) : esc(row[c.key] == null ? '' : row[c.key]);
        h += '<td class="' + (c.num ? 'num ' : '') + (c.cls || '') + '" data-label="' + esc(c.label || '') + '">' + val + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    if (o.pager !== false) h += this._pager(p);
    this.host.innerHTML = h;
    if (o.afterRender) o.afterRender(this.host, p.list);
  }
  _pager(p) {
    const total = p.all.length, from = total ? p.start + 1 : 0, to = Math.min(p.start + this.size, total);
    let h = '<div class="pager"><span>Menampilkan <b class="mono">' + from + '–' + to + '</b> dari <b class="mono">' + total + '</b> ' + esc(this.o.unit || 'data') + '</span>' +
      '<label class="row" style="gap:6px">Baris <select data-size>' + this.o.sizes.map(s => '<option' + (s === this.size ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></label>';
    if (p.pages > 1) {
      h += '<div class="pages"><button data-page="' + (this.page - 1) + '"' + (this.page === 1 ? ' disabled' : '') + ' aria-label="Sebelumnya">‹</button>';
      const nums = new Set([1, p.pages, this.page - 1, this.page, this.page + 1].filter(n => n >= 1 && n <= p.pages));
      let last = 0;
      Array.from(nums).sort((a, b) => a - b).forEach(n => {
        if (n - last > 1) h += '<span class="dots">…</span>';
        h += '<button data-page="' + n + '"' + (n === this.page ? ' class="on" aria-current="page"' : '') + '>' + n + '</button>';
        last = n;
      });
      h += '<button data-page="' + (this.page + 1) + '"' + (this.page === p.pages ? ' disabled' : '') + ' aria-label="Berikutnya">›</button></div>';
    }
    return h + '</div>';
  }
  _click(e) {
    const th = e.target.closest('th[data-sort]');
    if (th) {
      const k = th.dataset.sort;
      this.sort = this.sort && this.sort.key === k ? { key: k, dir: this.sort.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' };
      this.render(); return;
    }
    const pg = e.target.closest('button[data-page]');
    if (pg && !pg.disabled) { this.page = Number(pg.dataset.page); this.render(); this.host.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    const act = e.target.closest('[data-act]');
    if (act && this.o.onAction) {
      const tr = act.closest('tr');
      e.stopPropagation();
      this.o.onAction(act.dataset.act, tr ? tr.dataset.id : act.dataset.id, act, e);
      return;
    }
    if (this.o.onRow && !e.target.closest('input, select, textarea, button, a')) {
      const tr = e.target.closest('tbody tr');
      if (tr) this.o.onRow(tr.dataset.id, e);
    }
  }
}
