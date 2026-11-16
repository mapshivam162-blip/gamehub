import{b as S,g as x,d as v,a as L,T as m,e as M}from"./firebase-CiHGjH6c.js";const n=e=>document.getElementById(e);let i=new URLSearchParams(location.search).get("id"),a=null,f=!1,u=0;const p=100;function r(e){const t=n("toast");t.textContent=e,t.classList.add("show"),setTimeout(()=>t.classList.remove("show"),2200)}const d=`<script>
(function () {
  var mem = {};
  var shim = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; },
    clear: function () { mem = {}; },
    key: function (i) { return Object.keys(mem)[i] || null; },
    get length() { return Object.keys(mem).length; }
  };
  try { window.localStorage.getItem('khelog_probe'); } catch (e) {
    try { Object.defineProperty(window, 'localStorage', { value: shim, configurable: true }); } catch (e2) {}
  }
  window.Khelog = {
    addCoins: function (n) {
      n = Math.max(0, Math.min(50, Math.floor(Number(n) || 0)));
      parent.postMessage({ type: 'khelog:coins', amount: n }, '*');
    },
    saveScore: function (n) {
      n = Math.floor(Number(n) || 0);
      parent.postMessage({ type: 'khelog:score', score: n }, '*');
    },
    gameOver: function () {
      parent.postMessage({ type: 'khelog:gameover' }, '*');
    }
  };
})();
<\/script>`;function T(e){return/<head[^>]*>/i.test(e)?e.replace(/<head[^>]*>/i,t=>t+d):/<html[^>]*>/i.test(e)?e.replace(/<html[^>]*>/i,t=>t+d):d+e}function P(){return parseInt(localStorage.getItem("coins")||"1500",10)}function _(e){localStorage.setItem("coins",String(e))}window.addEventListener("message",e=>{const t=e.data||{};if(t.type==="khelog:coins"){if(u+t.amount>p&&(t.amount=Math.max(0,p-u),!t.amount))return;u+=t.amount,_(P()+t.amount),r("🪙 +"+t.amount+" coins!")}else if(t.type==="khelog:score"){const o="khelog_cbest_"+i,g=parseInt(localStorage.getItem(o)||"0",10);if(t.score>g){localStorage.setItem(o,String(t.score));const C=parseInt(localStorage.getItem("best_score")||"0",10);t.score>C&&localStorage.setItem("best_score",String(t.score))}}else if(t.type==="khelog:gameover"){const o=parseInt(localStorage.getItem("games_played")||"0",10)+1;localStorage.setItem("games_played",String(o))}});n("p-like").addEventListener("click",()=>{if(f)return;f=!0,S(i);const e=parseInt(n("p-likes").textContent,10)+1;n("p-likes").textContent=e,n("p-like").innerHTML='❤️ <span id="p-likes">'+e+"</span>",r("❤️ Pasand kar diya!")});n("p-fs").addEventListener("click",()=>{const e=document.documentElement;document.fullscreenElement?document.exitFullscreen():(e.requestFullscreen||e.webkitRequestFullscreen||function(){}).call(e)});const y=2e3;let w=Date.now(),c=0,l=0,s=null;function h(){const e=n("load-fill"),t=Math.min(100,Math.max(l,c));e&&(e.style.width=t.toFixed(1)+"%");const o=n("load-pct");o&&(o.textContent=Math.round(t)+"%")}function k(e){w=Date.now(),c=0,l=0;const t=n("loading");t.classList.remove("done"),t.style.display="flex",n("load-emoji").textContent=e||"🎮",n("load-title").textContent="Game khul raha hai…",s=setInterval(()=>{l+=(85-l)*.045+.25,l>85&&(l=85),h()},100)}function E(e,t){c=e/t*95,h()}function I(e,t){n("load-title").textContent=e,t&&(n("load-emoji").textContent=t)}function b(e){clearInterval(s),s=null,n("load-title").textContent=e,n("load-emoji").textContent="🤷"}async function G(){clearInterval(s),s=null,c=100,h();const e=Date.now()-w;e<y&&await new Promise(t=>setTimeout(t,y-e)),n("loading").classList.add("done"),setTimeout(()=>{n("loading").style.display="none"},400)}async function O(){if(!i){n("p-title").textContent="Game nahi mila",n("p-sub").textContent="Link adhura hai",k("🤷"),b("Game ID nahi mili");return}k("⬇️"),a=null;for(let e=0;e<3&&!a;e++){e&&(I("Dobara koshish kar rahe hain… ("+(e+1)+")","⏳"),await new Promise(t=>setTimeout(t,1500)));try{a=await x(i,E)}catch{a=null}(!a||!a.html)&&(a=null)}if(!a||!a.html){b("Game nahi mila"),n("p-title").textContent="Game nahi mila";return}if(I("Game taiyaar hai!","✅"),n("p-title").textContent=a.emoji+" "+a.title,n("p-sub").textContent="by "+(a.author||"Publisher")+" · "+(a.plays||0)+" plays",n("p-likes").textContent=a.likes||0,a.status!=="live"){if(!(a.tries||[]).includes(v)){try{a=await L(i)||a}catch{}const o=a.tryCount||0;o>=m?r("🎉 Game LIVE ho gaya!"):r("🧪 Tu try #"+o+" hai — "+(m-o)+" aur chahiye!")}const t=a.tryCount||0;n("trybanner").style.display="block",n("trybanner").textContent="🧪 BETA TEST — "+t+"/"+m+" try ho gaye. 20 pure hue to game sabke liye LIVE ho jayega!"}n("gframe").srcdoc=T(a.html),await G(),M(i).catch(()=>{})}O();
