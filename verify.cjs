/* Copyright (C) 2026 Leo971. SPDX-License-Identifier: GPL-3.0-or-later. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const expected=require('./expected-sha256.json');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(path.join(dir,f.name)).map(n=>f.name+'/'+n):[f.name]);}
for(const [browser,hashes] of Object.entries(expected)){
  const dir=path.join(__dirname,'dist',browser);
  assert.deepEqual(files(dir).sort(),Object.keys(hashes).sort(),browser+': file list differs');
  for(const [name,hash] of Object.entries(hashes)){
    const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex');
    assert.equal(actual,hash,browser+'/'+name);
  }
  console.log(browser+': '+Object.keys(hashes).length+' file identici alla release 1.4.1');
}
