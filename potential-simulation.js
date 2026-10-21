(function(root){
  'use strict';
  // Editable scenario seeds, deliberately NOT observed merchant revenue or market benchmarks.
  const presets={
    'Kuliner':[80,35000],'Retail & Perdagangan':[50,75000],'Kesehatan':[20,150000],
    'Kecantikan':[20,75000],'Pendidikan':[15,150000],'Jasa':[20,100000],
    'Otomotif':[15,150000],'Perhotelan & Hiburan':[20,250000],
    'Transportasi & Logistik':[30,50000],'Keuangan':[10,100000],
    'Multi bisnis':[30,75000],'Lainnya':[30,50000],'Belum terklasifikasi':[30,50000]
  };
  const locations={neutral:{label:'Netral / belum diketahui',weekday:1,weekend:1},office:{label:'Perkantoran (skenario weekday ramai)',weekday:1.2,weekend:.7},shopping:{label:'Pusat belanja / wisata (skenario weekend ramai)',weekday:1,weekend:1.5}};
  const finite=(v,fallback=0)=>Number.isFinite(Number(v))&&String(v).trim()!==''?Math.max(0,Number(v)):fallback;
  function location(raw){
    const address=String(raw.address||raw.alamat||'').trim(),text=address.toLowerCase();
    const shopping=/\b(mall|mal|plaza|pusat belanja|pusat perbelanjaan|wisata|resort)\b/.test(text),office=/\b(perkantoran|office|kantor|business district)\b/.test(text);
    return {type:shopping&&!office?'shopping':office&&!shopping?'office':'neutral',address,locationText:[address,raw.kecamatan,raw.kabupaten,raw.provinsi].filter(Boolean).join(', ')||'Lokasi belum tersedia',basis:shopping!==office?'Petunjuk dari teks alamat; belum diverifikasi':'Tidak ada petunjuk kawasan yang cukup jelas'};
  }
  function calendar(year,month,openDays){
    if(!Number.isInteger(year)||year<1900||year>2200||!Number.isInteger(month)||month<1||month>12)throw new Error('Periode simulasi tidak valid');
    let weekday=0,weekend=0;
    for(let m=0;m<month;m++)for(let d=1;d<=new Date(Date.UTC(year,m+1,0)).getUTCDate();d++){
      const day=new Date(Date.UTC(year,m,d)).getUTCDay();if(!openDays.includes(day))continue;
      if(day===0||day===6)weekend++;else weekday++;
    }
    return {weekday,weekend};
  }
  function suggest(raw,category,period,override={}){
    const seed=presets[category]||presets['Belum terklasifikasi'],place=location(raw),type=Object.hasOwn(locations,override.locationType)?override.locationType:place.type,factors=locations[type];
    const machineBased=Array.isArray(raw.mids)||Object.hasOwn(raw.totals||{},'edc');
    const count=raw.totals?.edc,machineCount=count!==null&&count!==undefined&&String(count).trim()!==''&&Number.isFinite(Number(count))&&Number(count)>=0?Math.floor(Number(count)):null;
    const units=machineBased?(machineCount||0):Math.max(1,Math.floor(finite(override.units,1)));
    const openDays=Array.isArray(override.openDays)?[...new Set(override.openDays.map(Number).filter(v=>Number.isInteger(v)&&v>=0&&v<=6))]:[1,2,3,4,5,6,0];
    const inputs={locationType:type,weekdayVisitors:finite(override.weekdayVisitors,Math.round(seed[0]*factors.weekday)),weekendVisitors:finite(override.weekendVisitors,Math.round(seed[0]*factors.weekend)),ticket:finite(override.ticket,seed[1]),share:Math.min(100,finite(override.share,100)),units,openDays};
    const days=calendar(period.year,period.month,openDays),previous=period.month===1?{weekday:0,weekend:0}:calendar(period.year,period.month-1,openDays);
    const weekdayCashflow=days.weekday*inputs.weekdayVisitors*inputs.ticket*inputs.units,weekendCashflow=days.weekend*inputs.weekendVisitors*inputs.ticket*inputs.units;
    const cashflowYtd=weekdayCashflow+weekendCashflow,cashflowMonthly=((days.weekday-previous.weekday)*inputs.weekdayVisitors+(days.weekend-previous.weekend)*inputs.weekendVisitors)*inputs.ticket*inputs.units;
    const ytd=cashflowYtd*inputs.share/100,monthly=cashflowMonthly*inputs.share/100;
    if(![ytd,monthly,cashflowYtd,cashflowMonthly].every(Number.isFinite))throw new Error('Angka simulasi terlalu besar');
    const available=!machineBased||machineCount>0;
    return {inputs,days,category,place,machineBased,machineCount,available,locationLabel:factors.label,weekdayCashflow,weekendCashflow,cashflowYtd:available?cashflowYtd:null,cashflowMonthly:available?cashflowMonthly:null,ytd:available?ytd:null,monthly:available?monthly:null,basis:machineBased?'Simulasi per mesin EDC':'Simulasi kategori & lokasi',simulated:true,automatic:!Object.keys(override).length};
  }
  function effective(raw,category,period,saved){
    if(saved&&saved.basis!=='category'){
      const monthly=saved.basis==='real'?finite(saved.realRevenue):finite(saved.visitors)*finite(saved.avgTicket)*Math.max(1,Math.min(31,finite(saved.days,30)));
      return {monthly,ytd:monthly*period.month,cashflowMonthly:monthly,cashflowYtd:monthly*period.month,basis:saved.basis==='real'?'Omzet real':'Asumsi omzet manual',simulated:false,automatic:false};
    }
    return suggest(raw,category,period,saved?.simulation||{});
  }
  function summarizeGaps(rows){
    const available=rows.filter(r=>typeof r.potentialSvGap==='number'&&Number.isFinite(r.potentialSvGap)&&r.potentialSvGap>=0);
    return {total:available.length?available.reduce((sum,r)=>sum+r.potentialSvGap,0):null,covered:available.length,missing:rows.length-available.length,count:rows.length};
  }
  const api=Object.freeze({presets,locations,location,calendar,suggest,effective,summarizeGaps});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MerchantSimulation=api;
})(typeof window!=='undefined'?window:this);
