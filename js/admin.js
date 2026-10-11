/* ==========================================================================
   SIPL — Modul khusus Admin Satdik (dimuat hanya setelah Admin login)
   Personel & Akun • Form Akun • Master Data • Jadwal • Rekap • Migrasi
   ========================================================================== */

function usersData() { return (S.data.users && S.data.users.users) || null; }
function staffList() { return (usersData() || []).filter(u => u.Role !== 'Admin'); }
function asgText(list) {
  if (!list || !list.length) return '<span class="small" style="color:var(--red)">Belum ditugaskan</span>';
  return list.map(a => '<div>' + esc(kelasName(a.ID_Kelas)) + (a.ID_Peleton ? ' <span class="faint">/</span> ' + esc(pelName(a.ID_Peleton)) : '') + '</div>').join('');
}
/** Simpan hasil usersList/userSave lalu sinkronkan referensi Gadik & ringkasan dashboard. */
function applyUsers(d) {
  S.data.users = { users: d.users, gadik: d.gadik };
  cachePut('users', S.data.users);
  if (d.gadik) S.boot.ref.gadik = d.gadik;
  const us = d.users || [];
  S.boot.stat.gadik = us.filter(u => u.Role === 'Gadik' && u.Status_Aktif === 'Aktif').length;
  S.boot.stat.pengasuh = us.filter(u => u.Role === 'Pengasuh' && u.Status_Aktif === 'Aktif').length;
  bootChanged();
}
function loadUsers(after, force) {
  return swr('users', 'usersList', {}, d => { S.data.users = d; if (d.gadik) { S.boot.ref.gadik = d.gadik; S.refVer++; } after(); }, { fresh: force ? 0 : 60000, force, onError: res => after(res) });
}

// ==========================================================================
// PERSONEL & AKUN (US-05)
// ==========================================================================
const PersonelPage = (() => {
  const st = { tab: 'all', q: '', kelas: '' };
  let el, table, err = null;

  function build(root) {
    el = root;
    el.innerHTML =
      pageHead({
        eyebrow: 'Personel & Penugasan // Administrator Satdik',
        title: 'Personel & Akun Login',
        desc: 'Kelola akun login Gadik dan Pengasuh, reset password, serta penugasan kelas dan peleton. Menghapus akun Gadik ikut menghapus jadwal mengajar beserta nilai harian mata pelajarannya.',
        actions: '<button class="btn outline" id="pr-refresh">' + icon('refresh') + 'Segarkan</button><a class="btn primary" href="#/akun/baru">' + icon('user-plus') + 'Tambah Akun</a>'
      }) +
      '<div class="grid c4 keep2" id="pr-stats"></div>' +
      '<div class="tabs mt-24" id="pr-tabs" role="tablist"></div>' +
      '<div class="card"><div class="toolbar">' +
        '<div class="field search"><label for="pr-q">Cari personel</label><div class="input-wrap">' + icon('search', 'lead') + '<input id="pr-q" class="input with-lead" placeholder="Nama, NRP, atau username…" autocomplete="off"></div></div>' +
        '<div class="field"><label for="pr-kelas">Penugasan kelas</label><select id="pr-kelas" class="select"></select></div>' +
      '</div><div id="pr-table"></div></div>';
    table = new Table($('#pr-table', el), {
      key: 'ID_User', unit: 'akun', pageSize: 25, sort: { key: 'Nama_Lengkap', dir: 'asc' },
      columns: [
        { key: 'Nama_Lengkap', label: 'Nama Lengkap', cls: 'card-title', render: u => '<div class="t-person">' + avatarAkun(u, 'sm' + (u.Status_Aktif !== 'Aktif' ? ' red' : '')) + '<div class="t-name"><b>' + esc(u.Nama_Lengkap) + (u.Status_Aktif !== 'Aktif' ? ' <span class="badge off">Nonaktif</span>' : '') + '</b><small class="mono">@' + esc(u.Username) + '</small></div></div>' },
        { key: 'NRP', label: 'Pangkat / NRP', render: u => esc(u.Pangkat || '—') + '<div><span class="nrp">' + esc(u.NRP || '—') + '</span></div>' },
        { key: 'Role', label: 'Peran', render: u => roleBadge(u.Role) },
        { key: 'asg', label: 'Penugasan', sort: u => u.penugasan.length ? kelasName(u.penugasan[0].ID_Kelas) : '', render: u => asgText(u.penugasan) },
        { key: 'acts', label: 'Aksi', sort: false, cls: 'acts-cell', render: u => '<div class="acts">' +
          (u.Status_Aktif !== 'Aktif' ? '<button class="btn outline xs" data-act="aktifkan" title="Akun ini dinonaktifkan di versi lama">' + icon('power', 'sm') + 'Aktifkan</button>' : '') +
          '<button class="btn icon" data-act="edit" title="Ubah akun">' + icon('edit') + '</button>' +
          '<button class="btn icon" data-act="foto" title="Pas foto 4×6">' + icon('camera') + '</button>' +
          '<button class="btn icon" data-act="pw" title="Reset password">' + icon('key') + '</button>' +
          '<button class="btn icon red" data-act="del" title="Hapus akun">' + icon('trash') + '</button></div>' }
      ],
      empty: () => emptyState('id-card', 'Belum ada akun', st.q ? 'Tidak ada personel yang cocok.' : 'Tambahkan akun Gadik atau Pengasuh pertama.', st.q ? '' : '<a class="btn primary" href="#/akun/baru">' + icon('user-plus') + 'Tambah Akun</a>'),
      onAction: (act, id) => {
        const u = staffList().find(x => x.ID_User === id);
        if (!u) return;
        if (act === 'edit') go('akun/' + encodeURIComponent(id));
        if (act === 'pw') resetPassword(u);
        if (act === 'foto') pilihPasFoto(u).then(v => { if (v !== null) render(true); });
        if (act === 'aktifkan') aktifkan(u);
        if (act === 'del') remove(u);
      }
    });
    $('#pr-q', el).addEventListener('input', debounce(e => { st.q = e.target.value; render(); }, 250));
    $('#pr-kelas', el).onchange = e => { st.kelas = e.target.value; render(); };
    $('#pr-tabs', el).addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { st.tab = b.dataset.tab; render(); } });
    $('#pr-refresh', el).onclick = () => load(true);
    $('#pr-table', el).addEventListener('click', e => { if (e.target.closest('[data-retry]')) load(true); });
  }

  function render(keep) {
    const all = staffList(), q = norm(st.q);
    const n = r => all.filter(u => u.Role === r).length;
    $('#pr-stats', el).innerHTML =
      stat({ label: 'Total Akun', value: all.length, unit: 'akun', icon: 'users', cap: 'Gadik & Pengasuh terdaftar' }) +
      stat({ label: 'Gadik', value: n('Gadik'), unit: 'personel', icon: 'book', cap: 'Pengajar mata pelajaran' }) +
      stat({ label: 'Pengasuh', value: n('Pengasuh'), unit: 'personel', icon: 'shield', cap: 'Pembina peleton' }) +
      stat({ label: 'Belum Ditugaskan', value: all.filter(u => !u.penugasan.length).length, unit: 'akun', icon: 'alert-triangle', tone: all.some(u => !u.penugasan.length) ? 'red' : '', cap: 'Belum punya penugasan kelas/peleton' });
    $('#pr-tabs', el).innerHTML = [['all', 'Semua Akun', all.length], ['Gadik', 'Gadik', n('Gadik')], ['Pengasuh', 'Pengasuh', n('Pengasuh')]]
      .map(t => '<button role="tab" data-tab="' + t[0] + '" class="' + (st.tab === t[0] ? 'on' : '') + '">' + t[1] + '<span class="count">' + t[2] + '</span></button>').join('');
    $('#pr-kelas', el).innerHTML = options(kelasList(), 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, st.kelas, 'Semua kelas');
    if (!usersData()) { $('#pr-table', el).innerHTML = err ? errorState(err.message) : skeletonRows(6, 5); return; }
    table.set(all.filter(u =>
      (st.tab === 'all' || u.Role === st.tab) &&
      (!st.kelas || u.penugasan.some(a => a.ID_Kelas === st.kelas)) &&
      (!q || norm(u.Nama_Lengkap + ' ' + u.NRP + ' ' + u.Username).indexOf(q) > -1)), keep);
  }

  function load(force) {
    err = null;
    render(true);
    loadUsers(e => { err = e || null; render(true); }, force);
  }

  function resetPassword(u) {
    const gen = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; let s = ''; const a = new Uint32Array(10); crypto.getRandomValues(a); a.forEach(x => { s += c[x % c.length]; }); return s; };
    const m = openModal({
      title: 'Reset Password', sub: u.Nama_Lengkap + ' • @' + u.Username, icon: 'key', size: 'narrow',
      body: '<form id="rp" novalidate style="display:flex;flex-direction:column;gap:14px"><div id="rp-alert" class="alert red" hidden></div>' +
        '<div class="field"><label>Password baru <span class="req">*</span><span class="tag">Min. 8</span></label><div class="input-wrap"><input name="Password" class="input mono" type="text" autocomplete="new-password" value="' + gen() + '"><button type="button" class="btn icon trail" id="rp-gen" title="Buat acak">' + icon('refresh') + '</button></div><div class="strength" id="rp-meter"><span></span><span></span><span></span><span></span></div><div class="hint" id="rp-meter-t"></div></div>' +
        '<div class="alert gold">' + icon('info') + '<div>Sampaikan password baru ini kepada yang bersangkutan. Semua sesi aktif akun ini akan otomatis keluar.</div></div></form>',
      foot: '<button class="btn outline" data-close>Batal</button><button class="btn primary" id="rp-save">' + icon('key') + 'Reset Password</button>'
    });
    const inp = m.$('[name=Password]');
    bindStrength(inp, m.$('#rp-meter'), m.$('#rp-meter-t'));
    m.$('#rp-gen').onclick = () => { inp.value = gen(); inp.dispatchEvent(new Event('input')); };
    m.$('#rp').addEventListener('submit', e => { e.preventDefault(); m.$('#rp-save').click(); });
    m.$('#rp-save').onclick = async () => {
      const form = m.$('#rp'); clearErrors(form);
      if (inp.value.length < 8) return fieldError(form, 'Password', 'Password minimal 8 karakter.');
      const done = busy(m.$('#rp-save'), 'Menyimpan…');
      const res = await api('userResetPassword', { ID_User: u.ID_User, Password: inp.value });
      done();
      if (!res.success) return showServerError(form, res, '#rp-alert');
      m.close();
      toast('Password direset', u.Nama_Lengkap + ' — sampaikan password baru secara langsung.');
    };
  }

  /** Akun yang dinonaktifkan di versi lama: aktifkan kembali (fitur nonaktifkan sudah dihapus). */
  async function aktifkan(u) {
    const res = await api('userStatus', { ID_User: u.ID_User, Status_Aktif: 'Aktif' });
    if (!res.success) return toast('Gagal mengaktifkan', res.message, 'error');
    applyUsers(res.data);
    render(true);
    toast('Akun diaktifkan', u.Nama_Lengkap + ' dapat masuk kembali.');
  }

  async function remove(u) {
    const r = await hapusData('akun', u.ID_User, { judul: 'Hapus akun ' + u.Role + '?', nama: u.Nama_Lengkap + ' (@' + u.Username + ')' });
    if (r) render(true);
  }

  return {
    title: 'Personel & Akun', roles: ['Admin'],
    show(root, p, o) { if (o.isNew || !table) build(root); load(false); },
    onBoot() { if (el) render(true); }
  };
})();
page('personel', PersonelPage);

// ==========================================================================
// FORM TAMBAH / UBAH AKUN & PENUGASAN
// ==========================================================================
const AkunForm = (() => {
  let el, model;

  function render(param) {
    const isNew = !param || param === 'baru';
    if (!isNew && !usersData()) {
      el.innerHTML = skeletonRows(5, 3);
      loadUsers(e => { if (e) el.innerHTML = errorState(e.message); else render(param); });
      return;
    }
    const u = isNew ? null : staffList().find(x => x.ID_User === param);
    if (!isNew && !u) { el.innerHTML = emptyState('user', 'Akun tidak ditemukan', 'Akun mungkin sudah dihapus.', '<a class="btn primary" href="#/personel">Kembali ke daftar</a>'); return; }
    model = { u, role: u ? u.Role : 'Gadik', asg: u && u.penugasan.length ? u.penugasan.map(a => ({ ID_Kelas: a.ID_Kelas, ID_Peleton: a.ID_Peleton || '' })) : [{ ID_Kelas: '', ID_Peleton: '' }] };

    el.innerHTML =
      '<a href="#/personel" class="btn ghost" style="margin:-6px 0 12px -10px">' + icon('arrow-left', 'sm') + 'Kembali ke daftar personel</a>' +
      pageHead({
        eyebrow: 'Formulir Otorisasi // Administrator Satdik',
        title: isNew ? 'Tambah Akun & Penugasan Personel' : 'Ubah Akun Personel',
        desc: 'Isi identitas, kredensial login, dan kelas/peleton yang diampu. Akses data dibatasi otomatis oleh server sesuai penugasan.',
        chips: '<span class="chip ' + (isNew ? '' : 'line') + '">' + (isNew ? 'Mode: registrasi baru' : 'Mode: ubah @' + esc(u.Username)) + '</span>',
        actions: isNew ? '<span class="small muted" style="max-width:220px">Pas foto 4×6 dapat ditambahkan setelah akun disimpan.</span>'
          : '<button type="button" class="pf-chip" id="af-foto" title="Ganti pas foto 4×6">' + avatarAkun(u, 'pf-mini') + '<span><b>Pas Foto 4×6</b><small>Klik untuk mengganti</small></span></button>'
      }) +
      '<form id="af" novalidate>' +
      '<div id="af-alert" class="alert red" hidden style="margin-bottom:16px"></div>' +
      // 01
      '<div class="card section-card"><div class="card-head"><div class="num-badge">01</div><div class="grow"><h3>Identitas & Peran Personel</h3><div class="sub">Menentukan hak akses operasional harian</div></div><span class="chip">Wajib</span></div><div class="card-body">' +
        '<div class="flabel" style="margin-bottom:10px">Pilihan peran pengguna <span class="req">*</span></div>' +
        '<div class="radio-cards" id="af-roles">' +
          roleCard('Gadik', 'Gadik (Tenaga Pendidik)', 'Menginput data peserta didik dan nilai mata pelajaran di kelas yang ditugaskan.', 'cap') +
          roleCard('Pengasuh', 'Pengasuh', 'Menginput Nilai Mental Kepribadian dan catatan pembinaan di kelas/peleton yang diampu.', 'shield') +
        '</div>' +
        '<div class="form-grid three mt-24">' +
          '<div class="field span-all"><label>Nama lengkap & gelar <span class="req">*</span></label><input name="Nama_Lengkap" class="input" maxlength="120" placeholder="Contoh: IPTU Bambang Sugiyarto, S.H." value="' + esc(u ? u.Nama_Lengkap : '') + '"></div>' +
          '<div class="field"><label>Pangkat <span class="req">*</span></label><input name="Pangkat" class="input" maxlength="40" placeholder="Contoh: IPTU" value="' + esc(u ? u.Pangkat : '') + '"></div>' +
          '<div class="field"><label>NRP / NIP <span class="req">*</span></label><input name="NRP" class="input mono" maxlength="25" placeholder="Contoh: 82070198" value="' + esc(u ? u.NRP : '') + '"></div>' +
          '<div class="field" id="af-kontak"><label>Nomor kontak / WA<span class="tag">Opsional</span></label><input name="Kontak" class="input mono" inputmode="tel" maxlength="20" placeholder="08xxxxxxxxxx" value="' + esc(u ? u.Kontak : '') + '"></div>' +
        '</div></div></div>' +
      // 02
      '<div class="card section-card"><div class="card-head"><div class="num-badge">02</div><div class="grow"><h3>Kredensial Login</h3><div class="sub">Username unik; password disimpan sebagai hash SHA-256 + salt</div></div></div><div class="card-body"><div class="form-grid three">' +
        '<div class="field"><label>Username <span class="req">*</span><span class="tag">Unik</span></label><input name="Username" class="input mono" maxlength="30" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="contoh: bambang.s" value="' + esc(u ? u.Username : '') + '"><div class="hint">Huruf kecil, angka, titik, atau garis bawah.</div></div>' +
        (isNew ?
          '<div class="field"><label>Password awal <span class="req">*</span><span class="tag">Min. 8</span></label><div class="input-wrap"><input name="Password" id="af-pw" type="password" class="input" autocomplete="new-password"><button type="button" class="btn icon trail" id="af-eye1" aria-label="Tampilkan">' + icon('eye') + '</button></div><div class="strength" id="af-meter"><span></span><span></span><span></span><span></span></div><div class="hint" id="af-meter-t"></div></div>' +
          '<div class="field"><label>Konfirmasi password <span class="req">*</span></label><div class="input-wrap"><input name="Password2" id="af-pw2" type="password" class="input" autocomplete="new-password"><button type="button" class="btn icon trail" id="af-eye2" aria-label="Tampilkan">' + icon('eye') + '</button></div></div>'
          : '<div class="field span-2"><label>Password</label><div class="alert gold">' + icon('info') + '<div>Password tidak ditampilkan. Untuk mengganti, gunakan tombol <b>Reset Password</b> (ikon kunci) di daftar personel.</div></div></div>') +
      '</div></div></div>' +
      // 03
      '<div class="card section-card"><div class="card-head"><div class="num-badge">03</div><div class="grow"><h3>Penugasan Kelas & Peleton</h3><div class="sub">Pembatasan wilayah data ditegakkan di server</div></div><span class="chip red">Zona RBAC</span></div><div class="card-body">' +
        '<div id="af-asg" style="display:flex;flex-direction:column;gap:12px"></div>' +
        '<button type="button" class="btn outline sm mt-16" id="af-add-asg">' + icon('plus', 'sm') + 'Tambah penugasan</button>' +
        '<div class="notice slim mt-16" style="margin-bottom:0" id="af-preview"></div>' +
      '</div></div>' +
      // 04
      '<div class="card section-card"><div class="card-head"><div class="num-badge">04</div><div class="grow"><h3>Ringkasan Aturan Akses</h3></div></div><div class="card-body">' +
        '<div class="alert gold">' + icon('lock') + '<div>Akun ini tidak dapat membuka menu Master Data, manajemen akun lain, maupun kelas/peleton di luar penugasan di atas. Setiap perubahan data dicatat beserta waktu dan penggunanya.</div></div>' +
      '</div></div>' +
      '<div class="sticky-bar"><span class="grow small muted">' + icon('info', 'sm') + ' Kolom bertanda <span class="req">*</span> wajib diisi.</span>' +
        '<a class="btn outline" href="#/personel">Batal</a><button class="btn primary" type="submit" id="af-save">' + icon('save') + (isNew ? 'Simpan & Terbitkan Akun' : 'Simpan Perubahan') + '</button></div>' +
      '</form>';

    const form = $('#af', el);
    $('#af-roles', el).addEventListener('change', e => { if (e.target.name === 'Role') { model.role = e.target.value; syncRole(); } });
    $('#af-add-asg', el).onclick = () => { model.asg.push({ ID_Kelas: '', ID_Peleton: '' }); renderAsg(); };
    if (isNew) {
      bindEye($('#af-eye1', el), $('#af-pw', el)); bindEye($('#af-eye2', el), $('#af-pw2', el));
      bindStrength($('#af-pw', el), $('#af-meter', el), $('#af-meter-t', el));
    }
    form.addEventListener('submit', e => { e.preventDefault(); submit(form, isNew); });
    const fb = $('#af-foto', el); if (fb) fb.onclick = () => pilihPasFoto(u);
    syncRole();
  }

  function roleCard(v, title, text, ic) {
    return '<label class="radio-card' + (model.role === v ? ' checked' : '') + '"><input type="radio" name="Role" value="' + v + '"' + (model.role === v ? ' checked' : '') + '><span class="row" style="gap:8px;justify-content:space-between"><strong>' + esc(title) + '</strong>' + roleBadge(v) + '</span><span class="muted">' + esc(text) + '</span></label>';
  }

  function syncRole() {
    $$('.radio-card', el).forEach(c => c.classList.toggle('checked', c.querySelector('input').checked));
    $('#af-kontak', el).hidden = model.role !== 'Gadik';
    renderAsg();
  }

  function renderAsg() {
    const kel = kelasList(), box = $('#af-asg', el), isP = model.role === 'Pengasuh';
    box.innerHTML = model.asg.map((a, i) =>
      '<div class="asg-row" data-i="' + i + '">' +
        '<div class="field"><label>Angkatan & kelas' + (i === 0 ? ' <span class="req">*</span>' : '') + '</label><select class="select" data-k>' + options(kel, 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, a.ID_Kelas, 'Pilih kelas') + '</select></div>' +
        '<div class="field"><label>Peleton binaan<span class="tag">' + (isP ? 'Pengasuh' : 'Tidak dipakai Gadik') + '</span></label><select class="select" data-p' + (isP ? '' : ' disabled') + '>' +
          (isP ? options(pelOf(a.ID_Kelas), 'ID_Peleton', p => p.Nama_Peleton, a.ID_Peleton, a.ID_Kelas ? 'Semua peleton di kelas ini' : 'Pilih kelas dulu') : '<option>Seluruh kelas</option>') + '</select></div>' +
        '<button type="button" class="btn icon red" data-rm title="Hapus penugasan"' + (model.asg.length === 1 ? ' disabled' : '') + '>' + icon('trash') + '</button>' +
      '</div>').join('');
    $$('.asg-row', box).forEach(row => {
      const i = Number(row.dataset.i);
      row.querySelector('[data-k]').onchange = e => { model.asg[i].ID_Kelas = e.target.value; model.asg[i].ID_Peleton = ''; renderAsg(); };
      const p = row.querySelector('[data-p]');
      if (isP) p.onchange = e => { model.asg[i].ID_Peleton = e.target.value; preview(); };
      row.querySelector('[data-rm]').onclick = () => { model.asg.splice(i, 1); renderAsg(); };
    });
    preview();
  }

  function preview() {
    const isP = model.role === 'Pengasuh', ok = model.asg.filter(a => a.ID_Kelas);
    const n = S.boot.peserta.filter(p => ok.some(a => a.ID_Kelas === p.ID_Kelas && (!isP || !a.ID_Peleton || a.ID_Peleton === p.ID_Peleton))).length;
    $('#af-preview', el).innerHTML = '<div class="icon-tile">' + icon('users') + '</div><div><b>Estimasi ' + n + ' peserta terhubung</b><p>' +
      (ok.length ? 'Akun ini dapat mengakses ' + ok.map(a => esc(kelasName(a.ID_Kelas)) + (isP && a.ID_Peleton ? ' / ' + esc(pelName(a.ID_Peleton)) : '')).join(', ') + '.' : 'Belum ada kelas dipilih — akun tidak akan melihat data peserta mana pun.') + '</p></div>';
  }

  async function submit(form, isNew) {
    clearErrors(form); $('#af-alert', el).hidden = true;
    const v = formValues(form);
    v.Role = model.role;
    if (!v.Nama_Lengkap) return fieldError(form, 'Nama_Lengkap', 'Nama lengkap wajib diisi.');
    if (!v.Pangkat) return fieldError(form, 'Pangkat', 'Pangkat wajib diisi.');
    if (!v.NRP) return fieldError(form, 'NRP', 'NRP/NIP wajib diisi.');
    v.Username = (v.Username || '').toLowerCase();
    if (!/^[a-z0-9._]{3,30}$/.test(v.Username)) return fieldError(form, 'Username', 'Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah.');
    const taken = staffList().concat((usersData() || []).filter(x => x.Role === 'Admin')).find(x => x.Username === v.Username && (isNew || x.ID_User !== model.u.ID_User));
    if (taken) return fieldError(form, 'Username', 'Username sudah dipakai ' + taken.Nama_Lengkap + '.');
    if (isNew) {
      if ((v.Password || '').length < 8) return fieldError(form, 'Password', 'Password awal minimal 8 karakter.');
      if (v.Password !== v.Password2) return fieldError(form, 'Password2', 'Konfirmasi password tidak sama.');
    }
    v.penugasan = model.asg.filter(a => a.ID_Kelas);
    if (!isNew) v.ID_User = model.u.ID_User;
    delete v.Password2;
    const done = busy($('#af-save', el), 'Menyimpan…');
    const res = await api('userSave', v);
    done();
    if (!res.success) { showServerError(form, res, '#af-alert'); if (!$('#af-alert', el).hidden) $('#af-alert', el).scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    applyUsers(res.data);
    toast(isNew ? 'Akun diterbitkan' : 'Akun diperbarui', v.Nama_Lengkap + ' (@' + v.Username + ')');
    go('personel');
  }

  return {
    title: p => (!p || p === 'baru' ? 'Tambah Akun' : 'Ubah Akun'), roles: ['Admin'],
    show(root, param) { el = root; render(param); }
  };
})();
page('akun', AkunForm);

// ==========================================================================
// MASTER DATA (US-06) — Kelas, Peleton, Mapel, Penugasan
// ==========================================================================
const MasterPage = (() => {
  const st = { tab: 'kelas', q: '', kelas: '' };
  let el, table;
  const TABS = [['kelas', 'Angkatan & Kelas', 'building'], ['peleton', 'Peleton', 'layers'], ['mapel', 'Mata Pelajaran', 'book'], ['penugasan', 'Penugasan', 'link']];

  function build(root) {
    el = root;
    el.innerHTML =
      pageHead({
        eyebrow: 'Master Data // Kurikulum Pelatihan & Organisasi',
        title: 'Master Data',
        desc: 'Konfigurasi angkatan/kelas pelatihan, peleton, mata pelajaran, dan penugasan personel. Menghapus data akan langsung menghapus semua data yang berkaitan (peserta, jadwal, dan nilai) setelah Anda konfirmasi.',
        actions: '<button class="btn primary" id="ms-add">' + icon('plus') + '<span id="ms-add-t">Tambah</span></button>'
      }) +
      '<div class="tabs" id="ms-tabs" role="tablist"></div>' +
      '<div class="card"><div class="toolbar" id="ms-tools"></div><div id="ms-table"></div></div>';
    $('#ms-tabs', el).addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) go('master/' + b.dataset.tab); });
    $('#ms-add', el).onclick = () => openForm(st.tab);
    table = null;
  }

  function counts() {
    const b = S.boot, users = usersData();
    return { kelas: b.ref.kelas.length, peleton: b.ref.peleton.length, mapel: b.ref.mapel.length, penugasan: users ? users.reduce((s, u) => s + u.penugasan.length, 0) : '…' };
  }

  function render(keep) {
    const c = counts();
    $('#ms-tabs', el).innerHTML = TABS.map(t => '<button role="tab" data-tab="' + t[0] + '" class="' + (st.tab === t[0] ? 'on' : '') + '">' + icon(t[2], 'sm') + t[1] + '<span class="count">' + c[t[0]] + '</span></button>').join('');
    $('#ms-add-t', el).textContent = { kelas: 'Tambah Kelas', peleton: 'Tambah Peleton', mapel: 'Tambah Mapel', penugasan: 'Tambah Penugasan' }[st.tab];
    const tools = $('#ms-tools', el);
    tools.innerHTML =
      '<div class="field search"><label for="ms-q">Cari</label><div class="input-wrap">' + icon('search', 'lead') + '<input id="ms-q" class="input with-lead" placeholder="Cari data master…" value="' + esc(st.q) + '" autocomplete="off"></div></div>' +
      (st.tab === 'peleton' || st.tab === 'penugasan' ? '<div class="field"><label>Kelas</label><select class="select" id="ms-kelas">' + options(kelasList(), 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, st.kelas, 'Semua kelas') + '</select></div>' : '');
    const q = $('#ms-q', tools);
    q.addEventListener('input', debounce(e => { st.q = e.target.value; fill(); }, 250));
    const k = $('#ms-kelas', tools); if (k) k.onchange = e => { st.kelas = e.target.value; fill(); };
    makeTable();
    fill(keep);
  }

  /** Tombol aksi: Ubah + Hapus. "Aktifkan" hanya muncul untuk data yang dinonaktifkan di versi lama. */
  function actBtns(row) {
    return '<div class="acts">' + (isAktif(row.Status) ? '' : '<button class="btn outline xs" data-act="aktifkan" title="Data ini dinonaktifkan di versi lama">' + icon('power', 'sm') + 'Aktifkan</button>') +
      '<button class="btn icon" data-act="edit" title="Ubah">' + icon('edit') + '</button>' +
      '<button class="btn icon red" data-act="del" title="Hapus">' + icon('trash') + '</button></div>';
  }
  const offBadge = r => isAktif(r.Status) ? '' : ' <span class="badge off">Nonaktif</span>';

  function makeTable() {
    const P = S.boot.peserta, cols = {
      kelas: [
        { key: 'ID_Kelas', label: 'ID', render: r => '<span class="mono small">' + esc(r.ID_Kelas) + '</span>' },
        { key: 'Nama_Kelas', label: 'Kelas', cls: 'card-title', sort: r => r.Nama_Angkatan + ' ' + r.Nama_Kelas, render: r => '<div class="t-name"><b>' + esc(r.Nama_Kelas) + offBadge(r) + '</b><small>' + esc(r.Nama_Angkatan) + '</small></div>' },
        { key: 'nPel', label: 'Peleton', num: true, sort: r => pelOf(r.ID_Kelas).length, render: r => pelOf(r.ID_Kelas).length },
        { key: 'nPst', label: 'Peserta', num: true, sort: r => P.filter(p => p.ID_Kelas === r.ID_Kelas).length, render: r => P.filter(p => p.ID_Kelas === r.ID_Kelas).length },
        { key: 'acts', label: 'Aksi', sort: false, cls: 'acts-cell', render: r => actBtns(r) }
      ],
      peleton: [
        { key: 'ID_Peleton', label: 'ID', render: r => '<span class="mono small">' + esc(r.ID_Peleton) + '</span>' },
        { key: 'Nama_Peleton', label: 'Peleton', cls: 'card-title', render: r => '<b>' + esc(r.Nama_Peleton) + offBadge(r) + '</b>' },
        { key: 'kelas', label: 'Kelas', sort: r => kelasName(r.ID_Kelas, true), render: r => esc(kelasName(r.ID_Kelas)) + '<div class="faint small">' + esc((R().kelas[r.ID_Kelas] || {}).Nama_Angkatan || '') + '</div>' },
        { key: 'nPst', label: 'Peserta', num: true, sort: r => P.filter(p => p.ID_Peleton === r.ID_Peleton).length, render: r => P.filter(p => p.ID_Peleton === r.ID_Peleton).length },
        { key: 'acts', label: 'Aksi', sort: false, cls: 'acts-cell', render: r => actBtns(r) }
      ],
      mapel: [
        { key: 'ID_Mapel', label: 'ID', render: r => '<span class="mono small">' + esc(r.ID_Mapel) + '</span>' },
        { key: 'Nama_Mapel', label: 'Mata Pelajaran', cls: 'card-title', render: r => '<b>' + esc(r.Nama_Mapel) + offBadge(r) + '</b>' },
        { key: 'Bobot_JP', label: 'Bobot / JP', num: true, sort: r => r.Bobot_JP === '' ? '' : Number(r.Bobot_JP), render: r => r.Bobot_JP === '' ? '<span class="faint">—</span>' : esc(r.Bobot_JP) },
        { key: 'nJdw', label: 'Sesi Jadwal', num: true, sort: r => S.boot.jadwal.filter(j => j.ID_Mapel === r.ID_Mapel).length, render: r => S.boot.jadwal.filter(j => j.ID_Mapel === r.ID_Mapel).length },
        { key: 'acts', label: 'Aksi', sort: false, cls: 'acts-cell', render: r => actBtns(r) }
      ],
      penugasan: [
        { key: 'Nama', label: 'Personel', cls: 'card-title', render: r => '<div class="t-person">' + avatarAkun({ ID_User: r.ID_User, Nama_Lengkap: r.Nama, Foto_Ver: r.Foto_Ver }, 'sm') + '<div class="t-name"><b>' + esc(r.Nama) + '</b><small class="mono">@' + esc(r.Username) + '</small></div></div>' },
        { key: 'Role', label: 'Peran', render: r => roleBadge(r.Role) },
        { key: 'kelas', label: 'Kelas', sort: r => kelasName(r.ID_Kelas, true), render: r => esc(kelasName(r.ID_Kelas, true)) },
        { key: 'pel', label: 'Peleton', sort: r => pelName(r.ID_Peleton), render: r => r.Role === 'Gadik' ? '<span class="faint">Seluruh kelas</span>' : (r.ID_Peleton ? esc(pelName(r.ID_Peleton)) : '<span class="faint">Semua peleton</span>') },
        { key: 'acts', label: 'Aksi', sort: false, cls: 'acts-cell', render: () => '<div class="acts"><button class="btn icon red" data-act="del" title="Hapus penugasan">' + icon('trash') + '</button></div>' }
      ]
    };
    const keys = { kelas: 'ID_Kelas', peleton: 'ID_Peleton', mapel: 'ID_Mapel', penugasan: 'ID_Penugasan' };
    const sorts = { kelas: 'Nama_Kelas', peleton: 'kelas', mapel: 'Nama_Mapel', penugasan: 'Nama' };
    const host = $('#ms-table', el);
    host.replaceWith(host.cloneNode(false));                     // lepas listener tabel lama
    table = new Table($('#ms-table', el), {
      key: keys[st.tab], unit: 'data', pageSize: 25, sort: { key: sorts[st.tab], dir: 'asc' }, columns: cols[st.tab],
      empty: () => emptyState(TABS.find(t => t[0] === st.tab)[2], 'Belum ada data', st.q ? 'Tidak ada data yang cocok.' : 'Tambahkan data pertama dengan tombol di kanan atas.'),
      onAction: (act, id) => action(act, id)
    });
    $('#ms-table', el).addEventListener('click', e => { if (e.target.closest('[data-retry]')) loadUsers(() => render(true), true); });
  }

  function fill(keep) {
    const q = norm(st.q), b = S.boot;
    let rows;
    if (st.tab === 'kelas') rows = b.ref.kelas.filter(k => (!q || norm(k.Nama_Angkatan + ' ' + k.Nama_Kelas + ' ' + k.ID_Kelas).indexOf(q) > -1));
    else if (st.tab === 'peleton') rows = b.ref.peleton.filter(p => (!st.kelas || p.ID_Kelas === st.kelas) && (!q || norm(p.Nama_Peleton + ' ' + kelasName(p.ID_Kelas, true)).indexOf(q) > -1));
    else if (st.tab === 'mapel') rows = b.ref.mapel.filter(m => (!q || norm(m.Nama_Mapel + ' ' + m.ID_Mapel).indexOf(q) > -1));
    else {
      if (!usersData()) { $('#ms-table', el).innerHTML = skeletonRows(5, 4); loadUsers(e => { if (e) $('#ms-table', el).innerHTML = errorState(e.message); else render(true); }); return; }
      rows = [];
      staffList().forEach(u => u.penugasan.forEach(a => rows.push({ ID_Penugasan: a.ID_Penugasan, ID_User: u.ID_User, Foto_Ver: u.Foto_Ver, Nama: u.Nama_Lengkap, Username: u.Username, Role: u.Role, Status_Aktif: u.Status_Aktif, ID_Kelas: a.ID_Kelas, ID_Peleton: a.ID_Peleton })));
      rows = rows.filter(r => (!st.kelas || r.ID_Kelas === st.kelas) && (!q || norm(r.Nama + ' ' + r.Username + ' ' + kelasName(r.ID_Kelas, true)).indexOf(q) > -1));
    }
    table.set(rows, keep);
  }

  const DEF = {
    kelas: { list: () => S.boot.ref.kelas, id: 'ID_Kelas', save: 'kelasSave', jenis: 'kelas', utama: 'Angkatan_Kelas', label: r => r.Nama_Kelas + ' — ' + r.Nama_Angkatan, name: 'kelas' },
    peleton: { list: () => S.boot.ref.peleton, id: 'ID_Peleton', save: 'peletonSave', jenis: 'peleton', utama: 'Peleton', label: r => r.Nama_Peleton + ' (' + kelasName(r.ID_Kelas) + ')', name: 'peleton' },
    mapel: { list: () => S.boot.ref.mapel, id: 'ID_Mapel', save: 'mapelSave', jenis: 'mapel', utama: 'Mata_Pelajaran', label: r => r.Nama_Mapel, name: 'mata pelajaran' }
  };

  function applyRef(res) {
    Object.assign(S.boot.ref, res.data.ref);
    S.boot.stat.kelasAktif = S.boot.ref.kelas.filter(k => isAktif(k.Status)).length;
    S.boot.stat.kelasTotal = S.boot.ref.kelas.length;
    bootChanged();
  }

  async function action(act, id) {
    if (st.tab === 'penugasan') {
      if (act !== 'del') return;
      const u = staffList().find(x => x.penugasan.some(a => a.ID_Penugasan === id)), a = u && u.penugasan.find(x => x.ID_Penugasan === id);
      const r = await hapusData('penugasan', id, { judul: 'Hapus penugasan?', nama: u ? u.Nama_Lengkap + ' → ' + kelasName(a.ID_Kelas) + (a.ID_Peleton ? ' / ' + pelName(a.ID_Peleton) : '') : id, utama: 'Penugasan' });
      if (r) render(true);
      return;
    }
    const D = DEF[st.tab], row = D.list().find(r => r[D.id] === id);
    if (!row) return;
    if (act === 'edit') return openForm(st.tab, row);
    if (act === 'aktifkan') {
      const res = await api(D.save, Object.assign({}, row, { Status: 'Aktif' }));
      if (!res.success) return toast('Gagal', res.message, 'error');
      applyRef(res); toast('Diaktifkan', D.label(row));
      return;
    }
    if (act === 'del') {
      const r = await hapusData(D.jenis, id, { judul: 'Hapus ' + D.name + '?', nama: D.label(row), utama: D.utama });
      if (r) render(true);
    }
  }


  function openForm(tab, row) {
    const isEdit = !!row;
    if (tab === 'penugasan') return openAsgForm();
    let body, title, ic;
    if (tab === 'kelas') {
      title = isEdit ? 'Ubah Angkatan & Kelas' : 'Tambah Angkatan & Kelas'; ic = 'building';
      body = '<div class="field span-all"><label>Angkatan / gelombang pelatihan <span class="req">*</span></label><input name="Nama_Angkatan" class="input" maxlength="80" placeholder="Contoh: Pelatihan Gelombang I 2026" value="' + esc(row ? row.Nama_Angkatan : '') + '"></div>' +
        '<div class="field span-all"><label>Nama kelas <span class="req">*</span></label><input name="Nama_Kelas" class="input" maxlength="60" placeholder="Contoh: Kelas A" value="' + esc(row ? row.Nama_Kelas : '') + '"></div>';
    } else if (tab === 'peleton') {
      title = isEdit ? 'Ubah Peleton' : 'Tambah Peleton'; ic = 'layers';
      body = '<div class="field span-all"><label>Kelas <span class="req">*</span></label><select name="ID_Kelas" class="select">' + options(kelasList(), 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, row ? row.ID_Kelas : st.kelas, 'Pilih kelas') + '</select></div>' +
        '<div class="field span-all"><label>Nama peleton <span class="req">*</span></label><input name="Nama_Peleton" class="input" maxlength="60" placeholder="Contoh: Peleton 1" value="' + esc(row ? row.Nama_Peleton : '') + '"></div>';
    } else {
      title = isEdit ? 'Ubah Mata Pelajaran' : 'Tambah Mata Pelajaran'; ic = 'book';
      body = '<div class="field span-all"><label>Nama mata pelajaran <span class="req">*</span></label><input name="Nama_Mapel" class="input" maxlength="100" placeholder="Contoh: Hukum Kepolisian" value="' + esc(row ? row.Nama_Mapel : '') + '"></div>' +
        '<div class="field"><label>Bobot / JP<span class="tag">Opsional</span></label><input name="Bobot_JP" class="input mono" inputmode="numeric" maxlength="5" value="' + esc(row ? row.Bobot_JP : '') + '"></div>';
    }
    const m = openModal({
      title, icon: ic, sub: isEdit ? 'ID ' + row[DEF[tab].id] : 'Data master baru',
      body: '<form id="mf" class="form-grid" novalidate><div id="mf-alert" class="alert red span-all" hidden></div>' + body +
        '</form>',
      foot: '<button class="btn outline" data-close>Batal</button><button class="btn primary" id="mf-save">' + icon('save') + 'Simpan Data Master</button>'
    });
    const form = m.$('#mf');
    form.addEventListener('submit', e => { e.preventDefault(); m.$('#mf-save').click(); });
    m.$('#mf-save').onclick = async () => {
      clearErrors(form); m.$('#mf-alert').hidden = true;
      const v = formValues(form);
      const req = { kelas: ['Nama_Angkatan', 'Nama_Kelas'], peleton: ['ID_Kelas', 'Nama_Peleton'], mapel: ['Nama_Mapel'] }[tab];
      for (let i = 0; i < req.length; i++) if (!v[req[i]]) return fieldError(form, req[i], 'Wajib diisi.');
      if (isEdit) v[DEF[tab].id] = row[DEF[tab].id];
      const done = busy(m.$('#mf-save'), 'Menyimpan…');
      const res = await api(DEF[tab].save, v);
      done();
      if (!res.success) return showServerError(form, res, '#mf-alert');
      m.close(); applyRef(res);
      toast(isEdit ? 'Data diperbarui' : 'Data ditambahkan', '');
    };
  }

  function openAsgForm() {
    const staff = staffList().filter(u => u.Status_Aktif === 'Aktif').sort((a, b) => collator.compare(a.Nama_Lengkap, b.Nama_Lengkap));
    const m = openModal({
      title: 'Tambah Penugasan', icon: 'link', sub: 'Hubungkan personel ke kelas/peleton',
      body: '<form id="pg" class="form-grid" novalidate><div id="pg-alert" class="alert red span-all" hidden></div>' +
        '<div class="field span-all"><label>Personel <span class="req">*</span></label><select name="ID_User" class="select">' + options(staff, 'ID_User', u => u.Nama_Lengkap + ' — ' + u.Role, '', 'Pilih Gadik atau Pengasuh') + '</select></div>' +
        '<div class="field"><label>Kelas <span class="req">*</span></label><select name="ID_Kelas" class="select">' + options(kelasList(), 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, st.kelas, 'Pilih kelas') + '</select></div>' +
        '<div class="field"><label>Peleton<span class="tag">Khusus pengasuh</span></label><select name="ID_Peleton" class="select" disabled><option value="">Seluruh kelas</option></select></div></form>',
      foot: '<button class="btn outline" data-close>Batal</button><button class="btn primary" id="pg-save">' + icon('save') + 'Simpan Penugasan</button>'
    });
    const form = m.$('#pg'), su = form.querySelector('[name=ID_User]'), sk = form.querySelector('[name=ID_Kelas]'), sp = form.querySelector('[name=ID_Peleton]');
    const sync = () => {
      const u = staff.find(x => x.ID_User === su.value), isP = u && u.Role === 'Pengasuh';
      sp.disabled = !isP;
      sp.innerHTML = isP ? options(pelOf(sk.value), 'ID_Peleton', p => p.Nama_Peleton, '', 'Semua peleton di kelas ini') : '<option value="">Seluruh kelas</option>';
    };
    su.onchange = sync; sk.onchange = sync; sync();
    m.$('#pg-save').onclick = async () => {
      clearErrors(form);
      const v = formValues(form);
      if (!v.ID_User) return fieldError(form, 'ID_User', 'Pilih personel.');
      if (!v.ID_Kelas) return fieldError(form, 'ID_Kelas', 'Pilih kelas.');
      const done = busy(m.$('#pg-save'), 'Menyimpan…');
      const res = await api('penugasanSave', v);
      done();
      if (!res.success) return showServerError(form, res, '#pg-alert');
      applyUsers(res.data); m.close(); render(true);
      toast('Penugasan ditambahkan', '');
    };
  }

  return {
    title: 'Master Data', roles: ['Admin'],
    show(root, param, o) {
      if (o.isNew || !el) build(root);
      st.tab = TABS.some(t => t[0] === param) ? param : 'kelas';
      render();
      if (!usersData()) loadUsers(() => { if (S.current && S.current.name === 'master') render(true); });
    },
    onBoot() { if (el && !_modals.length) render(true); }
  };
})();
page('master', MasterPage);

// ==========================================================================
// JADWAL — Admin: 1 mapel = blok 6 hari (Senin–Sabtu, 08.00–17.00) • matriks per pekan + daftar + bentrok
// ==========================================================================
window.JadwalAdmin = (() => {
  const st = { kelas: '', view: 'matrix', fGadik: '', fKelas: '', fWaktu: 'aktif', wk: '' };
  let el, table;
  const senin = t => addDays(t, -HARI.indexOf(hariOf(t)));

  function render() {
    const kel = kelasList(), all = S.boot.jadwal, conf = findConflicts(all);
    if (!kel.some(k => k.ID_Kelas === st.kelas)) st.kelas = kel[0] ? kel[0].ID_Kelas : '';
    if (!st.wk) st.wk = senin(todayStr());
    const pairs = [], seen = {};
    Object.keys(conf).forEach(a => conf[a].forEach(c => { const k = [a, c.id].sort().join('|'); if (!seen[k]) { seen[k] = 1; pairs.push({ a, b: c.id, why: c.why }); } }));
    const J = id => all.find(j => j.ID_Jadwal === id) || {};
    el.innerHTML =
      pageHead({
        eyebrow: 'Kurikulum & Matriks // 1 Mapel = 6 Hari • 08.00–17.00 WIT',
        title: 'Jadwal Pelajaran',
        desc: 'Satu mata pelajaran dilaksanakan <b>6 hari (Senin–Sabtu)</b> pukul <b>08.00–17.00 WIT</b>. Pilih tanggal mulai; tanggal selesai terisi otomatis. Bila penutupan dimajukan ke Jumat, centang opsinya agar Gadik dapat mengisi nilai hari Sabtu sejak Jumat.',
        actions: '<div class="seg" role="tablist"><button data-view="matrix" class="' + (st.view === 'matrix' ? 'on' : '') + '">' + icon('grid', 'sm') + 'Matriks</button><button data-view="list" class="' + (st.view === 'list' ? 'on' : '') + '">' + icon('list', 'sm') + 'Daftar</button></div>' +
          '<button class="btn primary" id="jd-add">' + icon('plus') + 'Tambah Jadwal Mapel</button>'
      }) +
      (pairs.length ? '<div class="notice red"><div class="icon-tile">' + icon('alert-triangle') + '</div><div class="grow"><b>' + pairs.length + ' bentrok jadwal terdeteksi</b>' +
        pairs.slice(0, 4).map(p => { const a = J(p.a), b = J(p.b); return '<p>' + (p.why === 'GADIK' ? 'Gadik <b>' + esc(gadikName(a.ID_Gadik)) + '</b> mengajar ' + esc(kelasName(a.ID_Kelas)) + ' dan ' + esc(kelasName(b.ID_Kelas)) : '<b>' + esc(kelasName(a.ID_Kelas)) + '</b>: ' + esc(mapelName(a.ID_Mapel)) + ' dan ' + esc(mapelName(b.ID_Mapel))) + ' pada ' + esc(rentangJadwal(a)) + ' ' + esc(fmt.jam(a.Jam_Mulai)) + '–' + esc(fmt.jam(a.Jam_Selesai)) + ' <a href="javascript:void 0" data-open="' + esc(p.a) + '">Selesaikan →</a></p>'; }).join('') +
        (pairs.length > 4 ? '<p>dan ' + (pairs.length - 4) + ' bentrok lainnya (lihat tampilan Daftar).</p>' : '') + '</div></div>' : '') +
      dokumenKartu({ admin: true, cls: 'mb-24' }) +
      '<div class="card">' + (st.view === 'matrix' ? matrixHtml(kel, conf) : '<div class="toolbar">' +
        '<div class="field"><label>Kelas</label><select class="select" id="jl-kelas">' + options(kel, 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, st.fKelas, 'Semua kelas') + '</select></div>' +
        '<div class="field"><label>Gadik</label><select class="select" id="jl-gadik">' + options(S.boot.ref.gadik.slice().sort((a, b) => collator.compare(a.Nama_Lengkap, b.Nama_Lengkap)), 'ID_Gadik', g => g.Nama_Lengkap, st.fGadik, 'Semua Gadik') + '</select></div>' +
        '<div class="field narrow"><label>Waktu</label><select class="select" id="jl-waktu">' + [['aktif', 'Berjalan & akan datang'], ['', 'Semua'], ['lalu', 'Sudah selesai']].map(o => '<option value="' + o[0] + '"' + (st.fWaktu === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
        '</div><div id="jl-table"></div>') + '</div>';

    $$('[data-view]', el).forEach(b => { b.onclick = () => { st.view = b.dataset.view; render(); }; });
    $('#jd-add', el).onclick = () => openForm(null, { ID_Kelas: st.view === 'matrix' ? st.kelas : st.fKelas, Tanggal_Mulai: st.view === 'matrix' && st.wk > todayStr() ? st.wk : '' });
    el.addEventListener('click', onClick);
    if (st.view === 'matrix') {
      const ks = $('#jm-kelas', el);
      if (ks) ks.onchange = () => { st.kelas = ks.value; render(); };
    } else {
      $('#jl-kelas', el).onchange = e => { st.fKelas = e.target.value; fillList(conf); };
      $('#jl-gadik', el).onchange = e => { st.fGadik = e.target.value; fillList(conf); };
      $('#jl-waktu', el).onchange = e => { st.fWaktu = e.target.value; fillList(conf); };
      table = new Table($('#jl-table', el), {
        key: 'ID_Jadwal', unit: 'jadwal', pageSize: 25, sort: { key: 'tgl', dir: 'asc' },
        columns: [
          { key: 'tgl', label: 'Pelaksanaan', sort: j => (j.Tanggal_Mulai || '0000') + HARI.indexOf(hariList(j)[0]), render: j => '<b class="nowrap">' + esc(j.Tanggal_Mulai ? rentangJadwal(j).split(' • ')[0] : 'Setiap pekan') + '</b><div class="small muted">' + esc(hariTeks(j)) + (j.Tutup_Jumat === 'Ya' ? ' • <span class="badge draft">Penutupan Jumat</span>' : '') + '</div>' },
          { key: 'jam', label: 'Jam (WIT)', sort: j => menit(j.Jam_Mulai), render: j => '<span class="mono nowrap">' + esc(fmt.jam(j.Jam_Mulai)) + '–' + esc(fmt.jam(j.Jam_Selesai)) + '</span>' },
          { key: 'mapel', label: 'Mata Pelajaran', cls: 'card-title', sort: j => mapelName(j.ID_Mapel), render: j => '<div class="t-name"><b>' + esc(mapelName(j.ID_Mapel)) + '</b><small>' + esc(kelasName(j.ID_Kelas, true)) + '</small></div>' },
          { key: 'gadik', label: 'Gadik', sort: j => gadikName(j.ID_Gadik), render: j => esc(gadikName(j.ID_Gadik)) },
          { key: 'Ruang', label: 'Ruang', render: j => esc(j.Ruang || '—') },
          { key: 'st', label: 'Status', sort: j => conf[j.ID_Jadwal] ? 0 : 1, render: j => conf[j.ID_Jadwal] ? '<span class="badge bad">Bentrok</span>' : (!j.Tanggal_Mulai ? '<span class="badge off">Format lama</span>' : j.Tanggal_Selesai < todayStr() ? '<span class="badge off">Selesai</span>' : j.Tanggal_Mulai > todayStr() ? '<span class="badge draft">Akan datang</span>' : '<span class="badge ok">Berjalan</span>') },
          { key: 'acts', label: 'Aksi', sort: false, cls: 'acts-cell', render: () => '<div class="acts"><button class="btn icon" data-act="edit" title="Ubah">' + icon('edit') + '</button><button class="btn icon red" data-act="del" title="Hapus">' + icon('trash') + '</button></div>' }
        ],
        empty: () => emptyState('calendar', 'Belum ada jadwal', 'Tambahkan jadwal mata pelajaran pertama (6 hari, 08.00–17.00).', '<button class="btn primary" data-act="add">' + icon('plus') + 'Tambah Jadwal Mapel</button>'),
        onAction: (act, id) => {
          if (act === 'add') return openForm(null, {});
          const j = S.boot.jadwal.find(x => x.ID_Jadwal === id);
          if (act === 'edit') openForm(j);
          if (act === 'del') remove(j);
        }
      });
      fillList(conf);
    }
  }

  function fillList() {
    const t = todayStr();
    table.set(S.boot.jadwal.filter(j => (!st.fKelas || j.ID_Kelas === st.fKelas) && (!st.fGadik || j.ID_Gadik === st.fGadik) &&
      (!st.fWaktu || (st.fWaktu === 'aktif' ? !j.Tanggal_Selesai || j.Tanggal_Selesai >= t : !!j.Tanggal_Selesai && j.Tanggal_Selesai < t))));
  }

  function matrixHtml(kel, conf) {
    if (!kel.length) return emptyState('building', 'Belum ada kelas', 'Tambahkan angkatan & kelas di menu Master Data terlebih dahulu.', '<a class="btn primary" href="#/master/kelas">Buka Master Data</a>');
    const dates = HARI.map((h, i) => addDays(st.wk, i));
    const kList = S.boot.jadwal.filter(j => j.ID_Kelas === st.kelas);
    const list = kList.filter(j => dates.some(t => jadwalAktif(j, t)));
    const days = dates.filter((t, i) => i < 6 || list.some(j => jadwalAktif(j, t)));
    const slots = Array.from(new Set(list.map(j => j.Jam_Mulai + '|' + j.Jam_Selesai))).sort((a, b) => menit(a) - menit(b.split('|')[0]) || menit(a.split('|')[1]) - menit(b.split('|')[1]));
    const today = todayStr();
    const mapels = Array.from(new Set(list.map(j => j.ID_Mapel)));
    let h = '<div class="card-head" style="flex-wrap:wrap"><div class="field" style="min-width:240px"><label for="jm-kelas">Kelas</label><select id="jm-kelas" class="select">' + options(kel, 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, st.kelas) + '</select></div>' +
      '<div class="wk-nav"><button class="btn icon" data-wk="-7" title="Pekan sebelumnya" aria-label="Pekan sebelumnya">' + icon('chevron-left') + '</button>' +
      '<div class="wk-t"><b>' + esc(tglRingkas(dates[0]) + ' – ' + tglRingkas(dates[5])) + '</b><small>' + (st.wk === senin(today) ? 'Pekan ini' : 'Pekan ' + esc(tglRingkas(st.wk))) + '</small></div>' +
      '<button class="btn icon" data-wk="7" title="Pekan berikutnya" aria-label="Pekan berikutnya">' + icon('chevron-right') + '</button>' +
      (st.wk !== senin(today) ? '<button class="btn outline xs" data-wk="0">Pekan ini</button>' : '') + '</div>' +
      '<span class="grow"></span><span class="chip line">' + (mapels.length ? esc(mapels.map(mapelName).join(', ')) : 'Belum ada mapel pekan ini') + '</span>' +
      '<span class="chip red">' + icon('alert-triangle', 'sm') + 'Merah = bentrok</span></div>';
    if (!slots.length) {
      const next = kList.filter(j => j.Tanggal_Mulai && j.Tanggal_Mulai > dates[6]).sort((a, b) => a.Tanggal_Mulai.localeCompare(b.Tanggal_Mulai))[0];
      return h + '<div class="card-body">' + emptyState('calendar', 'Belum ada mata pelajaran pada pekan ini', kelasName(st.kelas, true) + (next ? ' — jadwal berikutnya: ' + mapelName(next.ID_Mapel) + ', ' + rentangJadwal(next) + '.' : '.'),
        '<button class="btn primary" data-add-wk="1">' + icon('plus') + 'Jadwalkan Mapel Pekan Ini</button>' + (next ? ' <button class="btn outline" data-goto-wk="' + senin(next.Tanggal_Mulai) + '">Lihat pekan itu</button>' : '')) + '</div>';
    }
    h += '<div class="matrix-wrap"><div class="matrix" style="grid-template-columns:110px repeat(' + days.length + ',minmax(150px,1fr))">';
    h += '<div class="mh">Waktu</div>' + days.map(t => '<div class="mh' + (t === today ? ' today' : '') + '">' + hariOf(t) + '<small>' + esc(tglRingkas(t)) + (t === today ? ' • hari ini' : '') + '</small></div>').join('');
    slots.forEach(sl => {
      const [a, b] = sl.split('|'), dur = menit(b) - menit(a);
      h += '<div class="mt">' + esc(fmt.jam(a)) + '–' + esc(fmt.jam(b)) + '<small>' + fmt.num(dur / 60, dur % 60 ? 1 : 0) + ' jam</small></div>';
      days.forEach(t => {
        const cell = list.filter(j => jadwalAktif(j, t) && j.Jam_Mulai === a && j.Jam_Selesai === b);
        h += '<div class="mc' + (t === today ? ' today' : '') + '">' + cell.map(j => {
          const c = conf[j.ID_Jadwal], ke = tanggalJadwal(j).indexOf(t) + 1, sabtuAwal = j.Tutup_Jumat === 'Ya' && hariOf(t) === 'Sabtu';
          return '<button class="slot' + (c ? ' clash' : '') + '" data-open="' + esc(j.ID_Jadwal) + '"><span class="code">' + (c ? '⚠ BENTROK ' + (c[0].why === 'GADIK' ? 'GADIK' : 'KELAS') + (ke ? ' • HARI ' + ke : '') : (ke ? 'HARI ' + ke : 'MINGGUAN')) + '</span><b>' + esc(mapelName(j.ID_Mapel)) + '</b><small>' + icon('user', 'sm') + esc(gadikName(j.ID_Gadik)) + '</small>' + (j.Ruang ? '<small>' + icon('map-pin', 'sm') + esc(j.Ruang) + '</small>' : '') + (sabtuAwal ? '<small class="slot-note">Penutupan Jumat — nilai diisi Jumat</small>' : '') + '</button>';
        }).join('') + '</div>';
      });
    });
    return h + '</div></div><div class="pager"><span>' + icon('info', 'sm') + ' Klik mata pelajaran untuk mengubah. Gunakan ◀ ▶ untuk berpindah pekan.</span></div>';
  }

  function onClick(e) {
    if (e.target.closest('[data-dok-baru]')) return formDokumen(null);
    const du = e.target.closest('[data-dok-ubah]'); if (du) return formDokumen(dokumenList().find(x => x.ID_Dokumen === du.dataset.dokUbah));
    const dh = e.target.closest('[data-dok-hapus]');
    if (dh) {
      const d = dokumenList().find(x => x.ID_Dokumen === dh.dataset.dokHapus);
      if (d) hapusData('dokumen', d.ID_Dokumen, { judul: 'Hapus dokumen jadwal?', nama: d.Judul + ' (PDF)', utama: 'Dokumen_Jadwal' }).then(r => { if (r) render(); });
      return;
    }
    const o = e.target.closest('[data-open]');
    if (o) { e.preventDefault(); const j = S.boot.jadwal.find(x => x.ID_Jadwal === o.dataset.open); if (j) openForm(j); return; }
    const w = e.target.closest('[data-wk]');
    if (w) { const n = Number(w.dataset.wk); st.wk = n ? addDays(st.wk, n) : senin(todayStr()); render(); return; }
    const g = e.target.closest('[data-goto-wk]');
    if (g) { st.wk = g.dataset.gotoWk; render(); return; }
    if (e.target.closest('[data-add-wk]')) openForm(null, { ID_Kelas: st.kelas, Tanggal_Mulai: st.wk });
  }

  function clashText(rec) {
    const conf = findConflicts(S.boot.jadwal.filter(j => j.ID_Jadwal !== rec.ID_Jadwal).concat([Object.assign({}, rec, { ID_Jadwal: '__new' })]));
    return (conf.__new || []).map(c => {
      const j = S.boot.jadwal.find(x => x.ID_Jadwal === c.id) || {};
      return c.why === 'GADIK' ? 'Gadik ' + gadikName(j.ID_Gadik) + ' sudah mengajar ' + mapelName(j.ID_Mapel) + ' di ' + kelasName(j.ID_Kelas) + ' pada ' + rentangJadwal(j) + ' ' + fmt.jam(j.Jam_Mulai) + '–' + fmt.jam(j.Jam_Selesai) + '.'
        : kelasName(j.ID_Kelas) + ' sudah ada ' + mapelName(j.ID_Mapel) + ' pada ' + rentangJadwal(j) + ' ' + fmt.jam(j.Jam_Mulai) + '–' + fmt.jam(j.Jam_Selesai) + '.';
    });
  }

  /** Unggah / ubah dokumen Jadwal Pelatihan (PDF) yang tampil di dashboard Gadik & Pengasuh. */
  function formDokumen(d) {
    const isEdit = !!d;
    const m = openModal({
      title: isEdit ? 'Ubah Dokumen Jadwal' : 'Unggah Jadwal Pelatihan (PDF)', icon: 'file-pdf', sub: 'Tampil di dashboard Gadik & Pengasuh',
      body: '<form id="df" class="form-grid" novalidate><div id="df-alert" class="alert red span-all" hidden></div>' +
        '<div class="field span-all"><label>Judul dokumen <span class="req">*</span></label><input name="Judul" class="input" maxlength="120" placeholder="Contoh: Jadwal Pelatihan Gelombang I 2026" value="' + esc(d ? d.Judul : '') + '"></div>' +
        '<div class="field span-all"><label>Ditujukan untuk</label><select name="ID_Kelas" class="select">' + options(kelasList(), 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, d ? d.ID_Kelas : '', 'Semua kelas (umum)') + '</select><div class="hint">Gadik & Pengasuh hanya melihat dokumen umum dan dokumen kelas penugasannya.</div></div>' +
        '<label class="drop span-all" id="df-drop"><input type="file" id="df-file" accept="application/pdf,.pdf" hidden><div class="icon-tile">' + icon('file-pdf') + '</div><b id="df-file-t">' + (isEdit ? 'Ganti berkas PDF (opsional)' : 'Pilih berkas PDF atau seret ke sini') + '</b><div class="hint mt-8">' + (isEdit ? 'Saat ini: ' + esc(d.Nama_Berkas) + ' • ' + esc(ukuranTeks(d.Ukuran)) : 'Format PDF, maksimal 10 MB') + '</div></label>' +
        '</form>',
      foot: '<button class="btn outline" data-close>Batal</button><button class="btn primary" id="df-save">' + icon('upload') + (isEdit ? 'Simpan' : 'Unggah') + '</button>'
    });
    let picked = null;
    const form = m.$('#df'), file = m.$('#df-file'), drop = m.$('#df-drop'), alert = t => { const a = m.$('#df-alert'); a.hidden = !t; a.innerHTML = t ? icon('alert-circle') + '<div>' + esc(t) + '</div>' : ''; };
    const pick = f => {
      alert('');
      if (!f) return;
      if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { picked = null; return alert('Berkas harus berformat PDF.'); }
      if (f.size > 10 * 1024 * 1024) { picked = null; return alert('Ukuran ' + ukuranTeks(f.size) + ' melebihi batas 10 MB.'); }
      picked = f;
      m.$('#df-file-t').textContent = f.name + ' • ' + ukuranTeks(f.size);
      const j = form.querySelector('[name=Judul]'); if (!j.value) j.value = f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
    };
    file.onchange = () => pick(file.files[0]);
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => pick(e.dataTransfer.files[0]));
    form.addEventListener('submit', e => { e.preventDefault(); m.$('#df-save').click(); });
    m.$('#df-save').onclick = async () => {
      clearErrors(form); alert('');
      const v = formValues(form);
      if (!v.Judul) return fieldError(form, 'Judul', 'Wajib diisi.');
      if (!isEdit && !picked) return alert('Pilih berkas PDF jadwal pelatihan.');
      const done = busy(m.$('#df-save'), picked ? 'Mengunggah…' : 'Menyimpan…');
      const data = { ID_Dokumen: isEdit ? d.ID_Dokumen : '', Judul: v.Judul, ID_Kelas: v.ID_Kelas };
      if (picked) {
        data.Nama_Berkas = picked.name;
        data.base64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(picked); });
      }
      const res = await api('dokumenUpload', data, { timeout: 180000 });
      done();
      if (!res.success) return showServerError(form, res, '#df-alert');
      S.boot.dokumen = res.data.dokumen; bootChanged();
      m.close();
      render();
      toast(isEdit ? 'Dokumen diperbarui' : 'Jadwal PDF diunggah', v.Judul + ' — kini tampil di dashboard Gadik & Pengasuh.');
    };
  }

  /** Senin terdekat (hari ini bila Senin) — awal blok 6 hari bawaan. */
  function seninBerikut() { const t = todayStr(), i = HARI.indexOf(hariOf(t)); return i === 0 ? t : addDays(t, 7 - i); }

  function openForm(j, preset) {
    const isEdit = !!j;
    const v0 = Object.assign({ ID_Kelas: st.kelas, ID_Mapel: '', ID_Gadik: '', Hari: JADWAL.HARI_DEFAULT.join(','), Jam_Mulai: JADWAL.JAM_MULAI, Jam_Selesai: JADWAL.JAM_SELESAI, Ruang: '', Tanggal_Mulai: '', Tanggal_Selesai: '', Tutup_Jumat: '' }, preset || {}, j || {});
    if (!v0.Tanggal_Mulai) v0.Tanggal_Mulai = seninBerikut();
    if (!v0.Tanggal_Selesai) v0.Tanggal_Selesai = addDays(v0.Tanggal_Mulai, JADWAL.HARI_BLOK - 1);
    const lama = isEdit && !j.Tanggal_Mulai;
    const gadik = S.boot.ref.gadik.filter(g => g.Aktif || g.ID_Gadik === v0.ID_Gadik).sort((a, b) => collator.compare(a.Nama_Lengkap, b.Nama_Lengkap));
    const mapel = mapelList(false).filter(m => isAktif(m.Status) || m.ID_Mapel === v0.ID_Mapel);
    const hariOn = hariList(v0);
    const m = openModal({
      title: isEdit ? 'Ubah Jadwal Mata Pelajaran' : 'Tambah Jadwal Mata Pelajaran', sub: isEdit ? 'ID ' + j.ID_Jadwal : '1 mapel = 6 hari • 08.00–17.00 WIT', icon: 'calendar',
      body: '<form id="jf" class="form-grid" novalidate><div id="jf-alert" class="alert red span-all" hidden></div>' +
        (lama ? '<div class="alert gold span-all">' + icon('info') + '<div>Jadwal ini dibuat dengan format lama (berulang tiap pekan, ' + esc(hariTeks(j)) + ' ' + esc(fmt.jam(j.Jam_Mulai)) + '–' + esc(fmt.jam(j.Jam_Selesai)) + '). Lengkapi tanggal pelaksanaan dan jam 08.00–17.00 untuk menyimpan.</div></div>' : '') +
        '<div class="field span-all"><label>Kelas <span class="req">*</span></label><select name="ID_Kelas" class="select">' + options(kelasList(), 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, v0.ID_Kelas, 'Pilih kelas') + '</select></div>' +
        '<div class="field span-all"><label>Mata pelajaran <span class="req">*</span></label><select name="ID_Mapel" class="select">' + options(mapel, 'ID_Mapel', x => x.Nama_Mapel, v0.ID_Mapel, mapel.length ? 'Pilih mata pelajaran' : 'Belum ada mapel — tambah di Master Data') + '</select></div>' +
        '<div class="field span-all"><label>Gadik pengampu <span class="req">*</span></label><select name="ID_Gadik" class="select">' + options(gadik, 'ID_Gadik', g => g.Nama_Lengkap, v0.ID_Gadik, gadik.length ? 'Pilih Gadik' : 'Belum ada akun Gadik aktif') + '</select></div>' +
        '<div class="field"><label>Tanggal mulai <span class="req">*</span></label><input name="Tanggal_Mulai" type="date" class="input mono" value="' + esc(v0.Tanggal_Mulai) + '"></div>' +
        '<div class="field"><label>Tanggal selesai <span class="req">*</span><span class="tag">Otomatis 6 hari</span></label><input name="Tanggal_Selesai" type="date" class="input mono" value="' + esc(v0.Tanggal_Selesai) + '"></div>' +
        '<div class="field span-all"><label>Hari pelaksanaan <span class="req">*</span></label><div class="hari-pick" id="jf-hari">' +
          HARI.map(h => '<label class="hari-chip"><input type="checkbox" value="' + h + '"' + (hariOn.indexOf(h) > -1 ? ' checked' : '') + '><span>' + h + '</span></label>').join('') +
        '</div><div class="hint" id="jf-hari-t"></div></div>' +
        '<div class="field"><label>Jam mulai <span class="req">*</span></label><input name="Jam_Mulai" type="time" class="input mono" value="' + esc(v0.Jam_Mulai) + '" min="' + JADWAL.JAM_MULAI + '" max="' + JADWAL.JAM_SELESAI + '" step="300"></div>' +
        '<div class="field"><label>Jam selesai <span class="req">*</span></label><input name="Jam_Selesai" type="time" class="input mono" value="' + esc(v0.Jam_Selesai) + '" min="' + JADWAL.JAM_MULAI + '" max="' + JADWAL.JAM_SELESAI + '" step="300"></div>' +
        '<div class="field span-all"><label>Ruang<span class="tag">Opsional</span></label><input name="Ruang" class="input" maxlength="60" placeholder="Contoh: Ruang Teori 02" value="' + esc(v0.Ruang) + '"></div>' +
        '<label class="check span-all tutup-jumat"><input type="checkbox" name="Tutup_Jumat"' + (v0.Tutup_Jumat === 'Ya' ? ' checked' : '') + '><span><b>Penutupan dimajukan ke hari Jumat</b><br><span class="small muted">Gadik dapat mengisi nilai hari Sabtu (hari ke-6) sejak hari Jumat.</span></span></label>' +
        '<div id="jf-clash" class="span-all"></div></form>',
      foot: (isEdit ? '<button class="btn danger-line left" id="jf-del">' + icon('trash') + 'Hapus</button>' : '') + '<button class="btn outline" data-close>Batal</button><button class="btn primary" id="jf-save">' + icon('save') + 'Simpan Jadwal</button>'
    });
    const form = m.$('#jf'), tm = form.querySelector('[name=Tanggal_Mulai]'), ts = form.querySelector('[name=Tanggal_Selesai]');
    let selesaiManual = isEdit && j.Tanggal_Selesai && j.Tanggal_Selesai !== addDays(j.Tanggal_Mulai, JADWAL.HARI_BLOK - 1);
    const hariSel = () => $$('#jf-hari input', form).filter(x => x.checked).map(x => x.value);
    const values = () => {
      const v = formValues(form);
      v.Hari = hariSel(); v.Tutup_Jumat = form.querySelector('[name=Tutup_Jumat]').checked;
      delete v[''];
      return v;
    };
    const check = () => {
      const v = values(); v.ID_Jadwal = isEdit ? j.ID_Jadwal : '';
      const tgl = isTgl(v.Tanggal_Mulai) && isTgl(v.Tanggal_Selesai) && v.Tanggal_Selesai >= v.Tanggal_Mulai ? tanggalJadwal({ Hari: v.Hari.join(','), Tanggal_Mulai: v.Tanggal_Mulai, Tanggal_Selesai: v.Tanggal_Selesai }) : [];
      m.$('#jf-hari-t').innerHTML = tgl.length ? '<b>' + tgl.length + ' hari penilaian</b>: ' + esc(tgl.map(t => hariOf(t).slice(0, 3) + ' ' + Number(t.slice(8))).join(', ')) + (tgl.length !== JADWAL.HARI_BLOK ? ' <span style="color:var(--red)">(standar ' + JADWAL.HARI_BLOK + ' hari)</span>' : '') : 'Pilih tanggal & hari pelaksanaan.';
      const box = m.$('#jf-clash');
      const jm = menit(v.Jam_Mulai), js = menit(v.Jam_Selesai);
      if (!isNaN(jm) && !isNaN(js) && (jm < menit(JADWAL.JAM_MULAI) || js > menit(JADWAL.JAM_SELESAI))) { box.innerHTML = '<div class="alert red">' + icon('alert-circle') + '<div>Pelaksanaan hanya pukul 08.00–17.00 WIT.</div></div>'; return; }
      if (!v.ID_Kelas || !v.ID_Gadik || isNaN(jm) || isNaN(js) || !tgl.length) { box.innerHTML = ''; return; }
      if (js <= jm) { box.innerHTML = '<div class="alert red">' + icon('alert-circle') + '<div>Jam selesai harus setelah jam mulai.</div></div>'; return; }
      const t = clashText(Object.assign({}, v, { Hari: v.Hari.join(',') }));
      box.innerHTML = t.length ? '<div class="alert red">' + icon('alert-triangle') + '<div><b>Peringatan bentrok</b><br>' + t.map(esc).join('<br>') + '</div></div>' : '<div class="alert green">' + icon('check-circle') + '<div>Tidak ada bentrok untuk Gadik dan kelas ini.</div></div>';
    };
    tm.addEventListener('change', () => { if (isTgl(tm.value) && !selesaiManual) ts.value = addDays(tm.value, JADWAL.HARI_BLOK - 1); check(); });
    ts.addEventListener('change', () => { selesaiManual = ts.value !== addDays(tm.value, JADWAL.HARI_BLOK - 1); });
    form.addEventListener('input', check); form.addEventListener('change', check); check();
    form.addEventListener('submit', e => { e.preventDefault(); m.$('#jf-save').click(); });
    if (isEdit) m.$('#jf-del').onclick = async () => { m.close(); remove(j); };
    m.$('#jf-save').onclick = async () => {
      clearErrors(form); m.$('#jf-alert').hidden = true;
      const v = values();
      for (const k of ['ID_Kelas', 'ID_Mapel', 'ID_Gadik', 'Tanggal_Mulai', 'Tanggal_Selesai', 'Jam_Mulai', 'Jam_Selesai']) if (!v[k]) return fieldError(form, k, 'Wajib diisi.');
      if (!v.Hari.length) { const a = m.$('#jf-alert'); a.hidden = false; a.innerHTML = icon('alert-circle') + '<div>Pilih minimal satu hari pelaksanaan.</div>'; return; }
      if (v.Tanggal_Selesai < v.Tanggal_Mulai) return fieldError(form, 'Tanggal_Selesai', 'Harus sama atau setelah tanggal mulai.');
      if (menit(v.Jam_Mulai) < menit(JADWAL.JAM_MULAI)) return fieldError(form, 'Jam_Mulai', 'Paling awal pukul 08.00.');
      if (menit(v.Jam_Selesai) > menit(JADWAL.JAM_SELESAI)) return fieldError(form, 'Jam_Selesai', 'Paling lambat pukul 17.00.');
      if (menit(v.Jam_Selesai) <= menit(v.Jam_Mulai)) return fieldError(form, 'Jam_Selesai', 'Jam selesai harus setelah jam mulai.');
      if (isEdit) v.ID_Jadwal = j.ID_Jadwal;
      const done = busy(m.$('#jf-save'), 'Menyimpan…');
      let res = await api('jadwalSave', v);
      if (!res.success && res.code === 'CONFLICT') {
        done();
        const ok = await confirmBox({ title: 'Jadwal bentrok', icon: 'alert-triangle', danger: true, okText: 'Tetap simpan', html: (res.data.conflicts || []).map(c => esc(c.pesan)).join('<br>') + '<br><br>Simpan tetap? Bentrok akan ditandai merah sampai diselesaikan.' });
        if (!ok) return;
        const d2 = busy(m.$('#jf-save'), 'Menyimpan…');
        res = await api('jadwalSave', Object.assign({ force: true }, v));
        d2();
      } else done();
      if (!res.success) return showServerError(form, res, '#jf-alert');
      S.boot.jadwal = res.data.jadwal; bootChanged();
      m.close();
      st.kelas = v.ID_Kelas; st.wk = senin(v.Tanggal_Mulai);
      render();
      toast(isEdit ? 'Jadwal diperbarui' : 'Jadwal ditambahkan', mapelName(v.ID_Mapel) + ' • ' + rentangJadwal({ Hari: v.Hari.join(','), Tanggal_Mulai: v.Tanggal_Mulai, Tanggal_Selesai: v.Tanggal_Selesai }));
      if (res.data.penugasanBaru) {
        toast('Penugasan ditambahkan otomatis', gadikName(v.ID_Gadik) + ' kini ditugaskan di ' + kelasName(v.ID_Kelas) + ' agar dapat menginput nilai mapel ini.', 'info');
        loadUsers(() => {}, true);
      }
    };
  }

  async function remove(j) {
    if (!j) return;
    const r = await hapusData('jadwal', j.ID_Jadwal, { judul: 'Hapus jadwal mapel?', nama: mapelName(j.ID_Mapel) + ' — ' + kelasName(j.ID_Kelas) + ', ' + rentangJadwal(j), utama: 'Jadwal' });
    if (r) render();
  }

  return {
    show(root) { if (el !== root) { el = root; } else el.removeEventListener('click', onClick); bindDokumen(root); render(); },
    onBoot(root) { el = root; if (!_modals.length) { el.removeEventListener('click', onClick); render(); } }
  };
})();

// ==========================================================================
// REKAP HARIAN — Admin (US-12): lembar penilaian harian per sesi (format PROLAT),
// status sesi + buka kunci, dan Nilai Mental. NIL AKHIR ada di menu Rekap Akhir.
// ==========================================================================
const RekapPage = (() => {
  const st = { kelas: '', pel: '', q: '', tab: 'harian', sesi: '', fStatus: '' };
  let el, err = null;
  const data = () => (S.data.rekap || {})[st.kelas];

  function render() {
    const kel = kelasList();
    if (!kel.some(k => k.ID_Kelas === st.kelas)) { st.kelas = kel[0] ? kel[0].ID_Kelas : ''; st.sesi = ''; }
    el.innerHTML =
      pageHead({
        eyebrow: 'Rekapitulasi // Penilaian Harian & Mental Kepribadian',
        title: 'Rekap Harian',
        desc: 'Lembar penilaian harian setiap sesi (A1–C2 + JUMLAH) yang sudah dikirim Gadik, status sesi, dan Nilai Mental Kepribadian. Sesi draf belum dihitung. NIL AKHIR &amp; peringkat ada di menu <a href="#/rekap-akhir">Rekap Akhir</a>.',
        actions: '<a class="btn outline" id="rk-akhir" href="#/rekap-akhir">' + icon('medal') + 'Rekap Akhir</a><button class="btn outline" id="rk-refresh">' + icon('refresh') + 'Segarkan</button>'
      }) +
      '<div class="card"><div class="toolbar">' +
        '<div class="field"><label for="rk-kelas">Angkatan / kelas</label><select class="select" id="rk-kelas">' + options(kel, 'ID_Kelas', k => k.Nama_Kelas + ' — ' + k.Nama_Angkatan, st.kelas, kel.length ? null : 'Belum ada kelas') + '</select></div>' +
        '<div class="field narrow"><label for="rk-pel">Peleton</label><select class="select" id="rk-pel">' + options(pelOf(st.kelas), 'ID_Peleton', p => p.Nama_Peleton, st.pel, 'Semua') + '</select></div>' +
        '<div class="field search"><label for="rk-q">Cari peserta</label><div class="input-wrap">' + icon('search', 'lead') + '<input class="input with-lead" id="rk-q" placeholder="Nama atau NRP…" value="' + esc(st.q) + '" autocomplete="off"></div></div>' +
      '</div></div>' +
      '<div class="grid c4 keep2 mt-24" id="rk-stats"></div>' +
      '<div class="tabs mt-24" id="rk-tabs" role="tablist"></div>' +
      '<div class="card" id="rk-main"></div>';
    $('#rk-akhir', el).href = '#/rekap-akhir/' + encodeURIComponent(st.kelas);
    $('#rk-kelas', el).onchange = e => { st.kelas = e.target.value; st.pel = ''; st.sesi = ''; render(); load(); };
    $('#rk-pel', el).onchange = e => { st.pel = e.target.value; fill(); };
    $('#rk-q', el).addEventListener('input', debounce(e => { st.q = e.target.value; fill(); }, 250));
    $('#rk-tabs', el).onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { st.tab = b.dataset.tab; fill(); } };
    $('#rk-refresh', el).onclick = () => load(true);
    const main = $('#rk-main', el);
    main.addEventListener('click', e => {
      if (e.target.closest('[data-retry]')) return load(true);
      if (e.target.closest('[data-back]')) { st.sesi = ''; return fill(); }
      const u = e.target.closest('[data-unduh]'); if (u) return ekspor(u.dataset.unduh, u);
      const b = e.target.closest('[data-buka]'); if (b) return unlock(b.dataset.buka);
      const h = e.target.closest('[data-hapus-sesi]'); if (h) return hapusSesi(h.dataset.hapusSesi);
    });
    main.addEventListener('change', e => { if (e.target.id === 'rk-sesi-st') { st.fStatus = e.target.value; fill(); } });
    fill();
  }

  function pesertaKelas() {
    const q = norm(st.q);
    return urutNama(S.boot.peserta.filter(p => p.ID_Kelas === st.kelas)).map((p, i) => ({ p, no: i + 1 }))
      .filter(r => (!st.pel || r.p.ID_Peleton === st.pel) && (!q || norm(r.p.Nama_Lengkap).indexOf(q) > -1 || String(r.p.NRP).indexOf(q) > -1));
  }

  function fill() {
    const host = $('#rk-main', el), d = data();
    const units = d ? hariPenilaian(d.sesi) : [], labelOf = d ? labelHariMapel(d.sesi) : {};
    const nSesi = d ? d.sesi.length : 0, nDraf = d ? d.sesi.filter(s => s.Status !== 'Selesai').length : 0;
    $('#rk-tabs', el).innerHTML = [['harian', 'Penilaian Harian', 'calendar'], ['mental', 'Nilai Mental', 'shield-star']].map(t =>
      '<button role="tab" data-tab="' + t[0] + '" class="' + (st.tab === t[0] ? 'on' : '') + '" aria-selected="' + (st.tab === t[0]) + '">' + icon(t[2], 'sm') + t[1] + (t[0] === 'harian' && d ? '<span class="count">' + nSesi + '</span>' : '') + '</button>').join('');
    if (!st.kelas) { host.innerHTML = emptyState('building', 'Belum ada kelas', 'Tambahkan angkatan & kelas di Master Data.'); $('#rk-stats', el).innerHTML = ''; return; }
    if (!d) { host.innerHTML = err ? errorState(err) : skeletonRows(8, 6); $('#rk-stats', el).innerHTML = ''; return; }
    const ment = Object.keys(d.mental || {}).map(k => d.mental[k][0]).filter(v => v !== '' && v != null);
    $('#rk-stats', el).innerHTML =
      stat({ label: 'Hari Dinilai', value: units.length, unit: 'hari', icon: 'calendar', cap: 'Sesi yang sudah masuk rekap' }) +
      stat({ label: 'Sesi Masih Draf', value: nDraf, unit: 'sesi', icon: 'clock', tone: nDraf ? 'red' : '', cap: nDraf ? 'Belum dikirim Gadik — tidak dihitung' : 'Semua sesi sudah dikirim' }) +
      stat({ label: 'Peserta', value: pesertaCount(st.kelas), unit: 'orang', icon: 'users', cap: esc(kelasName(st.kelas, true)) }) +
      stat({ label: 'Rata-rata Nilai Mental', value: ment.length ? fmt.num(avg(ment), 2) : '—', unit: ment.length ? '/ 100' : '', icon: 'shield-star', cap: ment.length + ' peserta dinilai pengasuh' });

    const main = host;
    if (st.tab === 'mental') return mentalTable(main, d);
    const s = st.sesi && d.sesi.find(x => x.ID_Sesi === st.sesi);
    if (s) return lembar(main, d, s, labelOf[s.ID_Sesi]);
    st.sesi = '';
    sesiList(main, d, labelOf);
  }

  function sesiList(main, d, labelOf) {
    const total = pesertaCount(st.kelas);
    main.innerHTML = '<div class="toolbar" style="border-bottom:1px solid var(--border)"><div class="field narrow"><label for="rk-sesi-st">Status</label><select class="select" id="rk-sesi-st"><option value="">Semua</option><option value="Selesai"' + (st.fStatus === 'Selesai' ? ' selected' : '') + '>Masuk rekap</option><option value="Draf"' + (st.fStatus === 'Draf' ? ' selected' : '') + '>Draf</option></select></div>' +
      '<p class="small muted grow" style="align-self:center;margin:0">Klik sesi yang sudah masuk rekap untuk melihat lembar penilaiannya (bisa diunduh PDF/Excel). <b>Buka kunci</b> bila Gadik perlu mengoreksi; <b>Hapus</b> menghapus sesi beserta semua nilainya.</p></div><div id="rk-list"></div>';
    const list = d.sesi.filter(s => !st.fStatus || (st.fStatus === 'Selesai' ? s.Status === 'Selesai' : s.Status !== 'Selesai')).slice().reverse();
    new Table($('#rk-list', main), {
      key: 'ID_Sesi', unit: 'sesi', pageSize: 25, sort: { key: 'Tanggal', dir: 'desc' },
      columns: [
        { key: 'hari', label: 'Hari ke', sort: s => labelOf[s.ID_Sesi] || '', render: s => labelOf[s.ID_Sesi] ? '<b class="nowrap">' + esc(labelOf[s.ID_Sesi]) + '</b>' : '<span class="faint">—</span>' },
        { key: 'Tanggal', label: 'Tanggal', sort: s => s.Tanggal + (s.Jam || ''), render: s => '<b class="nowrap">' + esc(fmt.tgl(s.Tanggal, { short: true })) + '</b><div class="small muted">' + esc(hariOf(s.Tanggal)) + ' ' + esc(s.Tanggal.slice(0, 4)) + '</div>' },
        { key: 'mapel', label: 'Mata Pelajaran', cls: 'card-title', sort: s => mapelName(s.ID_Mapel), render: s => '<div class="t-name"><b>' + esc(mapelName(s.ID_Mapel)) + '</b><small>' + (s.Impor ? 'Hasil impor' : esc(fmt.jam(s.Jam || '')) + (s.Jam ? ' WIT' : '')) + '</small></div>' },
        { key: 'gadik', label: 'Gadik', sort: s => gadikName(s.ID_Gadik), render: s => s.ID_Gadik ? esc(gadikName(s.ID_Gadik)) : '<span class="faint">—</span>' },
        { key: 'Jumlah', label: 'Dinilai', num: true, render: s => '<span class="mono">' + (s.Jumlah || 0) + '/' + total + '</span>' },
        { key: 'Status', label: 'Status', render: s => (s.Status === 'Selesai' ? '<span class="badge ok">Masuk rekap</span>' : '<span class="badge draft">Draf</span>') + (s.Catatan_Admin ? '<div class="small muted mt-8" title="Catatan Admin">' + icon('unlock', 'sm') + ' ' + esc(s.Catatan_Admin) + '</div>' : '') },
        { key: 'Waktu_Selesai', label: 'Dikirim', render: s => s.Status === 'Selesai' && s.Waktu_Selesai ? '<span class="small nowrap">' + esc(fmt.dateTime(s.Waktu_Selesai)) + '</span>' + (s.Diselesaikan_Oleh ? '<div class="small muted">' + esc(s.Diselesaikan_Oleh) + '</div>' : '') : '<span class="faint">—</span>' },
        { key: 'acts', label: 'Aksi', sort: false, cls: 'acts-cell', render: s => '<div class="acts">' + (s.Status === 'Selesai'
          ? '<button class="btn outline xs" data-act="lihat">' + icon('eye', 'sm') + 'Lembar</button>' + (s.Impor ? '' : '<button class="btn icon" data-buka="' + esc(s.ID_Sesi) + '" title="Buka kunci (Gadik dapat mengoreksi)" aria-label="Buka kunci">' + icon('unlock') + '</button>')
          : '') + '<button class="btn icon red" data-act="del" title="Hapus sesi beserta nilainya">' + icon('trash') + '</button></div>' }
      ],
      onAction: (act, id) => { if (act === 'lihat') { st.sesi = id; fill(); } if (act === 'del') hapusSesi(id); },
      onRow: id => { const s = d.sesi.find(x => x.ID_Sesi === id); if (s && s.Status === 'Selesai') { st.sesi = id; fill(); } },
      empty: () => emptyState('clipboard-check', st.fStatus ? 'Tidak ada sesi dengan status ini' : 'Belum ada sesi penilaian', 'Sesi muncul setelah Gadik mulai menginput nilai harian di kelas ini.')
    }).set(list);
  }

  function lembar(main, d, s, label) {
    const rows = pesertaKelas().map(r => ({ p: r.p, no: r.no, v: ((d.nilai || {})[s.ID_Sesi] || {})[r.p.ID_Peserta] || KOSONG() }));
    main.innerHTML = '<div class="card-head"><button type="button" class="btn icon" data-back aria-label="Kembali ke daftar sesi" title="Kembali">' + icon('arrow-left') + '</button>' +
      '<div class="grow"><h3>' + esc((label ? label + ' — ' : '') + mapelName(s.ID_Mapel)) + '</h3><div class="sub">' + esc(tglPanjang(s.Tanggal, true)) + (s.Jam ? ' • ' + esc(fmt.jam(s.Jam)) + ' WIT' : '') + (s.ID_Gadik ? ' • ' + esc(gadikName(s.ID_Gadik)) : '') +
        (s.Waktu_Selesai ? ' • dikirim ' + esc(fmt.dateTime(s.Waktu_Selesai)) : '') + '</div></div>' + tombolUnduh() +
      (s.Impor ? '' : '<button type="button" class="btn outline sm" data-buka="' + esc(s.ID_Sesi) + '">' + icon('unlock', 'sm') + 'Buka kunci</button>') +
      '<button type="button" class="btn danger-line sm" data-hapus-sesi="' + esc(s.ID_Sesi) + '">' + icon('trash', 'sm') + 'Hapus</button></div>' +
      lembarLegend() + '<div class="sheet-wrap">' + (rows.length ? lembarTabel(rows, {}) : emptyState('search', 'Tidak ada peserta', 'Tidak ada peserta yang cocok dengan filter.')) + '</div>';
  }

  function mentalTable(main, d) {
    main.innerHTML = '<div id="rk-mental"></div>';
    const rows = pesertaKelas().map(r => {
      const mt = d.mental[r.p.ID_Peserta];
      return { ID_Peserta: r.p.ID_Peserta, no: r.no, NRP: r.p.NRP, Nama: r.p.Nama_Lengkap, Pel: pelName(r.p.ID_Peleton), mental: mt && mt[0] !== '' && mt[0] != null ? Number(mt[0]) : '', catatan: mt ? mt[1] : '', mBy: mt ? mt[3] : '', mAt: mt ? mt[2] : '' };
    });
    new Table($('#rk-mental', main), {
      key: 'ID_Peserta', unit: 'peserta', pageSize: 25, sort: { key: 'no', dir: 'asc' },
      columns: [
        { key: 'no', label: 'No', cls: 'no', render: r => pad2(r.no) },
        { key: 'Nama', label: 'Peserta', cls: 'card-title', render: r => '<div class="t-name"><b>' + esc(r.Nama) + '</b><small><span class="mono">' + esc(r.NRP) + '</span> • ' + esc(r.Pel) + '</small></div>' },
        { key: 'mental', label: 'Skor Mental', num: true, render: r => r.mental === '' ? '<span class="badge empty">Belum dinilai</span>' : '<b>' + fmt.num(r.mental, 2) + '</b>' },
        { key: 'catatan', label: 'Catatan Pembinaan', cls: 'wide', render: r => r.catatan ? esc(r.catatan) : '<span class="faint">—</span>' },
        { key: 'mBy', label: 'Diinput oleh', render: r => r.mBy ? esc(d.names[r.mBy] || r.mBy) : '<span class="faint">—</span>' },
        { key: 'mAt', label: 'Waktu', render: r => r.mAt ? '<span class="small">' + esc(fmt.dateTime(r.mAt)) + '</span>' : '<span class="faint">—</span>' },
        { key: 'acts', label: 'Aksi', sort: false, cls: 'acts-cell', render: r => r.mental === '' && !r.catatan ? '<span class="faint">—</span>' : '<div class="acts"><button class="btn icon red" data-act="del" title="Hapus nilai mental">' + icon('trash') + '</button></div>' }
      ],
      onAction: async (act, id) => {
        if (act !== 'del') return;
        const p = R().peserta[id];
        const r = await hapusData('mental', id, { judul: 'Hapus nilai mental?', nama: 'Nilai mental ' + (p ? p.Nama_Lengkap : id), utama: 'Nilai_Mental' });
        if (r) load(true);
      },
      empty: () => emptyState('search', 'Tidak ada peserta', '')
    }).set(rows);
  }

  function ekspor(kind, btn) {
    const d = data(), s = d && d.sesi.find(x => x.ID_Sesi === st.sesi);
    if (!s) return;
    const label = labelHariMapel(d.sesi)[s.ID_Sesi] || '';
    const all = urutNama(S.boot.peserta.filter(p => p.ID_Kelas === st.kelas)), v = (d.nilai || {})[s.ID_Sesi] || {};
    const out = {
      judul: 'PENILAIAN HARIAN PESERTA PELATIHAN', instansi: String(CFG.INSTANSI || 'SPN Polda Papua Barat').toUpperCase(),
      ringkas: kelasName(st.kelas) + ' • ' + label + ' • ' + fmt.tgl(s.Tanggal),
      info: [['Kelas', kelasName(st.kelas, true)], ['Mata Pelajaran', mapelName(s.ID_Mapel)], ['Hari / Tanggal', tglPanjang(s.Tanggal, true) + (label ? ' (' + label + ')' : '')], ['Gadik', s.ID_Gadik ? gadikName(s.ID_Gadik) : '—']],
      format: PENILAIAN, sheet: label || 'PENILAIAN HARIAN', ttd: ttdGadik(s.ID_Gadik, s.Tanggal),
      peserta: all.map(p => ({ nama: p.Nama_Lengkap, pn: pangkatNrp(p) })), nilai: all.map(p => v[p.ID_Peserta] || KOSONG())
    };
    unduhBerkas(kind === 'pdf' ? 'hariPdf' : 'hariXlsx', out, namaBerkas(['Penilaian-Harian', kelasName(st.kelas), label, mapelName(s.ID_Mapel), s.Tanggal], kind === 'pdf' ? 'pdf' : 'xlsx'), btn);
  }

  /** Hapus satu sesi penilaian harian beserta seluruh nilainya. */
  async function hapusSesi(id) {
    const d = data(), s = d && d.sesi.find(x => x.ID_Sesi === id);
    if (!s) return;
    const label = labelHariMapel(d.sesi)[id];
    const r = await hapusData('sesi', id, { judul: 'Hapus sesi penilaian?', nama: (label ? label + ' — ' : '') + mapelName(s.ID_Mapel) + ', ' + fmt.tgl(s.Tanggal, { hari: true }), utama: 'Sesi_Nilai', extra: { idKelas: st.kelas } });
    if (!r) return;
    st.sesi = '';
    fill();
    load(true);
  }

  /** Admin membuka kunci sesi agar Gadik dapat mengoreksi nilai. */
  function unlock(id) {
    const d = data(), s = d && d.sesi.find(x => x.ID_Sesi === id);
    if (!s) return;
    const m = openModal({
      title: 'Buka kunci nilai sesi?', icon: 'unlock', size: 'narrow', sub: mapelName(s.ID_Mapel) + ' • ' + fmt.tgl(s.Tanggal, { hari: true }),
      body: '<form id="bk" novalidate style="display:flex;flex-direction:column;gap:14px">' +
        '<p style="font-size:14.5px;line-height:1.6">Nilai sesi ini akan <b>dikeluarkan dari rekap</b> dan dapat dikoreksi kembali oleh <b>' + esc(gadikName(s.ID_Gadik)) + '</b>. Nilai dihitung lagi setelah Gadik menekan <b>Selesai &amp; Kirim ke Rekap</b>.</p>' +
        '<div class="field"><label for="bk-alasan">Alasan dibuka <span class="req">*</span><span class="tag">Tampil ke Gadik</span></label><textarea id="bk-alasan" name="alasan" class="textarea" maxlength="200" placeholder="Contoh: Koreksi nilai salah input"></textarea></div>' +
        '<div id="bk-alert" class="alert red" hidden></div></form>',
      foot: '<button class="btn outline" data-close>Batal</button><button class="btn primary" id="bk-ok">' + icon('unlock') + 'Buka Kunci</button>'
    });
    const form = m.$('#bk');
    form.addEventListener('submit', e => { e.preventDefault(); m.$('#bk-ok').click(); });
    m.$('#bk-ok').onclick = async () => {
      clearErrors(form); m.$('#bk-alert').hidden = true;
      const alasan = m.$('#bk-alasan').value.trim();
      if (!alasan) return fieldError(form, 'alasan', 'Tuliskan alasan singkat agar tercatat.');
      const done = busy(m.$('#bk-ok'), 'Membuka…');
      const res = await api('nilaiBuka', { ID_Sesi: id, alasan });
      done();
      if (!res.success) return showServerError(form, res, '#bk-alert');
      S.data.rekap = S.data.rekap || {};
      S.data.rekap[res.data.idKelas] = res.data;
      cachePut('rekap:' + res.data.idKelas, res.data);
      const info = res.data.sesi.find(x => x.ID_Sesi === id);
      if (info) sesiStatUpdate(info);
      m.close();
      st.sesi = '';
      fill();
      toast('Kunci dibuka', 'Gadik dapat mengoreksi nilai ' + mapelName(s.ID_Mapel) + ' tanggal ' + fmt.tgl(s.Tanggal) + '.');
    };
  }

  function load(force) {
    err = null;
    if (!st.kelas) return;
    const kelas = st.kelas;
    S.data.rekap = S.data.rekap || {};
    swr('rekap:' + kelas, 'rekap', { idKelas: kelas }, d => { S.data.rekap[kelas] = d; if (st.kelas === kelas && el && !el.hidden && !_modals.length) fill(); },
      { valid: rekapValid, fresh: force ? 0 : 5000, force, onError: res => { err = res.message; if (st.kelas === kelas) fill(); } });
  }

  return {
    title: 'Rekap Harian', roles: ['Admin'],
    show(root) { el = root; render(); load(false); },
    onBoot() { if (el && !_modals.length) render(); }
  };
})();
page('rekap', RekapPage);

// ==========================================================================
// MIGRASI DATABASE — Admin (gas-migrasi-database)
// ==========================================================================
const MigrasiPage = (() => {
  const GROUPS = [
    ['Master', [['Angkatan_Kelas', 'Angkatan & Kelas'], ['Peleton', 'Peleton'], ['Mata_Pelajaran', 'Mata Pelajaran']]],
    ['Akun & Personel', [['Users', 'Akun (Users)'], ['Data_Gadik', 'Data Gadik'], ['Data_Pengasuh', 'Data Pengasuh'], ['Penugasan', 'Penugasan']]],
    ['Akademik', [['Peserta_Didik', 'Peserta Pelatihan'], ['Jadwal', 'Jadwal'], ['Sesi_Nilai', 'Sesi Penilaian'], ['Nilai', 'Nilai Harian'], ['Nilai_Mental', 'Nilai Mental']]]
  ];
  const LABEL = {}; GROUPS.forEach(g => g[1].forEach(x => { LABEL[x[0]] = x[1]; }));
  const st = { source: '', sheets: null, overwrite: false, last: null };
  let el;

  function render() {
    if (!st.sheets) st.sheets = Object.keys(LABEL);
    el.innerHTML =
      pageHead({
        eyebrow: 'Sistem // Migrasi Database',
        title: 'Migrasi Data dari Spreadsheet Lama',
        desc: 'Pindahkan data pelatihan dari database SIPL lama atau spreadsheet buatan sendiri ke database ini. Aman diulang: data yang sudah ada tidak dibuat ganda.'
      }) +
      '<div class="notice"><div class="icon-tile">' + icon('shield-check') + '</div><div><b>Spreadsheet sumber hanya DIBACA</b><p>Sumber tidak pernah diubah. Jalankan <b>Pindai</b> dulu untuk melihat hasilnya tanpa menulis apa pun. Akun Google pemilik Apps Script harus punya akses baca ke spreadsheet sumber. Jalankan import saat aplikasi sedang sepi.</p></div></div>' +
      '<div class="grid c2" style="align-items:start">' +
        '<div class="card"><div class="card-head"><div class="num-badge" style="width:30px;height:30px;border-radius:8px;background:var(--gold);display:grid;place-items:center;font:700 13px var(--mono)">01</div><div class="grow"><h3>Sumber data</h3><div class="sub">URL atau ID Google Sheets</div></div></div><div class="card-body">' +
          '<div class="field"><label for="mg-src">URL / ID spreadsheet lama <span class="req">*</span></label><div class="input-wrap">' + icon('link', 'lead') + '<input id="mg-src" class="input with-lead mono" placeholder="https://docs.google.com/spreadsheets/d/…" value="' + esc(st.source) + '" autocomplete="off"></div><div class="hint">Excel? Unggah ke Google Drive lalu buka dengan Google Sheets, kemudian salin URL-nya.</div></div>' +
          '<label class="check mt-16"><input type="checkbox" id="mg-over"' + (st.overwrite ? ' checked' : '') + '><span><b>Timpa data master yang sudah ada</b><br><span class="small muted">Nama kelas/peleton/mapel, data personel, dan data peserta yang sudah ada diperbarui dari sumber. Status akun, password, dan akun Admin tidak pernah ditimpa. Nilai hanya diperbarui bila waktu input di sumber lebih baru.</span></span></label>' +
        '</div></div>' +
        '<div class="card"><div class="card-head"><div class="num-badge" style="width:30px;height:30px;border-radius:8px;background:var(--gold);display:grid;place-items:center;font:700 13px var(--mono)">02</div><div class="grow"><h3>Data yang diimpor</h3><div class="sub">Diproses berurutan: master → akun → akademik</div></div><button class="btn ghost sm" id="mg-all">Pilih semua</button></div><div class="card-body">' +
          GROUPS.map(g => '<div class="label-mono" style="margin:4px 0 8px">' + g[0] + '</div><div class="grid c2" style="gap:8px;margin-bottom:12px">' + g[1].map(x => '<label class="check"><input type="checkbox" data-sheet="' + x[0] + '"' + (st.sheets.indexOf(x[0]) > -1 ? ' checked' : '') + '><span>' + x[1] + '</span></label>').join('') + '</div>').join('') +
        '</div></div>' +
      '</div>' +
      '<div class="sticky-bar"><span class="grow small muted">' + icon('info', 'sm') + ' Langkah: <b>Pindai</b> → periksa hasil → <b>Jalankan Import</b>. Ulangi import sesaat sebelum pindah untuk menangkap data terbaru (delta).</span>' +
        '<button class="btn outline" id="mg-scan">' + icon('scan') + 'Pindai (Dry-run)</button><button class="btn primary" id="mg-run">' + icon('import') + 'Jalankan Import</button></div>' +
      '<div id="mg-result" class="mt-24">' + (st.last ? resultHtml(st.last) : '') + '</div>' +
      '<div class="grid c2 mt-24" style="align-items:start">' +
        '<div class="card"><div class="card-head"><div class="icon-tile">' + icon('clipboard-check') + '</div><div class="grow"><h3>Checklist pindah ke aplikasi baru</h3></div></div><div class="card-body"><ol style="margin:0;padding-left:20px;line-height:1.9">' +
          '<li>Isi Master Data dasar bila sumber tidak memilikinya, lalu <b>Pindai</b>.</li><li>Periksa tabel hasil & peringatan, lalu <b>Jalankan Import</b>.</li>' +
          '<li>Cek Personel, Peserta Pelatihan, Jadwal, dan Rekap. Uji login dengan 1 akun Gadik.</li><li>Tepat sebelum beralih, <b>jalankan import sekali lagi</b> (delta) agar data terakhir ikut.</li>' +
          '<li>Umumkan alamat aplikasi baru. Akun hasil import tanpa password perlu <b>Reset Password</b>.</li></ol></div></div>' +
        '<div class="card"><div class="card-head"><div class="icon-tile">' + icon('file-sheet') + '</div><div class="grow"><h3>Format spreadsheet yang dikenali</h3></div></div><div class="card-body small" style="line-height:1.7">' +
          '<p>Nama sheet & kolom dicocokkan berdasarkan <b>nama</b>, tidak peduli urutan. Contoh yang dikenali:</p>' +
          '<ul style="padding-left:18px;margin:8px 0">' +
            '<li><b>Peserta / Siswa</b>: NRP, Nama, Pangkat, Kelas, Peleton</li>' +
            '<li><b>Kelas</b>: Angkatan / Gelombang, Kelas</li>' +
            '<li><b>Mapel</b>: Mata Pelajaran, Bobot/JP</li>' +
            '<li><b>Nilai Harian</b>: NRP, Mapel, A1 A2 A3 B1 B2 C1 C2 (0–10) — atau satu kolom Nilai (0–100) — dan Tanggal (opsional)</li>' +
            '<li><b>Nilai Mental</b>: NRP, Nilai, Catatan</li>' +
            '<li>Database SIPL lain: semua sheet & kolom asli.</li></ul>' +
          '<p class="muted">Kelas/peleton/mapel boleh ditulis dengan nama; dicocokkan ke data yang sudah ada. NRP yang kehilangan angka 0 di depan dipulihkan ke 8 digit. Nilai hasil import langsung dihitung di rekap.</p></div></div>' +
      '</div>';
    $('#mg-src', el).addEventListener('input', e => { st.source = e.target.value.trim(); });
    $('#mg-over', el).onchange = e => { st.overwrite = e.target.checked; };
    $$('[data-sheet]', el).forEach(c => { c.onchange = () => { st.sheets = $$('[data-sheet]', el).filter(x => x.checked).map(x => x.dataset.sheet); }; });
    $('#mg-all', el).onclick = () => { $$('[data-sheet]', el).forEach(x => { x.checked = true; }); st.sheets = Object.keys(LABEL); };
    $('#mg-scan', el).onclick = () => run(true);
    $('#mg-run', el).onclick = () => run(false);
  }

  function resultHtml(r) {
    const d = r.data, rows = d.order.map(k => d.report[k]);
    const sum = f => rows.reduce((s, x) => s + (x[f] || 0), 0);
    return '<div class="card"><div class="card-head"><div class="icon-tile' + (d.dryRun ? '' : ' gold') + '">' + icon(d.dryRun ? 'scan' : 'check-circle') + '</div><div class="grow"><h3>' + (d.dryRun ? 'Hasil pindai (belum ada yang ditulis)' : 'Import selesai') + '</h3><div class="sub">Sumber: <b>' + esc(d.source.name) + '</b> • ' + esc(fmt.dateTime(r.at)) + (d.overwrite ? ' • mode timpa' : '') + '</div></div>' +
      '<span class="chip">' + sum('inserted') + ' ditambah</span><span class="chip line">' + sum('updated') + ' diperbarui</span></div>' +
      '<div class="table-wrap"><table class="dt cards result-table"><thead><tr><th>Data</th><th>Sheet sumber</th><th class="num">Di sumber</th><th class="num">Ditambah</th><th class="num">Diperbarui</th><th class="num">Dilewati</th></tr></thead><tbody>' +
      d.order.map(k => { const x = d.report[k]; return '<tr><td data-label="Data" class="card-title"><b>' + esc(LABEL[k] || k) + '</b></td><td data-label="Sheet sumber">' + (x.sheet ? '<span class="mono small">' + esc(x.sheet) + '</span>' : '<span class="badge off">Tidak ditemukan</span>') + '</td><td data-label="Di sumber" class="num">' + (x.source == null ? '—' : x.source) + '</td><td data-label="Ditambah" class="num"><b style="color:var(--green)">' + x.inserted + '</b></td><td data-label="Diperbarui" class="num">' + x.updated + '</td><td data-label="Dilewati" class="num faint">' + x.skipped + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      (d.warnings.length ? '<div class="card-body"><div class="alert gold">' + icon('alert-triangle') + '<div><b>Peringatan</b><ul style="margin:6px 0 0;padding-left:18px">' + d.warnings.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div></div></div>' : '') +
      (d.dryRun ? '<div class="card-foot small">Bila hasil sudah sesuai, klik <b>Jalankan Import</b>. Sheet di sumber: ' + esc(d.sourceSheets.join(', ')) + '</div>' : '') + '</div>';
  }

  async function run(dry) {
    if (!st.source) { toast('Sumber kosong', 'Tempel URL atau ID spreadsheet lama.', 'warning'); $('#mg-src', el).focus(); return; }
    if (!st.sheets.length) return toast('Belum ada data dipilih', 'Centang minimal satu jenis data.', 'warning');
    if (!dry && !(await confirmBox({ title: 'Jalankan import?', icon: 'import', okText: 'Jalankan Import', html: 'Data dari <b>' + esc(st.source.slice(0, 60)) + (st.source.length > 60 ? '…' : '') + '</b> akan ditulis ke database SIPL. Proses bisa memakan waktu hingga beberapa menit. Spreadsheet sumber tidak diubah.' }))) return;
    const btn = $(dry ? '#mg-scan' : '#mg-run', el), done = busy(btn, dry ? 'Memindai…' : 'Mengimpor…');
    const res = await api(dry ? 'importScan' : 'importRun', { source: st.source, sheets: st.sheets, overwrite: st.overwrite }, { tries: dry ? 1 : 2, timeout: 330000 });
    done();
    if (!res.success) { toast(dry ? 'Pindai gagal' : 'Import gagal', res.message, 'error'); return; }
    st.last = { data: res.data, at: new Date().toISOString() };
    $('#mg-result', el).innerHTML = resultHtml(st.last);
    hydrateIcons($('#mg-result', el));
    $('#mg-result', el).scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!dry) {
      toast('Import selesai', 'Memuat ulang data aplikasi…');
      Store.dropUser(S.uid);
      const b = await api('bootstrap', {});
      if (b.success) { S.boot = b.data; bootChanged(); }
      S.data = {};
    }
  }

  return { title: 'Migrasi Data', roles: ['Admin'], show(root) { el = root; render(); } };
})();
page('migrasi', MigrasiPage);

window.ADMIN_READY = true;
