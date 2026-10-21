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
    ['Retail & Perdagangan','Supermarket / minimarket',/\b(supermarket|minimarket)\b/,[50000,250000],80],
    ['Retail & Perdagangan','Kelontong / sembako',/\b(kelontong|sembako)\b/,[20000,100000],40],
    ['Retail & Perdagangan','Busana & tekstil',/\b(fashion|batik|tenun|pakaian|boutique|butik|sankalpa)\b/,[75000,500000],10],
    ['Retail & Perdagangan','Bahan bangunan & perlengkapan',/\b(bangunan|elektrik|electric|hardware)\b|^tb\s/,[100000,2000000],8],
    ['Kecantikan','Perawatan estetika',/\b(aesthetic|estetika|skincare|beaute)\b/,[200000,2000000],5],
    ['Kecantikan','Salon & barbershop',/\b(salon|barber|barbershop)\b/,[30000,200000],12],
    ['Kesehatan','Layanan gigi',/\b(drg|dental|gigi)\b/,[150000,1500000],6],
    ['Kesehatan','Laboratorium & pemeriksaan',/\b(lab|laboratorium|intibios|inti bios)\b/,[100000,800000],12],
    ['Otomotif','Cuci & detailing kendaraan',/\b(carwash|car wash|detailing|coating|prestige max care)\b/,[50000,500000],10],
    ['Otomotif','Bengkel & suku cadang',/\b(bengkel|garage|auto|motor|mobil|battery|aki|bmw)\b/,[100000,2000000],5],
    ['Perhotelan & Hiburan','Lapangan padel / olahraga',/\b(padel|gym|fitness|olahraga)\b/,[150000,400000],6],
    ['Perhotelan & Hiburan','Akomodasi hotel',/\b(hotel|resort|penginapan|arifindo|estrella)\b/,[300000,1500000],5],
    ['Transportasi & Logistik','Sewa kendaraan',/\b(rent car|rental|sewa mobil)\b/,[300000,1200000],2]
  ];
  const positive=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>0;
  function build(raw,category,period,units,days,factors,fallback){
    const text=[raw.merchant_name,raw.store_name,raw.lob,...(raw.source_lobs||[]),...(raw.dba_names||[]),...(raw.official_names||[])].filter(Boolean).join(' ').toLowerCase();
    const type=types.find(([cat,,pattern])=>cat===category&&pattern.test(text));
    const label=type?.[1]||'Profil umum · '+category,range=type?.[3]||[fallback[1]*.7,fallback[1]*1.3],baseFrequency=type?.[4]??fallback[0];
    const sv=raw.totals?raw.totals.sv26:raw.sum_sv_ytd_stat_din??raw.sv_ytd,count=raw.totals?.trx26;
    const ticket=positive(sv)&&positive(count)?Number(sv)/Number(count):(range[0]+range[1])/2;
    const weightedDays=days.weekday*factors.weekday+days.weekend*factors.weekend;
    const knownZero=sv!==null&&sv!==undefined&&String(sv).trim()!==''&&Number(sv)===0;
    const observedCount=knownZero?0:positive(count)?Number(count):positive(sv)?Number(sv)/ticket:null;
    // The imported count/SV is already aggregated. Divide by EDC units before modelling per-machine inputs.
    const base=observedCount!==null&&weightedDays>0&&units>0?observedCount/weightedDays/units:baseFrequency;
    const monthlySv=positive(sv)?Number(sv)/period.month:null;
    return {label,priceLow:range[0],priceHigh:range[1],ticket,weekday:base*factors.weekday,weekend:base*factors.weekend,
      ticketBasis:positive(sv)&&positive(count)?'SV aktual ÷ jumlah transaksi aktual Excel':'Titik tengah kisaran asumsi profil; belum merupakan harga merchant terverifikasi',
      frequencyBasis:observedCount!==null?(positive(count)?'Frekuensi diturunkan dari jumlah transaksi YTD Excel':'Frekuensi perkiraan = SV YTD ÷ asumsi nilai transaksi'):'Frekuensi contoh profil; belum ada acuan performance yang memadai',
      scale:monthlySv===null?'Skala kanal belum diketahui':monthlySv<50000000?'Volume kanal relatif rendah':monthlySv<500000000?'Volume kanal menengah':'Volume kanal relatif tinggi',
      scaleBasis:'Kelompok internal dari SV bulanan rata-rata (<Rp50 juta, Rp50–500 juta, ≥Rp500 juta), bukan klasifikasi resmi UMKM atau ukuran seluruh bisnis',
      anchored:observedCount!==null,units,referenceSv:positive(sv)?Number(sv):null,
      warning:'Harga merupakan rentang asumsi, bukan seluruh harga katalog. Pola weekday/weekend belum terverifikasi. Tanpa porsi kanal terukur, hasil bukan bukti total omzet usaha atau jaminan pertumbuhan.'};
  }
  const api=Object.freeze({build,types});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MerchantProfiles=api;
})(typeof window!=='undefined'?window:this);
