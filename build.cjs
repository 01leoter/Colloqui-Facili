/* Copyright (C) 2026 Leo971. SPDX-License-Identifier: GPL-3.0-or-later. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const common=['content.js','popup.js','popup.html','popup.css','privacy.css','help.html'];
for(const browser of ['Chrome','Firefox','Edge']){
  const out=path.join(__dirname,'dist',browser);
  fs.mkdirSync(path.join(out,'icons'),{recursive:true});
  function copy(source,target){fs.copyFileSync(path.join(__dirname,source),path.join(out,target));}
  for(const file of common)copy(file,file);
  copy('manifest-'+browser.toLowerCase()+'.json','manifest.json');
  copy(browser==='Edge'?'privacy-edge.html':'privacy.html','privacy.html');
  copy(browser==='Edge'?'COPYING-NOTICE-edge.txt':'COPYING-NOTICE.txt','COPYING-NOTICE.txt');
  copy('LICENSE','LICENSE.txt');
  copy('icon.svg','icons/source.svg');
  for(const size of [16,32,48,128])copy('icon-'+size+'.png','icons/'+size+'.png');
  console.log('Pronta: dist/'+browser);
}
