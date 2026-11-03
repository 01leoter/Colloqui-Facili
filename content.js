/* Colloqui Facili — Copyright (C) 2026 Leo971
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * Strumento indipendente, non ufficiale. Nessuna libreria esterna o telemetria.
 * Protocollo ricavato dalla pagina fornita dall'utente il 30/10/2026.
 * Le risposte POST non sono considerate prova di salvataggio: ogni scrittura
 * viene verificata con una nuova lettura. Non ritentare POST a esito incerto.
 */
(function () {
  'use strict';
  const VERSION = '1.4.1';
  const PATH = '/cvv/app/default/gioprof_colloqui.php';
  const fail = message => { throw new Error(message); };
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  function date(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail('Data non valida: ' + s);
    const d = new Date(s + 'T12:00:00Z');
    if (!Number.isFinite(+d) || iso(d) !== s) fail('Data non valida: ' + s);
    return d;
  }
  function weekly(from, to, day) {
    const a = date(from), b = date(to);
    if (a > b || b - a > 366 * 86400000) fail('Scegli un periodo ordinato, non superiore a un anno.');
    if (!Number.isInteger(day) || day < 0 || day > 6) fail('Giorno non valido.');
    const dates = [];
    for (let d = a; d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() === day) dates.push(iso(d));
    }
    return dates;
  }
  function time(s) {
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(s.trim());
    if (!m || +m[1] > 23 || +m[2] > 59) fail('Orario non valido: ' + s);
    return `${pad(+m[1])}:${m[2]}`;
  }
  function config(c) {
    const result = { hour: c.hour, parents: c.parents, place: c.place,
      start: time(c.start), end: time(c.end), all: c.all };
    if (result.start >= result.end) fail('L’orario di fine deve essere successivo a quello di inizio.');
    if (!/^[1-9]\d*$/.test(c.hour) || !/^[1-9]\d*$/.test(c.parents) || !c.place) fail('Completa ora, luogo e numero di genitori.');
    return result;
  }
  const signature = c => JSON.stringify([c.hour, c.parents, c.place, c.start, c.end, c.all]);
  const key = (d, c) => `${d}/${c.hour}`;
  const pretty = d => date(d).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  function field(doc, selector) {
    const found = doc.querySelectorAll(selector);
    if (found.length !== 1) fail('Pagina non riconosciuta: campo ' + selector + '. Nessun nuovo invio.');
    return found[0];
  }
  const options = (doc, selector) => [...field(doc, selector).options].filter(o => !o.disabled).map(o => ({ value: o.value, label: o.textContent.trim() }));
  function allowed(doc, selector, value) {
    if (!options(doc, selector).some(o => o.value === value)) fail('Valore non disponibile nel registro: ' + value);
  }
  function parse(html) { return new DOMParser().parseFromString(html, 'text/html'); }
  function author(doc) {
    const ids = [...doc.querySelectorAll('script:not([src])')].flatMap(s =>
      [...s.textContent.matchAll(/\bvar\s+autore_id_rif\s*=\s*['"]?(\d+)['"]?\s*;/g)].map(m => m[1]));
    const unique = [...new Set(ids)];
    if (unique.length !== 1) fail('Non riconosco il docente della pagina. Apri la gestione dei tuoi colloqui.');
    return unique[0];
  }
  function listing(doc, id, month) {
    if (author(doc) !== id || !doc.querySelector('.aggiungi')) fail('Sessione o docente cambiati. Riapri il registro.');
    if (Number(field(doc, '.mese_selezionato').getAttribute('mese')) !== Number(month)) fail('Il mese restituito dal registro non corrisponde a quello richiesto.');
    return [...doc.querySelectorAll('button.jrounded-box[evento_data][ora_posizione]')].map(b => {
      const box = b.closest('[evento_id]');
      if (!box?.getAttribute('evento_id')) fail('Identificativo del colloquio assente.');
      return { date: b.getAttribute('evento_data'), hour: b.getAttribute('ora_posizione'), id: box.getAttribute('evento_id') };
    });
  }
  function snapshot(doc) {
    const p = field(doc, '#popupnotaalunno');
    return {
      date: field(p, '#evento_data').value,
      hour: field(p, '#ora').value,
      place: field(p, '#luogo').value,
      parents: field(p, '#genitori').value,
      start: time(field(p, '#ora_ini_mod').value),
      end: time(field(p, '#ora_fin_mod').value),
      previousDate: field(p, '#data_prec').value,
      previousHour: field(p, '#ora_prec').value,
      all: !!p.querySelector('#popup_cbox_all')?.checked
    };
  }
  function matches(s, d, c) {
    if (s.date !== d || s.previousDate !== d || s.hour !== c.hour || s.previousHour !== c.hour ||
        s.place !== c.place || s.parents !== c.parents || s.start !== c.start || s.end !== c.end || s.all !== c.all) {
      fail('I dati riletti non corrispondono al piano. Controlla il colloquio del ' + pretty(d) + '.');
    }
  }
  function payload(d, c, id) {
    return { action: 'confpopupdoc', evento_data: d, ora: c.hour, luogo: c.place,
      genitori: c.parents, cancella: '', ora_prec: c.hour, data_prec: d,
      autore_id: id, ora_ini: c.start, ora_fin: c.end, checkboxall: String(c.all) };
  }
  function transportOptions(params, method) {
    const headers = {};
    // Le azioni sono richieste AJAX come quelle di jQuery. La lettura della
    // pagina mensile resta una normale richiesta HTML, non un frammento AJAX.
    if (params.action) headers['X-Requested-With'] = 'XMLHttpRequest';
    headers.Accept = method === 'GET' ? 'text/html, */*' : '*/*';
    if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
    return { method, headers, credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      ...(method === 'POST' ? { body: new URLSearchParams(params) } : {}) };
  }
  function classify(entry, existing) {
    // Anche i colloqui creati dalle versioni precedenti sono già presenti:
    // si saltano senza ulteriori modifiche, indipendentemente dalla vecchia fase.
    if (existing) return 'existing';
    if (entry) return ['done', 'created', 'note_sent'].includes(entry.phase) ? 'missing' : 'uncertain';
    return 'new';
  }
  async function processDate(d, c, api, journal, stopped, report, recreate = false) {
    const k = key(d, c);
    const entry = journal.get(k);
    const existing = await api.find(d, c.hour);
    const status = classify(entry, existing);
    if (['missing', 'uncertain'].includes(status) && recreate !== true) fail('Tentativo precedente per ' + pretty(d) + '. Seleziona esplicitamente questa data nell’anteprima per ricrearla dopo aver controllato il registro.');
    if (status === 'existing') { report('Già presente: saltato'); return; }
    if (stopped()) return;
    await api.validate(d, c);
    if (stopped()) return;
    // La verifica delle opzioni può richiedere tempo: controlla ancora prima
    // dell'invio, anche se l'utente ha autorizzato una nuova creazione.
    if (await api.find(d, c.hour)) { report('Già presente: saltato'); return; }
    if (stopped()) return;
    const pending = { phase: 'create_sent', signature: signature(c), date: d, updated: new Date().toISOString() };
    journal.set(k, pending); // Persistenza PRIMA del POST: mai ritentare una creazione dall'esito ignoto.
    report('Creazione in corso…');
    await api.write(payload(d, c, api.id));
    // Anche se viene premuto Ferma, termina la verifica della scrittura già inviata.
    const created = await api.find(d, c.hour);
    if (!created) fail('Creazione non verificata per ' + pretty(d) + '. Controlla nel registro prima di procedere.');
    const saved = await api.readCreated(d, c.hour);
    matches(saved, d, c);
    journal.set(k, { ...pending, eventId: created.id, phase: 'done', updated: new Date().toISOString() });
    report('Completato e verificato');
  }

  function videoLink(value) {
    const raw = value.trim();
    if (!raw || /\s/.test(raw)) fail('Inserisci un link completo per la videochiamata, senza spazi.');
    let url;
    try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : 'https://' + raw); }
    catch { fail('Il link della videochiamata non è valido.'); }
    if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) fail('Usa un link https completo, ad esempio quello copiato da Meet.');
    return url.href;
  }
  function bookingSlots(doc, id, d) {
    date(d);
    const events = listing(doc, id, d.slice(5, 7)).filter(e => e.date === d);
    const buttons = [...doc.querySelectorAll('.gestione_note[evento_data]')].filter(b => b.getAttribute('evento_data') === d);
    const seen = new Set(), hours = new Set();
    const slots = buttons.map(b => {
      const slot = { date: d, id: b.getAttribute('evento_id'), hour: b.getAttribute('ora_posizione'),
        total: b.getAttribute('totale_pos'), timetable: b.getAttribute('orario') };
      if (!/^\d+$/.test(slot.id || '') || !/^\d+$/.test(slot.hour || '') || !/^\d+$/.test(slot.total || '') || !slot.timetable ||
          seen.has(slot.id) || hours.has(slot.hour) || !events.some(e => e.id === slot.id && e.hour === slot.hour)) {
        fail('Non riconosco i ricevimenti della giornata. Nessun link è stato inviato.');
      }
      seen.add(slot.id); hours.add(slot.hour);
      return slot;
    });
    if (events.length !== slots.length) fail('Non posso leggere tutti i ricevimenti della giornata. Ricarica il registro.');
    return slots;
  }
  function bookingFields(doc) {
    // Classi e attributi usati da aggiorna_testo e opendettagliocolloqui
    // nella pagina originale. Non estrarre nomi o contatti delle famiglie.
    if (doc.querySelector('input[type="password"], form[action*="login"]')) fail('Sessione scaduta. Accedi di nuovo al registro.');
    const fields = [...doc.querySelectorAll('.link_colloquio')];
    const rows = [...doc.querySelectorAll('.colloquio_row')];
    if (rows.some(r => r.querySelectorAll('.link_colloquio').length !== 1)) fail('Una prenotazione non presenta il campo link previsto. Controlla il dettaglio nel registro.');
    if (!fields.length) {
      if (!rows.length && doc.body.textContent.trim() === 'Non risultano prenotazioni per questo ricevimento.') return [];
      fail('Dettaglio delle prenotazioni non riconosciuto. Nessun link è stato inviato.');
    }
    const seen = new Set();
    return fields.map((f, index) => {
      const id = f.getAttribute('evento_id');
      if (!/^\d+$/.test(id || '') || seen.has(id) || !['INPUT', 'TEXTAREA'].includes(f.tagName)) fail('Identificativo della prenotazione assente o duplicato. Nessun link è stato inviato.');
      seen.add(id);
      const automatic = [...(f.closest('.colloquio_row')?.querySelectorAll('.manuale[auv]') || [])]
        .some(b => b.getAttribute('auv').trim() === 'true');
      return { id, value: f.value.trim(), ordinal: index + 1, editable: !f.disabled && !f.readOnly && !automatic };
    });
  }
  function bookingStatus(booking, link) {
    if (!booking.editable) return 'unavailable';
    if (booking.value === link) return 'same';
    return booking.value ? 'replace' : 'empty';
  }
  function bookingLinkPayload(bookingId, link) {
    if (!/^\d+$/.test(bookingId)) fail('Identificativo della prenotazione non valido.');
    return { action: 'salva_link_live', evento_id: bookingId, memo: videoLink(link) };
  }
  async function processBooking(booking, link, api, stopped, report) {
    // Anche in caso di timeout non reinviare automaticamente il POST.
    // Una nuova anteprima rilegge il registro e salta i link già impostati.
    if (stopped()) return;
    const current = (await api.readBookings(booking.slot)).find(b => b.id === booking.id);
    if (!current) fail('La prenotazione non è più presente in questo ricevimento. Rileggi la giornata.');
    if (current.value === link) { report('Link già presente: saltata'); return; }
    if (!current.editable) fail('Il link di questa prenotazione non è modificabile. Rileggi la giornata.');
    if (current.value !== booking.value) fail('Il link è cambiato dopo l’anteprima. Rileggi la giornata prima di sostituirlo.');
    if (stopped()) return;
    report('Salvataggio del link…');
    let writeError;
    try {
      const answer = await api.saveBookingLink(booking.id, link);
      if (answer.trim() !== 'OK') writeError = new Error('Il registro non ha confermato il link.');
    } catch (e) { writeError = e; }
    // Completa la verifica anche dopo Ferma o una risposta persa.
    let saved;
    try { saved = (await api.readBookings(booking.slot)).find(b => b.id === booking.id); }
    catch { fail('Salvataggio del link non verificato. Rileggi le prenotazioni prima di riprovare.'); }
    if (!saved || saved.value !== link) fail((writeError ? 'Il registro non ha confermato il salvataggio. ' : '') + 'Link non verificato nella prenotazione. Rileggi la giornata prima di riprovare.');
    report('Link salvato e verificato');
  }

  // Export utilizzato esclusivamente dai test locali, senza avviare l'interfaccia.
  if (typeof module === 'object' && module.exports) {
    module.exports = { weekly, date, time, config, signature, classify, payload, transportOptions, matches, processDate, listing, snapshot,
      videoLink, bookingSlots, bookingFields, bookingStatus, bookingLinkPayload, processBooking };
    return;
  }
  if (window.top !== window.self || location.origin !== 'https://web.spaggiari.eu' || location.pathname !== PATH || document.getElementById('cf-host')) return;

  let id;
  try { id = author(document); } catch (e) { console.warn('Colloqui Facili:', e.message); return; }
  const endpoint = new URL(PATH, location.origin);
  async function request(params, method = 'GET') {
    if (author(document) !== id) fail('Docente cambiato. Ricarica la pagina.');
    const url = new URL(endpoint);
    const body = new URLSearchParams(params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      if (method === 'GET') url.search = body.toString();
      const response = await fetch(url, { ...transportOptions(params, method), signal: controller.signal });
      if (!response.ok) fail('Il registro ha risposto con un errore (' + response.status + ').');
      const html = await response.text();
      if (method === 'POST' && /ERR_|<html|<form|errore|error|login|accedi/i.test(html)) fail('Il registro non ha confermato il salvataggio. Verifica la sessione e il colloquio.');
      return html;
    } catch (e) {
      if (e.name === 'AbortError') fail('Il registro non risponde. L’ultimo salvataggio può essere riuscito: controlla prima di riprovare.');
      throw e;
    } finally { clearTimeout(timer); }
  }
  const api = {
    id,
    async newForm() {
      const doc = parse(await request({ action: 'openpopupdocnew', add: '1', autore_id: id }));
      for (const s of ['#popupnotaalunno', '#evento_data', '#ora', '#genitori', '#luogo', '#ora_ini_new', '#ora_fin_new']) field(doc, s);
      return doc;
    },
    async places(d) {
      const doc = parse('<select id="places">' + await request({ action: 'get_luogo_ricevimento', evento_data: d, autore_id: id }) + '</select>');
      if (doc.querySelector('script, form, input[type=password]')) fail('Sessione scaduta o risposta inattesa.');
      const list = options(doc, '#places').filter(o => o.value.trim());
      if (!list.length) fail('Nessun luogo di ricevimento disponibile per ' + pretty(d));
      return list;
    },
    async list(month) {
      return listing(parse(await request({ mese: month, autore_id: id })), id, month);
    },
    async find(d, hour) {
      const items = (await this.list(d.slice(5, 7))).filter(e => e.date === d && e.hour === hour);
      if (items.length > 1) fail('Esistono più colloqui nella stessa data e ora: ' + pretty(d));
      return items[0];
    },
    async readCreated(d, hour) {
      return snapshot(parse(await request({ action: 'openpopupdoc', evento_data: d, ora: hour, autore_id: id })));
    },
    async validate(d, c) {
      const doc = await this.newForm();
      allowed(doc, '#evento_data', d); allowed(doc, '#ora', c.hour); allowed(doc, '#genitori', c.parents);
      if (!!doc.querySelector('#popup_cbox_all')?.checked !== c.all) fail('Le impostazioni del registro sono cambiate. Ricrea l’anteprima.');
      if (!(await this.places(d)).some(o => o.value === c.place)) fail('Luogo non disponibile per ' + pretty(d));
    },
    async write(p) { await request(p, 'POST'); },
    async slots(d) {
      return bookingSlots(parse(await request({ mese: d.slice(5, 7), autore_id: id })), id, d);
    },
    async readBookings(slot) {
      // Riconferma docente, giorno e ricevimento prima di leggere le prenotazioni.
      const current = (await this.slots(slot.date)).find(s => s.id === slot.id && s.hour === slot.hour);
      if (!current) fail('Il ricevimento non è più presente nella giornata. Rileggi le prenotazioni.');
      return bookingFields(parse(await request({ action: 'opendettagliocolloqui', evento_data: current.date,
        ora: current.hour, totale_pos: current.total, orario: current.timetable, autore_id: id })));
    },
    async saveBookingLink(bookingId, link) {
      return request(bookingLinkPayload(bookingId, link), 'POST');
    }
  };
  const storageKey = `colloqui-facili:v1:${id}`;
  function readJournal() {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) fail('Memoria locale non leggibile. Non avvio nuovi inserimenti.');
    return obj;
  }
  const journal = {
    get(k) { return readJournal()[k]; },
    set(k, value) {
      const obj = readJournal(); obj[k] = value;
      const text = JSON.stringify(obj);
      localStorage.setItem(storageKey, text);
      if (localStorage.getItem(storageKey) !== text) fail('Impossibile salvare l’avanzamento locale.');
    }
  };
  const host = document.createElement('div'); host.id = 'cf-host';
  const root = host.attachShadow({ mode: 'open' }); document.body.append(host);
  // Solo HTML statico locale. Versione e dati vengono assegnati con textContent.
  root.innerHTML = `
  <style>
    :host{all:initial;font:14px/1.5 system-ui,sans-serif;color:#172b39}
    *{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer;border:0;border-radius:9px;padding:10px 15px;background:#12655d;color:white;font-weight:650}button:disabled{opacity:.45;cursor:default}
    #launcher{position:fixed;bottom:22px;right:24px;z-index:1000001;box-shadow:0 5px 25px #0003}
    #panel{position:fixed;inset:4vh max(20px,calc((100vw - 900px)/2));z-index:1000002;background:#fff;border:1px solid #c8d9d7;border-radius:18px;box-shadow:0 15px 70px #0005;overflow:auto;padding:26px}
    [hidden]{display:none!important}header{display:flex;justify-content:space-between;gap:20px}h1{font-size:26px;margin:0}p{margin:8px 0 18px;color:#425b68}small{color:#526a78}.secondary{background:#e9f0ef;color:#204b47}.danger{background:#a33329}
    .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}label{display:block;font-weight:600}input,select{display:block;width:100%;padding:9px;border:1px solid #9eafb6;border-radius:7px;background:#fff;color:#172b39;margin-top:4px}fieldset{border:0;padding:0;margin:18px 0}legend{font-size:17px;font-weight:700;margin-bottom:8px}.wide{grid-column:1/-1}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.box{background:#f0f6f5;border-radius:10px;padding:12px}#message{white-space:pre-wrap}#message.error{background:#fff0e9;color:#882f16}#message:empty{display:none}#rows{max-height:280px;overflow:auto;border:1px solid #dae3e5;border-radius:9px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #e4ebec}td input{width:auto;margin:0}th{background:#f0f6f5;position:sticky;top:0}.muted{color:#607481}#summary{font-weight:650}
    .modes{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}.modes button[aria-pressed="false"]{background:#e9f0ef;color:#204b47}.scroll{max-height:300px;overflow:auto;border:1px solid #dae3e5;border-radius:9px}.current-link{display:block;font-size:12px;font-weight:400;overflow-wrap:anywhere;max-width:260px}
    @media(max-width:600px){#panel{inset:10px;padding:16px}.grid{grid-template-columns:1fr 1fr}h1{font-size:21px}}
  </style>
  <button id="launcher">Colloqui Facili</button>
  <section id="panel" hidden aria-label="Colloqui Facili">
    <header><div><small>CLASSEVIVA · STRUMENTO INDIPENDENTE</small><h1>Colloqui Facili</h1></div><button id="close" class="secondary" aria-label="Chiudi">Chiudi</button></header>
    <nav class="modes" aria-label="Scegli l’operazione"><button id="mode-create" aria-pressed="true">Crea colloqui</button><button id="mode-links" aria-pressed="false">Link alle prenotazioni</button></nav>
    <div id="message" class="box" role="status" aria-live="polite"></div>
    <section id="create-view" aria-label="Crea colloqui">
    <p>Scegli le settimane, controlla l’anteprima e crea i tuoi colloqui in un’unica operazione.</p>
    <button id="load" class="secondary">1. Leggi le opzioni del registro</button>
    <fieldset id="settings" disabled><legend>Il tuo ricevimento</legend><div class="grid">
      <label>Dal<input id="from" type="date"></label><label>Al<input id="to" type="date"></label>
      <label>Ogni<select id="day"><option value="1">Lunedì</option><option value="2">Martedì</option><option value="3">Mercoledì</option><option value="4">Giovedì</option><option value="5">Venerdì</option><option value="6">Sabato</option><option value="0">Domenica</option></select></label>
      <label>Ora scolastica<select id="hour"></select></label><label>Dalle<input id="start" type="time" value="12:00"></label><label>Alle<input id="end" type="time" value="12:40"></label>
      <label>Numero di genitori<select id="parents"></select></label><label class="wide">Luogo<select id="place"></select></label>
    </div><small>“Ora scolastica” è il numero nel registro (es. 5), distinto dall’orario 12:00–12:40. Gli orari proposti sono modificabili.</small>
    <div class="actions"><button id="preview">2. Prepara anteprima</button></div></fieldset>
    <section id="review" hidden><p id="summary"></p><p>Togli la spunta alle vacanze e alle date da escludere. Non vengono escluse automaticamente le festività.</p>
      <p>Per ricreare un colloquio eliminato, seleziona la data indicata come “Non più presente”. Le date con un tentativo precedente partono senza spunta: selezionale solo dopo aver controllato che il colloquio sia assente dal registro.</p>
      <div id="rows"><table><thead><tr><th>Includi</th><th>Data</th><th>Stato</th></tr></thead><tbody id="dates"></tbody></table></div>
      <div class="actions"><button id="run">3. Inserisci le date selezionate</button><button id="stop" class="danger" hidden>Ferma</button><button id="export" class="secondary">Scarica resoconto</button><button id="finish" hidden>Chiudi e aggiorna il registro</button></div>
    </section>
    </section>
    <section id="links-view" aria-label="Link alle prenotazioni" hidden>
      <p>Assegna lo stesso link alle prenotazioni di una giornata, anche su più fasce orarie.</p>
      <fieldset id="links-settings"><legend>La videochiamata del giorno</legend><div class="grid">
        <label>Giorno<input id="links-day" type="date"></label>
        <label class="wide">Link della videochiamata<input id="links-url" type="url" placeholder="https://meet.google.com/…" autocomplete="off" spellcheck="false"></label>
      </div><div class="actions"><button id="links-load">1. Leggi le prenotazioni</button></div></fieldset>
      <section id="links-review" hidden>
        <p id="links-summary"></p>
        <p>Le prenotazioni senza link sono selezionate. Per sostituire un link diverso, seleziona esplicitamente la riga corrispondente.</p>
        <p><small>I numeri seguono l’ordine delle prenotazioni nel dettaglio di ciascun ricevimento. Le nuove iscrizioni richiedono una nuova esecuzione.</small></p>
        <div class="scroll"><table><thead><tr><th>Includi</th><th>Prenotazione</th><th>Stato</th></tr></thead><tbody id="links-rows"></tbody></table></div>
        <div class="actions"><button id="links-run">2. Applica il link alle selezionate</button><button id="links-stop" class="danger" hidden>Ferma</button><button id="links-export" class="secondary">Scarica resoconto</button><button id="links-finish" hidden>Chiudi e aggiorna il registro</button></div>
      </section>
    </section>
    <p><small>Lascia questa scheda aperta durante l’elaborazione. “Ferma” attende la verifica dell’operazione in corso. I colloqui e i link già salvati restano nel registro. Versione <span id="cf-version"></span> · Powered by Leo971 · <a id="cf-license" target="_blank" rel="noopener noreferrer">GPL-3.0-or-later</a>.</small></p>
  </section>`;
  const $ = s => root.querySelector(s);
  $('#cf-version').textContent = VERSION;
  let form, plan, linksPlan, busy = false, stop = false, linksRunning = false;
  function message(text, error = false) { $('#message').textContent = text; $('#message').classList.toggle('error', error); }
  function fill(selector, values, preferred) {
    const sel = $(selector); sel.replaceChildren(...values.map(o => new Option(o.label, o.value)));
    if (values.some(o => o.value === preferred)) sel.value = preferred;
  }
  function invalidate() { plan = null; $('#review').hidden = true; $('#finish').hidden = true; }
  function invalidateLinks() { linksPlan = null; $('#links-review').hidden = true; $('#links-finish').hidden = true; }
  function busyState(value) {
    busy = value; $('#settings').disabled = value || !form; $('#load').disabled = value;
    $('#run').disabled = value || !plan || !!plan.consumed; $('#stop').hidden = !value;
    $('#finish').disabled = value;
    $('#mode-create').disabled = value; $('#mode-links').disabled = value;
    $('#links-settings').disabled = value;
    $('#links-run').disabled = value || !linksPlan || !!linksPlan.consumed;
    $('#links-stop').hidden = !linksRunning;
    $('#links-finish').disabled = value;
    for (const box of root.querySelectorAll('#dates input')) box.disabled = value || box.dataset.blocked === 'yes';
    for (const box of root.querySelectorAll('#links-rows input')) box.disabled = value || box.dataset.blocked === 'yes';
  }
  async function guarded(fn) {
    if (busy) return;
    busyState(true);
    try { await fn(); } catch (e) { message(e.message, true); }
    finally { busyState(false); }
  }
  $('#launcher').onclick = () => { $('#panel').hidden = false; };
  $('#close').onclick = () => { $('#panel').hidden = true; };
  function mode(links) {
    if (busy) return;
    $('#create-view').hidden = links; $('#links-view').hidden = !links;
    $('#mode-create').setAttribute('aria-pressed', String(!links));
    $('#mode-links').setAttribute('aria-pressed', String(links));
    message('');
  }
  $('#mode-create').onclick = () => mode(false);
  $('#mode-links').onclick = () => mode(true);
  $('#finish').onclick = () => {
    if (busy || $('#finish').hidden) return;
    $('#panel').hidden = true;
    window.location.reload();
  };
  $('#stop').onclick = () => { stop = true; message('Arresto richiesto. Attendo la verifica dell’operazione in corso…'); };
  $('#links-stop').onclick = $('#stop').onclick;
  $('#links-finish').onclick = () => {
    if (busy || $('#links-finish').hidden) return;
    $('#panel').hidden = true; window.location.reload();
  };
  const todayForLinks = new Date();
  $('#links-day').value = `${todayForLinks.getFullYear()}-${pad(todayForLinks.getMonth() + 1)}-${pad(todayForLinks.getDate())}`;
  $('#links-settings').oninput = () => { invalidateLinks(); message(''); };
  $('#links-load').onclick = () => guarded(async () => {
    invalidateLinks();
    const d = $('#links-day').value; date(d);
    const link = videoLink($('#links-url').value); $('#links-url').value = link;
    message('Lettura delle prenotazioni del ' + pretty(d) + '…');
    const slots = await api.slots(d);
    if (!slots.length) fail('Nessun ricevimento trovato per questa giornata. Controlla la data e l’anno.');
    const rows = [], seen = new Set();
    const labels = { empty: 'Da inserire', same: 'Link già presente: saltata', replace: 'Link presente: seleziona per sostituire', unavailable: 'Link gestito dal registro o non modificabile' };
    for (const slot of slots) {
      for (const b of await api.readBookings(slot)) {
        if (seen.has(b.id)) fail('Una prenotazione compare in più ricevimenti. Controlla la giornata nel registro.');
        seen.add(b.id);
        const status = bookingStatus(b, link);
        rows.push({ ...b, slot, status, label: labels[status] });
      }
    }
    if (!rows.length) { message('Nessuna prenotazione presente per ' + pretty(d) + '. Riprova dopo l’iscrizione dei genitori.'); return; }
    linksPlan = { date: d, link, rows };
    $('#links-rows').replaceChildren();
    for (const r of rows) {
      const tr = document.createElement('tr'), td = document.createElement('td'), cb = document.createElement('input');
      cb.type = 'checkbox'; cb.setAttribute('aria-label', `Includi prenotazione ${r.ordinal}, ${r.slot.timetable}`);
      cb.checked = r.status === 'empty'; cb.dataset.blocked = ['empty', 'replace'].includes(r.status) ? 'no' : 'yes';
      cb.disabled = cb.dataset.blocked === 'yes'; r.checkbox = cb; td.append(cb); tr.append(td);
      const name = document.createElement('td'); name.textContent = `${r.slot.timetable} · prenotazione ${r.ordinal}`;
      if (r.value) { const old = document.createElement('small'); old.className = 'current-link'; old.textContent = 'Attuale: ' + r.value; name.append(old); }
      tr.append(name);
      const state = document.createElement('td'); state.textContent = r.label; tr.append(state); r.cell = state;
      $('#links-rows').append(tr);
    }
    $('#links-summary').textContent = `${pretty(d)} · ${rows.length} prenotazioni · ${slots.length} ricevimenti`;
    $('#links-review').hidden = false;
    message('Anteprima pronta. Controlla le righe selezionate: nessun link è stato ancora inviato.');
  });
  $('#links-run').onclick = () => guarded(async () => {
    if (!linksPlan || linksPlan.consumed) fail('Rileggi le prenotazioni prima di procedere.');
    const chosen = linksPlan.rows.filter(r => r.checkbox.checked && r.checkbox.dataset.blocked !== 'yes');
    if (!chosen.length) fail('Seleziona almeno una prenotazione da aggiornare.');
    if (!navigator.locks) fail('Usa una versione aggiornata di Firefox, Chrome o Edge per il blocco tra schede.');
    const replaceCount = chosen.filter(r => r.status === 'replace').length;
    if (!confirm(`Applicare questo link a ${chosen.length} prenotazioni del ${pretty(linksPlan.date)}?\n\n${linksPlan.link}\n\n${replaceCount ? `Sostituirai ${replaceCount} link già presenti nelle righe selezionate.\n\n` : ''}Le prenotazioni non selezionate resteranno invariate. Le nuove iscrizioni richiederanno una nuova esecuzione.`)) return;
    stop = false;
    await navigator.locks.request('colloqui-facili:' + id, { ifAvailable: true }, async lock => {
      if (!lock) fail('Colloqui Facili sta già lavorando in un’altra scheda.');
      linksPlan.consumed = true; linksRunning = true; busyState(true);
      try {
        for (const r of chosen) {
          if (stop) break;
          message(`Salvataggio: ${r.slot.timetable}, prenotazione ${r.ordinal}…`);
          try {
            await processBooking(r, linksPlan.link, api, () => stop, text => { r.label = text; r.cell.textContent = text; });
          } catch (e) {
            r.label = 'Fermato: ' + e.message; r.cell.textContent = r.label; throw e;
          }
        }
        $('#links-finish').hidden = stop;
        message(stop ? 'Elaborazione fermata. I link già salvati restano nel registro. Rileggi le prenotazioni per continuare.' : 'Elaborazione completata. I link delle prenotazioni selezionate sono stati verificati. Puoi chiudere e aggiornare il registro.');
      } finally { linksRunning = false; }
    });
  });
  $('#links-export').onclick = () => {
    if (!linksPlan) return;
    const text = ['Colloqui Facili ' + VERSION, 'Link alle prenotazioni · ' + pretty(linksPlan.date), new Date().toLocaleString('it-IT'), '',
      ...linksPlan.rows.map(r => `${r.slot.timetable} | Prenotazione ${r.ordinal} | ${r.checkbox.checked ? 'Selezionata' : 'Esclusa'} | ${r.label}`)].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'resoconto-link-prenotazioni.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('#settings').oninput = invalidate;
  $('#load').onclick = () => guarded(async () => {
    invalidate(); form = null; message('Lettura delle opzioni disponibili…');
    const loaded = await api.newForm();
    const dates = options(loaded, '#evento_data').map(o => o.value).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s)).sort();
    if (!dates.length) fail('Il registro non propone date disponibili.');
    fill('#hour', options(loaded, '#ora').filter(o => Number(o.value) > 0), '5');
    fill('#parents', options(loaded, '#genitori').filter(o => Number(o.value) > 0), '4');
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
    const from = dates.find(d => d >= todayISO) || dates[0];
    $('#from').value = from;
    const until = date(from); until.setUTCDate(until.getUTCDate() + 35);
    $('#to').value = dates.filter(d => d <= iso(until)).at(-1) || from;
    for (const s of ['#from', '#to']) { $(s).min = dates[0]; $(s).max = dates.at(-1); }
    const first = weekly($('#from').value, $('#to').value, Number($('#day').value)).find(d => dates.includes(d)) || from;
    fill('#place', await api.places(first), 'a distanza');
    form = loaded;
    message('Opzioni lette. Controlla il periodo, gli orari proposti e il luogo di ricevimento.');
  });
  // Il luogo può dipendere dal giorno: ricaricalo quando cambia il periodo/giorno.
  for (const selector of ['#from', '#to', '#day']) $(selector).addEventListener('change', () => guarded(async () => {
    invalidate();
    const d = weekly($('#from').value, $('#to').value, Number($('#day').value))[0];
    if (d) { const old = $('#place').value; fill('#place', await api.places(d), old); }
  }));
  $('#preview').onclick = () => guarded(async () => {
    invalidate(); message('Controllo delle date e dei colloqui già presenti…');
    const c = config({ hour: $('#hour').value, parents: $('#parents').value, place: $('#place').value,
      start: $('#start').value, end: $('#end').value, all: !!form.querySelector('#popup_cbox_all')?.checked });
    const dates = weekly($('#from').value, $('#to').value, Number($('#day').value));
    if (!dates.length) fail('Nessuna data nel periodo selezionato.');
    const available = new Set(options(form, '#evento_data').map(o => o.value));
    const months = new Map();
    for (const d of dates) if (!months.has(d.slice(5,7))) months.set(d.slice(5,7), await api.list(d.slice(5,7)));
    const labels = { new: 'Da creare', existing: 'Già presente: saltato', missing: 'Non più presente: seleziona per ricreare', uncertain: 'Esito incerto: seleziona solo dopo controllo', unavailable: 'Data non proposta dal registro', place: 'Luogo non disponibile', duplicate: 'Più colloqui: controllo manuale' };
    const rows = [];
    for (const d of dates) {
      const found = months.get(d.slice(5,7)).filter(e => e.date === d && e.hour === c.hour);
      let status = found.length > 1 ? 'duplicate' : classify(journal.get(key(d,c)), found[0]);
      if (['new', 'missing', 'uncertain'].includes(status)) {
        if (!available.has(d)) status = 'unavailable';
        else if (!(await api.places(d)).some(o => o.value === c.place)) status = 'place';
      }
      rows.push({ date: d, status, label: labels[status] });
    }
    plan = { config: c, rows };
    $('#dates').replaceChildren();
    for (const r of rows) {
      const tr = document.createElement('tr'), td = document.createElement('td'), cb = document.createElement('input');
      cb.type = 'checkbox'; cb.setAttribute('aria-label', 'Includi ' + pretty(r.date));
      const actionable = ['new', 'missing', 'uncertain'].includes(r.status);
      cb.checked = r.status === 'new'; cb.dataset.blocked = actionable ? 'no' : 'yes'; cb.disabled = !actionable;
      r.checkbox = cb; td.append(cb); tr.append(td);
      const day = document.createElement('td'); day.textContent = pretty(r.date); tr.append(day);
      const state = document.createElement('td'); state.textContent = r.label; tr.append(state); r.cell = state;
      $('#dates').append(tr);
    }
    $('#summary').textContent = `${c.start}–${c.end} · ora ${c.hour} · ${c.parents} genitori · ${c.place}`;
    $('#review').hidden = false;
    message('Anteprima pronta. Nessun colloquio è stato ancora inserito.');
  });
  $('#run').onclick = () => guarded(async () => {
    if (!plan) fail('Prepara prima l’anteprima.');
    const chosen = plan.rows.filter(r => r.checkbox.checked && r.checkbox.dataset.blocked !== 'yes');
    if (!chosen.length) fail('Seleziona almeno una data da elaborare.');
    if (!navigator.locks) fail('Questo browser non supporta il blocco tra schede. Usa una versione aggiornata di Firefox, Chrome, Edge o Safari.');
    const retries = chosen.filter(r => ['missing', 'uncertain'].includes(r.status));
    const retryNotice = retries.length ? '\n\nNuova creazione dopo un tentativo precedente:\n' + retries.map(r => pretty(r.date)).join('\n') + '\n\nQueste date verranno ricreate. Procedi dopo aver controllato che i colloqui siano assenti dal registro.' : '';
    if (!confirm(`Inserire ${chosen.length} colloqui nel registro?\n\n${$('#summary').textContent}\n\nDal ${pretty(chosen[0].date)} al ${pretty(chosen.at(-1).date)}${retryNotice}\n\nLe date escluse non saranno toccate.`)) return;
    plan.consumed = true;
    stop = false;
    await navigator.locks.request('colloqui-facili:' + id, { ifAvailable: true }, async lock => {
      if (!lock) fail('Colloqui Facili sta già lavorando in un’altra scheda.');
      // Verifica che la memoria sia scrivibile prima di qualunque invio.
      journal.set('_version', VERSION);
      for (const r of chosen) {
        if (stop) break;
        message('Elaborazione di ' + pretty(r.date) + '…');
        try {
          await processDate(r.date, plan.config, api, journal, () => stop, text => { r.label = text; r.cell.textContent = text; }, ['missing', 'uncertain'].includes(r.status));
        } catch (e) {
          r.label = 'Fermato: ' + e.message; r.cell.textContent = r.label;
          throw e;
        }
      }
      $('#finish').hidden = stop;
      message(stop ? 'Elaborazione fermata. Ricrea l’anteprima per continuare; i colloqui salvati restano nel registro.' : 'Elaborazione completata. Se desideri, scarica il resoconto; poi premi “Chiudi e aggiorna il registro” per visualizzare i colloqui.');
    });
  });
  $('#export').onclick = () => {
    if (!plan) return;
    const text = ['Colloqui Facili ' + VERSION, new Date().toLocaleString('it-IT'), $('#summary').textContent, '',
      ...plan.rows.map(r => `${r.date} | ${r.checkbox.checked ? 'Selezionata' : 'Esclusa'} | ${r.label}`)].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'resoconto-colloqui.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Il popup comunica solo con il content script di questa estensione.
  const extensionAPI = globalThis.browser || globalThis.chrome;
  const helpLink = document.createElement('a');
  helpLink.textContent = 'Aiuto';
  helpLink.href = extensionAPI.runtime.getURL('help.html');
  helpLink.target = '_blank';
  helpLink.rel = 'noopener noreferrer';
  helpLink.className = 'secondary';
  const headerActions = document.createElement('div');
  headerActions.className = 'cf-header-actions';
  const closeButton = $('#close');
  closeButton.before(headerActions);
  headerActions.append(helpLink, closeButton);
  root.querySelector('style').textContent += '.cf-header-actions{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap}.cf-header-actions a{display:inline-block;text-decoration:none;border-radius:9px;padding:10px 15px;font-weight:650}#cf-license{color:#12655d}';
  $('#cf-license').href = extensionAPI.runtime.getURL('help.html') + '#licenza';
  extensionAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id !== extensionAPI.runtime.id || request?.type !== 'COLLOQUI_FACILI_OPEN') return;
    $('#panel').hidden = false;
    sendResponse({ opened: true });
  });

})();
