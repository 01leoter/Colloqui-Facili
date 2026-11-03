/* Copyright (C) 2026 Leo971
SPDX-License-Identifier: GPL-3.0-or-later
See LICENSE.txt. Distributed WITHOUT ANY WARRANTY. */
'use strict';
const extensionAPI = globalThis.browser || globalThis.chrome;
document.getElementById('open').addEventListener('click', async () => {
  const button = document.getElementById('open');
  const status = document.getElementById('status');
  button.disabled = true;
  try {
    const [tab] = await extensionAPI.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('no-tab');
    const response = await extensionAPI.tabs.sendMessage(tab.id, { type: 'COLLOQUI_FACILI_OPEN' });
    if (!response?.opened) throw new Error('not-ready');
    window.close();
  } catch {
    status.textContent = 'Apri la pagina dei colloqui con il tuo accesso a ClasseViva. Se è già aperta, ricaricala e riprova. Se usavi Tampermonkey, disattiva il vecchio script e ricarica.';
  } finally { button.disabled = false; }
});
