"use strict";(()=>{var $=Object.defineProperty;var M=Object.getOwnPropertySymbols;var F=Object.prototype.hasOwnProperty,R=Object.prototype.propertyIsEnumerable;var L=(e,t,a)=>t in e?$(e,t,{enumerable:!0,configurable:!0,writable:!0,value:a}):e[t]=a,H=(e,t)=>{for(var a in t||(t={}))F.call(t,a)&&L(e,a,t[a]);if(M)for(var a of M(t))R.call(t,a)&&L(e,a,t[a]);return e};var h={displayName:"AI Assistant",primaryColor:"#18181B",welcomeMessage:"Hi! How can I help?"},K=`
/* Theme */
:host {
  --leaidear-primary-color: #18181B;
}

/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Animations */
@keyframes leaidear-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(24,24,27,0.35); }
  70%  { box-shadow: 0 0 0 12px rgba(24,24,27,0); }
  100% { box-shadow: 0 0 0 0 rgba(24,24,27,0); }
}
@keyframes leaidear-dot-pulse {
  0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
  30%            { opacity: 1;    transform: translateY(-4px); }
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}

/* Bubble */
.leaidear-bubble {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--leaidear-primary-color);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  transition: transform 200ms ease;
}
.leaidear-bubble:hover { transform: scale(1.06); }
.leaidear-bubble:active { transform: scale(0.96); }
.leaidear-bubble.leaidear-pulse {
  animation: leaidear-pulse 1.4s ease-out 1.2s 2 both;
}

/* Panel */
.leaidear-panel {
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
.leaidear-panel[aria-hidden="true"] {
  display: none;
}
.leaidear-panel-opening {
  animation: leaidear-panel-open 200ms ease forwards;
}
.leaidear-panel-closing {
  animation: leaidear-panel-close 160ms ease forwards;
}
@keyframes leaidear-panel-open {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes leaidear-panel-close {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to   { opacity: 0; transform: scale(0.95) translateY(8px); }
}

/* Header */
.leaidear-header {
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
.leaidear-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--leaidear-primary-color);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.leaidear-bot-name {
  font-size: 14px;
  font-weight: 600;
  color: #09090b;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Message list */
.leaidear-messages {
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
.leaidear-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  text-align: center;
  padding: 16px;
}
.leaidear-empty-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--leaidear-primary-color);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}
.leaidear-empty-heading {
  font-size: 14px;
  font-weight: 600;
  color: #09090b;
}
.leaidear-empty-body {
  font-size: 14px;
  font-weight: 400;
  color: #71717a;
  line-height: 1.5;
}

/* Message bubbles */
.leaidear-msg {
  display: flex;
  max-width: 75%;
  word-break: break-word;
}
.leaidear-msg-user {
  align-self: flex-end;
  justify-content: flex-end;
  margin-top: 12px;
}
.leaidear-msg-user:first-of-type { margin-top: 0; }
.leaidear-msg-assistant {
  align-self: flex-start;
  justify-content: flex-start;
  margin-top: 4px;
}
.leaidear-bubble-user {
  background: var(--leaidear-primary-color);
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 16px 16px 4px 16px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
}
.leaidear-bubble-assistant {
  background: #f4f4f5;
  color: #09090b;
  padding: 8px 16px;
  border-radius: 16px 16px 16px 4px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
}
.leaidear-bubble-error {
  background: #f4f4f5;
  color: #ef4444;
  padding: 8px 16px;
  border-radius: 16px 16px 16px 4px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
}

/* Typing indicator */
.leaidear-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f4f4f5;
  padding: 12px 16px;
  border-radius: 16px 16px 16px 4px;
  align-self: flex-start;
  margin-top: 4px;
}
.leaidear-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #71717a;
}
.leaidear-dot:nth-child(1) { animation: leaidear-dot-pulse 1.2s ease-in-out infinite; animation-delay: 0s; }
.leaidear-dot:nth-child(2) { animation: leaidear-dot-pulse 1.2s ease-in-out infinite; animation-delay: 0.2s; }
.leaidear-dot:nth-child(3) { animation: leaidear-dot-pulse 1.2s ease-in-out infinite; animation-delay: 0.4s; }

/* Input area */
.leaidear-input-area {
  height: 56px;
  min-height: 56px;
  background: #ffffff;
  border-top: 1px solid #e4e4e7;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.leaidear-input {
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
.leaidear-input::placeholder { color: #71717a; }
.leaidear-input:focus { border-color: #a1a1aa; }
.leaidear-input:disabled { opacity: 0.5; pointer-events: none; }
.leaidear-send {
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
.leaidear-send:hover:not(:disabled) { opacity: 0.92; }
.leaidear-send:active:not(:disabled) { opacity: 0.84; }
.leaidear-send:disabled { background: #d4d4d8; cursor: default; }
`,B='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',Y='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',G='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',v=document.currentScript,D,z=(D=v==null?void 0:v.dataset.token)!=null?D:"",J=v!=null&&v.src?new URL(v.src).origin:location.origin;z&&!document.getElementById("leaidear-root")&&te(z,J);function O(e){return`leaidear_${e}_sessionId`}function P(e){try{return localStorage.getItem(O(e))}catch(t){return null}}function q(e,t){try{localStorage.setItem(O(e),t)}catch(a){}}function j(e,t){if(typeof e!="string")return t;let a=e.trim();return a.length>0?a:t}function V(e){if(typeof e!="string")return h.primaryColor;let t=e.trim();return/^#[0-9A-Fa-f]{6}$/.test(t)?t.toUpperCase():h.primaryColor}function A(e){return e.trim().charAt(0).toUpperCase()||h.displayName.charAt(0)}async function Q(e,t){try{let a=await fetch(`${e}/api/widget/${t}/config`,{method:"GET",headers:{Accept:"application/json"}});if(!a.ok)return h;let m=await a.json();return{displayName:j(m.displayName,h.displayName),primaryColor:V(m.primaryColor),welcomeMessage:j(m.welcomeMessage,h.welcomeMessage)}}catch(a){return h}}async function X(e,t){var n;if(!e.body)return;let a=e.body.getReader(),m=new TextDecoder,s="";for(;;){let{done:r,value:y}=await a.read();if(r)break;s+=m.decode(y,{stream:!0});let o=s.split(`
`);s=(n=o.pop())!=null?n:"";for(let g of o){let b=g.trim();if(b)try{t(JSON.parse(b))}catch(p){}}}if(s.trim())try{t(JSON.parse(s.trim()))}catch(r){}}async function Z(e){let{apiBase:t,token:a,message:m,sessionId:s,onEvent:n}=e,r;try{r=await fetch(`${t}/api/chat/${a}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(H({message:m},s?{sessionId:s}:{}))})}catch(y){n({event:"error"});return}if(!r.ok||!r.body){n({event:"error",sessionId:String(r.status)});return}await X(r,n)}function ee(e,t,a,m){let s=document.createElement("div");s.className="leaidear-panel",s.setAttribute("role","dialog"),s.setAttribute("aria-label","Chat"),s.setAttribute("aria-hidden","true");let n=document.createElement("div");n.className="leaidear-header";let r=document.createElement("div");r.className="leaidear-avatar",r.textContent=A(h.displayName);let y=document.createElement("span");y.className="leaidear-bot-name",y.textContent=h.displayName,n.appendChild(r),n.appendChild(y);let o=document.createElement("div");o.className="leaidear-messages",o.setAttribute("aria-live","polite");let g=document.createElement("div");g.className="leaidear-empty";let b=document.createElement("div");b.className="leaidear-empty-avatar",b.textContent=A(h.displayName);let p=document.createElement("p");p.className="leaidear-empty-heading",p.textContent=h.welcomeMessage;let S=document.createElement("p");S.className="leaidear-empty-body",S.textContent="Ask me anything \u2014 I\u2019m here to help.",g.appendChild(b),g.appendChild(p),g.appendChild(S),o.appendChild(g);let w=document.createElement("div");w.className="leaidear-input-area";let f=document.createElement("input");f.type="text",f.className="leaidear-input",f.placeholder="Type a message\u2026",f.setAttribute("aria-label","Message input");let u=document.createElement("button");u.className="leaidear-send",u.setAttribute("aria-label","Send message"),u.setAttribute("aria-disabled","true"),u.disabled=!0,u.innerHTML=G,w.appendChild(f),w.appendChild(u),s.appendChild(n),s.appendChild(o),s.appendChild(w);let x=!1,C=P(t),I=!1;function E(i,l){I||(g.remove(),I=!0);let c=document.createElement("div");c.className=`leaidear-msg leaidear-msg-${l==="user"?"user":"assistant"}`;let d=document.createElement("div");d.className=l==="error"?"leaidear-bubble-error":`leaidear-bubble-${l}`,d.textContent=i,c.appendChild(d),o.appendChild(c),o.scrollTop=o.scrollHeight}function W(){let i=document.createElement("div");i.className="leaidear-typing",i.setAttribute("aria-label","AI is typing");for(let l=0;l<3;l++){let c=document.createElement("div");c.className="leaidear-dot",i.appendChild(c)}return o.appendChild(i),o.scrollTop=o.scrollHeight,i}function k(i){f.disabled=!i,u.disabled=!i||f.value.trim()==="",u.setAttribute("aria-disabled",String(!i||f.value.trim()===""))}async function T(){let i=f.value.trim();if(!i||x)return;x=!0,f.value="",k(!1),E(i,"user");let l=W(),c="";await Z({apiBase:a,token:t,message:i,sessionId:C,onEvent:d=>{if(d.event==="session"&&d.sessionId)C||(C=d.sessionId,q(t,C));else if(d.event==="token"&&d.text)c+=d.text;else if(d.event==="done")l.remove(),c&&E(c,"assistant"),c="",x=!1,k(!0),f.focus();else if(d.event!=="tool_call"){if(d.event==="error"){l.remove();let U=d.sessionId==="401"?"This chat is unavailable right now.":"Something went wrong. Please try again.";E(U,"error"),x=!1,k(!0)}}}}),x&&(l.remove(),c&&E(c,"assistant"),x=!1,k(!0))}f.addEventListener("input",()=>{u.disabled=f.value.trim()===""||x,u.setAttribute("aria-disabled",String(u.disabled))}),f.addEventListener("keydown",i=>{i.key==="Enter"&&!i.shiftKey&&(i.preventDefault(),T())}),u.addEventListener("click",()=>void T()),s.addEventListener("keydown",i=>{if(i.key!=="Tab")return;let l=Array.from(s.querySelectorAll('button, input, [tabindex="0"]'));if(l.length===0)return;let c=l[0],d=l[l.length-1],N=e.activeElement;i.shiftKey?N===c&&(i.preventDefault(),d.focus()):N===d&&(i.preventDefault(),c.focus())});function _(i){let l=A(i.displayName);r.textContent=l,y.textContent=i.displayName,b.textContent=l,p.textContent=i.welcomeMessage}return{panel:s,applyConfig:_}}function te(e,t){let a=document.createElement("div");a.id="leaidear-root",document.body.appendChild(a);let m=a.attachShadow({mode:"open"}),s=document.createElement("style");s.textContent=K,m.appendChild(s);let n=document.createElement("button");n.className="leaidear-bubble",n.setAttribute("aria-label","Open chat"),n.setAttribute("tabindex","0"),n.innerHTML=B,P(e)||n.classList.add("leaidear-pulse");let{panel:r,applyConfig:y}=ee(m,e,t,n);m.appendChild(n),m.appendChild(r),Q(t,e).then(p=>{a.style.setProperty("--leaidear-primary-color",p.primaryColor),y(p)});let o=!1;function g(){o=!0,r.setAttribute("aria-hidden","false"),r.classList.remove("leaidear-panel-closing"),r.classList.add("leaidear-panel-opening"),n.setAttribute("aria-label","Close chat"),n.innerHTML=Y;let p=r.querySelector(".leaidear-input");setTimeout(()=>p==null?void 0:p.focus(),210)}function b(){o=!1,r.classList.remove("leaidear-panel-opening"),r.classList.add("leaidear-panel-closing"),n.setAttribute("aria-label","Open chat"),n.innerHTML=B,setTimeout(()=>{r.setAttribute("aria-hidden","true"),r.classList.remove("leaidear-panel-closing")},160)}n.addEventListener("click",()=>{o?b():g()}),n.addEventListener("keydown",p=>{(p.key==="Enter"||p.key===" ")&&(p.preventDefault(),o?b():g())})}})();
