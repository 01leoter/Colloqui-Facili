/* Copyright (C) 2026 Leo971. SPDX-License-Identifier: GPL-3.0-or-later. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require(process.env.COLLOQUI_SOURCE || './content.js');
const fixtures = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, 'booking-dom-fixtures.json'), 'utf8'));
const link = 'https://meet.google.com/abc-defg-hij';
const day = '2026-11-16';

// Adapter over real lxml-parsed fixtures. The selector matches are computed by
// lxml, not by the production functions under test.
function doc(name) {
  const f = fixtures[name], nodes = f.nodes.map(n => ({
    ...n, getAttribute: a => n.attrs[a] ?? null,
    value: n.attrs.value || '', disabled: 'disabled' in n.attrs, readOnly: 'readonly' in n.attrs
  }));
  for (const n of nodes) {
    n.querySelectorAll = s => { assert.ok(n.matches[s], 'unsupported fixture selector ' + s); return n.matches[s].map(i => nodes[i]); };
    n.querySelector = s => n.querySelectorAll(s)[0] || null;
    n.closest = s => {
      for (let x = n; x; x = x.parent === null ? null : nodes[x.parent]) {
        if (s === '[evento_id]' && x.attrs.evento_id) return x;
        if (s === '.colloquio_row' && (x.attrs.class || '').split(/\s+/).includes('colloquio_row')) return x;
      }
      return null;
    };
  }
  return { body: nodes[f.body], querySelectorAll: nodes[0].querySelectorAll, querySelector: nodes[0].querySelector };
}
function fixture(value = '') {
  const slot = { date: day, id: '77', hour: '5', total: '4', timetable: '12:00 - 12:40' };
  let rows = [{ id: '101', ordinal: 1, value, editable: true }, { id: '102', ordinal: 2, value: 'https://example.org/other', editable: true }];
  const booking = { ...rows[0], slot }, writes = [];
  let reads = 0, stopped = false;
  const api = {
    readBookings: async s => { assert.deepEqual(s, slot); reads++; return structuredClone(rows); },
    saveBookingLink: async (id, value) => { writes.push(core.bookingLinkPayload(id, value)); rows.find(r => r.id === id).value = value; return 'OK'; }
  };
  return { api, booking, writes, rows: () => rows, setRows: v => { rows = v; }, reads: () => reads, stopped: () => stopped, stop: () => { stopped = true; } };
}
test('URL: accetta link https, aggiunge schema; rifiuta schemi eseguibili, spazi e credenziali', () => {
  assert.equal(core.videoLink(' meet.google.com/abc-defg-hij '), link);
  assert.equal(core.videoLink(link + '?x=1&y=2'), link + '?x=1&y=2');
  for (const value of ['', 'javascript:alert(1)', 'http://example.org/', 'data:text/html,x', 'https://user:pass@example.org/', 'https://meet.google.com/a b', 'parola']) assert.throws(() => core.videoLink(value));
});
test('giornata: include tutte le fasce e solo la data scelta', () => {
  const slots = core.bookingSlots(doc('month'), '123', day);
  assert.deepEqual(slots.map(s => s.id), ['77', '78']);
  assert.deepEqual(core.bookingSlots(doc('month'), '123', '2026-11-17'), []);
});
test('giornata: blocca cambio docente/mese, dettaglio mancante e ora ambigua', () => {
  for (const name of ['wrong_author', 'wrong_month', 'missing_button', 'duplicate_hour']) assert.throws(() => core.bookingSlots(doc(name), '123', day));
});
test('prenotazioni: identifica valori e link non modificabili senza estrarre nomi', () => {
  const rows = core.bookingFields(doc('bookings'));
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(r => core.bookingStatus(r, link)), ['empty', 'replace', 'unavailable', 'unavailable']);
  assert.equal(rows[1].id, '102');
  assert.equal(core.bookingStatus({value:link,editable:true}, link), 'same');
});
test('prenotazioni: riconosce soltanto il messaggio vuoto noto; blocca risposte ambigue e login', () => {
  assert.deepEqual(core.bookingFields(doc('empty')), []);
  for (const name of ['duplicate_booking', 'missing_id', 'missing_field', 'unknown', 'login']) assert.throws(() => core.bookingFields(doc(name)));
});
test('salva il link nel campo dedicato della prenotazione, una sola volta, con rilettura', async () => {
  const f = fixture(), messages = [];
  await core.processBooking(f.booking, link, f.api, f.stopped, m => messages.push(m));
  assert.deepEqual(f.writes, [{action:'salva_link_live',evento_id:'101',memo:link}]);
  assert.equal(f.reads(), 2); assert.equal(f.rows()[1].value, 'https://example.org/other');
  assert.equal(messages.at(-1), 'Link salvato e verificato');
  await core.processBooking(f.booking, link, f.api, f.stopped, () => {});
  assert.equal(f.writes.length, 1, 'nessun nuovo invio quando il link è già uguale');
});
test('sostituisce un link selezionato solo se ancora uguale a quello dell’anteprima', async () => {
  const f = fixture('https://example.org/old');
  await core.processBooking(f.booking, link, f.api, f.stopped, () => {});
  assert.equal(f.rows()[0].value, link); assert.equal(f.writes.length, 1);
});
test('cambio del link dopo anteprima: nessuna sovrascrittura', async () => {
  const f = fixture(); f.rows()[0].value = 'https://example.org/changed';
  await assert.rejects(core.processBooking(f.booking, link, f.api, f.stopped, () => {}), /cambiato/);
  assert.equal(f.writes.length, 0);
});
test('prenotazione cancellata/spostata o diventata non modificabile: nessun invio', async () => {
  for (const remove of [true, false]) {
    const f = fixture(); if (remove) f.setRows([]); else f.rows()[0].editable = false;
    await assert.rejects(core.processBooking(f.booking, link, f.api, f.stopped, () => {}));
    assert.equal(f.writes.length, 0);
  }
});
test('OK senza persistenza: rilettura fallisce, nessun tentativo automatico', async () => {
  const f = fixture(); let writes = 0; f.api.saveBookingLink = async () => { writes++; return 'OK'; };
  await assert.rejects(core.processBooking(f.booking, link, f.api, f.stopped, () => {}), /Link non verificato/);
  assert.equal(writes, 1); assert.equal(f.reads(), 2);
});
test('risposta persa dopo salvataggio: verifica il valore senza reinviare', async () => {
  const f = fixture(), write = f.api.saveBookingLink;
  f.api.saveBookingLink = async (...args) => { await write(...args); throw new Error('timeout'); };
  await core.processBooking(f.booking, link, f.api, f.stopped, () => {});
  assert.equal(f.writes.length, 1); assert.equal(f.reads(), 2);
});
test('KO senza salvataggio: ferma l’elaborazione', async () => {
  const f = fixture(); let writes = 0; f.api.saveBookingLink = async () => { writes++; return 'KO'; };
  await assert.rejects(core.processBooking(f.booking, link, f.api, f.stopped, () => {}), /non ha confermato/);
  assert.equal(writes, 1);
});
test('errore nella rilettura: esito non verificato senza ritentare', async () => {
  const f = fixture(), read = f.api.readBookings;
  f.api.readBookings = async (...args) => { if (f.writes.length) throw new Error('network'); return read(...args); };
  await assert.rejects(core.processBooking(f.booking, link, f.api, f.stopped, () => {}), /non verificato/);
  assert.equal(f.writes.length, 1);
});
test('Ferma prima/durante lettura: nessun invio; dopo POST: verifica completata', async () => {
  const before = fixture(); before.stop();
  await core.processBooking(before.booking, link, before.api, before.stopped, () => {});
  assert.equal(before.reads(), 0); assert.equal(before.writes.length, 0);
  const during = fixture(), read = during.api.readBookings;
  during.api.readBookings = async (...args) => { const value = await read(...args); during.stop(); return value; };
  await core.processBooking(during.booking, link, during.api, during.stopped, () => {});
  assert.equal(during.writes.length, 0);
  const after = fixture(), write = after.api.saveBookingLink;
  after.api.saveBookingLink = async (...args) => { const value = await write(...args); after.stop(); return value; };
  await core.processBooking(after.booking, link, after.api, after.stopped, () => {});
  assert.equal(after.writes.length, 1); assert.equal(after.reads(), 2);
});
test('nuova iscrizione dopo anteprima: non viene inclusa nel salvataggio corrente', async () => {
  const f = fixture(); f.rows().push({id:'103',ordinal:3,value:'',editable:true});
  await core.processBooking(f.booking, link, f.api, f.stopped, () => {});
  assert.equal(f.rows()[2].value, ''); assert.equal(f.writes.length, 1);
});
