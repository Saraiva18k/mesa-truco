// ui.js v4 — mesa 1x1 e 2x2 vs bots. Cartas ficam na mesa + pausa pra ver a rodada.
const T = window.Truco, R = window.Rulesets, SJ = window.SubJogos;
const SUIT = { paus:'♣', copas:'♥', espadas:'♠', ouros:'♦' };
const RED = { copas:1, ouros:1 };
const $ = id => document.getElementById(id);
let p, rs, n, busy=false, seatPos={}, lblA='Vocês', lblB='Eles';

const POS2 = ['bottom','top'];
const POS4 = ['bottom','left','top','right'];
const SEAT = { top:{seat:'st',bub:'bt'}, bottom:{seat:'sb',bub:'bb'}, left:{seat:'sl',bub:'bl'}, right:{seat:'sr',bub:'br'} };
const FACES = { eu:'🧑', bia:'👩', tato:'🧔', rui:'👨', b1:'🤖' };

function iniciar(){
  rs = R[$('rsel').value]; n = +$('msel').value === 1 ? 2 : 4;
  const jr = n===2
    ? [{id:'eu',nome:'Você'},{id:'b1',nome:'Bot'}]
    : [{id:'eu',nome:'Você'},{id:'tato',nome:'Tato'},{id:'bia',nome:'Bia'},{id:'rui',nome:'Rui'}];
  p = T.criarPartida({ ruleset: rs, jogadores: jr, seed:(Date.now()%100000)|1 });
  const order = n===2?POS2:POS4;
  seatPos = {}; jr.forEach((j,i)=> seatPos[j.id]=order[i]);
  lblA = n===4?'Vocês':'Você'; lblB = n===4?'Eles':'Bot';
  $('lbA').textContent=lblA; $('lbB').textContent=lblB;
  $('arena').classList.toggle('solo', n===2);
  // mostra/esconde lugares
  ['top','left','right'].forEach(pos=> $(SEAT[pos].seat).classList.toggle('hide', !Object.values(seatPos).includes(pos)));
  $('setup').style.display='none'; $('mesa').style.display='flex'; $('modo').textContent=rs.nome;
  novaMao();
}
function novaMao(){ T.novaMao(p); clearSlots(); flash(''); render(); setTimeout(loopBot,650); }

/* ---------- cartas ---------- */
function cardEl(c,opts={}){
  const d=document.createElement('div');
  d.className='card'+(opts.sm?' sm':'')+(RED[c.naipe]?' red':'')+(opts.manilha?' manilha':'')+(opts.cls?(' '+opts.cls):'');
  d.innerHTML=`<span class="tl">${c.valor}<br>${SUIT[c.naipe]}</span><span class="big">${SUIT[c.naipe]}</span><span class="br">${c.valor}<br>${SUIT[c.naipe]}</span>`;
  if(opts.onClick) d.onclick=opts.onClick;
  return d;
}
function ehManilha(c){
  if(rs.manilha==='fixa') return rs.manilhasFixas.some(m=>m.valor===c.valor&&m.naipe===c.naipe);
  return rs.manilha==='virada' && p.mao.manilhaValor && c.valor===p.mao.manilhaValor;
}
function team(id){ return T.timeDoJog(p,id); }

/* ---------- tentos ---------- */
function marca(v,color){
  const Hh=30,sw=3; let x=3,g='';
  const grupos=[]; for(let i=0;i<Math.floor(v/5);i++) grupos.push(5); if(v%5) grupos.push(v%5);
  for(const c of grupos){ const verts=Math.min(c,4);
    for(let i=0;i<verts;i++){ const xx=x+i*8; g+=`<line x1="${xx}" y1="3" x2="${xx}" y2="${Hh-3}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`; }
    if(c===5) g+=`<line x1="${x-2}" y1="${Hh-3}" x2="${x+3*8+2}" y2="3" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
    x+=3*8+13; }
  const w=Math.max(x,12); return `<svg width="${w}" height="${Hh}" viewBox="0 0 ${w} ${Hh}">${g}</svg>`;
}

/* ---------- balões ---------- */
function bubble(id,text,kind){
  const pos=seatPos[id]; if(!pos) return; const el=$(SEAT[pos].bub);
  el.textContent=text; el.className='bubble '+(kind||'')+' show';
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),1600);
}

/* ---------- mesa (slots) ---------- */
function clearSlots(){ ['top','bottom','left','right'].forEach(pos=>$('pc-'+pos).innerHTML=''); }
function addToSlot(who,carta){ const pos=seatPos[who]; $('pc-'+pos).appendChild(cardEl(carta,{manilha:ehManilha(carta),cls:'deal-'+pos})); }

/* ---------- render ---------- */
function seatFill(id){
  const pos=seatPos[id]; const se=$(SEAT[pos].seat); const m=p.mao;
  se.classList.remove('A','B'); se.classList.add(team(id));
  se.querySelector('.avatar').textContent = FACES[id]||'🙂';
  const nm = p.jogadores[p.idx[id]].nome + (id==='eu'?'':'') ;
  const sub = id==='eu'?'você':(team(id)===team('eu')?'parceiro':'adversário');
  se.querySelector('.nome').innerHTML = nm + (pos==='bottom'?'':`<br><small>${sub}</small>`);
  const minis=se.querySelector('.minis');
  if(minis){ minis.innerHTML=''; if(pos!=='bottom') for(let k=0;k<m.cartas[id].length;k++){ const d=document.createElement('div'); d.className='mini'; minis.appendChild(d);} }
  const ativo = m.vez===id && m.fase==='jogo' && !m.encerradaMao && !p.encerrada && !busy;
  se.classList.toggle('turn', ativo);
}
function render(){
  const m=p.mao;
  $('nA').textContent=p.placar.A; $('nB').textContent=p.placar.B;
  $('tA').innerHTML=marca(p.placar.A,'#4da3ff'); $('tB').innerHTML=marca(p.placar.B,'#ff6f5e');
  const r=$('rounds'); r.innerHTML='';
  for(let i=0;i<3;i++){ const d=document.createElement('div'); const vv=m.vazas[i]; d.className='dot'+(vv?(' '+vv):''); r.appendChild(d); }
  Object.keys(seatPos).forEach(seatFill);
  const vb=$('viraBox'); vb.innerHTML='';
  if(m.vira){ vb.appendChild(cardEl(m.vira)); const s=document.createElement('small'); s.textContent='vira'; vb.appendChild(s); }
  $('manilhaBox').textContent = m.manilhaValor ? ('manilha: '+m.manilhaValor) : '';
  const podeJogar=m.vez==='eu'&&!m.aposta&&!(m.envido&&m.envido.aguardando)&&!(m.flor&&m.flor.aguardando)&&m.fase==='jogo'&&!m.encerradaMao&&!busy;
  const mh=$('myHand'); mh.innerHTML='';
  m.cartas.eu.forEach((c,i)=>mh.appendChild(cardEl(c,{manilha:ehManilha(c),cls:podeJogar?'ok':'',onClick:podeJogar?()=>jogar(i):null})));
  controles();
}
function flash(t){ $('flash').textContent=t||''; }
function nivelNome(x){ return ({1:'TRUCO',2:'SEIS',3:'NOVE',4:'DOZE'})[x]||'TRUCO'; }

/* ---------- controles (sempre do humano, time A) ---------- */
function btn(t,cls,fn){ const b=document.createElement('button'); b.textContent=t; b.className=cls; b.onclick=fn; return b; }
function controles(){
  const c=$('controls'); c.innerHTML=''; const m=p.mao;
  if(m.encerradaMao||p.encerrada||busy) return;
  if(m.aposta&&m.aguardando==='A'){
    c.append(btn('Aceitar','b-yes',()=>act(()=>T.responderTruco(p,'eu','aceitar'),'eu','Quero!','sim')));
    if(m.nivel<rs.escalada.length-2) c.append(btn(nivelNome(m.nivel+2)+'!','b-sub',()=>act(()=>T.responderTruco(p,'eu','aumentar'),'eu',nivelNome(m.nivel+2)+'!','truco')));
    c.append(btn('Correr','b-no',()=>act(()=>T.responderTruco(p,'eu','correr'),'eu','Corro','nao'))); return;
  }
  if(m.envido&&m.envido.aguardando==='A'){
    c.append(btn('Quero','b-yes',()=>act(()=>T.responderEnvido(p,'eu','quero'),'eu','Quero!','sim')));
    c.append(btn('Real','b-sub',()=>act(()=>T.responderEnvido(p,'eu','real'),'eu','Real!','truco')));
    c.append(btn('Não quero','b-no',()=>act(()=>T.responderEnvido(p,'eu','naoquero'),'eu','Não quero','nao'))); return;
  }
  if(m.flor&&m.flor.aguardando==='A'){
    c.append(btn('Quero','b-yes',()=>act(()=>T.responderFlor(p,'eu','quero'),'eu','Quero!','sim')));
    c.append(btn('Contraflor','b-flor',()=>act(()=>T.responderFlor(p,'eu','contraflor'),'eu','Contraflor!','truco')));
    c.append(btn('Não quero','b-no',()=>act(()=>T.responderFlor(p,'eu','naoquero'),'eu','Não','nao'))); return;
  }
  if(m.fase==='decisao_mao11'&&m.timeDe11==='A'){
    c.append(btn('Jogar (vale 3)','b-yes',()=>act(()=>T.decidirMaoDe11(p,'eu','jogar'),'eu','Vou jogar!','sim')));
    c.append(btn('Não jogar','b-no',()=>act(()=>T.decidirMaoDe11(p,'eu','naojogar'),'eu','Passo','nao'))); return;
  }
  if(m.vez==='eu'&&m.fase==='jogo'){
    if(!m.trucoBloqueado&&m.travadoPara!=='A'&&m.nivel<rs.escalada.length-1)
      c.append(btn(nivelNome(m.nivel+1)+'!','b-truco',()=>act(()=>T.pedirTruco(p,'eu'),'eu',nivelNome(m.nivel+1)+'!','truco')));
    const janela=rs.temEnvido&&m.vazas.length===0&&m.mesaAtual.length===0&&!m.envidoFechado;
    const florAlguem=rs.temFlor&&Object.keys(seatPos).some(id=>SJ.temFlor(m.cartas[id]));
    if(janela&&!florAlguem){
      c.append(btn('Envido','b-sub',()=>act(()=>T.cantarEnvido(p,'eu','envido'),'eu','Envido!','truco')));
      c.append(btn('Falta','b-sub',()=>act(()=>T.cantarEnvido(p,'eu','falta'),'eu','Falta!','truco')));
    }
    if(rs.temFlor&&janela&&SJ.temFlor(m.cartas.eu))
      c.append(btn('Flor','b-flor',()=>act(()=>T.cantarFlor(p,'eu'),'eu','Flor!','truco')));
  }
}

/* ---------- jogar carta + pausa de rodada ---------- */
function jogar(i){ playCard('eu',i); }
function playCard(who,idx){
  if(busy) return;
  const carta={...p.mao.cartas[who][idx]};
  const vAntes=p.mao.vazas.length;
  try{ T.jogarCarta(p,who,idx); }catch(e){ flash(e.message); return; }
  addToSlot(who,carta); render();
  if(p.mao.vazas.length>vAntes){
    const res=p.mao.vazas[p.mao.vazas.length-1];
    flash(res==='E'?'🤝 Rodada empatada':(res==='A'?'✅ '+lblA+' levaram a rodada':'❌ '+lblB+' levaram a rodada'));
    busy=true; render();
    if(p.mao.encerradaMao||p.encerrada){
      setTimeout(()=>{ busy=false; if(checarFim())return; flash('Fim da mão'); setTimeout(()=>{ clearSlots(); novaMao(); },900); },1700);
    } else {
      setTimeout(()=>{ busy=false; clearSlots(); flash(''); render(); setTimeout(loopBot,300); },1500);
    }
  } else { setTimeout(loopBot,600); }
}

/* ---------- ações não-carta ---------- */
function act(fn,id,fala,kind){
  if(busy) return;
  try{ fn(); }catch(e){ flash(e.message); return; }
  if(id&&fala) bubble(id,fala,kind);
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
    const ganhou=p.vencedor===team('eu');
    $('fimTxt').textContent=(ganhou?'🏆 '+lblA+' venceram!':'🤖 '+lblB+' venceram')+`  ${p.placar.A} × ${p.placar.B}`; return true; }
  return false;
}

/* ---------- bots ---------- */
function forca(c){ return T.forca(c,rs,p.mao.manilhaValor); }
function fracaIdx(id){ const m=p.mao.cartas[id]; let k=0; for(let i=1;i<m.length;i++) if(forca(m[i])<forca(m[k]))k=i; return k; }
function maxF(id){ return Math.max(...p.mao.cartas[id].map(forca)); }
function botDoTime(t){ return p.jogadores.find(j=>j.id!=='eu'&&team(j.id)===t).id; }

function loopBot(){
  if(p.encerrada||p.mao.encerradaMao||busy) return;
  const m=p.mao;
  if(m.aposta&&m.aguardando!=='A'){ return botRespTruco(botDoTime(m.aguardando)); }
  if(m.envido&&m.envido.aguardando&&m.envido.aguardando!=='A'){ return botRespEnv(botDoTime(m.envido.aguardando)); }
  if(m.flor&&m.flor.aguardando&&m.flor.aguardando!=='A'){ return botRespFlor(botDoTime(m.flor.aguardando)); }
  if(m.fase==='decisao_mao11'&&m.timeDe11!=='A'){
    const bid=botDoTime(m.timeDe11); const joga=maxF(bid)>=8; try{T.decidirMaoDe11(p,bid,joga?'jogar':'naojogar');}catch(e){}
    bubble(bid,joga?'Vou jogar!':'Passo',joga?'sim':'nao'); return posAcao();
  }
  const vez=m.vez;
  if(vez!=='eu'&&m.fase==='jogo'){
    // só bots SEM humano no time iniciam truco
    const semHumano = team(vez)!==team('eu');
    if(semHumano&&!m.trucoBloqueado&&m.travadoPara!==team(vez)&&m.nivel===0&&maxF(vez)>=9&&Math.random()<0.4){
      try{T.pedirTruco(p,vez);}catch(e){} bubble(vez,'Truco!','truco'); return posAcao();
    }
    return playCard(vez,fracaIdx(vez));
  }
  render(); // sua vez
}
function botRespTruco(bid){
  const ac=maxF(bid)>=8, sobe=maxF(bid)>=11&&p.mao.nivel<rs.escalada.length-2&&Math.random()<0.35;
  if(sobe){ const nn=p.mao.aposta?p.mao.aposta.nivelProposto+1:2; try{T.responderTruco(p,bid,'aumentar');}catch(e){} bubble(bid,nivelNome(nn)+'!','truco'); }
  else if(ac){ try{T.responderTruco(p,bid,'aceitar');}catch(e){} bubble(bid,'Quero!','sim'); }
  else { try{T.responderTruco(p,bid,'correr');}catch(e){} bubble(bid,'Corro','nao'); }
  posAcao();
}
function botRespEnv(bid){ const t=p.mao.envido.aguardando; const best=Math.max(...p.jogadores.filter(j=>team(j.id)===t).map(j=>SJ.pontosEnvido(p.mao.cartas[j.id]))); const q=best>=27; try{T.responderEnvido(p,bid,q?'quero':'naoquero');}catch(e){} bubble(bid,q?'Quero!':'Não quero',q?'sim':'nao'); posAcao(); }
function botRespFlor(bid){ const cf=SJ.pontosFlor(p.mao.cartas[bid])>=35&&Math.random()<0.5; try{T.responderFlor(p,bid,cf?'contraflor':'quero');}catch(e){} bubble(bid,cf?'Contraflor!':'Quero!','truco'); posAcao(); }

window.iniciar=iniciar;
