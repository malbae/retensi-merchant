(function(){
  'use strict';
  const categoryOf=row=>MerchantCategories.classify(row);
  const allRows=()=>[...EDC_RELATIONSHIPS.map(row=>({channel:'EDC',row})),...LIVIN_MERCHANTS.map(row=>({channel:'LIVIN',row}))];
  const badge=row=>{const c=categoryOf(row);return `<span class="business-badge" title="${esc(c.source)}">${esc(c.category)}</span>`};
  const section=row=>{const c=categoryOf(row),editable=typeof currentUser!=='undefined'&&currentUser?.role==='RM';return `<div class="detail-section business-profile"><h3>Kategori bisnis</h3><p>${badge(row)}</p><p>${esc(c.source)} · ${esc(c.basis)}</p><p>Konfirmasi kategori untuk merchant yang belum terklasifikasi. Performance asli Excel tidak berubah. Estimasi potensi otomatis mengikuti kategori yang dipilih.</p><label for="merchantBusinessCategory">Pilih kategori bisnis</label><select id="merchantBusinessCategory" ${editable?'':'disabled'}><option value="">Pilih kategori…</option>${MerchantCategories.categories.filter(name=>name!=='Belum terklasifikasi').map(name=>`<option value="${esc(name)}" ${name===c.category?'selected':''}>${esc(name)}</option>`).join('')}</select><button id="saveBusinessCategory" type="button" class="primary" ${editable?'':'disabled'}>Simpan kategori</button><small>${editable?'Kategori tersimpan untuk merchant ini dan tersinkron ke perangkat lain.':'Kategori dapat diubah oleh RM / Sales.'}</small></div>`};
  const previousRow=merchantRow;
  merchantRow=function(o){return previousRow(o).replace('<div class="identity-cell">','<div class="identity-cell">'+badge(o.raw))};
  const previousRows=workspaceRows;
  workspaceRows=function(){const category=document.getElementById('businessCategoryFilter')?.value||'';return previousRows().filter(o=>!category||categoryOf(o.raw).category===category)};
  const previousWorkspace=renderWorkspace;
  renderWorkspace=function(resetPage=false){
    const filter=document.getElementById('businessCategoryFilter'),rows=currentKanal==='EDC'?EDC_RELATIONSHIPS:LIVIN_MERCHANTS,counts=new Map();
    rows.forEach(row=>{const name=categoryOf(row).category;counts.set(name,(counts.get(name)||0)+1)});
    const old=filter.value;filter.innerHTML='<option value="">Semua kategori</option>'+MerchantCategories.categories.filter(c=>counts.has(c)).map(c=>`<option value="${esc(c)}">${esc(c)} (${counts.get(c)})</option>`).join('');filter.value=counts.has(old)?old:'';
    previousWorkspace(resetPage);
    if(filter.value){const note=document.createElement('p');note.className='business-filter-note';note.textContent='Ringkasan di kiri mencakup seluruh kanal. Daftar difilter: '+filter.value;document.getElementById('summaryRail').append(note)}
  };
  const previousOpen=openWorkspace;
  openWorkspace=function(channel){document.getElementById('businessCategoryFilter').value='';return previousOpen(channel)};
  window.openBusinessCategory=function(channel,category){openWorkspace(channel);document.getElementById('businessCategoryFilter').value=category;renderWorkspace(true)};
  const previousEdc=renderEdcDetail,previousLivin=renderLivinDetail;
  renderEdcDetail=function(row){return previousEdc(row)+section(row)};
  renderLivinDetail=function(row){return previousLivin(row)+section(row)};
  const previousDetail=openDetail;
  openDetail=function(channel,key){
    previousDetail(channel,key);
    const row=(channel==='EDC'?EDC_RELATIONSHIPS:LIVIN_MERCHANTS).find(r=>(channel==='EDC'?r.id:r.key)===key),button=document.getElementById('saveBusinessCategory'),select=document.getElementById('merchantBusinessCategory');
    if(!row||!button||!select)return;
    const recordKey=MerchantCategories.recordKey(row),storeKey='mandiriBusinessCategoriesV1',initial=JSON.stringify(MerchantDB.read(storeKey,{})[recordKey]||null);
    select.addEventListener('change',()=>{const card=document.getElementById('potentialCard');if(card)card.dataset.categoryDirty='true'});
    button.addEventListener('click',async()=>{
      if(currentUser?.role!=='RM')return;
      button.disabled=true;
      try{
        if(!MerchantCategories.categories.includes(select.value)||select.value==='Belum terklasifikasi')throw new Error('Pilih kategori bisnis terlebih dahulu.');
        if(document.getElementById('potentialCard')?.dataset.dirty==='true')throw new Error('Simpan perubahan potensi terlebih dahulu, lalu simpan kategori.');
        const store=MerchantDB.read(storeKey,{});
        if(JSON.stringify(store[recordKey]||null)!==initial)throw new Error('Kategori telah diubah pengguna lain. Buka ulang detail sebelum menyimpan.');
        store[recordKey]={category:select.value,updatedAt:new Date().toISOString()};
        await MerchantDB.write(storeKey,store);
        invalidateScores();refreshPotentialViews();openDetail(channel,key);
        showToast('Kategori bisnis tersimpan dan tersedia bagi pengguna lain.','success','Kategori tersimpan');
      }catch(error){showToast(error.message||'Kategori belum dapat disimpan.','error','Gagal menyimpan kategori')}
      finally{button.disabled=false}
    });
  };
  const previousHome=renderHome;
  const previousPriority=renderPriority;
  renderPriority=function(){previousPriority();const rows=topLivinPriorities();document.querySelectorAll('#featureCard .priority-name').forEach((el,index)=>{if(rows[index])el.insertAdjacentHTML('beforeend',badge(rows[index].l))})};
  renderHome=function(){previousHome();
    let panel=document.getElementById('businessDashboard');
    if(!panel){panel=document.createElement('details');panel.id='businessDashboard';panel.className='dashboard-panel business-dashboard';document.querySelector('#homeView .dashboard-content').before(panel)}
    const counts=new Map();allRows().forEach(({row,channel})=>{const c=categoryOf(row).category;if(!counts.has(c))counts.set(c,{EDC:0,LIVIN:0});counts.get(c)[channel]++});
    const wasOpen=panel.open;
    panel.innerHTML=`<summary>Kategori bisnis <span>${counts.size} kategori · EDC & Livin’</span></summary><p>Konfirmasi manual didahulukan, lalu jenis usaha/LOB, referensi publik yang cocok, dan petunjuk nama. Nama ambigu tetap perlu konfirmasi; sumber publik tidak membuktikan volume transaksi. Jumlah EDC mengikuti rekening/relasi, bukan jumlah mesin atau MID.</p><div class="business-category-grid">${MerchantCategories.categories.filter(c=>counts.has(c)).map(c=>{const count=counts.get(c);return `<article><b>${esc(c)}</b><div>${['EDC','LIVIN'].map(ch=>`<button type="button" data-channel="${ch}" data-category="${esc(c)}" ${count[ch]?'':'disabled'}>${ch==='EDC'?'EDC':"Livin’"} · ${count[ch]}</button>`).join('')}</div></article>`}).join('')}</div>`;
    panel.open=wasOpen;panel.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>openBusinessCategory(button.dataset.channel,button.dataset.category)));
  };
  const previousExcelRows=merchantExcelRows;
  merchantExcelRows=function(){const categoryById=new Map(allRows().map(({row,channel})=>[channel+':'+(channel==='EDC'?row.id:row.key),categoryOf(row)]));return previousExcelRows().map(row=>({...row,businessCategory:categoryById.get(row.channel+':'+row.id)?.category||'Belum terklasifikasi',businessCategorySource:[categoryById.get(row.channel+':'+row.id)?.source,categoryById.get(row.channel+':'+row.id)?.reference?.url].filter(Boolean).join(' · ')||'Jenis usaha belum tersedia'}))};
  const previousSearch=excelPreviewSearchMatch;
  excelPreviewSearchMatch=function(row,query){return previousSearch({...row,name:row.name+' '+row.businessCategory},query)};
  window.filteredBusinessExcelRows=function(){const category=document.getElementById('excelPreviewCategory')?.value||'',channel=document.getElementById('excelPreviewChannel')?.value||'ALL',query=document.getElementById('excelPreviewSearch')?.value||'';return merchantExcelRows().filter(row=>(!category||row.businessCategory===category)&&(channel==='ALL'||row.channel===channel)&&excelPreviewSearchMatch(row,query))};
  const previousPreview=openExcelPreview;
  openExcelPreview=function(){previousPreview();const filter=document.createElement('select');filter.id='excelPreviewCategory';filter.setAttribute('aria-label','Kategori bisnis export');const names=new Set(merchantExcelRows().map(row=>row.businessCategory));filter.innerHTML='<option value="">Semua kategori bisnis</option>'+MerchantCategories.categories.filter(c=>names.has(c)).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');filter.addEventListener('change',renderExcelPreview);document.querySelector('.export-preview-controls').append(filter)};
  const previousMethodology=openMethodology;
  openMethodology=function(){previousMethodology();document.getElementById('detailDrawer').insertAdjacentHTML('beforeend','<div class="detail-section"><h3>Kategori bisnis otomatis</h3><p>Konfirmasi kategori manual didahulukan. Jenis usaha/LOB adalah sumber data utama; referensi publik yang dicocokkan nama secara tepat membantu bila LOB belum jelas. Referensi historis ditandai dan bukan bukti usaha masih aktif. Nama PT tidak ditebak dari merek. Nama merchant hanya menjadi fallback bila jenis usaha belum tersedia; hasilnya ditandai Perkiraan dari nama. LOB yang belum dipetakan masuk Lainnya; nama yang tidak cukup jelas masuk Belum terklasifikasi. Beberapa kategori pada satu rekening menjadi Multi bisnis. Ini pengelompokan bantu, bukan klasifikasi resmi. Kategori tidak mengubah saldo, SV, retensi, atau gap pendanaan.</p></div>')};
})();
