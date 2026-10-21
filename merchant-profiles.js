(function(root){
  'use strict';
  // Editable planning ranges, NOT verified merchant prices or market statistics.
  const types=[
    ['Kuliner','Minuman siap saji',/\b(haus|inspirasi bisnis nusantara|boba|tea|minuman|juice|jus)\b/,[8000,25000],70],
    ['Kuliner','Roti, donat & pastry',/\b(butter baby|bakery|bluder|roti|donat|pastry)\b/,[15000,60000],40],
    ['Kuliner','Kopi & kafe',/\b(kopi|coffee|cafe|kafe|tiam)\b/,[18000,55000],40],
    ['Kuliner','Hotpot & restoran spesialis',/\b(hot pot|hotpot|sushi|shigeru|ramen)\b/,[75000,250000],25],
    ['Kuliner','Warung & makanan harian',/\b(warung|warteg|bakso|ayam|burjo|soto|sate|sembako makanan)\b/,[15000,35000],45],
    ['Kuliner','Restoran & bistro',/\b(restoran|restaurant|bistro|lounge|bebek tepi sawah)\b/,[40000,150000],30],
    ['Retail & Perdagangan','Kamera & optik premium',/\b(leica|kamera|camera|tirta sapta semesta)\b/,[5000000,75000000],.2],
    ['Retail & Perdagangan','Jam tangan',/\b(watch|watches|arloji)\b/,[500000,10000000],1],
    ['Retail & Perdagangan','Komputer & elektronik',/\b(komputer|computer|elektronik|celluler|cellular|ponsel)\b/,[500000,12000000],3],
    ['Retail & Perdagangan','Supermarket',/\b(supermarket|hypermarket)\b/,[75000,350000],90],
    ['Retail & Perdagangan','Minimarket',/\b(minimarket)\b/,[25000,125000],60],
    ['Retail & Perdagangan','Kelontong / sembako',/\b(kelontong|sembako)\b/,[20000,100000],40],
    ['Retail & Perdagangan','Busana & tekstil',/\b(fashion|batik|tenun|pakaian|boutique|butik|sankalpa)\b/,[75000,500000],10],
    ['Retail & Perdagangan','Bahan bangunan & perlengkapan',/\b(bangunan|elektrik|electric|hardware)\b|^tb\s/,[100000,2000000],8],
    ['Kecantikan','Perawatan estetika',/\b(aesthetic|estetika|skincare|beaute)\b/,[200000,2000000],5],
    ['Kecantikan','Barbershop',/\b(barber|barbershop)\b/,[25000,100000],18],
    ['Kecantikan','Salon',/\b(salon)\b/,[50000,300000],10],
    ['Kesehatan','Layanan gigi',/\b(drg|dental|gigi)\b/,[150000,1500000],6],
    ['Kesehatan','Laboratorium & pemeriksaan',/\b(lab|laboratorium|intibios|inti bios)\b/,[100000,800000],12],
    ['Kesehatan','Apotek',/\b(apotek|apotik|pharmacy|farmasi)\b/,[25000,200000],40],
    ['Kesehatan','Rumah sakit',/\b(rumah sakit|hospital)\b/,[150000,2000000],30],
    ['Kesehatan','Klinik',/\b(klinik|clinic)\b/,[100000,500000],15],
    ['Pendidikan','Pembayaran kursus / pendidikan',/\b(kursus|sekolah|school|bimbel|pendidikan)\b/,[300000,3000000],1],
    ['Otomotif','Cuci & detailing kendaraan',/\b(carwash|car wash|detailing|coating|prestige max care)\b/,[50000,500000],10],
    ['Otomotif','Bengkel & suku cadang',/\b(bengkel|garage|auto|motor|mobil|battery|aki|bmw)\b/,[100000,2000000],5],
    ['Perhotelan & Hiburan','Lapangan padel / olahraga',/\b(padel|gym|fitness|olahraga)\b/,[150000,400000],6],
    ['Perhotelan & Hiburan','Akomodasi hotel',/\b(hotel|resort|penginapan|arifindo|estrella)\b/,[300000,1500000],5],
    ['Transportasi & Logistik','Sewa kendaraan',/\b(rent car|rental|sewa mobil)\b/,[300000,1200000],2]
  ];
  function build(raw,category,period,units,days,factors,fallback){
    const text=[raw.merchant_name,raw.store_name,raw.lob,...(raw.source_lobs||[]),...(raw.dba_names||[]),...(raw.official_names||[])].filter(Boolean).join(' ').toLowerCase();
    const type=types.find(([cat,,pattern])=>cat===category&&pattern.test(text));
    const label=type?.[1]||'Profil umum · '+category,range=type?.[3]||[fallback[1]*.7,fallback[1]*1.3],baseFrequency=type?.[4]??fallback[0];
    const ticket=(range[0]+range[1])/2;
    const edc=Array.isArray(raw.mids)||Object.hasOwn(raw.totals||{},'edc');
    // Independent capacity scenario. Multiple terminals are NOT evidence of multiple stores.
    // Aggregate EDC capacity scales by sqrt(terminals); divide back to expose per-machine inputs.
    const capacityFactor=edc?Math.sqrt(Math.max(1,units)):Math.max(1,units);
    const base=baseFrequency*capacityFactor/Math.max(1,units);
    return {label,priceLow:range[0],priceHigh:range[1],ticket,weekday:base*factors.weekday,weekend:base*factors.weekend,
      ticketBasis:'Titik tengah kisaran asumsi produk/jasa, bukan SV aktual ÷ transaksi',
      frequencyBasis:'Frekuensi kapasitas profil '+baseFrequency+' transaksi/hari dasar × faktor kapasitas '+capacityFactor.toLocaleString('id-ID',{maximumFractionDigits:2})+(edc?' ÷ '+units+' mesin untuk input per mesin':''),
      scale:units>1?(edc?'Multi-mesin · kapasitas bertahap':'Multi-unit usaha'):(edc?'Satu mesin EDC · kapasitas profil':'Satu unit usaha · kapasitas profil'),
      scaleBasis:edc?'Faktor kapasitas = akar jumlah mesin EDC; asumsi internal agar mesin tidak dianggap toko. Bukan ukuran bisnis terverifikasi.':'Kapasitas profil per unit usaha yang dimodelkan; bukan klasifikasi resmi skala bisnis.',
      anchored:false,independent:true,units,capacityFactor,baseFrequency,
      warning:'Potensi dibangun dari asumsi harga dan kapasitas profil, bukan dikalibrasi ke SV/transaksi aktual. Harga, frekuensi dan kapasitas perlu konfirmasi merchant; hasil bukan omzet aktual terverifikasi.'};
  }
  const api=Object.freeze({build,types});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MerchantProfiles=api;
})(typeof window!=='undefined'?window:this);
