(function(root){
  'use strict';
  const rules=[
    ['Kesehatan', /\b(klinik|clinic|hospital|rumah sakit|apotek|apotik|farmasi|pharmacy|dental|dokter|medical|laboratorium|lab|intibios|kesehatan)\b/],
    ['Kecantikan', /\b(salon|barber|barbershop|beauty|spa|skincare|kosmetik|cosmetic|kecantikan)\b/],
    ['Pendidikan', /\b(sekolah|school|universitas|university|kursus|bimbel|pendidikan|akademi|college|training)\b/],
    ['Kuliner', /\b(restoran|restaurant|rumah makan|kedai|warung|warkop|cafe|café|coffee|coffe|kopi|bakery|baker|roti|bakso|soto|ayam|sate|kantin|catering|katering|kuliner|makanan|minuman|food|beverage|kue|pempek|shigeru|ramen|sushi|tiam)\b/],
    ['Otomotif', /\b(otomotif|bengkel|motor|mobil|automotive|sparepart|spare part|carwash|car wash|onderdil)\b/],
    ['Perhotelan & Hiburan', /\b(hotel|motel|resor|resort|penginapan|hiburan|cinema|bioskop|karaoke|rekreasi|wisata|fitness|gym|pilates|olahraga)\b/],
    ['Transportasi & Logistik', /\b(transportasi|transport|kurir|courier|logistik|logistics|ekspedisi|travel|taksi|taxi|angkutan)\b/],
    ['Keuangan', /\b(bank|perbankan|asuransi|insurance|finance|keuangan|pegadaian|koperasi)\b/],
    ['Retail & Perdagangan', /\b(retail|perdagangan|supermarket|minimarket|kelontong|sembako|toko|store|mart|pakaian|fashion|boutique|butik|thrift|elektronik|ponsel|cell|pulsa|aksesoris|accessories|furniture|furnitur|perlengkapan|tableware|grosir|distributor)\b/],
    ['Jasa', /\b(jasa|layanan|service|laundry|percetakan|printing|konsultan|consultant|notaris|fotografi|photography|dekorasi|decor|kontraktor|konstruksi|properti|property)\b/]
  ];
  const categories=[...rules.map(r=>r[0]),'Multi bisnis','Lainnya','Belum terklasifikasi'];
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const generic=new Set(['edc','edc merchant','merchant','lainnya','other','others','unknown','na','n a']);
  const references=typeof module!=='undefined'&&module.exports?require('./merchant-references.js'):root.MerchantReferences;
  const additionalRules=[
    ['Kesehatan',/\b(drg|dokter gigi|inti bios)\b/],
    ['Kecantikan',/\b(aesthetic|beaute|parfum|perfume)\b/],
    ['Kuliner',/\b(bluder|bistro|lounge|hot pot|wok|burjo|nongkrong)\b/],
    ['Otomotif',/\b(garage|auto car|bmw|battery|aki)\b/],
    ['Transportasi & Logistik',/\b(rent car|rental mobil|sewa mobil)\b/],
    ['Perhotelan & Hiburan',/\b(padel|distribusi film|video)\b/],
    ['Retail & Perdagangan',/\b(watch|watches|arloji|batik|tenun|celluler|cellular|komputer|computer|elektrik|electric|topup|atribut)\b|^tb\s/],
    ['Jasa',/\b(sablon|studio)\b/]
  ];
  function recordKey(row){return (Array.isArray(row.mids)||Object.hasOwn(row.totals||{},'edc')||(row.id&&!row.key)?'EDC':'LIVIN')+'::'+String(row.account||row.id||row.key||'')}
  function classify(row,manual){
    const chosen=manual===undefined?root.MerchantDB?.read('mandiriBusinessCategoriesV1',{})?.[recordKey(row)]?.category:manual;
    if(categories.includes(chosen)&&chosen!=='Belum terklasifikasi')return {category:chosen,source:'Kategori dikonfirmasi manual',basis:'Pilihan kategori merchant tersimpan di database bersama'};
    const rawLobs=[row.lob,row.lob_lm,row.business_type,...(row.source_lobs||[])].filter(v=>v&&typeof v==='string').map(normalize).filter(v=>v&&!generic.has(v));
    const lobs=[...new Set(rawLobs)];
    // Mixed source businesses on one settlement account must not be forced into one type.
    const found=[...new Set(lobs.map(lob=>/\b(kelontong|sembako|supermarket|minimarket)\b/.test(lob)?'Retail & Perdagangan':rules.find(([,pattern])=>pattern.test(lob))?.[0]).filter(Boolean))];
    if(found.length)return {category:found.length>1?'Multi bisnis':found[0],source:'Jenis usaha / LOB',basis:lobs.join('; ')};
    const additionalLob=[...new Set(lobs.map(lob=>additionalRules.find(([,pattern])=>pattern.test(lob))?.[0]).filter(Boolean))];
    if(additionalLob.length)return {category:additionalLob.length>1?'Multi bisnis':additionalLob[0],source:'Jenis usaha / LOB',basis:lobs.join('; ')};
    const reference=references?.lookup(row);
    if(reference&&categories.includes(reference.category))return {category:reference.category,source:'Referensi publik · perlu cocokkan identitas merchant',basis:reference.note,reference};
    if(lobs.length)return {category:'Lainnya',source:'Jenis usaha / LOB belum dipetakan',basis:lobs.join('; ')};
    const names=[row.store_name,row.merchant_name,...(row.dba_names||[]),...(row.official_names||[]),...(row.mids||[]).flatMap(m=>[m.dba,m.official])].map(normalize).filter(Boolean);
    const inferred=[...new Set(names.map(name=>rules.find(([,pattern])=>pattern.test(name))?.[0]||additionalRules.find(([,pattern])=>pattern.test(name))?.[0]).filter(Boolean))];
    return inferred.length?{category:inferred.length>1?'Multi bisnis':inferred[0],source:'Perkiraan dari nama',basis:'Perlu konfirmasi jenis usaha dari data sumber'}:{category:'Belum terklasifikasi',source:'Jenis usaha belum tersedia',basis:'Tidak ada jenis usaha atau kata kunci nama yang cukup jelas'};
  }
  const api=Object.freeze({categories:Object.freeze(categories),classify,recordKey});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.MerchantCategories=api;
})(typeof window!=='undefined'?window:this);
