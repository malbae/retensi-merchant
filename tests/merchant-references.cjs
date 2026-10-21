const assert=require('node:assert/strict'),refs=require('../merchant-references.js'),cats=require('../business-categories.js');
const haus={merchant_name:'INSPIRASI BISNIS NUSANTARA'};
assert.equal(refs.lookup(haus).legal,'PT Inspirasi Bisnis Nusantara');
assert.equal(cats.classify(haus).category,'Kuliner');
assert.equal(cats.classify(haus,'Jasa').category,'Jasa');
assert.equal(refs.lookup({merchant_name:'XYZ'}),null);
assert.equal(cats.classify({merchant_name:'HONGJIN JAYA INDONESIA'}).category,'Belum terklasifikasi');
assert.equal(cats.classify({merchant_name:'PREMIUM WATCHES'}).category,'Retail & Perdagangan');
assert.equal(cats.classify({merchant_name:'BURJO TAMA'}).category,'Kuliner');
assert.equal(cats.classify({lob:'Distribusi Film/Video'}).category,'Perhotelan & Hiburan');
const period={year:2026,month:10};
const actual=refs.transactions({totals:{sv26:10000000,trx26:200}},35000,period);
assert.equal(actual.actual,true);assert.equal(actual.count,200);assert.equal(actual.ticket,50000);assert.equal(actual.daily,200/304);
assert.equal(refs.transactions({totals:{sv26:10000000,trx26:0}},35000,period).count,0);
const proxy=refs.transactions({sv_ytd:1000000},50000,period);assert.equal(proxy.actual,false);assert.equal(proxy.count,20);
assert.equal(refs.transactions({sv_ytd:1000000},null,period).count,null);
assert.equal(refs.lookup({merchant_name:'BUTTER BABY - B2B B2C'}).legal,'');
for(const entry of refs.entries){assert(entry.url.startsWith('https://'));assert(!('transactions' in entry))}
console.log('Public references: exact match, manual precedence, ambiguous identity, expanded categories, actual/proxy transactions and source URLs passed.');
