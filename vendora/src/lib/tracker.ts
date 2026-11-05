/**
 * Script de seguimiento de la tienda (también se inyecta en landings y ofertas con HTML propio):
 * visitante, UTM (último toque) que viajan hasta el checkout, evento de visita, Meta Pixel, GA4 y TikTok.
 */
export type TrackerConfig = {
  storeId: string;
  type: "PAGE_VIEW" | "PRODUCT_VIEW" | "CHECKOUT_VIEW";
  productId?: string | null;
  pixelId?: string | null;
  ga4Id?: string | null;
  tiktokId?: string | null;
  value?: number | null;
  currency?: string | null;
  contentName?: string | null;
  eventId?: string | null;
  abVariant?: string | null;
  skipEvent?: boolean;
};

function safeId(v: string | null | undefined) {
  return v && /^[\w-]{3,40}$/.test(v) ? v : null;
}

export function trackerScript(c: TrackerConfig) {
  const cfg = JSON.stringify({
    storeId: c.storeId,
    type: c.type,
    productId: c.productId ?? null,
    pixelId: safeId(c.pixelId),
    ga4Id: safeId(c.ga4Id),
    ttId: safeId(c.tiktokId),
    value: c.value ?? null,
    currency: c.currency ?? null,
    contentName: c.contentName ?? null,
    eventId: c.eventId ?? null,
    abVariant: c.abVariant ?? null,
    skip: Boolean(c.skipEvent),
  }).replace(/</g, "\\u003c");
  return `(function(){var S=${cfg};
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
var vid=ls('vd_vid');if(!vid){vid=(window.crypto&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36));ls('vd_vid',vid)}
try{document.cookie='vd_vid='+vid+';path=/;max-age=31536000;samesite=lax'}catch(e){}
var q=new URLSearchParams(location.search),utm={};['source','medium','campaign','content','term'].forEach(function(k){var v=q.get('utm_'+k);if(v)utm[k]=v.slice(0,200)});
if(Object.keys(utm).length){ls('vd_utm',JSON.stringify(utm))}else{try{utm=JSON.parse(ls('vd_utm')||'{}')}catch(e){utm={}}}
var fbclid=q.get('fbclid');if(fbclid){ls('vd_fbc','fb.1.'+Date.now()+'.'+fbclid)}
window.vdVisitor=vid;window.vdUtm=utm;window.vdStore=S.storeId;
function decorate(){try{document.querySelectorAll('a[href]').forEach(function(a){try{var u=new URL(a.getAttribute('href'),location.href);if(u.origin===location.origin&&/\\/checkout(\\/|$)/.test(u.pathname)){Object.keys(utm).forEach(function(k){if(!u.searchParams.has('utm_'+k))u.searchParams.set('utm_'+k,utm[k])});a.setAttribute('href',u.pathname+u.search+u.hash)}}catch(e){}})}catch(e){}}
decorate();document.addEventListener('DOMContentLoaded',decorate);
if(!S.skip){try{fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({storeId:S.storeId,type:S.type,visitorId:vid,productId:S.productId,path:location.pathname,referrer:document.referrer||null,utm:utm,abVariant:S.abVariant})}).catch(function(){})}catch(e){}}
var tt={ViewContent:'ViewContent',InitiateCheckout:'InitiateCheckout',AddPaymentInfo:'AddPaymentInfo',Purchase:'CompletePayment'},ga={ViewContent:'view_item',InitiateCheckout:'begin_checkout',AddPaymentInfo:'add_payment_info',Purchase:'purchase'};
window.vdTrack=function(name,params,eventId){params=params||{};try{if(window.fbq)fbq('track',name,params,eventId?{eventID:eventId}:undefined)}catch(e){}try{if(window.gtag)gtag('event',ga[name]||name,{value:params.value,currency:params.currency,transaction_id:eventId})}catch(e){}try{if(window.ttq)ttq.track(tt[name]||name,{value:params.value,currency:params.currency,content_id:(params.content_ids||[])[0]})}catch(e){}};
if(S.pixelId){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',S.pixelId);fbq('track','PageView')}
if(S.ga4Id){var g=document.createElement('script');g.async=1;g.src='https://www.googletagmanager.com/gtag/js?id='+S.ga4Id;document.head.appendChild(g);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config',S.ga4Id)}
if(S.ttId){!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{};ttq._i[e]=[];ttq._t=ttq._t||{};ttq._t[e]=+new Date;var o=d.createElement('script');o.type='text/javascript';o.async=!0;o.src=n+'?sdkid='+e+'&lib='+t;var a=d.getElementsByTagName('script')[0];a.parentNode.insertBefore(o,a)};ttq.load(S.ttId);ttq.page()}(window,document,'ttq')}
if(S.type==='PRODUCT_VIEW'&&S.productId){window.vdTrack('ViewContent',{content_ids:[S.productId],content_type:'product',content_name:S.contentName,value:S.value,currency:S.currency},S.eventId)}
})();`;
}
