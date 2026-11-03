<img src="icon-128.png" width="96" alt="Logo Colloqui Facili">

# Colloqui Facili

**Colloqui settimanali e link alle prenotazioni su ClasseViva, con anteprima e verifica.**

Powered by **Leo971** · Software libero **GPL-3.0-or-later** · Versione **1.4.1**

## Scarica e installa

| Browser | Installazione |
| --- | --- |
| **Firefox** | [Installa da Mozilla Add-ons](https://addons.mozilla.org/it/firefox/addon/colloqui-facili/) |
| **Microsoft Edge** | [Installa da Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/colloqui-facili/fdlhnhhmkfcjpgkfgdnldcgjdekdbjgj) |
| **Google Chrome** | [Scarica il pacchetto con guida dettagliata](https://github.com/01leoter/Colloqui-Facili/releases/download/v1.4.1/Colloqui-Facili-Chrome-Manuale-1.4.1.zip) |

[Tutti i pacchetti e le note della versione](https://github.com/01leoter/Colloqui-Facili/releases/tag/v1.4.1).

### Installazione manuale in Chrome

1. Scarica il pacchetto Chrome dal collegamento qui sopra ed estrai tutto lo ZIP.
2. Conserva la cartella **Colloqui-Facili-Chrome** in una posizione stabile, per esempio Documenti.
3. Apri **GUIDA-CHROME.html**: contiene installazione, utilizzo, aggiornamenti e soluzioni ai problemi comuni.
4. In Chrome apri `chrome://extensions`, attiva **Modalità sviluppatore**, premi **Carica estensione non pacchettizzata** e seleziona la sottocartella **estensione**.
5. Accedi a ClasseViva e ricarica la pagina di gestione dei colloqui.

Conserva la cartella e lascia attiva Modalità sviluppatore. Gli aggiornamenti di questa installazione sono manuali. Non occorre installare Tampermonkey o copiare codice. [Procedura ufficiale Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).

## Cosa fa

- **Crea i colloqui su più settimane:** scegli periodo, giorno, ora scolastica, orario, luogo e numero massimo di genitori.
- **Mostra un’anteprima:** escludi le date non desiderate. I colloqui già presenti nella stessa data e ora scolastica vengono saltati.
- **Assegna lo stesso link alle prenotazioni del giorno:** include più fasce orarie e permette di sostituire un link diverso soltanto dopo una selezione esplicita.
- **Verifica i salvataggi:** rilegge i dati dopo ogni operazione e permette di scaricare un resoconto.
- **Include una guida locale:** il pulsante Aiuto apre le istruzioni senza richiedere altri servizi.

Vacanze e festività devono essere escluse manualmente. Le nuove prenotazioni richiedono una nuova esecuzione per ricevere il link. Il campo Avviso del ricevimento non viene modificato.

## Come si usa

Accedi con il tuo account docente, apri **Colloqui con la famiglia** nella pagina di gestione dei colloqui e premi **Colloqui Facili** in basso a destra. Scegli **Crea colloqui** oppure **Link alle prenotazioni**, controlla l’anteprima e conferma. Al termine usa **Chiudi e aggiorna il registro**.

Se usavi il vecchio script di Colloqui Facili in Tampermonkey, disattivalo e ricarica il registro. Evita di eseguire due copie contemporaneamente.

L’estensione è destinata ai browser su computer e richiede un account docente abilitato ai colloqui. La versione Firefox richiede almeno Firefox 142. L’app mobile di ClasseViva non è supportata. Le funzioni dipendono dalle pagine e dalle opzioni rese disponibili dal registro.

## Dati

Il programma comunica con **web.spaggiari.eu** usando la sessione già aperta, per leggere e salvare le operazioni richieste. Tratta identificativi del docente, dei colloqui e delle prenotazioni, parametri del ricevimento e link. Non acquisisce la password e non invia dati a server dello sviluppatore. Non contiene pubblicità o telemetria.

Mantiene nei dati locali del sito un registro dei tentativi per gestire duplicati e interruzioni. I link delle prenotazioni lette restano nella memoria della scheda. La rimozione dell’estensione non cancella i colloqui salvati nel registro.

## Sorgenti e sviluppo

JavaScript, HTML e CSS sono leggibili e modificabili. `icon.svg` è la sorgente delle icone. Il codice comune è in `content.js`; i tre manifest sono distinti. I file alla radice sono sorgenti: per ottenere le cartelle caricabili nei browser usa la build.

Con Node.js 24, senza dipendenze aggiuntive:

```sh
node build.cjs
node verify.cjs
node --test test-creation.cjs test-bookings.cjs
```

La build genera `dist/Chrome`, `dist/Firefox` e `dist/Edge`. La verifica confronta i 15 file di ciascun browser con quelli della versione 1.4.1; dopo modifiche intenzionali gli hash di riferimento vanno aggiornati consapevolmente. I 31 test usano dati simulati e non sostituiscono una prova nel registro reale.

La build Firefox produce file non firmati. Per l’installazione ordinaria usa Mozilla Add-ons o il file XPI firmato della release. Lo ZIP Edge della release è il pacchetto per lo store o per il caricamento locale, mentre l’installazione normale avviene dal link Edge Add-ons sopra.

## Segnalazioni

Apri una [segnalazione](https://github.com/01leoter/Colloqui-Facili/issues) indicando browser, versione dell’estensione e messaggio ricevuto. Non inserire password, nomi o contatti delle famiglie; oscura questi dati nelle immagini.

## Licenza

Copyright © 2026 Leo971. [GNU General Public License, versione 3 o successiva](LICENSE). Gli avvisi sono in [COPYING-NOTICE.txt](COPYING-NOTICE.txt). Il software è distribuito senza garanzia, nei termini della licenza.

Strumento indipendente, non ufficiale e non affiliato a ClasseViva o al Gruppo Spaggiari. I marchi appartengono ai rispettivi titolari.
