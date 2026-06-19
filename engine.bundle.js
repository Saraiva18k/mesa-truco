// GERADO por web/build.js — não editar à mão. Fonte: core/*.js
(function () {
  const modules = {};
  function req(name) { return modules[name.replace('./', '')]; }
  function define(name, fn) { const module = { exports: {} }; fn(module, module.exports, req); modules[name] = module.exports; }
  define('subjogos', function (module, exports, require) { // subjogos.js — ENVIDO e FLOR (truco gaudério). Funções PURAS de contagem.
// Regra: A=1..7=7 pelo número; figuras (Q,J,K)=0.
// Envido: 2 do mesmo naipe = 20 + soma das duas maiores desse naipe; senão a maior carta.
// Flor: 3 do mesmo naipe = 20 + soma das três.

const VAL = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, Q: 0, J: 0, K: 0 };

function valorEnvido(carta) { return VAL[carta.valor]; }

function pontosEnvido(cartas) {
  const porNaipe = {};
  for (const c of cartas) (porNaipe[c.naipe] = porNaipe[c.naipe] || []).push(valorEnvido(c));
  let best = -1;
  for (const naipe in porNaipe) {
    const vals = porNaipe[naipe].sort((a, b) => b - a);
    if (vals.length >= 2) best = Math.max(best, 20 + vals[0] + vals[1]);
  }
  if (best < 0) best = Math.max(...cartas.map(valorEnvido)); // sem par de naipe
  return best;
}

function temFlor(cartas) {
  return cartas.length === 3 &&
    cartas[0].naipe === cartas[1].naipe && cartas[1].naipe === cartas[2].naipe;
}

function pontosFlor(cartas) {
  return 20 + cartas.reduce((s, c) => s + valorEnvido(c), 0);
}

module.exports = { valorEnvido, pontosEnvido, temFlor, pontosFlor };
 });
  define('rulesets', function (module, exports, require) { // rulesets.js — cada modo de truco é uma CONFIGURAÇÃO, não um código novo.
// O motor (motorTruco.js) lê esse objeto e se comporta de acordo.
// v1 entrega o PADRÃO. Os outros já estão esboçados pra plugar depois.

const NAIPES = ['paus', 'copas', 'espadas', 'ouros'];

// Ordem de força das cartas comuns (fraca -> forte), baralho limpo.
const ORDEM_LIMPO = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

// Manilhas fixas (mais forte -> mais fraca): zap, copas, espadilha, ouros.
const MANILHAS_FIXAS = [
  { valor: '4', naipe: 'paus',    nome: 'Zap' },
  { valor: '7', naipe: 'copas',   nome: 'Copas' },
  { valor: 'A', naipe: 'espadas', nome: 'Espadilha' },
  { valor: '7', naipe: 'ouros',   nome: 'Ouros' },
];

// ---- PADRÃO (base paulista/mineiro: baralho limpo, manilha fixa) ----
const PADRAO = {
  id: 'padrao',
  nome: 'Truco Padrão',
  baralho: 'limpo',
  naipes: NAIPES,
  ordem: ORDEM_LIMPO,
  manilha: 'fixa',
  manilhasFixas: MANILHAS_FIXAS,
  cartasPorJogador: 3,
  pontosVitoria: 12,
  escalada: [1, 3, 6, 9, 12], // normal, truco, seis, nove, doze
  temEnvido: false,
  temFlor: false,
  maoDeFerro: 11,             // time que chega a 11 decide jogar/não (mão de 11)
};

// ---- Esboços dos outros modos (plugam no MESMO motor depois) ----
const MINEIRO = { ...PADRAO, id: 'mineiro', nome: 'Truco Mineiro' };
const PAULISTA = { ...PADRAO, id: 'paulista', nome: 'Truco Paulista' };
const GAUCHO = {
  ...PADRAO,
  id: 'gaucho',
  nome: 'Truco Gaúcho',
  manilha: 'virada',                                   // manilha variável (a vira)
  ordemNaipesManilha: ['paus', 'copas', 'espadas', 'ouros'], // forte -> fraco
  maoDeFerro: null,                                    // gaúcho não usa mão de 11
  temEnvido: true,                                     // subjogo (régua a definir)
  temFlor: true,                                       // subjogo (régua a definir)
  pontosVitoria: 12,
};
// ---- Modo próprio "King League" (regras extras dinâmicas) — v3 ----
const KINGLEAGUE = {
  ...PADRAO,
  id: 'kingleague',
  nome: 'Mesa King League',
  cartasEspeciais: true, // cartas-coringa, dobra de pontos, etc. (a desenhar)
};

module.exports = { PADRAO, MINEIRO, PAULISTA, GAUCHO, KINGLEAGUE, NAIPES, ORDEM_LIMPO, MANILHAS_FIXAS };
 });
  define('motorTruco', function (module, exports, require) { // motorTruco.js — núcleo do jogo (formato PADRÃO), 1x1 E 2x2 (duplas).
// Servidor-autoritativo: o estado vive aqui, nunca no cliente.
// Times: índices PARES = Dupla A, ÍMPARES = Dupla B (alternados na mesa).
const SJ = require('./subjogos'); // envido / flor (gaúcho)

// ---------- baralho ----------
function montarBaralho(rs) {
  const cartas = [];
  for (const valor of rs.ordem) for (const naipe of rs.naipes) cartas.push({ valor, naipe });
  return cartas; // 40 cartas no baralho limpo
}

// PRNG determinístico (mulberry32) — testes reproduzíveis sem Math.random.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function embaralhar(cartas, rand) {
  const c = cartas.slice();
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

// ---------- força da carta ----------
// manilhaValor: só usado quando manilha é 'virada' (o valor que virou manilha na mão).
function forca(carta, rs, manilhaValor = null) {
  if (rs.manilha === 'fixa') {
    const idx = rs.manilhasFixas.findIndex(m => m.valor === carta.valor && m.naipe === carta.naipe);
    if (idx >= 0) return 100 + (rs.manilhasFixas.length - idx); // zap=104 ... ouros=101
  } else if (rs.manilha === 'virada' && manilhaValor && carta.valor === manilhaValor) {
    const on = rs.ordemNaipesManilha;                 // ['paus','copas','espadas','ouros'] (forte->fraco)
    return 100 + (on.length - on.indexOf(carta.naipe)); // paus=104 ... ouros=101
  }
  return rs.ordem.indexOf(carta.valor); // 0..9
}
// Calcula o valor-manilha da mão a partir da carta virada (o valor logo ACIMA, com wrap).
function manilhaDaVira(vira, rs) {
  const i = rs.ordem.indexOf(vira.valor);
  return rs.ordem[(i + 1) % rs.ordem.length];
}
// Etiqueta pro log: 'Zap'/'Copas'/... (fixa) ou 'Manilha' (virada) ou null.
function tagCarta(carta, rs, manilhaValor) {
  if (rs.manilha === 'fixa') {
    const m = rs.manilhasFixas.find(m => m.valor === carta.valor && m.naipe === carta.naipe);
    return m ? m.nome : null;
  }
  if (rs.manilha === 'virada' && manilhaValor && carta.valor === manilhaValor) return 'Manilha';
  return null;
}

// Resolve uma vaza com N cartas. mesaArr = [{id, carta, time}].
// Vence a carta mais forte; se as mais fortes empatam entre TIMES diferentes -> 'E'.
function resolverVaza(mesaArr, rs, manilhaValor = null) {
  let maxF = -1, top = [];
  for (const e of mesaArr) {
    const f = forca(e.carta, rs, manilhaValor);
    if (f > maxF) { maxF = f; top = [e]; }
    else if (f === maxF) top.push(e);
  }
  const times = new Set(top.map(t => t.time));
  if (times.size === 1) return { res: top[0].time, vencedorId: top[0].id };
  return { res: 'E', vencedorId: null }; // canga (empate)
}

// Resolve a MÃO a partir das vazas ['A'|'B'|'E', ...] -> 'A'|'B'|'EMPATE'|null.
function resolverMao(res) {
  const a = res.filter(r => r === 'A').length;
  const b = res.filter(r => r === 'B').length;
  if (a === 2) return 'A';
  if (b === 2) return 'B';
  const n = res.length;
  if (n >= 2) {
    if (res[0] === 'E' && res[1] !== 'E') return res[1]; // empatou 1a, ganhou 2a -> leva
    if (res[0] !== 'E' && res[1] === 'E') return res[0]; // ganhou 1a, empatou 2a -> leva
  }
  if (n === 3) {
    if (res[2] !== 'E') return res[2];                   // 1-1, 3a decide
    if (res[0] !== 'E') return res[0];                   // empate na 3a -> quem fez a 1a
    if (res[0] === 'E' && res[1] === 'E') return 'EMPATE';
  }
  return null;
}

// ---------- partida ----------
function timeDe(i) { return i % 2 === 0 ? 'A' : 'B'; }
function outroTime(t) { return t === 'A' ? 'B' : 'A'; }

function criarPartida({ ruleset, jogadores, seed = 1 }) {
  const n = jogadores.length;
  if (n !== 2 && n !== 4) throw new Error('suporta 1x1 (2) ou 2x2 (4)');
  const p = {
    rs: ruleset,
    jogadores,                       // ordem = assento na mesa
    n,
    idx: Object.fromEntries(jogadores.map((j, i) => [j.id, i])),
    placar: { A: 0, B: 0 },
    rand: rng(seed),
    maoNum: 0,
    distribuidor: n - 1,             // o "pé" dá as cartas; "mão" é o próximo
    mao: null,
    encerrada: false,
    vencedor: null,
    log: [],
  };
  return p;
}

function idAt(p, i) { return p.jogadores[i].id; }
function nomeJog(p, id) { return p.jogadores[p.idx[id]].nome; }
function timeDoJog(p, id) { return timeDe(p.idx[id]); }
function nomeTime(p, t) {
  return 'Dupla ' + t + ' (' + p.jogadores.filter((_, i) => timeDe(i) === t).map(j => j.nome).join(' & ') + ')';
}
function proxAssento(p, id) { return idAt(p, (p.idx[id] + 1) % p.n); }

function novaMao(p) {
  if (p.encerrada) throw new Error('partida encerrada');
  const baralho = embaralhar(montarBaralho(p.rs), p.rand);
  const cartas = {};
  for (let i = 0; i < p.n; i++) cartas[idAt(p, i)] = baralho.slice(i * 3, i * 3 + 3);
  // manilha virada (gaúcho): vira a próxima carta do baralho
  let vira = null, manilhaValor = null;
  if (p.rs.manilha === 'virada') {
    vira = baralho[p.n * 3];
    manilhaValor = manilhaDaVira(vira, p.rs);
  }
  const maoIdx = (p.distribuidor + 1) % p.n; // quem começa
  p.maoNum++;
  p.mao = {
    cartas,
    vira,
    manilhaValor,
    vazas: [],
    mesaAtual: [],          // [{id, carta}] na ordem de jogada
    lider: maoIdx,          // assento que abre a vaza
    vez: idAt(p, maoIdx),
    nivel: 0,               // 0=normal,1=truco,2=seis,3=nove,4=doze
    aposta: null,           // {pedinteId, pedinteTime, nivelProposto}
    aguardando: null,       // time que deve responder
    travadoPara: null,      // time que pediu por último (não repede)
    trucoBloqueado: false,  // true em mão de 11 (valor já travado)
    fase: 'jogo',           // 'jogo' | 'decisao_mao11'
    timeDe11: null,
    maoInicial: maoIdx,     // assento que abriu a mão (desempate envido/flor)
    envido: null,           // {quemCantou, aguardando, pendente, recusa, resolvido}
    flor: null,
    envidoFechado: false,   // fecha ao jogar a 1a carta
    florResolvida: false,
    encerradaMao: false,
  };
  p.log.push(`--- Mão ${p.maoNum} | abre: ${nomeJog(p, p.mao.vez)} | vale ${p.rs.escalada[0]} ---`);
  if (vira) p.log.push(`  vira: ${vira.valor} de ${vira.naipe} → manilha desta mão: ${manilhaValor}`);

  // ---- Mão de 11 (mão de ferro) ----
  const lim = p.rs.maoDeFerro;
  if (lim != null) {
    const aEm = p.placar.A >= lim, bEm = p.placar.B >= lim;
    if (aEm && bEm) {
      p.mao.trucoBloqueado = true; // 11 x 11: vale 1, sem truco, jogo seco
      p.log.push(`  (mão de ferro ${lim}x${lim}: vale 1, sem truco — vence quem levar)`);
    } else if (aEm || bEm) {
      p.mao.timeDe11 = aEm ? 'A' : 'B';
      p.mao.fase = 'decisao_mao11';
      p.mao.trucoBloqueado = true;
      p.log.push(`  (mão de 11: ${nomeTime(p, p.mao.timeDe11)} vê as cartas e decide JOGAR (vale 3) ou NÃO JOGAR (dá 1 ao adversário))`);
    }
  }
  return p.mao;
}

function jogarCarta(p, jogadorId, indiceCarta) {
  const m = p.mao;
  if (!m || m.encerradaMao) throw new Error('mão não está ativa');
  if (m.fase === 'decisao_mao11') throw new Error(`aguardando ${nomeTime(p, m.timeDe11)} decidir a mão de 11`);
  if (m.envido && m.envido.aguardando) throw new Error('responda o envido primeiro');
  if (m.flor && m.flor.aguardando) throw new Error('responda a flor primeiro');
  if (m.aposta) throw new Error(`responda o truco primeiro (${nomeTime(p, m.aguardando)})`);
  if (m.vez !== jogadorId) throw new Error('não é a sua vez');
  if (m.vazas.length === 0 && m.mesaAtual.length === 0) m.envidoFechado = true; // fecha janela de envido/flor
  const mao = m.cartas[jogadorId];
  if (indiceCarta < 0 || indiceCarta >= mao.length) throw new Error('carta inválida');
  const carta = mao.splice(indiceCarta, 1)[0];
  m.mesaAtual.push({ id: jogadorId, carta });
  const tag = tagCarta(carta, p.rs, m.manilhaValor);
  p.log.push(`${nomeJog(p, jogadorId)} [${timeDoJog(p, jogadorId)}] jogou ${carta.valor} de ${carta.naipe}${tag ? ` (${tag}!)` : ''}`);

  if (m.mesaAtual.length < p.n) {
    m.vez = proxAssento(p, jogadorId);
    return { evento: 'carta_jogada' };
  }
  // vaza completa -> resolve
  const arr = m.mesaAtual.map(e => ({ ...e, time: timeDoJog(p, e.id) }));
  const { res, vencedorId } = resolverVaza(arr, p.rs, m.manilhaValor);
  m.vazas.push(res);
  p.log.push(`  vaza ${m.vazas.length}: ${res === 'E' ? 'EMPATE (canga)' : 'venceu ' + nomeJog(p, vencedorId) + ' [' + res + ']'}`);
  m.mesaAtual = [];
  m.lider = res === 'E' ? m.lider : p.idx[vencedorId];
  m.vez = idAt(p, m.lider);

  const fim = resolverMao(m.vazas);
  if (fim) return _encerrarMao(p, fim);
  return { evento: 'vaza_resolvida', resultado: res };
}

function pedirTruco(p, jogadorId) {
  const m = p.mao;
  if (!m || m.encerradaMao) throw new Error('mão não está ativa');
  if (m.trucoBloqueado) throw new Error('truco bloqueado nesta mão (mão de 11)');
  if ((m.envido && m.envido.aguardando) || (m.flor && m.flor.aguardando)) throw new Error('resolva envido/flor antes do truco');
  if (m.aposta) throw new Error('já há um pedido em aberto');
  if (m.vez !== jogadorId) throw new Error('só pede no seu turno de jogar');
  if (m.nivel >= p.rs.escalada.length - 1) throw new Error('já está no valor máximo');
  const time = timeDoJog(p, jogadorId);
  if (m.travadoPara === time) throw new Error('seu time fez o último pedido; aguarde');
  m.aposta = { pedinteId: jogadorId, pedinteTime: time, nivelProposto: m.nivel + 1 };
  m.aguardando = outroTime(time);
  const nome = { 1: 'TRUCO', 2: 'SEIS', 3: 'NOVE', 4: 'DOZE' }[m.nivel + 1];
  p.log.push(`${nomeJog(p, jogadorId)} [${time}] pediu ${nome}! (vale ${p.rs.escalada[m.nivel + 1]})`);
  return { evento: 'truco_pedido', valor: p.rs.escalada[m.nivel + 1], aguardando: m.aguardando };
}

// resposta: 'aceitar' | 'correr' | 'aumentar'
function responderTruco(p, jogadorId, resposta) {
  const m = p.mao;
  if (!m || !m.aposta) throw new Error('não há truco pra responder');
  if (timeDoJog(p, jogadorId) !== m.aguardando) throw new Error('não é o seu time que responde');
  const ap = m.aposta;
  if (resposta === 'correr') {
    const pontos = p.rs.escalada[m.nivel]; // valor antes do pedido recusado
    m.aposta = null; m.aguardando = null;
    p.log.push(`${nomeJog(p, jogadorId)} correu. ${nomeTime(p, ap.pedinteTime)} leva ${pontos}.`);
    return _encerrarMao(p, ap.pedinteTime, pontos);
  }
  if (resposta === 'aceitar') {
    m.nivel = ap.nivelProposto;
    m.travadoPara = ap.pedinteTime;
    m.vez = ap.pedinteId;
    m.aposta = null; m.aguardando = null;
    p.log.push(`${nomeJog(p, jogadorId)} aceitou. Mão vale ${p.rs.escalada[m.nivel]}.`);
    return { evento: 'truco_aceito', valor: p.rs.escalada[m.nivel] };
  }
  if (resposta === 'aumentar') {
    if (ap.nivelProposto >= p.rs.escalada.length - 1) throw new Error('não dá pra aumentar além do doze');
    m.nivel = ap.nivelProposto;
    const time = timeDoJog(p, jogadorId);
    m.aposta = { pedinteId: jogadorId, pedinteTime: time, nivelProposto: m.nivel + 1 };
    m.aguardando = outroTime(time);
    const nome = { 2: 'SEIS', 3: 'NOVE', 4: 'DOZE' }[m.nivel + 1];
    p.log.push(`${nomeJog(p, jogadorId)} [${time}] aumentou pra ${nome}! (vale ${p.rs.escalada[m.nivel + 1]})`);
    return { evento: 'truco_aumentado', valor: p.rs.escalada[m.nivel + 1], aguardando: m.aguardando };
  }
  throw new Error('resposta inválida');
}

// decisao: 'jogar' | 'naojogar' — só o time que está em 11 decide.
function decidirMaoDe11(p, jogadorId, decisao) {
  const m = p.mao;
  if (!m || m.fase !== 'decisao_mao11') throw new Error('não há mão de 11 pra decidir');
  if (timeDoJog(p, jogadorId) !== m.timeDe11) throw new Error('só o time da mão de 11 decide');
  if (decisao === 'naojogar') {
    p.log.push(`${nomeTime(p, m.timeDe11)} NÃO jogou a mão de 11 — adversário leva 1.`);
    return _encerrarMao(p, outroTime(m.timeDe11), 1);
  }
  if (decisao === 'jogar') {
    m.nivel = 1;            // valor travado em 3
    m.fase = 'jogo';
    p.log.push(`${nomeTime(p, m.timeDe11)} decidiu JOGAR a mão de 11 (vale 3).`);
    return { evento: 'mao11_aceita', valor: p.rs.escalada[m.nivel] };
  }
  throw new Error('decisão inválida');
}

function _encerrarMao(p, lado, pontosForcado) {
  const m = p.mao;
  m.encerradaMao = true;
  if (lado === 'EMPATE') {
    p.log.push(`  mão empatou (deu velha) — ninguém pontua`);
  } else {
    const pontos = pontosForcado != null ? pontosForcado : p.rs.escalada[m.nivel];
    p.placar[lado] += pontos;
    p.log.push(`  >> ${nomeTime(p, lado)} venceu a mão (+${pontos}) | placar A:${p.placar.A} x B:${p.placar.B}`);
    if (p.placar[lado] >= p.rs.pontosVitoria) {
      p.encerrada = true;
      p.vencedor = lado;
      p.log.push(`==== ${nomeTime(p, lado)} VENCEU A PARTIDA (${p.placar[lado]}) ====`);
    }
  }
  p.distribuidor = (p.distribuidor + 1) % p.n; // gira o pé
  return { evento: 'mao_encerrada', vencedorMao: lado, encerrada: p.encerrada, vencedor: p.vencedor };
}

// ===================== ENVIDO / FLOR (gaúcho) =====================
function _faltam(p) { return p.rs.pontosVitoria - Math.max(p.placar.A, p.placar.B); }
function _melhorEnvido(p, time) {
  let best = -1;
  for (let i = 0; i < p.n; i++) if (timeDe(i) === time) best = Math.max(best, SJ.pontosEnvido(p.mao.cartas[idAt(p, i)]));
  return best;
}
function _timeTemFlor(p, time) {
  for (let i = 0; i < p.n; i++) if (timeDe(i) === time && SJ.temFlor(p.mao.cartas[idAt(p, i)])) return true;
  return false;
}
function _melhorFlor(p, time) {
  let best = -1;
  for (let i = 0; i < p.n; i++) if (timeDe(i) === time && SJ.temFlor(p.mao.cartas[idAt(p, i)])) best = Math.max(best, SJ.pontosFlor(p.mao.cartas[idAt(p, i)]));
  return best;
}
// pontua e checa vitória (envido/flor contam na hora e podem fechar a partida)
function _pontuar(p, time, pts, motivo) {
  p.placar[time] += pts;
  p.log.push(`  [${motivo}] +${pts} → Dupla ${time} | placar A:${p.placar.A} x B:${p.placar.B}`);
  if (p.placar[time] >= p.rs.pontosVitoria && !p.encerrada) {
    p.encerrada = true; p.vencedor = time; p.mao.encerradaMao = true;
    p.log.push(`==== ${nomeTime(p, time)} VENCEU A PARTIDA (${p.placar[time]}) ====`);
  }
}
function _podeApostarInicial(p) {
  const m = p.mao;
  return m && !m.encerradaMao && m.vazas.length === 0 && m.mesaAtual.length === 0 && !m.envidoFechado;
}

// tipo: 'envido' | 'real' | 'falta'
function cantarEnvido(p, jogadorId, tipo = 'envido') {
  const m = p.mao;
  if (!p.rs.temEnvido) throw new Error('envido não existe nesta variante');
  if (!_podeApostarInicial(p)) throw new Error('envido só antes da primeira carta');
  if (p.rs.temFlor && (_timeTemFlor(p, 'A') || _timeTemFlor(p, 'B'))) throw new Error('envido contra flor é proibido');
  if (m.envido && m.envido.aguardando) throw new Error('já há envido em aberto');
  if (m.envido && m.envido.resolvido) throw new Error('envido já foi resolvido');
  const time = timeDoJog(p, jogadorId);
  let pendente, recusa;
  if (tipo === 'envido') { pendente = 2; recusa = 1; }
  else if (tipo === 'real') { pendente = 3; recusa = 1; }
  else if (tipo === 'falta') { pendente = _faltam(p); recusa = 1; }
  else throw new Error('tipo de envido inválido');
  m.envido = { quemCantou: time, aguardando: outroTime(time), pendente, recusa, resolvido: false };
  p.log.push(`${nomeJog(p, jogadorId)} [${time}] cantou ${tipo.toUpperCase()} ENVIDO (vale ${pendente})`);
  return { evento: 'envido_cantado', tipo, valor: pendente, aguardando: m.envido.aguardando };
}

// resp: 'quero' | 'naoquero' | 'real' | 'falta'
function responderEnvido(p, jogadorId, resp) {
  const m = p.mao, e = m.envido;
  if (!e || !e.aguardando) throw new Error('não há envido pra responder');
  if (timeDoJog(p, jogadorId) !== e.aguardando) throw new Error('não é o seu time que responde');
  if (resp === 'naoquero') {
    e.aguardando = null; e.resolvido = true;
    p.log.push(`${nomeJog(p, jogadorId)} disse NÃO QUERO.`);
    _pontuar(p, e.quemCantou, e.recusa, 'envido recusado');
    return { evento: 'envido_recusado' };
  }
  if (resp === 'quero') {
    const ea = _melhorEnvido(p, 'A'), eb = _melhorEnvido(p, 'B');
    let win = ea > eb ? 'A' : eb > ea ? 'B' : timeDe(m.maoInicial); // empate -> mão
    e.aguardando = null; e.resolvido = true;
    p.log.push(`${nomeJog(p, jogadorId)} QUERO. Envido: A=${ea} x B=${eb} → Dupla ${win}`);
    _pontuar(p, win, e.pendente, 'envido');
    return { evento: 'envido_resolvido', vencedor: win, a: ea, b: eb };
  }
  if (resp === 'real' || resp === 'falta') {
    e.recusa = e.pendente;                        // recusar agora dá o valor já em jogo
    e.pendente = resp === 'real' ? e.pendente + 3 : _faltam(p);
    const t = timeDoJog(p, jogadorId);
    e.quemCantou = t; e.aguardando = outroTime(t);
    p.log.push(`${nomeJog(p, jogadorId)} [${t}] subiu pra ${resp.toUpperCase()} ENVIDO (vale ${e.pendente})`);
    return { evento: 'envido_aumentado', valor: e.pendente, aguardando: e.aguardando };
  }
  throw new Error('resposta de envido inválida');
}

function cantarFlor(p, jogadorId) {
  const m = p.mao;
  if (!p.rs.temFlor) throw new Error('flor não existe nesta variante');
  if (!_podeApostarInicial(p)) throw new Error('flor só antes da primeira carta');
  if (!SJ.temFlor(m.cartas[jogadorId])) throw new Error('você não tem flor');
  if (m.flor && m.flor.aguardando) throw new Error('já há flor em aberto');
  if (m.florResolvida) throw new Error('flor já resolvida');
  const time = timeDoJog(p, jogadorId);
  m.envido = m.envido || { resolvido: true, aguardando: null }; // flor mata o envido
  m.envidoFechado = true;
  if (!_timeTemFlor(p, outroTime(time))) {            // adversário sem flor: leva direto
    m.florResolvida = true;
    p.log.push(`${nomeJog(p, jogadorId)} [${time}] cantou FLOR!`);
    _pontuar(p, time, 3, 'flor');
    return { evento: 'flor', valor: 3, resolvido: true };
  }
  m.flor = { quemCantou: time, aguardando: outroTime(time), pendente: 3, recusa: 3, resolvido: false };
  p.log.push(`${nomeJog(p, jogadorId)} [${time}] cantou FLOR! (adversário também tem — pode contraflor)`);
  return { evento: 'flor_disputada', aguardando: m.flor.aguardando };
}

// resp: 'quero' | 'naoquero' | 'contraflor'
function responderFlor(p, jogadorId, resp) {
  const m = p.mao, f = m.flor;
  if (!f || !f.aguardando) throw new Error('não há flor pra responder');
  if (timeDoJog(p, jogadorId) !== f.aguardando) throw new Error('não é o seu time que responde');
  if (resp === 'naoquero') {
    f.aguardando = null; f.resolvido = true; m.florResolvida = true;
    p.log.push(`${nomeJog(p, jogadorId)} não quis a contraflor.`);
    _pontuar(p, f.quemCantou, f.recusa, 'flor recusada');
    return { evento: 'flor_recusada' };
  }
  if (resp === 'quero') {
    const fa = _melhorFlor(p, 'A'), fb = _melhorFlor(p, 'B');
    let win = fa > fb ? 'A' : fb > fa ? 'B' : timeDe(m.maoInicial);
    f.aguardando = null; f.resolvido = true; m.florResolvida = true;
    p.log.push(`${nomeJog(p, jogadorId)} QUERO. Flor: A=${fa} x B=${fb} → Dupla ${win}`);
    _pontuar(p, win, f.pendente, 'flor');
    return { evento: 'flor_resolvida', vencedor: win };
  }
  if (resp === 'contraflor') {
    f.recusa = f.pendente; f.pendente = 6;
    const t = timeDoJog(p, jogadorId); f.quemCantou = t; f.aguardando = outroTime(t);
    p.log.push(`${nomeJog(p, jogadorId)} [${t}] pediu CONTRAFLOR (vale 6)`);
    return { evento: 'contraflor', valor: 6, aguardando: f.aguardando };
  }
  throw new Error('resposta de flor inválida');
}

function placarStr(p) { return `A:${p.placar.A} x B:${p.placar.B}`; }

module.exports = {
  montarBaralho, embaralhar, rng, forca, tagCarta, manilhaDaVira, resolverVaza, resolverMao,
  criarPartida, novaMao, jogarCarta, pedirTruco, responderTruco, decidirMaoDe11,
  cantarEnvido, responderEnvido, cantarFlor, responderFlor, placarStr,
  timeDoJog, nomeTime,
};
 });
  window.Truco = req('motorTruco');
  window.Rulesets = req('rulesets');
  window.SubJogos = req('subjogos');
})();
