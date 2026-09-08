(async function(){
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  try {
    const base = new URL('./', document.baseURI).href;
    const configRes = await fetch(new URL('api/push-config', base), {cache:'no-store'});
    if(!configRes.ok)return;
    const config=await configRes.json(); if(!config.enabled||!config.publicKey)return;
    const registration=await navigator.serviceWorker.ready;
    if(Notification.permission==='default') { if(await Notification.requestPermission()!=='granted') return; }
    if(Notification.permission!=='granted') return;
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription) subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(config.publicKey)});
    await fetch(new URL('api/push-subscribe', base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:subscription.toJSON()})});
    console.info('[PaturGPS] Notifications Push activées');
  } catch(error) { console.warn('[PaturGPS] Push indisponible', error); }
  function decode(value){const pad='='.repeat((4-value.length%4)%4);const raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
})();
