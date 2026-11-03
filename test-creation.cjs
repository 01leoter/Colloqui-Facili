/* Copyright (C) 2026 Leo971. SPDX-License-Identifier: GPL-3.0-or-later. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require(process.env.COLLOQUI_SOURCE || './content.js');
const c = core.config({hour:'5',parents:'4',place:'a distanza',start:'12:00',end:'12:40',all:false});
const d = '2026-11-16';
function fixture() {
  const store={}, events=new Map(), writes=[], reads=[];
  const journal={get:k=>store[k],set:(k,v)=>{store[k]=structuredClone(v)}};
  const api={id:'123',validate:async()=>{},find:async day=>events.get(day),
    readCreated:async day=>{reads.push(day);return structuredClone(events.get(day).data)},
    write:async p=>{
      assert.equal('nota1' in p,false,'Nessun invio del campo Avviso');
      writes.push(p);
      events.set(p.evento_data,{id:'999',date:p.evento_data,hour:p.ora,data:{date:p.evento_data,hour:p.ora,previousDate:p.data_prec,previousHour:p.ora_prec,place:p.luogo,parents:p.genitori,start:p.ora_ini,end:p.ora_fin,all:p.checkboxall==='true'}});
    }};
  return {store,events,writes,reads,journal,api};
}
test('date: cambio anno, giorno bisestile e ora legale',()=>{
  assert.deepEqual(core.weekly('2026-12-21','2027-01-11',1),['2026-12-21','2026-12-28','2027-01-04','2027-01-11']);
  assert.deepEqual(core.weekly('2026-10-19','2026-11-02',1),['2026-10-19','2026-10-26','2026-11-02']);
  assert.equal(core.date('2028-02-29').getUTCDate(),29);
  assert.throws(()=>core.date('2026-02-29'));
  assert.throws(()=>core.weekly('2026-11-02','2026-10-30',1));
});
test('configurazione senza link e validazione orari',()=>{
  assert.equal(core.time('9.05'),'09:05');
  for(const t of ['24:00','12:60','25.20','foo']) assert.throws(()=>core.time(t));
  assert.throws(()=>core.config({...c,end:'11:59'}));
  assert.equal('link' in core.config({...c,link:'dato della vecchia versione'}),false);
});
test('un solo salvataggio per data, verifica dati senza campo note, niente duplicati',async()=>{
  const f=fixture();
  await core.processDate(d,c,f.api,f.journal,()=>false,()=>{});
  assert.equal(f.writes.length,1);assert.equal(f.reads.length,1);
  assert.equal(f.store[d+'/5'].phase,'done');
  await core.processDate(d,c,f.api,f.journal,()=>false,()=>{});
  assert.equal(f.writes.length,1);assert.equal(f.reads.length,1);
});
test('tutte le fasi delle vecchie versioni: evento presente saltato senza modifica',async()=>{
  for(const phase of ['note_sent','created','done','create_sent']) {
    const f=fixture();f.events.set(d,{id:'preesistente'});
    f.journal.set(d+'/5',{phase,eventId:'preesistente',signature:JSON.stringify(['5','4','a distanza','12:00','12:40','vecchio link',false])});
    const messages=[];
    await core.processDate(d,c,f.api,f.journal,()=>false,m=>messages.push(m));
    assert.equal(f.writes.length,0);assert.equal(f.reads.length,0);
    assert.deepEqual(messages,['Già presente: saltato']);
  }
});
test('timeout dopo creazione riuscita: evento saltato alla ripresa',async()=>{
  const f=fixture(),write=f.api.write;
  f.api.write=async p=>{await write(p);throw new Error('timeout')};
  await assert.rejects(core.processDate(d,c,f.api,f.journal,()=>false,()=>{}));
  assert.equal(f.store[d+'/5'].phase,'create_sent');
  f.api.write=write;
  await core.processDate(d,c,f.api,f.journal,()=>false,()=>{});
  assert.equal(f.writes.length,1);
});
test('tentativo precedente senza evento visibile: mai reinviato senza scelta esplicita',async()=>{
  for(const phase of ['create_sent','created','note_sent','done']) {
    const f=fixture();f.journal.set(d+'/5',{phase,signature:'vecchia firma'});
    await assert.rejects(core.processDate(d,c,f.api,f.journal,()=>false,()=>{}),/Seleziona esplicitamente/);
    assert.equal(f.writes.length,0);
  }
});
test('colloquio creato e poi eliminato manualmente: ricreazione esplicita riuscita',async()=>{
  const f=fixture();
  await core.processDate(d,c,f.api,f.journal,()=>false,()=>{});
  f.events.delete(d);
  assert.equal(core.classify(f.journal.get(d+'/5'),undefined),'missing');
  await core.processDate(d,c,f.api,f.journal,()=>false,()=>{},true);
  assert.equal(f.writes.length,2);
  assert.equal(f.store[d+'/5'].phase,'done');
  await core.processDate(d,c,f.api,f.journal,()=>false,()=>{},true);
  assert.equal(f.writes.length,2);
});
test('tentativo incerto assente: nuova creazione solo con autorizzazione esplicita',async()=>{
  const f=fixture();f.journal.set(d+'/5',{phase:'create_sent'});
  assert.equal(core.classify(f.journal.get(d+'/5'),undefined),'uncertain');
  await core.processDate(d,c,f.api,f.journal,()=>false,()=>{},true);
  assert.equal(f.writes.length,1);assert.equal(f.store[d+'/5'].phase,'done');
});
test('evento ricomparso durante i controlli: niente doppia creazione anche se autorizzata',async()=>{
  const f=fixture();f.journal.set(d+'/5',{phase:'done'});
  f.api.validate=async()=>{f.events.set(d,{id:'ricomparso'})};
  await core.processDate(d,c,f.api,f.journal,()=>false,()=>{},true);
  assert.equal(f.writes.length,0);
});
test('ricreazione fallita: stato incerto persistito e nessun successivo invio automatico',async()=>{
  const f=fixture();f.journal.set(d+'/5',{phase:'done'});
  f.api.write=async()=>{throw new Error('timeout')};
  await assert.rejects(core.processDate(d,c,f.api,f.journal,()=>false,()=>{},true),/timeout/);
  assert.equal(f.store[d+'/5'].phase,'create_sent');
  await assert.rejects(core.processDate(d,c,f.api,f.journal,()=>false,()=>{}),/Seleziona esplicitamente/);
});
test('Ferma durante il POST: completa la verifica del colloquio già inviato',async()=>{
  const f=fixture(),write=f.api.write;let stop=false;
  f.api.write=async p=>{await write(p);stop=true};
  await core.processDate(d,c,f.api,f.journal,()=>stop,()=>{});
  assert.equal(f.writes.length,1);assert.equal(f.reads.length,1);
  assert.equal(f.store[d+'/5'].phase,'done');
});
test('Ferma prima del POST: nessuna creazione',async()=>{
  const f=fixture();let stop=false;f.api.validate=async()=>{stop=true};
  await core.processDate(d,c,f.api,f.journal,()=>stop,()=>{});
  assert.equal(f.writes.length,0);assert.equal(Object.keys(f.store).length,0);
});
test('dati riletti diversi: nessun completamento e nessun secondo salvataggio',async()=>{
  const f=fixture(),read=f.api.readCreated;
  f.api.readCreated=async day=>({...await read(day),start:'11:00'});
  await assert.rejects(core.processDate(d,c,f.api,f.journal,()=>false,()=>{}),/non corrispondono/);
  assert.equal(f.writes.length,1);assert.equal(f.store[d+'/5'].phase,'create_sent');
});
test('memoria locale non scrivibile: nessun POST',async()=>{
  const f=fixture();f.journal.set=()=>{throw new Error('quota')};
  await assert.rejects(core.processDate(d,c,f.api,f.journal,()=>false,()=>{}),/quota/);
  assert.equal(f.writes.length,0);
});
test('più settimane, compreso il 16 novembre già creato: procede alle successive',async()=>{
  const f=fixture();f.events.set(d,{id:'precedente'});
  f.journal.set(d+'/5',{phase:'note_sent',signature:'vecchia firma'});
  for(const day of [d,'2026-11-23','2026-11-30']) await core.processDate(day,c,f.api,f.journal,()=>false,()=>{});
  assert.deepEqual(f.writes.map(p=>p.evento_data),['2026-11-23','2026-11-30']);
  assert.equal(f.writes.every(p=>!('nota1' in p)),true);
});
test('richiesta di creazione mantiene sessione, caratteri e separazione pagina/AJAX',()=>{
  const p=core.payload(d,{...c,place:'Sede A & B – città'},'123');
  const opts=core.transportOptions(p,'POST');
  const wire=new URLSearchParams(opts.body.toString());
  assert.equal(wire.get('luogo'),'Sede A & B – città');
  assert.equal(wire.has('nota1'),false);assert.equal(wire.get('cancella'),'');
  assert.equal(opts.credentials,'same-origin');
  assert.equal(opts.headers['X-Requested-With'],'XMLHttpRequest');
  assert.equal(core.transportOptions({mese:'11'},'GET').headers['X-Requested-With'],undefined);
});
