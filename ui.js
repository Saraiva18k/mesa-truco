// ui.js v3 — mesa 1x1 vs bot. Cartas jogadas FICAM na mesa, com pausa pra ver quem levou a rodada.
const T = window.Truco, R = window.Rulesets, SJ = window.SubJogos;
const SUIT = { paus:'♣', copas:'♥', espadas:'♠', ouros:'♦' };
const RED = { copas:1, ouros:1 };
let p, rs, busy = false;

const $ = id => document.getElementById(id);

function iniciar(){
  rs = R[$('rsel').value];
  p = T.criarPartida({ ruleset: rs, jogadores:[{id:'eu',nome:'Você'},{id:'bot',nome:'Bot'}], seed:(Date.now()%100000)|1 });
  $('setup').style.display='none'; $('mesa').style.display='flex';
  $('modo').textContent = rs.nome;
  novaMao();
}
function novaMao(){ T.novaMao(p); clearSlots(); flash(''); render(); setTimeout(loopBot,650); }

/* ---------- cartas ---------- */
function cardEl(c, opts={}){
  const d=document.createElement('div');
  d.className='card'+(RED[c.naipe]?' red':'')+(opts.manilha?' manilha':'')+(opts.cls?(' '+opts.cls):'');
  d.innerHTML=`<span class="tl">${c.valor}<br>${SUIT[c.naipe]}</span><span class="big">${SUIT[c.naipe]}</span><span class="br">${c.valor}<br>${SUIT[c.naipe]}</span>`;
  if(opts.onClick) d.onclick=opts.onClick;
  return d;
}
function backEl(){ const d=document.createElement('div'); d.className='card back'; return d; }
function ehManilha(c){
  if(rs.manilha==='fixa') return rs.manilhasFixas.some(m=>m.valor===c.valor&&m.naipe===c.naipe);
  return rs.manilha==='virada' && p.mao.manilhaValor && c.valor===p.mao.manilhaValor;
}

/* ---------- tentos (palitinhos) ---------- */
function marca(n,color){
  const Hh=32, sw=3; let x=3, g='';
  const grupos=[]; for(let i=0;i<Math.floor(n/5);i++) grupos.push(5); if(n%5) grupos.push(n%5);
  for(const c of grupos){
    const verts=Math.min(c,4);
    for(let i=0;i<verts;i++){ const xx=x+i*8; g+=`<line x1="${xx}" y1="3" x2="${xx}" y2="${Hh-3}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`; }
    if(c===5) g+=`<line x1="${x-2}" y1="${Hh-3}" x2="${x+3*8+2}" y2="3" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
    x+=3*8+13;
  }
  const w=Math.max(x,12);
  return `<svg width="${w}" height="${Hh}" viewBox="0 0 ${w} ${Hh}">${g}</svg>`;
}

/* ---------- balões ---------- */
function bubble(side,text,kind){
  const el=$(side==='A'?'bubEu':'bubBot');
  el.textContent=text; el.className='bubble '+side+(kind?(' '+kind):'')+' show';
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),1600);
}

/* ---------- mesa (slots geridos pela UI, não pelo motor) ---------- */
function clearSlots(){ $('slotBot').innerHTML=''; $('slotEu').innerHTML=''; }
function addToSlot(who,carta){
  const meu=who==='eu';
  $(meu?'slotEu':'slotBot').appendChild(cardEl(carta,{ manilha:ehManilha(carta), cls: meu?'deal-bottom':'deal-top' }));
}

/* ---------- render (NÃO mexe nos slots) ---------- */
function render(){
  const m=p.mao;
  $('nA').textContent=p.placar.A; $('nB').textContent=p.placar.B;
  $('tA').innerHTML=marca(p.placar.A,'#4da3ff'); $('tB').innerHTML=marca(p.placar.B,'#ff6f5e');
  const r=$('rounds'); r.innerHTML='';
  for(let i=0;i<3;i++){ const d=document.createElement('div'); const v=m.vazas[i]; d.className='dot'+(v?(' '+v):''); r.appendChild(d); }
  const myTurn=m.vez==='eu'&&m.fase==='jogo'&&!m.encerradaMao&&!p.encerrada&&!busy;
  $('seatEu').classList.toggle('turn', myTurn);
  $('seatBot').classList.toggle('turn', m.vez==='bot'&&m.fase==='jogo'&&!m.encerradaMao&&!p.encerrada);
  const bh=$('botHand'); bh.innerHTML=''; m.cartas.bot.forEach(()=>bh.appendChild(backEl()));
  const vb=$('viraBox'); vb.innerHTML='';
  if(m.vira){ vb.appendChild(cardEl(m.vira)); const s=document.createElement('small'); s.textContent='vira'; vb.appendChild(s); }
  $('manilhaBox').textContent = m.manilhaValor ? ('manilha: '+m.manilhaValor) : '';
  const podeJogar=m.vez==='eu'&&!m.aposta&&!(m.envido&&m.envido.aguardando)&&!(m.flor&&m.flor.aguardando)&&m.fase==='jogo'&&!m.encerradaMao&&!busy;
  const mh=$('myHand'); mh.innerHTML='';
  m.cartas.eu.forEach((c,i)=>mh.appendChild(cardEl(c,{ manilha:ehManilha(c), cls:podeJogar?'ok':'', onClick:podeJogar?()=>jogar(i):null })));
  controles();
}
function flash(t){ $('flash').textContent=t||''; }
function nivelNome(n){ return ({1:'TRUCO',2:'SEIS',3:'NOVE',4:'DOZE'})[n]||'TRUCO'; }

/* ---------- controles ---------- */
function btn(txt,cls,fn){ const b=document.createElement('button'); b.textContent=txt; b.className=cls; b.onclick=fn; return b; }
function controles(){
  const c=$('controls'); c.innerHTML=''; const m=p.mao;
  if(m.encerradaMao||p.encerrada||busy) return;
  if(m.aposta&&m.aguardando==='A'){
    c.append(btn('Aceitar','b-yes',()=>act(()=>T.responderTruco(p,'eu','aceitar'),'A','Quero!','sim')));
    if(m.nivel<rs.escalada.length-2) c.append(btn(nivelNome(m.nivel+2)+'!','b-sub',()=>act(()=>T.responderTruco(p,'eu','aumentar'),'A',nivelNome(m.nivel+2)+'!','truco')));
    c.append(btn('Correr','b-no',()=>act(()=>T.responderTruco(p,'eu','correr'),'A','Corro','nao'))); return;
  }
  if(m.envido&&m.envido.aguardando==='A'){
    c.append(btn('Quero','b-yes',()=>act(()=>T.responderEnvido(p,'eu','quero'),'A','Quero!','sim')));
    c.append(btn('Real','b-sub',()=>act(()=>T.responderEnvido(p,'eu','real'),'A','Real!','truco')));
    c.append(btn('Não quero','b-no',()=>act(()=>T.responderEnvido(p,'eu','naoquero'),'A','Não quero','nao'))); return;
  }
  if(m.flor&&m.flor.aguardando==='A'){
    c.append(btn('Quero','b-yes',()=>act(()=>T.responderFlor(p,'eu','quero'),'A','Quero!','sim')));
    c.append(btn('Contraflor','b-flor',()=>act(()=>T.responderFlor(p,'eu','contraflor'),'A','Contraflor!','truco')));
    c.append(btn('Não quero','b-no',()=>act(()=>T.responderFlor(p,'eu','naoquero'),'A','Não','nao'))); return;
  }
  if(m.fase==='decisao_mao11'&&m.timeDe11==='A'){
    c.append(btn('Jogar (vale 3)','b-yes',()=>act(()=>T.decidirMaoDe11(p,'eu','jogar'),'A','Vou jogar!','sim')));
    c.append(btn('Não jogar','b-no',()=>act(()=>T.decidirMaoDe11(p,'eu','naojogar'),'A','Passo','nao'))); return;
  }
  if(m.vez==='eu'&&m.fase==='jogo'){
    if(!m.trucoBloqueado&&m.travadoPara!=='A'&&m.nivel<rs.escalada.length-1)
      c.append(btn(nivelNome(m.nivel+1)+'!','b-truco',()=>act(()=>T.pedirTruco(p,'eu'),'A',nivelNome(m.nivel+1)+'!','truco')));
    const janela=rs.temEnvido&&m.vazas.length===0&&m.mesaAtual.length===0&&!m.envidoFechado;
    const florAlguem=rs.temFlor&&(SJ.temFlor(m.cartas.eu)||SJ.temFlor(m.cartas.bot));
    if(janela&&!florAlguem){
      c.append(btn('Envido','b-sub',()=>act(()=>T.cantarEnvido(p,'eu','envido'),'A','Envido!','truco')));
      c.append(btn('Falta','b-sub',()=>act(()=>T.cantarEnvido(p,'eu','falta'),'A','Falta!','truco')));
    }
    if(rs.temFlor&&janela&&SJ.temFlor(m.cartas.eu))
      c.append(btn('Flor','b-flor',()=>act(()=>T.cantarFlor(p,'eu'),'A','Flor!','truco')));
  }
}

/* ---------- jogar carta (com pausa na resolução da vaza) ---------- */
function jogar(i){ playCard('eu',i); }
function playCard(who,idx){
  if(busy) return;
  const carta={...p.mao.cartas[who][idx]};
  const vAntes=p.mao.vazas.length;
  try{ T.jogarCarta(p,who,idx); }catch(e){ flash(e.message); return; }
  addToSlot(who,carta);
  render();
  if(p.mao.vazas.length>vAntes){           // vaza fechou: segura na mesa e mostra quem levou
    const res=p.mao.vazas[p.mao.vazas.length-1];
    flash(res==='E'?'🤝 Rodada empatada':(res==='A'?'✅ Você levou a rodada':'❌ Bot levou a rodada'));
    busy=true; render();
    if(p.mao.encerradaMao||p.encerrada){
      setTimeout(()=>{ busy=false; if(checarFim())return; flash('Fim da mão'); setTimeout(()=>{ clearSlots(); novaMao(); },900); }, 1700);
    } else {
      setTimeout(()=>{ busy=false; clearSlots(); flash(''); render(); setTimeout(loopBot,300); }, 1500);
    }
  } else {
    setTimeout(loopBot,600);
  }
}

/* ---------- ações que não são carta (truco/envido/flor/mão11) ---------- */
function act(fn,side,fala,kind){
  if(busy) return;
  try{ fn(); }catch(e){ flash(e.message); return; }
  if(side&&fala) bubble(side,fala,kind);
  posAcao();
}
function posAcao(){
  render();
  if(checarFim()) return;
  if(p.mao.encerradaMao){ flash('Fim da mão'); busy=true; setTimeout(()=>{ busy=false; clearSlots(); novaMao(); },1700); return; }
  setTimeout(loopBot,650);
}
function checarFim(){
  if(p.encerrada){ $('fim').style.display='flex';
    $('fimTxt').textContent=(p.vencedor==='A'?'🏆 Você venceu!':'🤖 Bot venceu')+`  ${p.placar.A} × ${p.placar.B}`; return true; }
  return false;
}

/* ---------- bot ---------- */
function forca(c){ return T.forca(c,rs,p.mao.manilhaValor); }
function botFraca(){ const m=p.mao.cartas.bot; let k=0; for(let i=1;i<m.length;i++) if(forca(m[i])<forca(m[k]))k=i; return k; }
function botMax(){ return Math.max(...p.mao.cartas.bot.map(forca)); }

function loopBot(){
  if(p.encerrada||p.mao.encerradaMao||busy) return;
  const m=p.mao;
  if(m.aposta&&m.aguardando==='B') return botTruco();
  if(m.envido&&m.envido.aguardando==='B') return botEnv();
  if(m.flor&&m.flor.aguardando==='B') return botFlor();
  if(m.fase==='decisao_mao11'&&m.timeDe11==='B'){
    const joga=botMax()>=8; try{T.decidirMaoDe11(p,'bot',joga?'jogar':'naojogar');}catch(e){}
    bubble('B',joga?'Vou jogar!':'Passo',joga?'sim':'nao'); return posAcao();
  }
  if(m.vez==='bot'&&m.fase==='jogo'){
    if(!m.trucoBloqueado&&m.travadoPara!=='B'&&m.nivel===0&&botMax()>=9&&Math.random()<0.45){
      try{T.pedirTruco(p,'bot');}catch(e){} bubble('B','Truco!','truco'); return posAcao();
    }
    return playCard('bot',botFraca());
  }
  render(); // é sua vez
}
function botTruco(){
  const ac=botMax()>=8, sobe=botMax()>=11&&p.mao.nivel<rs.escalada.length-2&&Math.random()<0.35;
  if(sobe){ const nn=p.mao.aposta?p.mao.aposta.nivelProposto+1:2; try{T.responderTruco(p,'bot','aumentar');}catch(e){} bubble('B',nivelNome(nn)+'!','truco'); }
  else if(ac){ try{T.responderTruco(p,'bot','aceitar');}catch(e){} bubble('B','Quero!','sim'); }
  else { try{T.responderTruco(p,'bot','correr');}catch(e){} bubble('B','Corro','nao'); }
  posAcao();
}
function botEnv(){ const q=SJ.pontosEnvido(p.mao.cartas.bot)>=27; try{T.responderEnvido(p,'bot',q?'quero':'naoquero');}catch(e){} bubble('B',q?'Quero!':'Não quero',q?'sim':'nao'); posAcao(); }
function botFlor(){ const cf=SJ.pontosFlor(p.mao.cartas.bot)>=35&&Math.random()<0.5; try{T.responderFlor(p,'bot',cf?'contraflor':'quero');}catch(e){} bubble('B',cf?'Contraflor!':'Quero!','truco'); posAcao(); }

window.iniciar=iniciar;
