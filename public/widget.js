"use strict";(()=>{var $=Object.defineProperty;var M=Object.getOwnPropertySymbols;var F=Object.prototype.hasOwnProperty,R=Object.prototype.propertyIsEnumerable;var L=(e,t,n)=>t in e?$(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,H=(e,t)=>{for(var n in t||(t={}))F.call(t,n)&&L(e,n,t[n]);if(M)for(var n of M(t))R.call(t,n)&&L(e,n,t[n]);return e};var h={displayName:"AI Assistant",primaryColor:"#18181B",welcomeMessage:"Hi! How can I help?"},K=`
/* Theme */
:host {
  --opps-primary-color: #18181B;
}

/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Animations */
@keyframes opps-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(24,24,27,0.35); }
  70%  { box-shadow: 0 0 0 12px rgba(24,24,27,0); }
  100% { box-shadow: 0 0 0 0 rgba(24,24,27,0); }
}
@keyframes opps-dot-pulse {
  0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
  30%            { opacity: 1;    transform: translateY(-4px); }
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}

/* Bubble */
.opps-bubble {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--opps-primary-color);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  transition: transform 200ms ease;
}
.opps-bubble:hover { transform: scale(1.06); }
.opps-bubble:active { transform: scale(0.96); }
.opps-bubble.opps-pulse {
  animation: opps-pulse 1.4s ease-out 1.2s 2 both;
}

/* Panel */
.opps-panel {
  position: fixed;
  bottom: 88px;
  right: 20px;
  z-index: 2147483646;
  width: 360px;
  height: 520px;
  background: #ffffff;
  border: 1px solid #e4e4e7;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transform-origin: bottom right;
}
.opps-panel[aria-hidden="true"] {
  display: none;
}
.opps-panel-opening {
  animation: opps-panel-open 200ms ease forwards;
}
.opps-panel-closing {
  animation: opps-panel-close 160ms ease forwards;
}
@keyframes opps-panel-open {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes opps-panel-close {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to   { opacity: 0; transform: scale(0.95) translateY(8px); }
}

/* Header */
.opps-header {
  height: 52px;
  min-height: 52px;
  background: #f4f4f5;
  border-bottom: 1px solid #e4e4e7;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.opps-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--opps-primary-color);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.opps-bot-name {
  font-size: 14px;
  font-weight: 600;
  color: #09090b;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Message list */
.opps-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #ffffff;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  scroll-behavior: smooth;
}

/* Empty state */
.opps-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  text-align: center;
  padding: 16px;
}
.opps-empty-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--opps-primary-color);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}
.opps-empty-heading {
  font-size: 14px;
  font-weight: 600;
  color: #09090b;
}
.opps-empty-body {
  font-size: 14px;
  font-weight: 400;
  color: #71717a;
  line-height: 1.5;
}

/* Message bubbles */
.opps-msg {
  display: flex;
  max-width: 75%;
  word-break: break-word;
}
.opps-msg-user {
  align-self: flex-end;
  justify-content: flex-end;
  margin-top: 12px;
}
.opps-msg-user:first-of-type { margin-top: 0; }
.opps-msg-assistant {
  align-self: flex-start;
  justify-content: flex-start;
  margin-top: 4px;
}
.opps-bubble-user {
  background: var(--opps-primary-color);
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 16px 16px 4px 16px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
}
.opps-bubble-assistant {
  background: #f4f4f5;
  color: #09090b;
  padding: 8px 16px;
  border-radius: 16px 16px 16px 4px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
}
.opps-bubble-error {
  background: #f4f4f5;
  color: #ef4444;
  padding: 8px 16px;
  border-radius: 16px 16px 16px 4px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
}

/* Typing indicator */
.opps-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f4f4f5;
  padding: 12px 16px;
  border-radius: 16px 16px 16px 4px;
  align-self: flex-start;
  margin-top: 4px;
}
.opps-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #71717a;
}
.opps-dot:nth-child(1) { animation: opps-dot-pulse 1.2s ease-in-out infinite; animation-delay: 0s; }
.opps-dot:nth-child(2) { animation: opps-dot-pulse 1.2s ease-in-out infinite; animation-delay: 0.2s; }
.opps-dot:nth-child(3) { animation: opps-dot-pulse 1.2s ease-in-out infinite; animation-delay: 0.4s; }

/* Input area */
.opps-input-area {
  height: 56px;
  min-height: 56px;
  background: #ffffff;
  border-top: 1px solid #e4e4e7;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.opps-input {
  flex: 1;
  height: 36px;
  background: #f4f4f5;
  border: 1px solid #e4e4e7;
  border-radius: 18px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.4;
  color: #09090b;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  outline: none;
}
.opps-input::placeholder { color: #71717a; }
.opps-input:focus { border-color: #a1a1aa; }
.opps-input:disabled { opacity: 0.5; pointer-events: none; }
.opps-send {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #18181b;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms ease;
  flex-shrink: 0;
}
.opps-send:hover:not(:disabled) { opacity: 0.92; }
.opps-send:active:not(:disabled) { opacity: 0.84; }
.opps-send:disabled { background: #d4d4d8; cursor: default; }
`,B='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',Y='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',G='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',v=document.currentScript,D,z=(D=v==null?void 0:v.dataset.token)!=null?D:"",J=v!=null&&v.src?new URL(v.src).origin:location.origin;z&&!document.getElementById("opps-root")&&te(z,J);function O(e){return`opps_${e}_sessionId`}function P(e){try{return localStorage.getItem(O(e))}catch(t){return null}}function q(e,t){try{localStorage.setItem(O(e),t)}catch(n){}}function j(e,t){if(typeof e!="string")return t;let n=e.trim();return n.length>0?n:t}function V(e){if(typeof e!="string")return h.primaryColor;let t=e.trim();return/^#[0-9A-Fa-f]{6}$/.test(t)?t.toUpperCase():h.primaryColor}function A(e){return e.trim().charAt(0).toUpperCase()||h.displayName.charAt(0)}async function Q(e,t){try{let n=await fetch(`${e}/api/widget/${t}/config`,{method:"GET",headers:{Accept:"application/json"}});if(!n.ok)return h;let m=await n.json();return{displayName:j(m.displayName,h.displayName),primaryColor:V(m.primaryColor),welcomeMessage:j(m.welcomeMessage,h.welcomeMessage)}}catch(n){return h}}async function X(e,t){var o;if(!e.body)return;let n=e.body.getReader(),m=new TextDecoder,a="";for(;;){let{done:i,value:y}=await n.read();if(i)break;a+=m.decode(y,{stream:!0});let r=a.split(`
`);a=(o=r.pop())!=null?o:"";for(let g of r){let b=g.trim();if(b)try{t(JSON.parse(b))}catch(d){}}}if(a.trim())try{t(JSON.parse(a.trim()))}catch(i){}}async function Z(e){let{apiBase:t,token:n,message:m,sessionId:a,onEvent:o}=e,i;try{i=await fetch(`${t}/api/chat/${n}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(H({message:m},a?{sessionId:a}:{}))})}catch(y){o({event:"error"});return}if(!i.ok||!i.body){o({event:"error",sessionId:String(i.status)});return}await X(i,o)}function ee(e,t,n,m){let a=document.createElement("div");a.className="opps-panel",a.setAttribute("role","dialog"),a.setAttribute("aria-label","Chat"),a.setAttribute("aria-hidden","true");let o=document.createElement("div");o.className="opps-header";let i=document.createElement("div");i.className="opps-avatar",i.textContent=A(h.displayName);let y=document.createElement("span");y.className="opps-bot-name",y.textContent=h.displayName,o.appendChild(i),o.appendChild(y);let r=document.createElement("div");r.className="opps-messages",r.setAttribute("aria-live","polite");let g=document.createElement("div");g.className="opps-empty";let b=document.createElement("div");b.className="opps-empty-avatar",b.textContent=A(h.displayName);let d=document.createElement("p");d.className="opps-empty-heading",d.textContent=h.welcomeMessage;let S=document.createElement("p");S.className="opps-empty-body",S.textContent="Ask me anything \u2014 I\u2019m here to help.",g.appendChild(b),g.appendChild(d),g.appendChild(S),r.appendChild(g);let w=document.createElement("div");w.className="opps-input-area";let f=document.createElement("input");f.type="text",f.className="opps-input",f.placeholder="Type a message\u2026",f.setAttribute("aria-label","Message input");let u=document.createElement("button");u.className="opps-send",u.setAttribute("aria-label","Send message"),u.setAttribute("aria-disabled","true"),u.disabled=!0,u.innerHTML=G,w.appendChild(f),w.appendChild(u),a.appendChild(o),a.appendChild(r),a.appendChild(w);let x=!1,C=P(t),I=!1;function E(s,p){I||(g.remove(),I=!0);let c=document.createElement("div");c.className=`opps-msg opps-msg-${p==="user"?"user":"assistant"}`;let l=document.createElement("div");l.className=p==="error"?"opps-bubble-error":`opps-bubble-${p}`,l.textContent=s,c.appendChild(l),r.appendChild(c),r.scrollTop=r.scrollHeight}function W(){let s=document.createElement("div");s.className="opps-typing",s.setAttribute("aria-label","AI is typing");for(let p=0;p<3;p++){let c=document.createElement("div");c.className="opps-dot",s.appendChild(c)}return r.appendChild(s),r.scrollTop=r.scrollHeight,s}function k(s){f.disabled=!s,u.disabled=!s||f.value.trim()==="",u.setAttribute("aria-disabled",String(!s||f.value.trim()===""))}async function T(){let s=f.value.trim();if(!s||x)return;x=!0,f.value="",k(!1),E(s,"user");let p=W(),c="";await Z({apiBase:n,token:t,message:s,sessionId:C,onEvent:l=>{if(l.event==="session"&&l.sessionId)C||(C=l.sessionId,q(t,C));else if(l.event==="token"&&l.text)c+=l.text;else if(l.event==="done")p.remove(),c&&E(c,"assistant"),c="",x=!1,k(!0),f.focus();else if(l.event!=="tool_call"){if(l.event==="error"){p.remove();let U=l.sessionId==="401"?"This chat is unavailable right now.":"Something went wrong. Please try again.";E(U,"error"),x=!1,k(!0)}}}}),x&&(p.remove(),c&&E(c,"assistant"),x=!1,k(!0))}f.addEventListener("input",()=>{u.disabled=f.value.trim()===""||x,u.setAttribute("aria-disabled",String(u.disabled))}),f.addEventListener("keydown",s=>{s.key==="Enter"&&!s.shiftKey&&(s.preventDefault(),T())}),u.addEventListener("click",()=>void T()),a.addEventListener("keydown",s=>{if(s.key!=="Tab")return;let p=Array.from(a.querySelectorAll('button, input, [tabindex="0"]'));if(p.length===0)return;let c=p[0],l=p[p.length-1],N=e.activeElement;s.shiftKey?N===c&&(s.preventDefault(),l.focus()):N===l&&(s.preventDefault(),c.focus())});function _(s){let p=A(s.displayName);i.textContent=p,y.textContent=s.displayName,b.textContent=p,d.textContent=s.welcomeMessage}return{panel:a,applyConfig:_}}function te(e,t){let n=document.createElement("div");n.id="opps-root",document.body.appendChild(n);let m=n.attachShadow({mode:"open"}),a=document.createElement("style");a.textContent=K,m.appendChild(a);let o=document.createElement("button");o.className="opps-bubble",o.setAttribute("aria-label","Open chat"),o.setAttribute("tabindex","0"),o.innerHTML=B,P(e)||o.classList.add("opps-pulse");let{panel:i,applyConfig:y}=ee(m,e,t,o);m.appendChild(o),m.appendChild(i),Q(t,e).then(d=>{n.style.setProperty("--opps-primary-color",d.primaryColor),y(d)});let r=!1;function g(){r=!0,i.setAttribute("aria-hidden","false"),i.classList.remove("opps-panel-closing"),i.classList.add("opps-panel-opening"),o.setAttribute("aria-label","Close chat"),o.innerHTML=Y;let d=i.querySelector(".opps-input");setTimeout(()=>d==null?void 0:d.focus(),210)}function b(){r=!1,i.classList.remove("opps-panel-opening"),i.classList.add("opps-panel-closing"),o.setAttribute("aria-label","Open chat"),o.innerHTML=B,setTimeout(()=>{i.setAttribute("aria-hidden","true"),i.classList.remove("opps-panel-closing")},160)}o.addEventListener("click",()=>{r?b():g()}),o.addEventListener("keydown",d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),r?b():g())})}})();
