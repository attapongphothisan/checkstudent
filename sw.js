const CACHE='checkeng-app-v2.0.0';
const FILES=["./","./index.html","./ui-tokens.css","./styles.css","./modern-ui-v77.css","./assets/logo-indigo.svg","./assets/saas-v80/01-checkmark.png","./assets/saas-v79/health.png","./assets/saas-v79/physical.png","./assets/fonts/Prompt-400.ttf","./assets/fonts/Prompt-500.ttf","./assets/fonts/Prompt-600.ttf","./assets/fonts/Prompt-700.ttf","./assets/fonts/OFL.txt","./ui-display.js","./ui-summary.js","./core.js","./app.js","./report-export.js","./student-import.js","./vendor/xlsx.full.min.js","./templates/students-example.xlsx","./templates/students-example.csv","./manifest.webmanifest","./SETUP.html"];
// Safari navigation must receive a response without a followed-redirect flag.
async function directResponse(response){
 if(!response.redirected)return response;
 const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
 return new Response(await response.arrayBuffer(),{status:response.status,statusText:response.statusText,headers});
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await Promise.all(FILES.map(async path=>{const response=await fetch(new Request(new URL(path,self.registration.scope),{cache:'reload'}));if(!response.ok)throw Error('Cache failed: '+path);await cache.put(path,await directResponse(response));}));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('checkeng-app-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),url=new URL(event.request.url),root=new URL('./',self.registration.scope);
  const home=event.request.mode==='navigate'&&(url.pathname===root.pathname||url.pathname===root.pathname+'index.html');
  const cached=await cache.match(home?new Request(root.href):event.request);
  if(cached)return directResponse(cached);
  const response=await fetch(event.request);return directResponse(response);
 })());
});
