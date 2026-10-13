/* ==========================================================================
   SIPL — Ekspor Excel (.xlsx) & PDF, tanpa pustaka luar (± 20 KB).
   Dimuat hanya saat tombol "Unduh" pertama kali ditekan.
   - XLSX: lembar HARI & NIL AKHIR sesuai format PENILAIAN PROLAT, lengkap dengan RUMUS
     (=SUM, RANK, COUNTIF), sel gabungan, garis tabel, dan pengaturan cetak A4.
   - PDF : tabel A4 potrait dengan huruf Helvetica bawaan PDF, kepala tabel diulang tiap halaman,
           kolom tanda tangan Gadik pengampu di kanan bawah.
   ========================================================================== */
(function () {
  'use strict';
  const enc = new TextEncoder();
  const BULAN_P = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI_N = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  function hariDari(t) { const p = String(t).split('-').map(Number); return HARI_N[(new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() + 6) % 7]; }
  function tglPanjang(t, withHari) {
    const p = String(t || '').split('-');
    if (p.length !== 3) return String(t || '');
    return (withHari ? hariDari(t) + ', ' : '') + Number(p[2]) + ' ' + BULAN_P[Number(p[1]) - 1] + ' ' + p[0];
  }
  function angka(v, dec) {
    if (v === '' || v == null || !isFinite(Number(v))) return '';
    return Number(v).toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function skorTeks(v) { return v === '' || v == null ? '' : String(v).replace('.', ','); }
  function round(v, d) { const f = Math.pow(10, d); return Math.round(v * f) / f; }

  // ==========================================================================
  // ZIP (metode simpan) — wadah berkas .xlsx
  // ==========================================================================
  const CRC_T = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    const parts = [], central = [];
    let offset = 0;
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce(function (s, p) { return s + p.length; }, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ==========================================================================
  // XLSX
  // ==========================================================================
  const X = { def: 0, title: 1, sub: 2, th: 3, td: 4, tdc: 5, num: 6, numb: 7, label: 8, note: 9, tdb: 10, ttd: 11, ttdNama: 12, kop: 13, kopAkhir: 14,
    thB: 15, tdTxt: 16, tdNo: 17, judulL: 18, wrap: 19, pilih: 20, pilihH: 21 };
  const xesc = function (s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };
  function colName(n) { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function ref(c, r) { return colName(c) + (r + 1); }
  function sheetRef(name) { return "'" + String(name).replace(/'/g, "''") + "'"; }

  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="8"><font><sz val="11"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="11"/><name val="Arial"/><family val="2"/></font>' +
    '<font><b/><sz val="14"/><name val="Arial"/><family val="2"/></font><font><i/><sz val="9"/><color rgb="FF555555"/><name val="Arial"/><family val="2"/></font><font><b/><u/><sz val="11"/><name val="Arial"/><family val="2"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="12"/><color rgb="FF5C1414"/><name val="Arial"/><family val="2"/></font><font><sz val="10"/><color rgb="FF444444"/><name val="Arial"/><family val="2"/></font></fonts>' +
    '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF3E7C4"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF5C1414"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFBF5E3"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="22">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="2" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="7" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function cellXml(c, R) {
    const o = c !== null && typeof c === 'object' ? c : { v: c };
    const s = o.s ? ' s="' + o.s + '"' : '';
    if (o.f) {
      const num = typeof o.v === 'number' && isFinite(o.v);
      const v = o.v === undefined || o.v === '' || o.v === null ? '' : '<v>' + xesc(num ? String(o.v) : o.v) + '</v>';
      return '<c r="' + R + '"' + s + (num || !v ? '' : ' t="str"') + '><f>' + xesc(o.f) + '</f>' + v + '</c>';
    }
    if (typeof o.v === 'number' && isFinite(o.v)) return '<c r="' + R + '"' + s + '><v>' + o.v + '</v></c>';
    if (o.v === '' || o.v === null || o.v === undefined) return '<c r="' + R + '"' + s + '/>';
    return '<c r="' + R + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + xesc(o.v) + '</t></is></c>';
  }

  function sheetXml(sh) {
    let maxC = 0;
    const body = sh.rows.map(function (row, r) {
      if (!row) return '';
      let cells = '';
      row.forEach(function (c, ci) { if (c === undefined) return; cells += cellXml(c, ref(ci, r)); if (ci > maxC) maxC = ci; });
      const ht = sh.heights && sh.heights[r];
      return '<row r="' + (r + 1) + '"' + (ht ? ' ht="' + ht + '" customHeight="1"' : '') + '>' + cells + '</row>';
    }).join('');
    const last = ref(Math.max(maxC, (sh.cols || []).length - 1), Math.max(0, sh.rows.length - 1));
    const pane = sh.freeze ? '<pane ySplit="' + sh.freeze + '" topLeftCell="' + ref(0, sh.freeze) + '" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="' + ref(3, sh.freeze) + '" sqref="' + ref(3, sh.freeze) + '"/>' : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:' + last + '"/>' +
      '<sheetViews><sheetView workbookViewId="0"' + (sh.active ? ' tabSelected="1"' : '') + '>' + pane + '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      (sh.cols && sh.cols.length ? '<cols>' + sh.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' : '') +
      '<sheetData>' + body + '</sheetData>' +
      (sh.merges && sh.merges.length ? '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>' : '') +
      (sh.validations && sh.validations.length ? '<dataValidations count="' + sh.validations.length + '">' + sh.validations.map(function (v) {
        if (v.type === 'decimal') {
          return '<dataValidation type="decimal" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1"' + (v.prompt ? ' promptTitle="' + xesc(v.prompt[0]) + '" prompt="' + xesc(v.prompt[1]) + '"' : '') +
            ' errorTitle="Nilai tidak valid" error="' + xesc(v.error || 'Isi angka.') + '" sqref="' + v.sqref + '"><formula1>' + v.min + '</formula1><formula2>' + v.max + '</formula2></dataValidation>';
        }
        return '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="' + (v.strict ? 1 : 0) + '"' + (v.prompt ? ' promptTitle="' + xesc(v.prompt[0]) + '" prompt="' + xesc(v.prompt[1]) + '"' : '') +
          (v.strict ? ' errorTitle="Pilihan tidak dikenal" error="' + xesc(v.error || 'Pilih dari daftar.') + '"' : '') + ' sqref="' + v.sqref + '"><formula1>' + xesc(v.formula) + '</formula1></dataValidation>';
      }).join('') + '</dataValidations>' : '') +
      '<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="' + (sh.landscape ? 'landscape' : 'portrait') + '" fitToWidth="1" fitToHeight="0"/>' +
      '</worksheet>';
  }

  /** sheets: [{ name, cols:[lebar], rows:[[sel]], merges:['A1:B1'], freeze, landscape }] → Blob .xlsx */
  function xlsx(sheets) {
    const files = [];
    const names = sheets.map(function (s, i) { return String(s.name || ('Sheet' + (i + 1))).replace(/[\[\]:*?\/\\]/g, '-').slice(0, 31); });
    files.push({
      name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'
    });
    files.push({
      name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'
    });
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    files.push({
      name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>SIPL</dc:title><dc:creator>SIPL</dc:creator>' +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>'
    });
    files.push({
      name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>SIPL</Application></Properties>'
    });
    files.push({
      name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView activeTab="' + Math.max(0, sheets.findIndex(function (s) { return s.active; })) + '"/></bookViews><sheets>' +
        names.map(function (n, i) { return '<sheet name="' + xesc(n) + '" sheetId="' + (i + 1) + '"' + (sheets[i].hidden ? ' state="hidden"' : '') + ' r:id="rId' + (i + 1) + '"/>'; }).join('') +
        '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>'
    });
    files.push({
      name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
    });
    files.push({ name: 'xl/styles.xml', data: STYLES });
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s) }); });
    return zip(files);
  }

  // ==========================================================================
  // PDF (Helvetica bawaan, WinAnsi)
  // ==========================================================================
  const W_H = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,500,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
  const W_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,556,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];
  const SPECIAL = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F, 0x2212: 0x2D, 0x00D7: 0xD7 };
  function win(s) {
    let out = '';
    for (const ch of String(s == null ? '' : s)) {
      const cp = ch.codePointAt(0);
      let b = cp < 128 ? cp : (cp >= 160 && cp <= 255 ? cp : (SPECIAL[cp] || 63));
      if (b < 32) b = 32;
      out += String.fromCharCode(b);
    }
    return out;
  }
  function wOf(s, size, bold) { const t = bold ? W_B : W_H, w = win(s); let n = 0; for (let i = 0; i < w.length; i++) n += t[w.charCodeAt(i) - 32] || 556; return n * size / 1000; }
  function fit(s, size, bold, max) {
    s = String(s == null ? '' : s);
    if (wOf(s, size, bold) <= max) return s;
    while (s.length > 1 && wOf(s + '…', size, bold) > max) s = s.slice(0, -1);
    return s + '…';
  }
  function wrap(s, size, bold, max) {
    const words = String(s == null ? '' : s).split(/\s+/), lines = [];
    let cur = '';
    words.forEach(function (w) { const t = cur ? cur + ' ' + w : w; if (wOf(t, size, bold) <= max || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines.map(function (l) { return fit(l, size, bold, max); });
  }
  const pstr = function (s) { return '(' + win(s).replace(/[\\()]/g, '\\$&') + ')'; };
  const f2 = function (n) { return (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, '') || '0'; };

  function Pdf(landscape) {
    this.W = landscape ? 841.89 : 595.28; this.H = landscape ? 595.28 : 841.89;
    this.M = 32; this.pages = []; this.add();
  }
  Pdf.prototype.add = function () { this.ops = []; this.pages.push(this.ops); this.y = this.M; };
  Pdf.prototype.text = function (x, y, s, size, bold, align, gray) {
    if (s === '' || s == null) return;
    const w = wOf(s, size, bold);
    const tx = align === 'c' ? x - w / 2 : align === 'r' ? x - w : x;
    this.ops.push((gray ? '0.35 g ' : '0 g ') + 'BT /' + (bold ? 'F2' : 'F1') + ' ' + f2(size) + ' Tf ' + f2(tx) + ' ' + f2(this.H - y) + ' Td ' + pstr(s) + ' Tj ET');
  };
  Pdf.prototype.line = function (x1, y1, x2, y2, w) { this.ops.push(f2(w || 0.6) + ' w 0 G ' + f2(x1) + ' ' + f2(this.H - y1) + ' m ' + f2(x2) + ' ' + f2(this.H - y2) + ' l S'); };
  Pdf.prototype.rect = function (x, y, w, h, fill, stroke) {
    const r = f2(x) + ' ' + f2(this.H - y - h) + ' ' + f2(w) + ' ' + f2(h) + ' re';
    if (fill) this.ops.push(fill + ' rg ' + r + ' f');
    if (stroke !== false) this.ops.push('0.5 w 0 G ' + r + ' S');
  };
  Pdf.prototype.blob = function (footer) {
    const objs = [], H = this.H, W = this.W, n = this.pages.length;
    const pageIds = [];
    let id = 5;
    const contents = this.pages.map(function (ops, i) {
      const foot = footer ? footer(i + 1, n) : null;
      const extra = foot ? [
        '0.35 g BT /F1 7.5 Tf 32 18 Td ' + pstr(foot[0]) + ' Tj ET',
        '0.35 g BT /F1 7.5 Tf ' + f2(W - 32 - wOf(foot[1], 7.5, false)) + ' 18 Td ' + pstr(foot[1]) + ' Tj ET'
      ] : [];
      return ops.concat(extra).join('\n');
    });
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    contents.forEach(function (c) {
      const pid = id++, cid = id++;
      pageIds.push(pid);
      objs[pid] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f2(W) + ' ' + f2(H) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + cid + ' 0 R >>';
      objs[cid] = '<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream';
    });
    objs[2] = '<< /Type /Pages /Kids [' + pageIds.map(function (p) { return p + ' 0 R'; }).join(' ') + '] /Count ' + pageIds.length + ' >>';
    let out = '%PDF-1.4\n%âãÏÓ\n';
    const xref = [];
    for (let i = 1; i < objs.length; i++) { xref[i] = out.length; out += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
    const xs = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (let i = 1; i < objs.length; i++) out += String(xref[i]).padStart(10, '0') + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R /Info << /Producer (SIPL) /Title (Penilaian PROLAT) >> >>\nstartxref\n' + xs + '\n%%EOF\n';
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
    return new Blob([bytes], { type: 'application/pdf' });
  };

  /**
   * Tabel ber-kepala gabungan. spec: { widths, head: [[{t, cs, rs}]], body: [[sel]], align: ['l','c',...],
   * size, rowH, headH, bold: [kolom tebal], title(pdf) → tinggi judul halaman pertama }
   */
  function table(pdf, spec) {
    const avail = pdf.W - pdf.M * 2, sum = spec.widths.reduce(function (s, w) { return s + w; }, 0), k = avail / sum;
    const ws = spec.widths.map(function (w) { return w * k; }), xs = [pdf.M];
    ws.forEach(function (w, i) { xs[i + 1] = xs[i] + w; });
    const size = spec.size || 8.5, rowH = spec.rowH || 15, headH = spec.headH || 15;
    const grid = [];       // susunan sel kepala
    spec.head.forEach(function (row, r) {
      grid[r] = grid[r] || [];
      let c = 0;
      row.forEach(function (cell) {
        while (grid[r][c]) c++;
        const cs = cell.cs || 1, rs = cell.rs || 1;
        for (let rr = r; rr < r + rs; rr++) { grid[rr] = grid[rr] || []; for (let cc = c; cc < c + cs; cc++) grid[rr][cc] = 1; }
        cell._c = c; cell._r = r;
        c += cs;
      });
    });
    function drawHead() {
      const y0 = pdf.y;
      spec.head.forEach(function (row) {
        row.forEach(function (cell) {
          const x = xs[cell._c], w = xs[cell._c + (cell.cs || 1)] - x, y = y0 + cell._r * headH, h = (cell.rs || 1) * headH;
          pdf.rect(x, y, w, h, '0.953 0.906 0.769');
          const lines = wrap(cell.t, size - 0.5, true, w - 4);
          const top = y + h / 2 - (lines.length - 1) * (size + 1) / 2;
          lines.forEach(function (l, i) { pdf.text(x + w / 2, top + i * (size + 1) + size * 0.35, l, size - 0.5, true, 'c'); });
        });
      });
      pdf.y = y0 + spec.head.length * headH;
    }
    if (spec.title) spec.title(pdf, true);
    drawHead();
    spec.body.forEach(function (row) {
      if (pdf.y + rowH > pdf.H - pdf.M - 14) { pdf.add(); if (spec.title) spec.title(pdf, false); drawHead(); }
      row.forEach(function (cell, c) {
        const o = cell !== null && typeof cell === 'object' ? cell : { t: cell };
        const x = xs[c], w = ws[c], al = o.al || (spec.align && spec.align[c]) || 'l', b = !!(o.b || (spec.bold && spec.bold.indexOf(c) > -1));
        pdf.rect(x, pdf.y, w, rowH, o.fill || null);
        const t = fit(o.t == null ? '' : o.t, size, b, w - 6), ty = pdf.y + rowH / 2 + size * 0.35;
        pdf.text(al === 'c' ? x + w / 2 : al === 'r' ? x + w - 3 : x + 3, ty, t, size, b, al);
      });
      pdf.y += rowH;
    });
    return pdf;
  }

  function judulPdf(pdf, d, first) {
    const cx = pdf.W / 2;
    if (!first) {
      pdf.text(pdf.M, pdf.M + 8, d.judul + ' — ' + (d.ringkas || ''), 8, true, 'l', true);
      pdf.y = pdf.M + 16;
      return;
    }
    const top = kopPdf(pdf) + 6;
    pdf.text(cx, top + 10, d.judul, 13, true, 'c');
    pdf.text(cx, top + 26, d.instansi, 10.5, true, 'c');
    let y = top + 46;
    d.info.forEach(function (kv) {
      pdf.text(pdf.M, y, kv[0], 9, false, 'l');
      pdf.text(pdf.M + 112, y, ': ' + kv[1], 9, kv[2] === 'b', 'l');
      y += 13;
    });
    pdf.y = y + 4;
  }
  /** Kop surat di pojok kiri atas (dapat diubah di js/config.js → KOP). */
  function kopBaris() {
    const k = (window.SIPL_CONFIG || {}).KOP;
    return Array.isArray(k) && k.length ? k.map(String) : ['KEPOLISIAN NEGARA REPUBLIK INDONESIA', 'DAERAH PAPUA BARAT', 'SEKOLAH POLISI NEGARA'];
  }
  function kopPdf(pdf) {
    const L = kopBaris(), size = 9, w = Math.max.apply(null, L.map(function (l) { return wOf(l, size, true); })), cx = pdf.M + w / 2;
    let y = pdf.M + 8;
    L.forEach(function (l) { pdf.text(cx, y, l, size, true, 'c'); y += 11; });
    pdf.line(pdf.M, y - 7, pdf.M + w, y - 7, 0.8);
    return y + 6;
  }
  /** Kop Excel: baris 1–3 di kolom A–C (rata tengah), garis bawah pada baris terakhir. */
  function kopXlsx(rows, merges) {
    const L = kopBaris();
    L.forEach(function (l, i) {
      const st = i === L.length - 1 ? X.kopAkhir : X.kop;
      rows[i] = [{ v: l, s: st }, { v: '', s: st }, { v: '', s: st }];
      merges.push('A' + (i + 1) + ':C' + (i + 1));
    });
  }

  /** Kolom tanda tangan di kanan bawah: kota & tanggal, jabatan, ruang kosong, nama (garis bawah), NRP. */
  function ttdBaris(t) {
    t = t || {};
    return {
      atas: [(t.kota ? t.kota + ', ' : '') + (t.tanggal || ''), t.jabatan || 'GADIK PENGAMPU MATA PELAJARAN'],
      nama: t.nama || '',
      bawah: t.nrp ? (t.pangkat && t.nama && String(t.nama).indexOf(t.pangkat) !== 0 ? t.pangkat + ' ' : '') + 'NRP ' + t.nrp : (t.nama ? '' : 'NRP ..............................')
    };
  }
  function ttdPdf(pdf, t) {
    if (!t) return;
    const b = ttdBaris(t), w = 230, cx = pdf.W - pdf.M - w / 2, need = 118;
    if (pdf.y + need > pdf.H - pdf.M - 14) pdf.add();
    let y = pdf.y + 22;
    b.atas.forEach(function (s, i) { pdf.text(cx, y, s, 9.5, i === 1, 'c'); y += 13; });
    y += 52;                                                         // ruang kosong untuk tanda tangan
    const nama = b.nama || '( .................................................. )';
    pdf.text(cx, y, nama, 9.5, !!b.nama, 'c');
    if (b.nama) { const nw = wOf(nama, 9.5, true); pdf.line(cx - nw / 2, y + 2, cx + nw / 2, y + 2, 0.7); }
    y += 13;
    if (b.bawah) pdf.text(cx, y, b.bawah, 9, false, 'c');
    pdf.y = y + 8;
  }
  /** Baris tanda tangan Excel di kolom paling kanan (gabungan c0..c1), mulai baris r. */
  function ttdXlsx(rows, merges, heights, t, r, c0, c1) {
    if (!t) return;
    const b = ttdBaris(t);
    const put = function (rr, v, st) { const row = rows[rr] = rows[rr] || []; row[c0] = { v: v, s: st }; for (let c = c0 + 1; c <= c1; c++) row[c] = { v: '', s: st }; if (c1 > c0) merges.push(ref(c0, rr) + ':' + ref(c1, rr)); };
    put(r, b.atas[0], X.ttd);
    put(r + 1, b.atas[1], X.ttd);
    heights[r + 2] = 22; heights[r + 3] = 22; heights[r + 4] = 22;
    put(r + 5, b.nama || '( ................................................ )', b.nama ? X.ttdNama : X.ttd);
    if (b.bawah) put(r + 6, b.bawah, X.ttd);
  }

  function footerFn(d) {
    const at = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    const stamp = at.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' }) + ' ' +
      at.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jayapura' }).replace(':', '.') + ' WIT';
    return function (i, n) { return ['Dicetak dari SIPL • ' + d.instansi + ' • ' + stamp, 'Halaman ' + i + ' dari ' + n]; };
  }

  // ==========================================================================
  // Format PENILAIAN PROLAT
  // ==========================================================================
  const KOP = 4;                    // baris 1–3 kop, baris 4 kosong
  const HEAD_ROW = KOP + 8;         // baris kepala tabel (0-based) → baris Excel 13–14
  const BODY_ROW = HEAD_ROW + 2;    // baris peserta pertama → baris Excel 15

  function aspekOf(fmt) { return fmt.ASPEK; }
  function jumlahGrup(v, fmt) {
    let i = 0;
    return aspekOf(fmt).map(function (g) {
      let s = 0, any = false;
      g.butir.forEach(function () { const x = v[i++]; if (x !== '' && x != null && isFinite(Number(x))) { s += Number(x); any = true; } });
      return { sum: round(s, 2), any: any };
    });
  }

  /** Kepala & isi tabel HARI: NO · NAMA · PANGKAT/NRP · [butir… JUMLAH] per aspek. */
  function lembarHari(d, name) {
    const fmt = d.format, A = aspekOf(fmt);
    const cols = [5, 30, 22];
    const head1 = [{ v: 'NO', s: X.th }, { v: 'NAMA', s: X.th }, { v: 'PANGKAT / NRP', s: X.th }];
    const head2 = [{ v: '', s: X.th }, { v: '', s: X.th }, { v: '', s: X.th }];
    const merges = ['A' + (HEAD_ROW + 1) + ':A' + (HEAD_ROW + 2), 'B' + (HEAD_ROW + 1) + ':B' + (HEAD_ROW + 2), 'C' + (HEAD_ROW + 1) + ':C' + (HEAD_ROW + 2)];
    const sumCols = [];
    let c = 3;
    A.forEach(function (g) {
      head1.push({ v: g.nama.toUpperCase(), s: X.th });
      for (let k = 1; k < g.butir.length; k++) head1.push({ v: '', s: X.th });
      merges.push(ref(c, HEAD_ROW) + ':' + ref(c + g.butir.length - 1, HEAD_ROW));
      g.butir.forEach(function (b) { head2.push({ v: b, s: X.th }); cols.push(6.5); });
      c += g.butir.length;
      head1.push({ v: 'JUMLAH', s: X.th }); head2.push({ v: '', s: X.th });
      merges.push(ref(c, HEAD_ROW) + ':' + ref(c, HEAD_ROW + 1));
      sumCols.push(c); cols.push(9);
      c++;
    });
    const lastCol = c - 1;
    const rows = [];
    kopXlsx(rows, merges);
    rows[KOP] = [{ v: d.judul, s: X.title }];
    rows[KOP + 1] = [{ v: d.instansi, s: X.sub }];
    merges.push(ref(0, KOP) + ':' + ref(lastCol, KOP), ref(0, KOP + 1) + ':' + ref(lastCol, KOP + 1));
    (d.info || []).slice(0, 5).forEach(function (kv, i) { rows[KOP + 3 + i] = [null, { v: kv[0], s: X.label }, { v: ': ' + kv[1], s: X.label }]; });
    rows[HEAD_ROW] = head1; rows[HEAD_ROW + 1] = head2;
    d.peserta.forEach(function (p, i) {
      const r = BODY_ROW + i, v = (d.nilai && d.nilai[i]) || [], row = [{ v: i + 1, s: X.tdc }, { v: p.nama, s: X.td }, { v: p.pn, s: X.td }];
      let cc = 3, bi = 0;
      const sums = jumlahGrup(v, fmt);
      A.forEach(function (g, gi) {
        const from = cc;
        g.butir.forEach(function () { const x = v[bi++]; row.push({ v: x === '' || x == null ? '' : Number(x), s: X.tdc }); cc++; });
        row.push({ f: 'SUM(' + ref(from, r) + ':' + ref(cc - 1, r) + ')', v: sums[gi].sum, s: X.tdb });
        cc++;
      });
      rows[r] = row;
    });
    const endRow = BODY_ROW + d.peserta.length;
    rows[endRow + 1] = [null, { v: 'Skor tiap butir 0–' + fmt.SKOR_MAX + '. JUMLAH = penjumlahan butir (butir kosong dihitung 0).', s: X.note }];
    const heights = { [KOP]: 22, [HEAD_ROW]: 30, [HEAD_ROW + 1]: 18 };
    ttdXlsx(rows, merges, heights, d.ttd, endRow + 3, lastCol - 6, lastCol);
    return { name: name, cols: cols, rows: rows, merges: merges, freeze: BODY_ROW, landscape: false, sumCols: sumCols, heights: heights };
  }

  function hitungAkhir(d) {
    const fmt = d.format, A = aspekOf(fmt), n = d.hari.length;
    const hasil = d.peserta.map(function (p, i) {
      const tot = A.map(function () { return 0; });
      d.hari.forEach(function (h) { jumlahGrup((h.nilai && h.nilai[i]) || [], fmt).forEach(function (s, gi) { tot[gi] += s.sum; }); });
      const asp = tot.map(function (t, gi) { return n ? t / n / A[gi].butir.length * 10 : 0; });
      const na = asp.reduce(function (s, x, gi) { return s + x * A[gi].bobot; }, 0);
      return { asp: asp, na: na };
    });
    hasil.forEach(function (h, i) {
      const key = Math.round(h.na * 1e6);
      let rank = 1;
      hasil.forEach(function (o, j) { const ok = Math.round(o.na * 1e6); if (ok > key || (ok === key && j < i)) rank++; });
      h.rank = rank;
    });
    return hasil;
  }

  function lembarAkhir(d, hariSheets) {
    const fmt = d.format, A = aspekOf(fmt), n = d.hari.length, hasil = d.hasil || hitungAkhir(d);
    const cols = [5, 34, 26].concat(A.map(function () { return 17; }), [14, 9]);
    const titles = ['NO', 'NAMA', 'PANGKAT / NRP'].concat(A.map(function (g) { return 'JUMLAH ' + g.nama.toUpperCase(); }), ['NIL AKHIR', 'RANK']);
    const rows = [], merges = [];
    const lastCol = titles.length - 1, cNA = 3 + A.length, cRank = cNA + 1;
    kopXlsx(rows, merges);
    rows[KOP] = [{ v: d.judul, s: X.title }];
    rows[KOP + 1] = [{ v: d.instansi, s: X.sub }];
    merges.push(ref(0, KOP) + ':' + ref(lastCol, KOP), ref(0, KOP + 1) + ':' + ref(lastCol, KOP + 1));
    (d.info || []).slice(0, 5).forEach(function (kv, i) { rows[KOP + 3 + i] = [null, { v: kv[0], s: X.label }, { v: ': ' + kv[1], s: X.label }]; });
    rows[HEAD_ROW] = titles.map(function (t) { return { v: t, s: X.th }; });
    rows[HEAD_ROW + 1] = titles.map(function () { return { v: '', s: X.th }; });
    titles.forEach(function (t, c) { merges.push(ref(c, HEAD_ROW) + ':' + ref(c, HEAD_ROW + 1)); });
    const first = BODY_ROW + 1, last = BODY_ROW + d.peserta.length;
    d.peserta.forEach(function (p, i) {
      const r = BODY_ROW + i, h = hasil[i];
      const row = [{ v: i + 1, s: X.tdc }, { v: p.nama, s: X.td }, { v: p.pn, s: X.td }];
      A.forEach(function (g, gi) {
        const refs = hariSheets.map(function (s) { return sheetRef(s.name) + '!' + ref(s.sumCols[gi], r); });
        const f = n ? 'SUM(' + refs.join(',') + ')/' + n + '/' + g.butir.length + '*10' : '0';
        row.push({ f: f, v: round(h.asp[gi], 6), s: X.num });
      });
      const fNA = 'IFERROR(' + A.map(function (g, gi) { return '(' + ref(3 + gi, r) + '*' + g.bobot + ')'; }).join('+') + ',"-")';
      row.push({ f: fNA, v: round(h.na, 6), s: X.numb });
      const g = ref(cNA, r), col = colName(cNA);
      row.push({ f: 'IFERROR(RANK(' + g + ',$' + col + '$' + first + ':$' + col + '$' + last + ')+COUNTIF($' + col + '$' + first + ':' + g + ',' + g + ')-1,"**")', v: h.rank, s: X.tdb });
      rows[r] = row;
    });
    const e = BODY_ROW + d.peserta.length + 1;
    rows[e] = [null, { v: 'Keterangan:', s: X.note }];
    rows[e + 1] = [null, { v: 'Nilai aspek = jumlah aspek seluruh hari ÷ ' + n + ' hari ÷ banyak butir × 10 (skor butir 0–' + fmt.SKOR_MAX + ').', s: X.note }];
    rows[e + 2] = [null, { v: 'NIL AKHIR = ' + A.map(function (g) { return g.nama.replace('Aspek ', '') + ' × ' + Math.round(g.bobot * 100) + '%'; }).join(' + ') + '. RANK dari NIL AKHIR tertinggi.', s: X.note }];
    const heights = { [KOP]: 22, [HEAD_ROW]: 22, [HEAD_ROW + 1]: 22 };
    ttdXlsx(rows, merges, heights, d.ttd, e + 4, lastCol - 3, lastCol);
    return { name: 'NIL AKHIR', cols: cols, rows: rows, merges: merges, freeze: BODY_ROW, landscape: false, active: true, heights: heights };
  }

  function pdfHari(d) {
    const fmt = d.format, A = aspekOf(fmt);
    const widths = [20, 145, 100], head1 = [{ t: 'NO', rs: 2 }, { t: 'NAMA', rs: 2 }, { t: 'PANGKAT / NRP', rs: 2 }], head2 = [], align = ['c', 'l', 'l'], bold = [];
    A.forEach(function (g) {
      head1.push({ t: g.nama.toUpperCase(), cs: g.butir.length });
      g.butir.forEach(function (b) { head2.push({ t: b }); widths.push(23); align.push('c'); });
      head1.push({ t: 'JUMLAH', rs: 2 }); widths.push(40); align.push('c'); bold.push(widths.length - 1);
    });
    const body = d.peserta.map(function (p, i) {
      const v = (d.nilai && d.nilai[i]) || [], sums = jumlahGrup(v, fmt), row = [i + 1, p.nama, p.pn];
      let bi = 0;
      A.forEach(function (g, gi) { g.butir.forEach(function () { row.push(skorTeks(v[bi++])); }); row.push(sums[gi].any ? skorTeks(sums[gi].sum) : '0'); });
      return row;
    });
    const pdf = new Pdf(false);                                   // A4 potrait
    table(pdf, { widths: widths, head: [head1, head2], body: body, align: align, bold: bold, size: 8, rowH: 15, headH: 18, title: function (p, first) { judulPdf(p, d, first); } });
    pdf.y += 12;
    if (pdf.y < pdf.H - pdf.M - 20) pdf.text(pdf.M, pdf.y, 'Skor tiap butir 0–' + fmt.SKOR_MAX + '. JUMLAH = penjumlahan butir (butir kosong dihitung 0).', 7.5, false, 'l', true);
    ttdPdf(pdf, d.ttd);
    return pdf.blob(footerFn(d));
  }

  function pdfAkhir(d) {
    const fmt = d.format, A = aspekOf(fmt), hasil = d.hasil || hitungAkhir(d);
    const widths = [22, 150, 105].concat(A.map(function () { return 62; }), [52, 34]);
    const head = [[{ t: 'NO' }, { t: 'NAMA' }, { t: 'PANGKAT / NRP' }].concat(A.map(function (g) { return { t: 'JUMLAH ' + g.nama.toUpperCase() }; }), [{ t: 'NIL AKHIR' }, { t: 'RANK' }])];
    const align = ['c', 'l', 'l'].concat(A.map(function () { return 'c'; }), ['c', 'c']);
    const body = d.peserta.map(function (p, i) {
      const h = hasil[i];
      return [i + 1, p.nama, p.pn].concat(h.asp.map(function (x) { return angka(x, 2); }), [{ t: angka(h.na, 2), b: true }, { t: String(h.rank), b: true }]);
    });
    const pdf = new Pdf(false);
    table(pdf, { widths: widths, head: head, body: body, align: align, size: 8, rowH: 15, headH: 30, title: function (p, first) { judulPdf(p, d, first); } });
    const notes = ['Nilai aspek = jumlah aspek seluruh hari ÷ ' + d.hari.length + ' hari ÷ banyak butir × 10 (skor butir 0–' + fmt.SKOR_MAX + ').',
      'NIL AKHIR = ' + A.map(function (g) { return g.nama.replace('Aspek ', '') + ' × ' + Math.round(g.bobot * 100) + '%'; }).join(' + ') + '. RANK dari NIL AKHIR tertinggi.'];
    pdf.y += 12;
    if (pdf.y + 26 > pdf.H - pdf.M - 14) pdf.add();
    notes.forEach(function (t) { pdf.text(pdf.M, pdf.y, t, 7.5, false, 'l', true); pdf.y += 11; });
    ttdPdf(pdf, d.ttd);
    return pdf.blob(footerFn(d));
  }

  function simpan(blob, filename) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }

  // ==========================================================================
  // TEMPLATE & EKSPOR DATA (v1.8) — lembar rapi yang bisa diisi lalu diimpor kembali
  // ==========================================================================
  /**
   * t: { judul, sub, nama (nama sheet), kolom:[{ t, w, text, wajib, contoh, pilihan:[..], ketat }], baris:[[nilai]],
   *      kosong (jumlah baris kosong siap isi), petunjuk:[teks], daftar:[{ judul, nilai:[..] }] }
   */
  function tabelXlsx(t) {
    const K = t.kolom, last = K.length, rows = [], merges = [], heights = {}, validations = [];
    kopXlsx(rows, merges);
    const R0 = KOP, HR = KOP + 4, B0 = HR + 1;
    rows[R0] = [{ v: t.judul, s: X.title }]; merges.push(ref(0, R0) + ':' + ref(last, R0)); heights[R0] = 24;
    if (t.sub) { rows[R0 + 1] = [{ v: t.sub, s: X.sub }]; merges.push(ref(0, R0 + 1) + ':' + ref(last, R0 + 1)); }
    rows[R0 + 2] = [{ v: t.catatan || 'Isi mulai baris ' + (B0 + 1) + '. Kolom bertanda * wajib diisi. Jangan mengubah judul kolom. Petunjuk lengkap ada di sheet PETUNJUK.', s: X.note }];
    merges.push(ref(0, R0 + 2) + ':' + ref(last, R0 + 2));
    rows[HR] = [{ v: 'NO', s: X.thB }].concat(K.map(function (k) { return { v: k.t + (k.wajib ? ' *' : ''), s: X.thB }; }));
    heights[HR] = 30;
    const data = t.baris || [], n = Math.max(data.length + (t.kosong || 0), data.length ? data.length : 1);
    for (let i = 0; i < n; i++) {
      const v = data[i] || [];
      rows[B0 + i] = [{ v: i + 1, s: X.tdNo }].concat(K.map(function (k, c) {
        const x = v[c];
        return { v: x === undefined || x === null ? '' : (k.text ? String(x) : x), s: k.text ? X.tdTxt : X.td };
      }));
    }
    // daftar pilihan (dropdown) di sheet PETUNJUK
    const daftar = t.daftar || [], P = [], pm = [];
    P[0] = [{ v: 'PETUNJUK PENGISIAN', s: X.judulL }];
    let r = 2;
    (t.petunjuk || []).forEach(function (txt, i) { P[r++] = [{ v: (i + 1) + '. ' + txt, s: X.wrap }]; });
    r++;
    P[r++] = [{ v: 'KOLOM', s: X.pilihH }, { v: 'KETERANGAN', s: X.pilihH }];
    K.forEach(function (k) { P[r++] = [{ v: k.t + (k.wajib ? ' *' : ''), s: X.tdb }, { v: k.ket || '', s: X.td }]; });
    const dCol = 3;
    daftar.forEach(function (d, j) {
      const c = dCol + j;
      P[2] = P[2] || [];
      P[2][c] = { v: d.judul, s: X.pilihH };
      d.nilai.forEach(function (x, i) { P[3 + i] = P[3 + i] || []; P[3 + i][c] = { v: x, s: X.pilih }; });
      const kc = K.findIndex(function (k) { return k.pilihan === d.id; });
      if (kc > -1 && d.nilai.length) {
        const col = colName(c);
        validations.push({ sqref: ref(kc + 1, B0) + ':' + ref(kc + 1, B0 + Math.max(n, 400) - 1), formula: "'PETUNJUK'!$" + col + '$4:$' + col + '$' + (3 + d.nilai.length), strict: !!d.ketat, prompt: [d.judul, d.prompt || 'Pilih dari daftar.'], error: d.error });
      }
    });
    const pCols = [62, 70, 3].concat(daftar.map(function () { return 40; }));
    const main = { name: t.nama || 'DATA', cols: [6].concat(K.map(function (k) { return k.w || 18; })), rows: rows, merges: merges, freeze: B0, heights: heights, validations: validations, active: true, landscape: K.length > 5 };
    return xlsx([main, { name: 'PETUNJUK', cols: pCols, rows: P, merges: pm }]);
  }

  // ---------- Pembaca .xlsx / .csv (tanpa pustaka luar) ----------
  async function inflate(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Browser ini belum mendukung pembacaan Excel. Gunakan Chrome/Edge/Firefox/Safari terbaru, atau simpan berkas sebagai CSV.');
    const ds = new DecompressionStream('deflate-raw');
    const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function unzip(buf) {
    const u = new Uint8Array(buf), dv = new DataView(buf), files = {};
    let e = -1;
    for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('Berkas bukan Excel (.xlsx) yang valid.');
    const count = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const dec = new TextDecoder();
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = dec.decode(u.subarray(p + 46, p + 46 + nlen));
      files[name] = { method: method, csize: csize, off: off };
      p += 46 + nlen + xlen + clen;
    }
    return {
      names: Object.keys(files),
      text: async function (name) {
        const f = files[name];
        if (!f) return null;
        const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
        const raw = u.subarray(start, start + f.csize);
        return dec.decode(f.method === 8 ? await inflate(raw) : raw);
      }
    };
  }
  function xmlDoc(s) { return new DOMParser().parseFromString(s, 'application/xml'); }
  function byTag(node, tag) { return Array.from(node.getElementsByTagName(tag)).concat(Array.from(node.getElementsByTagNameNS ? node.getElementsByTagNameNS('*', tag) : [])).filter(function (x, i, a) { return a.indexOf(x) === i; }); }
  function colIndex(refStr) { const m = /^([A-Z]+)/.exec(refStr || ''); let n = 0; if (!m) return -1; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
  function bacaSheet(sx, shared) {
    const out = [];
    byTag(xmlDoc(sx), 'row').forEach(function (rowEl) {
      const r = Number(rowEl.getAttribute('r')) - 1, row = [];
      byTag(rowEl, 'c').forEach(function (c, ci) {
        const col = c.getAttribute('r') ? colIndex(c.getAttribute('r')) : ci, t = c.getAttribute('t');
        const vEl = byTag(c, 'v')[0], v = vEl ? vEl.textContent : '';
        let val = '';
        if (t === 's') val = shared[Number(v)] || '';
        else if (t === 'inlineStr') val = byTag(c, 't').map(function (x) { return x.textContent; }).join('');
        else if (t === 'str' || t === 'e') val = v;
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else val = v === '' ? '' : Number(v);
        row[col] = val;
      });
      out[r >= 0 ? r : out.length] = row;
    });
    for (let i = 0; i < out.length; i++) if (!out[i]) out[i] = [];
    return out;
  }
  /** Semua sheet terlihat → [{ name, rows }] (urut sesuai buku kerja). */
  async function bacaXlsxSemua(buf) {
    const z = await unzip(buf);
    const ssTxt = await z.text('xl/sharedStrings.xml'), shared = [];
    if (ssTxt) byTag(xmlDoc(ssTxt), 'si').forEach(function (si) { shared.push(byTag(si, 't').map(function (t) { return t.textContent; }).join('')); });
    const wb = xmlDoc(await z.text('xl/workbook.xml')), relTxt = await z.text('xl/_rels/workbook.xml.rels'), rels = relTxt ? xmlDoc(relTxt) : null;
    const out = [];
    for (const sh of byTag(wb, 'sheet')) {
      if (sh.getAttribute('state') === 'hidden' || sh.getAttribute('state') === 'veryHidden') continue;
      const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const rel = rels && byTag(rels, 'Relationship').find(function (r) { return r.getAttribute('Id') === rid; });
      if (!rel) continue;
      const tg = rel.getAttribute('Target');
      const path = tg.charAt(0) === '/' ? tg.slice(1) : 'xl/' + tg.replace(/^\.\//, '');
      const sx = await z.text(path);
      if (sx) out.push({ name: sh.getAttribute('name'), rows: bacaSheet(sx, shared) });
    }
    if (!out.length) throw new Error('Sheet data tidak ditemukan di berkas Excel.');
    return out;
  }
  async function bacaXlsx(buf) {
    const z = await unzip(buf);
    const ssTxt = await z.text('xl/sharedStrings.xml'), shared = [];
    if (ssTxt) byTag(xmlDoc(ssTxt), 'si').forEach(function (si) { shared.push(byTag(si, 't').map(function (t) { return t.textContent; }).join('')); });
    // sheet pertama sesuai urutan workbook
    let path = 'xl/worksheets/sheet1.xml';
    try {
      const wb = xmlDoc(await z.text('xl/workbook.xml')), rels = xmlDoc(await z.text('xl/_rels/workbook.xml.rels'));
      const first = byTag(wb, 'sheet').filter(function (s) { return s.getAttribute('state') !== 'hidden'; })[0];
      const rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
      const rel = byTag(rels, 'Relationship').find(function (r) { return r.getAttribute('Id') === rid; });
      if (rel) { const tg = rel.getAttribute('Target').replace(/^\/?xl\//, ''); path = 'xl/' + tg.replace(/^\//, ''); }
    } catch (e) { /* pakai sheet1 */ }
    const sx = await z.text(path) || await z.text(z.names.find(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); }));
    if (!sx) throw new Error('Sheet data tidak ditemukan di berkas Excel.');
    const out = [];
    byTag(xmlDoc(sx), 'row').forEach(function (rowEl) {
      const r = Number(rowEl.getAttribute('r')) - 1, row = [];
      byTag(rowEl, 'c').forEach(function (c, ci) {
        const col = c.getAttribute('r') ? colIndex(c.getAttribute('r')) : ci, t = c.getAttribute('t');
        const vEl = byTag(c, 'v')[0], v = vEl ? vEl.textContent : '';
        let val = '';
        if (t === 's') val = shared[Number(v)] || '';
        else if (t === 'inlineStr') val = byTag(c, 't').map(function (x) { return x.textContent; }).join('');
        else if (t === 'str' || t === 'e') val = v;
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else val = v === '' ? '' : Number(v);
        row[col] = val;
      });
      out[r >= 0 ? r : out.length] = row;
    });
    for (let i = 0; i < out.length; i++) if (!out[i]) out[i] = [];
    return out;
  }
  function bacaCsv(text) {
    text = text.replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/)[0] || '', delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : (firstLine.indexOf('\t') > -1 ? '\t' : ',');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  /** Berkas (File) → semua sheet [{ name, rows }]. CSV = satu sheet. */
  async function bacaBerkasSemua(file) {
    const name = String(file.name || '').toLowerCase();
    if (/\.xls$/.test(name)) throw new Error('Format .xls (Excel 97–2003) belum didukung. Buka berkas di Excel lalu Simpan Sebagai → Excel Workbook (.xlsx).');
    if (/\.(csv|txt)$/.test(name)) return [{ name: file.name, rows: bacaCsv(await file.text()) }];
    return bacaXlsxSemua(await file.arrayBuffer());
  }
  /** Berkas (File) → array baris (sel: string atau number). */
  async function bacaBerkas(file) {
    const name = String(file.name || '').toLowerCase();
    if (/\.xls$/.test(name)) throw new Error('Format .xls (Excel 97–2003) belum didukung. Buka berkas di Excel lalu Simpan Sebagai → Excel Workbook (.xlsx).');
    if (/\.(csv|txt)$/.test(name)) return bacaCsv(await file.text());
    return bacaXlsx(await file.arrayBuffer());
  }

  // ==========================================================================
  // TEMPLATE IMPORT NILAI HARIAN (v2.0): satu sheet per HARI, format sama dengan lembar harian,
  // sel butir dibatasi 0–10, kode sesi tertulis di bagian info agar dapat diimpor kembali.
  // ==========================================================================
  function nilaiTemplateXlsx(d) {
    const A = aspekOf(d.format);
    const sheets = d.hari.map(function (h) {
      const sh = lembarHari({ judul: h.judul || 'PENILAIAN HARIAN PESERTA PELATIHAN', instansi: d.instansi, info: h.info, format: d.format, peserta: h.peserta, nilai: h.nilai, ttd: h.ttd }, h.label);
      const n = Math.max(1, h.peserta.length), sq = [];
      let c = 3;
      A.forEach(function (g) { g.butir.forEach(function () { sq.push(ref(c, BODY_ROW) + ':' + ref(c, BODY_ROW + n - 1)); c++; }); c++; });
      sh.validations = [{ type: 'decimal', min: 0, max: d.format.SKOR_MAX, sqref: sq.join(' '), prompt: ['Skor butir', 'Isi angka 0–' + d.format.SKOR_MAX + ' (desimal pakai koma/titik).'], error: 'Skor harus angka 0–' + d.format.SKOR_MAX + '.' }];
      if (h.terkunci) sh.rows[KOP + 2] = [{ v: 'LEMBAR INI SUDAH DIKIRIM KE REKAP (TERKUNCI) — perubahan di lembar ini tidak akan diterima.', s: X.note }];
      sh.active = false;
      return sh;
    });
    if (sheets.length) sheets[0].active = true;
    const P = [[{ v: 'PETUNJUK PENGISIAN NILAI HARIAN', s: X.judulL }]];
    let r = 2;
    (d.petunjuk || []).forEach(function (t, i) { P[r++] = [{ v: (i + 1) + '. ' + t, s: X.wrap }]; });
    return xlsx(sheets.concat([{ name: 'PETUNJUK', cols: [110], rows: P }]));
  }

  // ==========================================================================
  // LAPORAN PERINGKAT SATU (v2.0) — PDF A4 potrait
  // d: { judul, instansi, ringkas, info, kelas: [{ judul, sub, nama, pn, na, tabel: { head, body }, alasan:[], catatan:[], kesimpulan }] }
  // ==========================================================================
  function juaraPdf(d) {
    const pdf = new Pdf(false), M = pdf.M, Wt = pdf.W - M * 2;
    judulPdf(pdf, d, true);
    const butuh = function (h) { if (pdf.y + h > pdf.H - M - 16) { pdf.add(); judulPdf(pdf, d, false); } };
    const para = function (t, size, bold, indent, bullet) {
      const lines = wrap(t, size, bold, Wt - (indent || 0) - (bullet ? 10 : 0));
      lines.forEach(function (l, i) {
        butuh(size + 4);
        if (bullet && i === 0) pdf.text(M + (indent || 0), pdf.y + size, bullet, size, bold, 'l');
        pdf.text(M + (indent || 0) + (bullet ? 10 : 0), pdf.y + size, l, size, bold, 'l');
        pdf.y += size + 3.5;
      });
    };
    d.kelas.forEach(function (k, ki) {
      butuh(150);
      if (ki) pdf.y += 10;
      pdf.rect(M, pdf.y, Wt, 22, '0.361 0.078 0.078', false);
      pdf.ops.push('1 g');
      pdf.ops.push('BT /F2 10.5 Tf ' + f2(M + 8) + ' ' + f2(pdf.H - pdf.y - 15) + ' Td ' + pstr(k.judul) + ' Tj ET');
      pdf.y += 28;
      if (k.kosong) { para(k.kosong, 9, false); return; }
      pdf.text(M, pdf.y + 12, 'PERINGKAT 1', 8, true, 'l', true);
      pdf.text(M, pdf.y + 27, k.nama, 13, true, 'l');
      pdf.text(M, pdf.y + 40, k.pn, 9, false, 'l', true);
      pdf.text(pdf.W - M, pdf.y + 12, 'NIL AKHIR', 8, true, 'r', true);
      pdf.text(pdf.W - M, pdf.y + 33, k.na, 20, true, 'r');
      pdf.y += 50;
      if (k.sub) para(k.sub, 8.5, false);
      pdf.y += 4;
      butuh(20 + k.tabel.body.length * 15);
      table(pdf, { widths: k.tabel.widths, head: [k.tabel.head.map(function (t) { return { t: t }; })], body: k.tabel.body, align: k.tabel.align, size: 8, rowH: 15, headH: 17 });
      pdf.y += 8;
      para('ALASAN MERAIH PERINGKAT 1', 9, true);
      k.alasan.forEach(function (t, i) { para(t, 8.8, false, 4, (i + 1) + '.'); });
      if (k.catatan && k.catatan.length) { pdf.y += 4; para('EVALUASI & SARAN PEMBINAAN', 9, true); k.catatan.forEach(function (t) { para(t, 8.8, false, 4, '-'); }); }
      if (k.kesimpulan) { pdf.y += 4; para('KESIMPULAN', 9, true); para(k.kesimpulan, 8.8, false, 4); }
    });
    return pdf.blob(footerFn(d));
  }

  window.Ekspor = {
    nilaiTemplateXlsx: nilaiTemplateXlsx, juaraPdf: juaraPdf, bacaBerkasSemua: bacaBerkasSemua,
    tabelXlsx: tabelXlsx, bacaBerkas: bacaBerkas, _bacaXlsx: bacaXlsx, _bacaCsv: bacaCsv,
    tglPanjang: tglPanjang, hitungAkhir: hitungAkhir,
    /** d: { judul, instansi, info:[[label, nilai]], ringkas, format, peserta:[{nama, pn}], nilai:[[7 butir]] } */
    hariXlsx: function (d) { return xlsx([lembarHari(d, d.sheet || 'HARI')]); },
    hariPdf: function (d) { return pdfHari(d); },
    /** d: { judul, instansi, info, format, peserta, hari:[{ label, judul, info, nilai:[[7]] }], hasil? } */
    akhirXlsx: function (d) {
      const sheets = d.hari.map(function (h) {
        return lembarHari({ judul: h.judul, instansi: d.instansi, info: h.info, format: d.format, peserta: d.peserta, nilai: h.nilai, ttd: h.ttd }, h.label);
      });
      return xlsx(sheets.concat([lembarAkhir(d, sheets)]));
    },
    akhirPdf: function (d) { return pdfAkhir(d); },
    simpan: simpan,
    _xlsx: xlsx, _zip: zip, _Pdf: Pdf
  };
})();
