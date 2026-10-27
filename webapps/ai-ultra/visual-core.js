/* Presentation only. The authenticated transport and dialog state stay in app-upgrade.js. */
'use strict';
(() => {
 const root=document.documentElement;
 const rgb=value=>{if(!/^#[\da-f]{6}$/i.test(value||''))return null;return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16))};
 const hex=value=>'#'+value.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
 const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
 const luminance=color=>rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]+.05)/(values[1]+.05)};
 const readable=(candidate,bgs,fallback)=>{const value=rgb(candidate)?candidate:fallback;if(bgs.every(bg=>contrast(value,bg)>=4.5))return value;const score=color=>Math.min(...bgs.map(bg=>contrast(color,bg))),target=score('#ffffff')>score('#000000')?'#ffffff':'#000000';for(let step=1;step<=20;step++){const adjusted=hex(mix(rgb(value),rgb(target),step/20));if(bgs.every(bg=>contrast(adjusted,bg)>=4.5))return adjusted}return target};
 function theme(){
  const params=tg?.themeParams||{},dark=tg?.colorScheme?tg.colorScheme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;
  const color=(name,fallback)=>rgb(params[name])?params[name]:fallback;
  const bg=color('bg_color',dark?'#101216':'#f6f7f9'),surface=color('secondary_bg_color',dark?'#191d23':'#ffffff');
  const raised=hex(mix(rgb(surface),rgb(dark?'#ffffff':'#101216'),dark?.035:.025));
  const text=readable(color('text_color',dark?'#edf0f4':'#202733'),[bg,surface,raised],dark?'#edf0f4':'#202733');
  const muted=readable(color('hint_color',dark?'#a0a9b7':'#5e6979'),[bg,surface,raised],text);
  const accent=color('button_color',dark?'#9cb9ec':'#355e9b'),onAccent=readable(color('button_text_color','#ffffff'),[accent],'#ffffff');
  const tokens={bg,surface,raised,text,muted,accent,'on-accent':onAccent,'accent-soft':hex(mix(rgb(surface),rgb(accent),.1)),border:hex(mix(rgb(surface),rgb(text),dark?.19:.2)),shadow:dark?'0 8px 28px #00000026':'0 8px 28px #2027330b'};
  for(const[key,value]of Object.entries(tokens))root.style.setProperty('--ui-'+key,value);
  root.dataset.theme=dark?'dark':'light';root.style.colorScheme=dark?'dark':'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content',bg);
  for(const method of ['setHeaderColor','setBackgroundColor','setBottomBarColor'])try{tg?.[method]?.(bg)}catch{}
 }
 viewport=function(){
  const visual=window.visualViewport,height=visual?.height||tg?.viewportHeight||window.innerHeight;
  root.style.setProperty('--vh',height+'px');root.style.setProperty('--app-height',height+'px');
  root.style.setProperty('--viewport-offset',(visual?.offsetTop||0)+'px');
  const keyboard=window.innerHeight-height>150;root.classList.toggle('keyboard-open',keyboard);
  const device=tg?.safeAreaInset,content=tg?.contentSafeAreaInset;
  for(const side of ['top','right','bottom','left']){
   if(device||content){const inset=Math.max(0,Number(device?.[side])||0)+Math.max(0,Number(content?.[side])||0);root.style.setProperty('--safe-'+side,(keyboard&&side==='bottom'?0:inset)+'px')}
   else root.style.setProperty('--safe-'+side,keyboard&&side==='bottom'?'0px':`env(safe-area-inset-${side},0px)`);
  }
 };
 initTelegram=function(){
  try{tg?.ready();tg?.expand();for(const event of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'])tg?.onEvent?.(event,viewport);tg?.onEvent?.('themeChanged',theme);
   if(tg?.isVersionAtLeast?.('8.0')&&!tg.isFullscreen)setTimeout(()=>{try{tg.requestFullscreen()}catch{}},250);
  }catch{}
  theme();viewport();window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);window.addEventListener('resize',viewport);
  matchMedia('(prefers-color-scheme:dark)').addEventListener?.('change',()=>{if(!tg?.colorScheme)theme()});
 };
 const baseRenderMode=renderMode;
 renderMode=function(mode){baseRenderMode(mode);root.dataset.mode=mode};
 const navigationActions=new Set(['chat','video','image','music','agent','mode:chat','mode:video','mode:image','mode:music','mode:agent']);
 const baseMessage=renderMessage;
 renderMessage=function(message){
  const buttons=(message.buttons||[]).map(row=>row.filter(entry=>!navigationActions.has(entry[1]))).filter(row=>row.length);
  const node=baseMessage({...message,buttons});
  const copy=node.querySelector('.message-actions button');
  if(copy){
   copy.classList.add('copy-state');copy.dataset.state='idle';
   const label=el('span','sr-only','Копировать ответ');label.setAttribute('aria-live','polite');copy.append(label);
   copy.onclick=async()=>{
    if(copy.disabled)return;copy.disabled=true;copy.dataset.state='loading';copy.setAttribute('aria-busy','true');
    try{await navigator.clipboard.writeText(message.text);copy.dataset.state='copied';copy.replaceChildren(icon('check'),label);copy.setAttribute('aria-label','Скопировано');label.textContent='Ответ скопирован';haptic()}
    catch{copy.dataset.state='error';copy.replaceChildren(icon('info'),label);copy.setAttribute('aria-label','Не удалось скопировать. Повторить');label.textContent='Не удалось скопировать';toast('Не удалось скопировать. Выделите текст или попробуйте ещё раз.')}
    finally{copy.disabled=false;copy.removeAttribute('aria-busy');setTimeout(()=>{if(!copy.isConnected)return;copy.dataset.state='idle';copy.replaceChildren(icon('copy'),label);copy.setAttribute('aria-label','Копировать ответ');label.textContent='Копировать ответ'},2400)}
   };
  }
  if(message.role==='assistant'&&message.status==='working'){
   const dots=el('span','typing-dots');dots.setAttribute('aria-label','Готовлю ответ');for(let i=0;i<3;i++)dots.append(el('i'));node.querySelector('.bubble').append(dots);
  }
  return node;
 };
 const baseConnected=connected;
 connected=function(value){baseConnected(value);if(value)root.classList.remove('app-loading')};
 const baseBanner=banner;
 banner=function(text){root.classList.remove('app-loading');baseBanner(text)};
 const baseSetup=setup;
 setup=function(){
  root.classList.add('app-loading');baseSetup();
  for(const button of document.querySelectorAll('[data-agent-prompt]'))button.onclick=()=>{
   if(!state.connected||state.sending||state.actionSending||state.dialogSwitching||state.voiceStarting||state.recording||state.transcribing||$('prompt').readOnly)return;
   const field=$('prompt');field.value=button.dataset.agentPrompt;field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();haptic();
  };
  // Keep one dictation control while the composer is empty; sending reveals its own arrow.
  $('prompt').addEventListener('input',()=>root.classList.toggle('has-prompt',!!$('prompt').value.trim()));
  const refreshLabel=()=>{const has=!!$('prompt').value.trim();root.classList.toggle('has-prompt',has);$('attach-trigger').setAttribute('aria-expanded',String(!$('attach-menu').hidden));for(const button of document.querySelectorAll('[data-agent-prompt]'))button.disabled=!state.connected||state.sending||state.actionSending||state.dialogSwitching||state.voiceStarting||!!state.recording||state.transcribing||$('prompt').readOnly};
  new MutationObserver(refreshLabel).observe($('send'),{attributes:true,attributeFilter:['data-empty','disabled']});
  new MutationObserver(refreshLabel).observe($('attach-menu'),{attributes:true,attributeFilter:['hidden']});
  root.dataset.mode=state.mode;refreshLabel();
  // Login is a resolved screen; it must not be covered by a loading placeholder.
  new MutationObserver(()=>{if(!$('login-panel').hidden)root.classList.remove('app-loading')}).observe($('login-panel'),{attributes:true,attributeFilter:['hidden']});
 };
})();
