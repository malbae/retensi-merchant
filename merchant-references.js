(function(root){
  'use strict';
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/^pt\s+/,'');
  // Public business facts only. Never infer account ownership or publish private performance here.
  const entries=[
    {aliases:['PRESTIGE MAX CARE'],legal:'',brand:'Prestige Max Care',category:'Otomotif',url:'https://prestigemaxcare.com/',note:'Situs usaha menjelaskan layanan body repair, detailing, coating, dan carwash. Nama PT serta volume transaksi tidak dipublikasikan di referensi ini.'},
    {aliases:['SVARA SELARAS SEMESTA'],legal:'PT Svara Selaras Semesta',brand:'Svara Selaras Semesta',category:null,url:'https://companieshouse.id/svara-selaras-semesta',note:'Direktori pihak ketiga mencantumkan nama PT; bidang usaha merchant belum cukup jelas untuk menetapkan kategori.'},
    {aliases:['ESTRELLA SEBELAS INDONESIA'],legal:'PT Estrella Sebelas Indonesia',brand:'Usaha hotel · referensi historis',category:'Perhotelan & Hiburan',url:'https://investor-id.intiland.com/wp-content/uploads/2013/07/Bond-Prospektus-Final-2013.pdf',note:'Prospektus 2013 mencantumkan bidang hotel, saat itu belum operasional. Tidak menyatakan hotel sudah beroperasi sekarang; perlu konfirmasi terbaru.'},
    {aliases:['HONGJIN JAYA INDONESIA'],legal:'PT Hongjin Jaya Indonesia',brand:'Hongjin Jaya Indonesia',category:null,url:'https://companieshouse.id/hongjin-jaya-indonesia',note:'Direktori perusahaan pihak ketiga mencantumkan nama PT. Bidang usaha, cabang, dan jumlah transaksi belum dapat dipastikan; perlu validasi dokumen usaha.'},
    {aliases:['SULICO'],legal:'PT Sulico',brand:'Sulico',category:null,url:'https://companieshouse.id/sulico',note:'Direktori pihak ketiga mencantumkan nama PT, tetapi tidak cukup untuk memastikan jenis usaha merchant.'},
    {aliases:['SAKTI AGUNG NUSANTARA'],legal:'PT Sakti Agung Nusantara',brand:'Sakti Agung Nusantara',category:null,url:'https://companieshouse.id/sakti-agung-nusantara',note:'Nama PT ditemukan pada direktori pihak ketiga; bidang usaha dan lokasi operasional merchant belum terkonfirmasi.'},
    {aliases:['INSPIRASI BISNIS NUSANTARA'],legal:'PT Inspirasi Bisnis Nusantara',brand:'Haus!',category:'Kuliner',url:'https://haus.co.id/',note:'Situs resmi mencantumkan badan usaha dan layanan makanan/minuman.'},
    {aliases:['INTI BIOS PERSADA SEJAHTERA','INTIBIOS PERSADA SEJAHTERA'],legal:'PT Inti Bios Persada Sejahtera',brand:'Intibios',category:'Kesehatan',url:'https://play.google.com/store/apps/details?id=com.intibios.mobhealth',note:'Penerbit aplikasi layanan kesehatan MyIntibios.'},
    {aliases:['TIRTA SAPTA SEMESTA'],legal:'PT Tirta Sapta Semesta',brand:'Leica (referensi historis)',category:'Retail & Perdagangan',url:'https://www.postel.go.id/downloads/43/RHU-201805.htm',note:'Catatan sertifikasi 2018 menghubungkan perusahaan dengan kamera Leica. Bukan bukti status usaha terkini.'},
    {aliases:['BUTTER BABY - B2B B2C','BUTTER BABY'],legal:'',brand:'Butter Baby',category:'Kuliner',url:'https://dgip.go.id/uploads/berita_resmi/file/600156ca2661f1f10bf5caadeaf47f22.pdf',note:'Publikasi merek kelas 43 mencakup layanan restoran. PT pengelola merchant ini belum dipastikan.'},
    {aliases:['TUNAS NUANSA INDONESIA'],legal:'PT Tunas Nuansa Indonesia',brand:'Bebek Tepi Sawah (referensi historis)',category:'Kuliner',url:'https://kc.umn.ac.id/id/eprint/30092/4/BAB%20II.pdf',note:'Studi perusahaan menjelaskan bisnis restoran; bukan konfirmasi kondisi operasional terkini.'},
    {aliases:['ARIFINDO GRAHA PRATAMA'],legal:'PT Arifindo Graha Pratama',brand:'The Amazing Hotel (referensi historis)',category:'Perhotelan & Hiburan',url:'https://www.antarafoto.com/id/view/294170/peresmian-hotel-amazing-jakarta',note:'Dokumentasi peresmian hotel 2013; bukan bukti status usaha atau okupansi terkini.'},
    {aliases:['WATCH SOLUTION'],legal:'',brand:'Watch Solution',category:'Retail & Perdagangan',url:'https://christverra.com/pages/store-locations',note:'Daftar dealer resmi jam tangan. Nama cabang merchant belum dicocokkan; alamat dealer tidak disalin ke data merchant.'},
    {aliases:['SANKALPA FREAKS'],legal:'',brand:'Sankalpa Freaks',category:'Retail & Perdagangan',url:'https://exodus-worldwide.com/pages/stockist',note:'Terdaftar sebagai stockist merek. Bukan bukti lokasi spesifik merchant atau nama PT.'},
    {aliases:['PERKUMPULAN CITA TENUN INDONESIA'],legal:'',brand:'Cita Tenun Indonesia',category:'Jasa',url:'https://www.setneg.go.id/baca/index/cita_tenun_akan_diresmikan_ibu_negara',note:'Perkumpulan pembinaan perajin tenun; bukan PT. Pengelompokan jasa tidak menyatakan seluruh pemasukan berasal dari penjualan retail.'}
  ];
  function lookup(row){
    const names=[row.merchant_name,row.store_name,...(row.dba_names||[]),...(row.official_names||[])].map(normalize);
    const matches=entries.filter(entry=>entry.aliases.some(alias=>names.includes(normalize(alias))));
    return matches.length===1?{...matches[0],checkedAt:'2026-10-21'}:null;
  }
  function transactions(raw,ticket,period){
    const sv=Array.isArray(raw.mids)||raw.totals?raw.totals?.sv26:raw.sum_sv_ytd_stat_din??raw.sv_ytd;
    const count=raw.totals?.trx26;
    const valid=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>0;
    const days=(Date.UTC(period.year,period.month,1)-Date.UTC(period.year,0,1))/86400000;
    if(count!==null&&count!==undefined&&String(count).trim()!==''&&Number.isFinite(Number(count))&&Number(count)>=0)return {count:Number(count),daily:Number(count)/days,ticket:valid(sv)&&Number(count)>0?Number(sv)/Number(count):null,actual:true,source:'Jumlah transaksi YTD dari Excel EDC'};
    if(valid(sv)&&valid(ticket))return {count:Number(sv)/Number(ticket),daily:Number(sv)/Number(ticket)/days,ticket:Number(ticket),actual:false,source:'Perkiraan jumlah transaksi = SV YTD ÷ asumsi nilai transaksi. Bukan hasil riset volume transaksi publik.'};
    return {count:null,daily:null,ticket:null,actual:false,source:'Belum tersedia jumlah transaksi atau acuan nilai transaksi yang memadai.'};
  }
  const api=Object.freeze({lookup,transactions,entries});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MerchantReferences=api;
})(typeof window!=='undefined'?window:this);
