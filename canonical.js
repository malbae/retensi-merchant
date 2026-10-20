(function(){
  const host=location.hostname;
  if((host.endsWith('.github.io')||host.endsWith('.netlify.app')||(host.endsWith('.pages.dev')&&host!=='retensi-merchant.pages.dev'))&&!new URLSearchParams(location.search).has('localBackup')){
    location.replace('https://retensi-merchant.pages.dev/?sync=central-v2');
  }
})();
