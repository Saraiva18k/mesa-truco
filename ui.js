// ui.js — mesa jogável 1x1 contra bot. Liga a UI ao motor (window.Truco).
const T = window.Truco, R = window.Rulesets, SJ = window.SubJogos;
const SUIT = { paus:'♣', copas:'♥', espadas:'♠', ouros:'♦' };
const RED = { copas:1, ouros:1 };
let p, rs, busy = false;

const $ = id => document.getElementById(id);
function iniciar() {
  rs = R[$('rsel').value];
  p = T.criarPartida({ ruleset: rs, jogadores: [{id:'eu',nome:'Você'},{id:'bot',nome:'Bot'}], seed: (Date.now() % 100000) | 1 });
  $('setup').style.display = 'none';
  $('mesa').style.display = 'block';
  $('modo').textContent = rs.nome;
  novaMao();
}

function novaMao() {
  T.novaMao(p);
  render();
  setTimeout(loopBot, 600);
}

// ---------- desenho ----------
function cardEl(carta, opts = {}) {
  const d = document.createElement('div');
  d.className = 'card' + (RED[carta.naipe] ? ' red' : '') + (opts.tag ? ' tag' : '') + (opts.disabled ? ' disabled' : '');
  d.innerHTML = `<span class="v">${carta.valor}</span><span class="s">${SUIT[carta.naipe]}</span>`;
  if (opts.onClick && !opts.disabled) d.onclick = opts.onClick;
  return d;
}
function backEl() { const d = document.createElement('div'); d.className = 'card back'; return d; }

function ehManilhaTag(carta) {
  if (rs.manilha === 'fixa') return rs.manilhasFixas.some(m => m.valor===carta.valor && m.naipe===carta.naipe);
  return rs.manilha === 'virada' && p.mao.manilhaValor && carta.valor === p.mao.manilhaValor;
}

function render() {
  const m = p.mao;
  $('pa').textContent = p.placar.A; $('pb').textContent = p.placar.B;
  // mão do bot (cartas viradas)
  const bh = $('botHand'); bh.innerHTML = '';
  m.cartas.bot.forEach(() => bh.appendChild(backEl()));
  // vira / manilha (gaúcho)
  $('viraBox').innerHTML = m.vira ? '' : '';
  if (m.vira) { $('viraBox').appendChild(cardEl(m.vira)); const s=document.createElement('small'); s.textContent='vira'; $('viraBox').appendChild(s); }
  $('manilhaBox').textContent = m.manilhaValor ? ('manilha: ' + m.manilhaValor) : '';
  // cartas na mesa
  const mc = $('mesaCards'); mc.innerHTML = '';
  m.mesaAtual.forEach(e => mc.appendChild(cardEl(e.carta, { tag: ehManilhaTag(e.carta) })));
  // minha mão
  const mh = $('myHand'); mh.innerHTML = '';
  const minhaVez = m.vez === 'eu' && !m.aposta && !(m.envido&&m.envido.aguardando) && !(m.flor&&m.flor.aguardando) && m.fase==='jogo' && !m.encerradaMao;
  m.cartas.eu.forEach((c, i) => mh.appendChild(cardEl(c, { tag: ehManilhaTag(c), disabled: !minhaVez, onClick: () => jogar(i) })));
  controles();
  msgEstado();
}

function msg(t){ $('msg').textContent = t; }
function msgEstado() {
  const m = p.mao;
  if (m.aposta && m.aguardando === 'A') msg('Bot pediu ' + nivelNome(m.aposta.nivelProposto) + '!');
  else if (m.envido && m.envido.aguardando === 'A') msg('Bot cantou envido!');
  else if (m.flor && m.flor.aguardando === 'A') msg('Bot cantou flor!');
  else if (m.fase === 'decisao_mao11' && m.timeDe11 === 'A') msg('Mão de 11 — joga ou não?');
  else if (m.vez === 'eu' && m.fase==='jogo') msg('Sua vez');
  else msg('');
}
function nivelNome(n){ return ({1:'TRUCO',2:'SEIS',3:'NOVE',4:'DOZE'})[n] || 'TRUCO'; }

// ---------- controles dinâmicos ----------
function btn(txt, cls, fn){ const b=document.createElement('button'); b.textContent=txt; b.className=cls; b.onclick=fn; return b; }
function controles() {
  const c = $('controls'); c.innerHTML = ''; const m = p.mao;
  if (m.encerradaMao || p.encerrada) return;
  // responder truco
  if (m.aposta && m.aguardando === 'A') {
    c.appendChild(btn('Aceitar', 'b-yes', () => act(()=>T.responderTruco(p,'eu','aceitar'))));
    if (m.nivel < rs.escalada.length-2) c.appendChild(btn('Aumentar', 'b-sub', () => act(()=>T.responderTruco(p,'eu','aumentar'))));
    c.appendChild(btn('Correr', 'b-no', () => act(()=>T.responderTruco(p,'eu','correr'))));
    return;
  }
  // responder envido
  if (m.envido && m.envido.aguardando === 'A') {
    c.appendChild(btn('Quero', 'b-yes', () => act(()=>T.responderEnvido(p,'eu','quero'))));
    c.appendChild(btn('Real', 'b-sub', () => act(()=>T.responderEnvido(p,'eu','real'))));
    c.appendChild(btn('Não quero', 'b-no', () => act(()=>T.responderEnvido(p,'eu','naoquero'))));
    return;
  }
  // responder flor
  if (m.flor && m.flor.aguardando === 'A') {
    c.appendChild(btn('Quero', 'b-yes', () => act(()=>T.responderFlor(p,'eu','quero'))));
    c.appendChild(btn('Contraflor', 'b-flor', () => act(()=>T.responderFlor(p,'eu','contraflor'))));
    c.appendChild(btn('Não quero', 'b-no', () => act(()=>T.responderFlor(p,'eu','naoquero'))));
    return;
  }
  // decisão mão de 11
  if (m.fase === 'decisao_mao11' && m.timeDe11 === 'A') {
    c.appendChild(btn('Jogar (vale 3)', 'b-yes', () => act(()=>T.decidirMaoDe11(p,'eu','jogar'))));
    c.appendChild(btn('Não jogar', 'b-no', () => act(()=>T.decidirMaoDe11(p,'eu','naojogar'))));
    return;
  }
  // minha vez de jogar: truco + (envido/flor antes da 1a carta)
  if (m.vez === 'eu' && m.fase === 'jogo') {
    if (!m.trucoBloqueado && m.travadoPara !== 'A' && m.nivel < rs.escalada.length-1)
      c.appendChild(btn(nivelNome(m.nivel+1) + '!', 'b-truco', () => act(()=>T.pedirTruco(p,'eu'))));
    const janela = rs.temEnvido && m.vazas.length===0 && m.mesaAtual.length===0 && !m.envidoFechado;
    if (janela && !(rs.temFlor && (SJ.temFlor(m.cartas.eu)||SJ.temFlor(m.cartas.bot)))) {
      c.appendChild(btn('Envido', 'b-sub', () => act(()=>T.cantarEnvido(p,'eu','envido'))));
      c.appendChild(btn('Falta', 'b-sub', () => act(()=>T.cantarEnvido(p,'eu','falta'))));
    }
    if (rs.temFlor && janela && SJ.temFlor(m.cartas.eu))
      c.appendChild(btn('Flor', 'b-flor', () => act(()=>T.cantarFlor(p,'eu'))));
  }
}

// ---------- ações ----------
function jogar(i){ act(()=>T.jogarCarta(p,'eu',i)); }
function act(fn){
  if (busy) return;
  try { fn(); } catch(e){ msg(e.message); return; }
  posAcao();
}
function posAcao(){
  render();
  if (checarFim()) return;
  if (p.mao.encerradaMao) { msg('Fim da mão…'); busy=true; setTimeout(()=>{ busy=false; novaMao(); }, 1400); return; }
  setTimeout(loopBot, 650);
}

function checarFim(){
  if (p.encerrada){
    $('fim').style.display='flex';
    $('fimTxt').textContent = (p.vencedor==='A'?'🏆 Você venceu!':'😤 Bot venceu') + `  (${p.placar.A} x ${p.placar.B})`;
    return true;
  }
  return false;
}

// ---------- bot ----------
function forca(c){ return T.forca(c, rs, p.mao.manilhaValor); }
function botCartaFraca(){ const mao=p.mao.cartas.bot; let k=0; for(let i=1;i<mao.length;i++) if(forca(mao[i])<forca(mao[k])) k=i; return k; }
function botCartaForte(){ const mao=p.mao.cartas.bot; let k=0; for(let i=1;i<mao.length;i++) if(forca(mao[i])>forca(mao[k])) k=i; return k; }
function botMax(){ return Math.max(...p.mao.cartas.bot.map(forca)); }

function loopBot(){
  if (p.encerrada || p.mao.encerradaMao) return;
  const m = p.mao;
  // responder pendências do bot (time B)
  if (m.aposta && m.aguardando === 'B'){ botResponderTruco(); return; }
  if (m.envido && m.envido.aguardando === 'B'){ botResponderEnvido(); return; }
  if (m.flor && m.flor.aguardando === 'B'){ botResponderFlor(); return; }
  if (m.fase === 'decisao_mao11' && m.timeDe11 === 'B'){
    const joga = botMax() >= 8; // joga se tiver carta forte
    safe(()=>T.decidirMaoDe11(p,'bot', joga?'jogar':'naojogar')); return posBot();
  }
  if (m.vez === 'bot' && m.fase === 'jogo'){
    // às vezes pede truco se tiver mão forte e ainda não travado
    if (!m.trucoBloqueado && m.travadoPara!=='B' && m.nivel===0 && botMax()>=9 && Math.random()<0.5){
      safe(()=>T.pedirTruco(p,'bot')); return posBot();
    }
    safe(()=>T.jogarCarta(p,'bot', botCartaFraca())); return posBot();
  }
  render(); // é sua vez
}
function safe(fn){ try{ fn(); }catch(e){ /* ignora jogada inválida do bot */ } }
function posBot(){
  render();
  if (checarFim()) return;
  if (p.mao.encerradaMao){ msg('Fim da mão…'); busy=true; setTimeout(()=>{ busy=false; novaMao(); },1400); return; }
  setTimeout(loopBot, 650); // continua até ser sua vez ou pendência sua
}
function botResponderTruco(){
  const aceita = botMax() >= 8;
  const sobe = botMax() >= 11 && p.mao.nivel < rs.escalada.length-2 && Math.random()<0.4;
  safe(()=>T.responderTruco(p,'bot', sobe?'aumentar':(aceita?'aceitar':'correr')));
  posBot();
}
function botResponderEnvido(){
  const pts = SJ.pontosEnvido(p.mao.cartas.bot);
  safe(()=>T.responderEnvido(p,'bot', pts>=27?'quero':'naoquero'));
  posBot();
}
function botResponderFlor(){
  const sobe = SJ.pontosFlor(p.mao.cartas.bot) >= 35 && Math.random()<0.5;
  safe(()=>T.responderFlor(p,'bot', sobe?'contraflor':'quero'));
  posBot();
}
window.iniciar = iniciar;
