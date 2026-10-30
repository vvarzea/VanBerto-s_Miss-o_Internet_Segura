// ================== ASSETS ==================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled=false;

// Imagens embutidas (não dependem de pasta assets nem da cache)
const WALL_SRC="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAcElEQVR4nGOUc1j/n4GGgOXz870MWtFdNDH88b6dDCzIHGzg8/O9DLySzjgNwSUv6+TOwMDAgLDg8/O9eA3BB7DLo1mAy5Xk+gAGmPA6jQpg1AKCYDQVEQSjFhAEo6mIIBi1gCCgXyqiVcXPSOtmCwD6AEfVZi03xQAAAABJRU5ErkJggg==";
const PATCH_SRC="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAVUlEQVR4nGNgGGjACGMwtRz/T4rGfzWWjAwMDAwsyIJmloZEaT51/DyczYQuedyJneG4EzvRLsEwgIGBgcFy30/yDSBFM04XjBpAZwNQUiJyChs6AABdIA98HAkVowAAAABJRU5ErkJggg==";
const ASSETS = { wall: new Image(), patch: new Image() };
ASSETS.wall.src = WALL_SRC;
ASSETS.patch.src = PATCH_SRC;
ASSETS.wall.onload = ASSETS.patch.onload = ()=>{ if(window.__vbReady) draw(); };
function allAssetsLoaded(){
  return Object.values(ASSETS).every(img => img.complete && img.naturalWidth > 0);
}
// cores do labirinto (tom de cada nível; sem azuis)
const WALL_HUES=[320,28,140,275,175,350,48,300,90,10];
const wallHue=()=>WALL_HUES[(level-1)%WALL_HUES.length];
const patchHue=()=>Math.abs(wallHue()-45)<40 ? 175 : 45;
function tintCanvas(src,hue){
  const c=document.createElement("canvas"); c.width=src.width; c.height=src.height;
  const g=c.getContext("2d"); g.drawImage(src,0,0);
  const im=g.getImageData(0,0,c.width,c.height), d=im.data, h=hue/360;
  const f=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; return t<1/6?p+(q-p)*6*t : t<1/2?q : t<2/3?p+(q-p)*(2/3-t)*6 : p; };
  for(let i=0;i<d.length;i+=4){
    if(!d[i+3]) continue;
    const r=d[i]/255, gg=d[i+1]/255, b=d[i+2]/255;
    const mx=Math.max(r,gg,b), mn=Math.min(r,gg,b), l=(mx+mn)/2;
    let s=0; if(mx!==mn) s=l>0.5 ? (mx-mn)/(2-mx-mn) : (mx-mn)/(mx+mn);
    s=Math.min(1,s*1.1);
    const q=l<0.5 ? l*(1+s) : l+s-l*s, p=2*l-q;
    d[i]=Math.round(f(p,q,h+1/3)*255); d[i+1]=Math.round(f(p,q,h)*255); d[i+2]=Math.round(f(p,q,h-1/3)*255);
  }
  g.putImageData(im,0,0); return c;
}
function tinted(key,img,hue){ const k=key+hue; return CRISP[k]||(CRISP[k]=tintCanvas(crisp(key,img),hue)); }
// versão ampliada (pixels nítidos em qualquer tamanho de ecrã)
const CRISP={};
function crisp(key,img){
  if(CRISP[key]) return CRISP[key];
  const s=8, c=document.createElement("canvas");
  c.width=img.naturalWidth*s; c.height=img.naturalHeight*s;
  const g=c.getContext("2d"); g.imageSmoothingEnabled=false; g.drawImage(img,0,0,c.width,c.height);
  return CRISP[key]=c;
}

// ================== SOM (RETRO ORIGINAL) ==================
let audioCtx=null, soundOn=true;
function ctxEnsure(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === "suspended") audioCtx.resume().catch(()=>{});
}
function tone(freq, ms, type="square", vol=0.05, when=0){
  if(!soundOn) return;
  ctxEnsure();
  const t0 = audioCtx.currentTime + when;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms/1000);

  o.connect(g); g.connect(audioCtx.destination);
  o.start(t0); o.stop(t0 + ms/1000 + 0.02);
}
function slide(f1, f2, ms, type="square", vol=0.05, when=0){
  if(!soundOn) return;
  ctxEnsure();
  const t0 = audioCtx.currentTime + when;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t0);
  o.frequency.exponentialRampToValueAtTime(f2, t0 + ms/1000);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms/1000);

  o.connect(g); g.connect(audioCtx.destination);
  o.start(t0); o.stop(t0 + ms/1000 + 0.02);
}
const sPatch = ()=> tone(880, 40, "square", 0.05);
const sCoin  = ()=> { tone(988,60,"square",0.06); tone(1319,70,"square",0.05,0.06); };
const sPower = ()=> { slide(440,1320,180,"square",0.06); tone(1760,80,"square",0.04,0.18); };
const sEat   = ()=> { tone(660,60,"square",0.05); tone(990,60,"square",0.05,0.07); tone(1320,90,"square",0.05,0.14); };
const sHurt  = ()=> { slide(740,220,220,"square",0.06); tone(196,120,"square",0.04,0.22); };
const sStart = ()=> { tone(523,90,"square",0.05); tone(659,90,"square",0.05,0.10); tone(784,110,"square",0.05,0.20); };
const sLevel = ()=> { tone(784,90,"square",0.05); tone(988,90,"square",0.05,0.10); tone(1319,120,"square",0.05,0.20); };
const sOver  = ()=> { tone(523,180,"square",0.05); tone(392,180,"square",0.05,0.18); tone(330,240,"square",0.05,0.36); };

// ================== JOGO ==================
const TILE=32, COLS=28, ROWS=19;
// câmara (telemóvel vertical): mostra só uma parte da largura do labirinto, maior, e segue o robô
const cam={on:false, vis:COLS, x:0, snap:true};

function resizeCanvasToScreen(){
  // resolução lógica do jogo
  const lw = COLS*TILE, lh = ROWS*TILE;
  const root = document.documentElement;
  if(root.classList.contains("phone")){ fitPhone(lw, lh, root.classList.contains("m-land")); return; }
  cam.on=false; cam.vis=COLS; cam.x=0;

  const vw = window.innerWidth, vh = window.innerHeight;
  const landscapePhone = vw <= 900 && vw > vh;      // janela estreita deitada
  const sideBySide = vw > 900 || landscapePhone;     // painel ao lado do jogo
  const wrap = document.getElementById("wrap"), panel = document.getElementById("panel");
  const top = wrap.getBoundingClientRect().top + window.scrollY;
  const pad = vw<=900 ? 4 : 14, gap = 16;

  let availW, availH;
  if(sideBySide){
    const panelW = panel ? panel.offsetWidth : 0;
    availW = vw - panelW - gap - pad*2;
    availH = vh - top - pad;
  }else{
    availW = vw - pad*2;
    availH = vh * 0.62;
  }
  const scale = Math.max(0.2, Math.min(availW / lw, availH / lh));
  const cw = Math.floor(lw * scale), ch = Math.floor(lh * scale);
  canvas.style.width  = cw + "px";
  canvas.style.height = ch + "px";
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width  = Math.max(Math.round(lw/2), Math.round(cw * dpr));
  canvas.height = Math.max(Math.round(lh/2), Math.round(ch * dpr));
}
// Telemóvel: o jogo ocupa tudo o que o painel não usa (sem scroll).
// Na vertical, o labirinto é largo e ficaria minúsculo → zoom com câmara que segue o robô.
function fitPhone(lw, lh, land){
  const wrap=document.getElementById("wrap"), panel=document.getElementById("panel");
  const gap=6, border=6;                               // borda do canvas (2×2,5 px) + folga
  let availW, availH;
  if(land){ availW = wrap.clientWidth - panel.offsetWidth - gap - border; availH = wrap.clientHeight - border; }
  else    { availW = wrap.clientWidth - border; availH = wrap.clientHeight - panel.offsetHeight - gap - border; }
  availW=Math.max(120,availW); availH=Math.max(90,availH);
  const sFit = Math.min(availW/lw, availH/lh);         // labirinto inteiro
  let scale=sFit, vis=COLS;
  if(!land){
    const MIN_VIS=16;                                  // nunca menos de 16 colunas visíveis
    const sCam = Math.min(availH/lh, availW/(MIN_VIS*TILE));
    if(sFit*TILE < 22 && sCam > sFit*1.15){ scale=sCam; vis=availW/(scale*TILE); }
  }
  cam.on = vis < COLS-0.01; cam.vis = cam.on ? vis : COLS; cam.snap=true;
  const cw=Math.floor(cam.vis*TILE*scale), ch=Math.floor(lh*scale);
  canvas.style.width=cw+"px"; canvas.style.height=ch+"px";
  const dpr=Math.min(window.devicePixelRatio||1,3);
  canvas.width=Math.max(120,Math.round(cw*dpr)); canvas.height=Math.max(90,Math.round(ch*dpr));
}
function onResize(){ resizeCanvasToScreen(); if(window.__vbReady) draw(); }
window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", ()=>setTimeout(onResize,250));
if(window.ResizeObserver) new ResizeObserver(()=>onResize()).observe(document.getElementById("panel"));

resizeCanvasToScreen();

const POWER_TIME=8000;
const POWER_WARNING=2000;

/* ITENS EXTRA (arcade) */
let bonusOnMap=false, bonusDespawnAt=0;
let heartOnMap=false;
let chipsEatenThisLevel=0;
let heartSpawnAt=0;
const BONUS_LIFE_MS = 8500;
const BONUS_POINTS = 100;
const HEART_POINTS = 50;
const MAX_LIVES = 5;

// partículas simples (sparkles)
let particles=[];
function spawnParticles(x,y,n=10){
  for(let i=0;i<n;i++){
    particles.push({x, y, vx:(Math.random()*2-1)*1.6, vy:(Math.random()*2-1)*1.6, t0:performance.now(), life:420+Math.random()*220});
  }
}


let score=0, level=1, lives=3;
let running=false, paused=false;
let tick=0;
let easyMode=true;
const BASE_STEP_MS=220; // velocidade base
let stepMs=BASE_STEP_MS;
let timer=null;

let power=false, powerEnd=0, powerBlink=false;
let firewallOnMap=false;
let firewallSpawnAt=0;

// feedback visual (mensagens rápidas)
let toastText="", toastUntil=0;
let munchUntil=0, joyUntil=0, hurtUntil=0;
let scareUntil=0;      let powerFlashUntil=0; // brilho curto no VanBerto

const pac={x:1,y:15,px:1,py:15,dir:{x:1,y:0},next:{x:1,y:0}};
let ghosts=[];

const BASE=[
"1111111111111111111111111111",
"1000000000110000000000000001",
"1011111110110111111111111101",
"1000000010000001000000000001",
"1011111011111111011111011101",
"1000001010000000010001010001",
"1111101010111111010101011111",
"1000000010100000010100000001",
"1011111110101111110101111101",
"1000000000001000000000000001",
"1011111111101110111111111101",
"1000000000000000000000000001",
"1111101111110111111110111111",
"1000101000000100000000100001",
"1011101011111101111110101111",
"1000000010000001000000000001",
"1011111110110111111111111101",
"1000000000110000000000000001",
"1111111111111111111111111111"
].map(r=>r.split("").map(Number));

let map=[]; // 1 wall, 2 chip (patch), 3 firewall, 4 bónus, 5 coração

// ---------- UI ----------
const $ = (id)=>document.getElementById(id);
function setStatus(txt){ $("status").textContent = txt || ""; }
function toast(msg, ms=900){
  toastText = msg;
  toastUntil = Date.now() + ms;
}
function clampHUD(){
  $("score").textContent=score; $("best").textContent=bestLabel();
  $("level").textContent=level;
  $("lives").textContent="❤️".repeat(Math.max(0,lives));
}
function showStart(show){ $("overlayStart").classList.toggle("show", !!show); }
function showOver(show){ $("overlayGameOver").classList.toggle("show", !!show); }



// ---------- PERGUNTAS (progressivas por nível) ----------
const QUESTION_BANK = {
  1: [
    { q: "O que é a Internet?", a: ["Uma rede que liga computadores", "Um jogo de tabuleiro", "Uma impressora"], correct: 0 },
    { q: "Deves falar com desconhecidos online?", a: ["Sim, sempre", "Não, e pedir ajuda a um adulto", "Só à noite"], correct: 1 },
  ],
  2: [
    { q: "O que é uma palavra-passe?", a: ["Um segredo para entrar numa conta", "Uma fotografia", "Um botão do ecrã"], correct: 0 },
    { q: "Qual é uma boa palavra-passe?", a: ["1234", "Uma longa e única", "O teu nome"], correct: 1 },
  ],
  3: [
    { q: "Phishing é…", a: ["Uma tentativa de enganar para roubar dados", "Um tipo de rato", "Um vídeo"], correct: 0 },
    { q: "Antes de clicar num link, deves…", a: ["Clicar logo", "Confirmar quem enviou e se é seguro", "Fechar os olhos"], correct: 1 },
  ],
  4: [
    { q: "Para que serve um antivírus?", a: ["Proteger contra ameaças", "Aumentar o volume", "Desenhar"], correct: 0 },
    { q: "Instalar apps de sites estranhos é…", a: ["Seguro", "Arriscado", "Obrigatório"], correct: 1 },
  ],
  5: [
    { q: "O que faz uma firewall?", a: ["Controla ligações suspeitas", "Muda a cor do ecrã", "Apaga fotos"], correct: 0 },
    { q: "Se uma mensagem disser 'ganhaste um prémio', deves…", a: ["Carregar já", "Desconfiar e confirmar", "Partilhar com todos"], correct: 1 },
  ],
  6: [
    { q: "O que é 2FA?", a: ["Dois passos para entrar numa conta", "Um jogo", "Um tipo de teclado"], correct: 0 },
    { q: "Partilhar palavras-passe com amigos é…", a: ["Boa ideia", "Má ideia", "Obrigatório"], correct: 1 },
  ],
  7: [
    { q: "Porque é importante atualizar o sistema?", a: ["Para fechar falhas de segurança", "Para gastar bateria", "Para mudar o som"], correct: 0 },
    { q: "Num site sem https, deves…", a: ["Pôr a palavra-passe", "Evitar pôr dados", "Enviar morada"], correct: 1 },
  ],
  8: [
    { q: "Backups servem para…", a: ["Proteger ficheiros", "Aumentar o brilho", "Criar vírus"], correct: 0 },
    { q: "Se vires algo estranho online, deves…", a: ["Ficar calado", "Pedir ajuda a um adulto/professor", "Clicar mais"], correct: 1 },
  ],
  9: [
    { q: "Uma boa regra online é…", a: ["Partilhar tudo", "Pensar antes de publicar", "Nunca perguntar"], correct: 1 },
    { q: "Dados pessoais incluem…", a: ["Morada e número", "Só emojis", "Só jogos"], correct: 0 },
  ],
  10: [
    { q: "Qual é a melhor atitude de segurança?", a: ["Ser curioso e confirmar", "Confiar sempre", "Clicar sem ler"], correct: 0 },
    { q: "O que proteges quando usas boas práticas?", a: ["As tuas contas e privacidade", "A cor do labirinto", "Só o som"], correct: 0 },
  ],
};

const WHY = {
 "O que é a Internet?": "A Internet é uma rede gigante que liga computadores e telemóveis em todo o mundo.",
 "Deves falar com desconhecidos online?": "Online, qualquer pessoa pode fingir ser quem não é. Se um desconhecido te escrever, fala com um adulto.",
 "O que é uma palavra-passe?": "É um segredo que só tu deves saber, para ninguém entrar nas tuas contas.",
 "Qual é uma boa palavra-passe?": "Quanto mais longa e única, mais difícil de adivinhar. “1234” ou o teu nome descobrem-se num instante.",
 "Phishing é…": "No phishing, alguém finge ser um banco, uma loja ou um amigo para te levar a dar dados.",
 "Antes de clicar num link, deves…": "Um link pode levar a um site falso. Confirma quem o enviou e se estavas à espera da mensagem.",
 "Para que serve um antivírus?": "Deteta e bloqueia programas maliciosos antes de fazerem estragos.",
 "Instalar apps de sites estranhos é…": "Apps fora das lojas oficiais podem trazer malware escondido.",
 "O que faz uma firewall?": "A firewall é como um segurança à porta: deixa passar o que é seguro e bloqueia ligações suspeitas.",
 "Se uma mensagem disser 'ganhaste um prémio', deves…": "Prémios inesperados são uma isca clássica. Se fosse verdade, não terias de carregar a correr.",
 "O que é 2FA?": "Além da palavra-passe pede um segundo passo (por exemplo, um código no telemóvel). Mesmo que descubram a palavra-passe, não entram.",
 "Partilhar palavras-passe com amigos é…": "Quem a tem pode usar a tua conta e passá-la a outros. Só a deves partilhar com um adulto de confiança.",
 "Porque é importante atualizar o sistema?": "As atualizações corrigem falhas que os atacantes podem aproveitar.",
 "Num site sem https, deves…": "Sem https, o que escreves pode ser intercetado. Evita pôr aí palavras-passe e dados pessoais.",
 "Backups servem para…": "Se perderes ou estragares ficheiros (ou apanhares um vírus), tens uma cópia para recuperar.",
 "Se vires algo estranho online, deves…": "Contar a um adulto ou ao professor ajuda a resolver depressa e a proteger os outros.",
 "Uma boa regra online é…": "O que publicas pode ficar na Internet para sempre. Pensa antes de publicar.",
 "Dados pessoais incluem…": "Morada, telefone, escola… tudo o que mostra quem és ou onde estás.",
 "Qual é a melhor atitude de segurança?": "Ser curioso e confirmar antes de clicar protege-te de quase todas as burlas.",
 "O que proteges quando usas boas práticas?": "Proteges as tuas contas, os teus dados e a tua privacidade."
};
const whyFor = (qObj)=>WHY[qObj.q]||"";
let missedQs=[]; // perguntas falhadas: voltam a aparecer mais tarde

function pickQuestionForLevel(lv){
  if(missedQs.length && Math.random()<0.5) return missedQs[Math.floor(Math.random()*missedQs.length)];
  let list = QUESTION_BANK[lv] || QUESTION_BANK[10];
  list = filterQuestions(list);
  if(list.length===0) list = QUESTION_BANK[lv] || QUESTION_BANK[10];
  return list[Math.floor(Math.random()*list.length)];
}

// ---------- PERGUNTAS + "SABIAS QUE" ----------
const QUESTIONS = [
  {
    q: "O que é malware?",
    a: ["Um tipo de software malicioso", "Um ecrã partido", "Um cabo de rede"],
    correct: 0
  },
  {
    q: "Qual é uma boa prática para criar palavras-passe?",
    a: ["Usar '1234' para ser fácil", "Usar palavras-passe longas e únicas", "Partilhar com amigos"],
    correct: 1
  },
  {
    q: "Para que serve um antivírus?",
    a: ["Para desenhar", "Para proteger o computador contra ameaças", "Para aumentar o volume"],
    correct: 1
  },
  {
    q: "O que deves fazer antes de abrir um link estranho?",
    a: ["Clicar logo", "Verificar quem enviou e se é seguro", "Desligar o ecrã"],
    correct: 1
  },
  {
    q: "Phishing é…",
    a: ["Uma tentativa de enganar para roubar dados", "Um jogo de futebol", "Um tipo de teclado"],
    correct: 0
  },
  {
    q: "Qual destas é uma atualização importante?",
    a: ["Atualização de segurança", "Atualização do papel de parede", "Atualização da cor do rato"],
    correct: 0
  },
];

const FACTS = [
  "Atualizações de segurança corrigem falhas que os malware tentam aproveitar.",
  "Nunca partilhes palavras-passe. Uma palavra-passe é pessoal e secreta.",
  "Ativa a verificação em dois passos (2FA) sempre que for possível.",
  "Desconfia de mensagens com urgência: 'é já!' 'ganhaste um prémio!' — pode ser phishing.",
  "Antes de clicar num link, confirma quem enviou e se o endereço parece correto.",
  "Não instales aplicações fora de lojas oficiais e lê as permissões antes de aceitar.",
  "Uma firewall ajuda a bloquear ligações suspeitas entre o teu dispositivo e a internet.",
  "Fazer cópias de segurança (backups) protege os teus ficheiros se acontecer um ataque.",
  "Se um site não tiver https, evita colocar dados pessoais ou palavras-passe.",
  "Se vires algo estranho, pede ajuda a um adulto/professor em vez de tentares sozinho.",
];

let quizPending=false;
let quizLocked=false;

function pickQuestion(level){
  return pickQuestionForLevel(level);
}
function pickFact(level){
  const idx = (level-1) % FACTS.length;
  return FACTS[idx];
}


function hintFor(qText){
  const t=qText.toLowerCase();
  if(t.includes("phishing")) return "Sugestão: mensagens com urgência e links estranhos podem ser armadilhas.";
  if(t.includes("palavra-passe")) return "Sugestão: usa uma palavra-passe longa e diferente para cada conta.";
  if(t.includes("firewall")) return "Sugestão: a firewall ajuda a bloquear ligações suspeitas.";
  if(t.includes("https")) return "Sugestão: em sites sem https evita colocar dados pessoais.";
  if(t.includes("atualizar")) return "Sugestão: atualizações fecham falhas de segurança.";
  return "Sugestão: pensa antes de clicar e pede ajuda se não tiveres a certeza.";
}

function showQuestionOverlay(qObj, onCorrect){
  quizLocked=true;
  paused=true;

  const overlay = $("overlayQuestion");
  $("qText").textContent = qObj.q;
  $("qFeedback").textContent = "";

  const box = $("qOptions");
  box.innerHTML = "";
  qSel=-1;
  { const nO=qObj.a.length; $("qHint").textContent="⌨️ Carrega "+["1","2","3","4"].slice(0,nO).join(", ")+" (ou "+["A","B","C","D"].slice(0,nO).join(", ")+") — ou usa ↑ ↓ e Enter"; }

  let errou=false;
  qObj.a.forEach((txt, i)=>{
    const b=document.createElement("button");
    b.className="optBtn";
    b.textContent = txt;
    b.addEventListener("click", ()=>{
      if(quizLocked===false) return;
      const ok = i===qObj.correct;
      $("qFeedback").textContent = ok ? ("✅ Certo! Boa!"+(whyFor(qObj)?" 💡 Porquê? "+whyFor(qObj):"")) : `❌ Quase… tenta outra vez. 💡 ${hintFor(qObj.q)}`;
      if(ok){
        vibe([30,40,30]);
        b.classList.add("good");
        if(!errou) missedQs=missedQs.filter(m=>m!==qObj);
        quizLocked=false;
        setTimeout(()=>{
          overlay.classList.remove("show");
          showFactOverlay(pickFact(level), ()=>{
            paused=false;
            onCorrect();
            loop();
          });
        }, whyFor(qObj)?3600:450);
      }else{
        vibe(180);
        b.classList.add("bad");
        errou=true; if(!missedQs.includes(qObj)) missedQs.push(qObj);
        // mantém a possibilidade de tentar novamente
      }
    });
    box.appendChild(b);
  });

  overlay.classList.add("show");
}

function showFactOverlay(text, onContinue){
  const overlay=$("overlayFact");
  $("factText").textContent = text;
  overlay.classList.add("show");
  const btn=$("btnFactContinue");
  const handler=()=>{
    btn.removeEventListener("click", handler);
    overlay.classList.remove("show");
    onContinue();
  };
  btn.addEventListener("click", handler);
}

// ---------- MAP ----------
function buildMap(){
  map=BASE.map(r=>r.slice());
  for(let y=0;y<ROWS;y++)
    for(let x=0;x<COLS;x++)
      if(map[y][x]===0) map[y][x]=2;

  // inicio sem patch
  map[15][1]=0;
}

function isWall(x,y){
  if(x<0||x>=COLS||y<0||y>=ROWS) return true;
  return map[y][x]===1;
}

function remainingPatches(){
  let n=0;
  for(let y=0;y<ROWS;y++)
    for(let x=0;x<COLS;x++)
      if(map[y][x]===2) n++;
  return n;
}

function spawnFirewall(){
  if(firewallOnMap || power) return;
  // tenta 60 vezes encontrar um tile vazio
  for(let i=0;i<60;i++){
    const x = 1 + Math.floor(Math.random()*(COLS-2));
    const y = 1 + Math.floor(Math.random()*(ROWS-2));
    if(map[y][x]===0 && !isWall(x,y) && !(x===pac.x && y===pac.y)){
      map[y][x]=3;
      firewallOnMap=true;
      setStatus("🛡️ Firewall disponível!");
      sCoin();
      return;
    }
  }
}


function spawnBonus(){
  if(bonusOnMap) return;
  for(let i=0;i<80;i++){
    const x = 1 + Math.floor(Math.random()*(COLS-2));
    const y = 1 + Math.floor(Math.random()*(ROWS-2));
    if(map[y][x]===0 && !isWall(x,y) && !(x===pac.x && y===pac.y)){
      map[y][x]=4;
      bonusOnMap=true;
      bonusDespawnAt = Date.now() + BONUS_LIFE_MS;
      toast("⭐ Bónus!", 800);
      sCoin();
      return;
    }
  }
}

function spawnHeartItem(){
  if(heartOnMap) return;
  if(lives>=MAX_LIVES) return;

  // ❤️ Escolhe um sítio "andável" (0 ou patch 2). Se só existir patch, o coração substitui o patch.
  const candidates = [];
  for(let y=1;y<ROWS-1;y++){
    for(let x=1;x<COLS-1;x++){
      const v = map[y][x];
      if((v===0 || v===2) && !(x===pac.x && y===pac.y)){
        candidates.push({x,y});
      }
    }
  }
  if(!candidates.length) return;

  const spot = candidates[Math.floor(Math.random()*candidates.length)];
  map[spot.y][spot.x] = 5;
  heartOnMap = true;

  toast("❤️ Vida extra!", 900);
  sCoin();
}



function calcSpeedMs(level, easyMode){
  // 10 níveis: 1-3 mais calmo, 4-7 a acelerar, 8-10 rápido mas controlado
  const base = easyMode ? 230 : 175;

  if(level<=3) return base;                 // calmo
  if(level<=7) return base - (level-3)*15;  // acelera
  return Math.max(95, base - 60 - (level-7)*8); // final mais rápido
}

function setupLevel(keepScore=true){
  buildMap();

  pac.x=1; pac.y=15; pac.px=1; pac.py=15;
  pac.dir={x:1,y:0}; pac.next={x:1,y:0};

  power=false; powerBlink=false;
  firewallOnMap=false;
  bonusOnMap=false; bonusDespawnAt=0;
  heartOnMap=false;
  chipsEatenThisLevel=0;
  heartSpawnAt = Date.now() + 6000; // ❤️ aparece ~6s após iniciar o nível
  $("powerBar").style.width="0%";

  // dificuldade
  const baseGhosts = easyMode ? 3 : 4;
  const n = Math.min(4, baseGhosts + Math.floor((level-1)/2));
  const spawns=[{x:1,y:1},{x:26,y:1},{x:1,y:17},{x:26,y:17}];

  ghosts=[];
  for(let i=0;i<n;i++){
    const s=spawns[i];
    ghosts.push({id:i,x:s.x,y:s.y,px:s.x,py:s.y,dir:{x:1,y:0},scared:false,eaten:false});
  }
  $("ghostsN").textContent=n;

  stepMs = (easyMode ? 225 : 175) - (level-1)*10;  // velocidade progressiva (Modo Fácil mais lento)
  const speedFactor = easyMode ? 1.40 : 1.00;
  stepMs = Math.max(110, Math.round(BASE_STEP_MS*speedFactor - (level-1)*8));
// firewall aparece mais cedo em níveis altos
  firewallSpawnAt = Date.now() + Math.max(2500, 6500 - (level-1)*600);
  updateMission(); toast("VanBerto's — Nível "+level, 1600);
}

// ---------- MOVIMENTO ----------
function setDir(dx,dy){ pac.next={x:dx,y:dy}; }

function movePac(){
  pac.px=pac.x; pac.py=pac.y;

  const nx=pac.x+pac.next.x, ny=pac.y+pac.next.y;
  if(!isWall(nx,ny)) pac.dir={...pac.next};

  const mx=pac.x+pac.dir.x, my=pac.y+pac.dir.y;
  if(isWall(mx,my)) return;

  pac.x=mx; pac.y=my;

  if(map[my][mx]===2){
    map[my][mx]=0; score+=10; sPatch(); munchUntil=Date.now()+260; mascotEvent("patch");
    chipsEatenThisLevel++;
    if(!bonusOnMap && chipsEatenThisLevel>0 && chipsEatenThisLevel%45===0) spawnBonus();
  }
  if(map[my][mx]===4){
    map[my][mx]=0; bonusOnMap=false;
    score += BONUS_POINTS; joyUntil=Date.now()+1000; mascotEvent("bonus");
    toast(`⭐ +${BONUS_POINTS}`, 900);
    spawnParticles(mx*TILE+TILE/2, my*TILE+TILE/2, 14);
    sCoin();
  }
  if(map[my][mx]===5){
    map[my][mx]=0; heartOnMap=false;
    if(lives<MAX_LIVES) lives++;
    joyUntil=Date.now()+1000; mascotEvent("heart");
    score += HEART_POINTS;
    toast(`❤️ +1 vida`, 900);
    spawnParticles(mx*TILE+TILE/2, my*TILE+TILE/2, 16);
    sCoin();
  }
  if(map[my][mx]===3){
    map[my][mx]=0; firewallOnMap=false;
    power=true; ghostCombo=100; powerEnd=Date.now()+POWER_TIME;
    $("powerBar").style.width="100%";
    setStatus("🛡️ Firewall ativada! Come os malware azuis!");
    toast("🛡️ Proteção ativada!");
    scareUntil = Date.now() + 1400;
    powerFlashUntil = Date.now() + 900; mascotEvent("shield");
    ghosts.forEach(g=>{ if(!g.eaten) g.scared=true; });
    sPower();
  }
}

function stepToward(sx,sy,tx,ty){
  const key=(x,y)=>y*COLS+x, prev=new Map(), q=[[sx,sy]];
  prev.set(key(sx,sy),null);
  const D=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  while(q.length){
    const [x,y]=q.shift();
    if(x===tx && y===ty) break;
    for(const d of D){
      const nx=x+d.x, ny=y+d.y;
      if(isWall(nx,ny) || prev.has(key(nx,ny))) continue;
      prev.set(key(nx,ny),[x,y,d]); q.push([nx,ny]);
    }
  }
  if(!prev.has(key(tx,ty))) return null;
  let cx=tx, cy=ty, step=null;
  while(true){ const p=prev.get(key(cx,cy)); if(!p) break; step=p[2]; cx=p[0]; cy=p[1]; }
  return step;
}

function moveGhost(g){
  g.px=g.x; g.py=g.y;
  if(g.eaten){ // só os olhos: voltam ao centro e renascem
    if(g.x===13 && g.y===9){ g.eaten=false; g.scared=false; return; }
    const st=stepToward(g.x,g.y,13,9);
    if(st){ g.x+=st.x; g.y+=st.y; g.dir=st; } else { g.x=13; g.y=9; }
    return;
  }
  const dirs=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  const fleeing=g.scared;
  let best=null, bestScore=fleeing ? -Infinity : Infinity;

  for(const d of dirs){
    const nx=g.x+d.x, ny=g.y+d.y;
    if(isWall(nx,ny)) continue;
    // evita ir logo para trás se possível
    if(d.x===-g.dir.x && d.y===-g.dir.y) continue;

    let tx=pac.x, ty=pac.y;
    if(g.id===1){ tx=pac.x+pac.dir.x*4; ty=pac.y+pac.dir.y*4; }
    else if(g.id===2 && Math.random()<0.35){ tx=Math.floor(Math.random()*COLS); ty=Math.floor(Math.random()*ROWS); }
    else if(g.id===3 && Math.abs(g.x-pac.x)+Math.abs(g.y-pac.y)<7){ tx=1; ty=ROWS-2; }
    const dist=Math.abs(nx-tx)+Math.abs(ny-ty);
    if(fleeing ? dist>bestScore : dist<bestScore){
      bestScore=dist; best=d;
    }
  }

  if(!best){
    const options=dirs.filter(d=>!isWall(g.x+d.x,g.y+d.y));
    best = options.length ? options[Math.floor(Math.random()*options.length)] : {x:0,y:0};
  }

  g.x+=best.x; g.y+=best.y; g.dir=best;
}

function resetAfterHit(){
  // mantém o que já foi comido (não reconstrói o mapa)
  power=false; powerBlink=false;
  document.getElementById("powerBar").style.width="0%";

  stepMs = calcSpeedMs(level, easyMode);

  // reposicionar apenas o VanBerto
  pac.x=1; pac.y=15; pac.px=1; pac.py=15;
  pac.dir={x:1,y:0}; pac.next={x:1,y:0};
  pac.face={x:1,y:0};

  // reposicionar apenas os malware
  const spawns=[
    {x:1,y:1},
    {x:26,y:1},
    {x:1,y:17},
    {x:26,y:17}
  ];
  ghosts.forEach((g,i)=>{
    const s=spawns[i % spawns.length];
    g.x=s.x; g.y=s.y; g.px=s.x; g.py=s.y;
    g.dir={x:1,y:0}; g.scared=false; g.eaten=false;
  });
}

function collide(){
  for(const g of ghosts){
    if(g.eaten) continue;
    const same=(g.x===pac.x && g.y===pac.y);
    const crossed=(g.x===pac.px && g.y===pac.py && g.px===pac.x && g.py===pac.y);
    if(!(same || crossed)) continue;

    if(g.scared){
      // malware assustado: o VanBerto's come-o! 200, 400, 800, 1600…
      ghostCombo=Math.min(1600,ghostCombo*2);
      score+=ghostCombo; sEat(); joyUntil=Date.now()+800; mascotEvent("eat");
      toast("👻 +"+ghostCombo,800);
      spawnParticles(g.x*TILE+TILE/2, g.y*TILE+TILE/2, 18);
      g.scared=false; g.eaten=true;
    }else{
      lives--; hurtUntil=Date.now()+1300; sHurt(); clampHUD(); if(lives>0) mascotEvent("hurt");
      if(lives<=0){ endGame(); return; }
      resetAfterHit();
      return;
    }
  }
}

// ---------- DESENHO (PIXEL SPRITES) ----------
function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if (w < 2*r) r = w/2;
  if (h < 2*r) r = h/2;
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

function drawTile(img, x, y, w=TILE, h=TILE){
  ctx.drawImage(img, x*TILE, y*TILE, w, h);
}

function drawSprite(sheet, frame, x, y, size=32){
  const sx = frame*size;
  const d=Math.round(size*1.3);   // sprites um pouco maiores que a casa
  ctx.drawImage(sheet, sx, 0, size, size, x*TILE+(TILE-d)/2, y*TILE+(TILE-d)/2, d, d);
}

// ---------- VANBERTO'S: o mesmo robô (vetorial) do jogo "Missão Cibersegurança" ----------
function rrVan(ctx,x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
}
function cVan(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function cfVan(ctx,x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function lVan(ctx,x1,y1,x2,y2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}

function makeVanBertoCanvas(blink,step,armsUp,S=1){
  const w=96,h=96, cv=document.createElement("canvas"); cv.width=w*S; cv.height=h*S; const ctx=cv.getContext("2d");
  ctx.clearRect(0,0,w*S,h*S);
  ctx.scale(S,S);
  ctx.lineJoin="round"; ctx.lineCap="round";
  // Desloca todo o desenho 6px para baixo para o halo da antena (y≈0) não ser cortado.
  // O setOffset do corpo físico foi ajustado em igual medida para o robô ficar na mesma posição no ecrã.
  ctx.save(); ctx.translate(0, 6);
  const NAVY="#16233e", NAVY2="#26365a", OUT="#101a30";
  function white(x0,y0,x1,y1){const g=ctx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,"#ffffff");g.addColorStop(0.55,"#e6edf7");g.addColorStop(1,"#b4c4dc");return g;}

  // ===== PERNAS (bem visíveis por baixo do tronco; passo marcado) =====
  const LIFT=8, STRIDE=3;
  let lTop=70, rTop=70, lDX=0, rDX=0;          // topo da coxa; planta=70 -> pé a y=88
  if(step===0){ lTop=70-LIFT; lDX=STRIDE; rDX=-STRIDE; }
  else if(step===1){ rTop=70-LIFT; rDX=STRIDE; lDX=-STRIDE; }
  function leg(cx,top){
    rrVan(ctx,cx-5,top,10,11,4.5); ctx.fillStyle=white(cx-5,top,cx+5,top); ctx.fill();
    ctx.lineWidth=2.6; ctx.strokeStyle=OUT; ctx.stroke();
    const fy=top+9;
    rrVan(ctx,cx-6.5,fy,13,9,4); ctx.fillStyle=NAVY; ctx.fill();
    ctx.lineWidth=2.6; ctx.strokeStyle=OUT; ctx.stroke();
    rrVan(ctx,cx-6.5,fy+2,13,2.4,1.2); ctx.fillStyle="rgba(255,255,255,0.85)"; ctx.fill();
    cfVan(ctx,cx-2.5,fy+4.5,1.4,"rgba(255,255,255,0.5)");
  }
  leg(41+lDX,lTop); leg(55+rDX,rTop);

  // ===== BRAÇOS (curtos e encostados; balançam ao contrário da perna do
  // mesmo lado — braço esquerdo para trás quando a perna esquerda avança,
  // tal como um passo natural — só nos frames de caminhar, step 0/1) =====
  // Frame de salto (armsUp=true): braços erguidos quase direitos para cima,
  // só com uma ligeira inclinação para fora — ignora o balanço de andar,
  // usa outro ângulo. (Era 2.4 rad, o que punha as mãos longe do corpo,
  // com um ar "descolado"; a 2.9 rad ficam coladas à cabeça, só saindo
  // ligeiramente para os lados.)
  const ARM_SWING = 0.24; // radianos
  const JUMP_RAISE = 2.9; // radianos — braço roda de "para baixo" para "quase direito para cima"
  let lArmSwing = 0, rArmSwing = 0;
  if(armsUp){ lArmSwing = JUMP_RAISE; rArmSwing = -JUMP_RAISE; }
  else if(step===0){ lArmSwing=-ARM_SWING; rArmSwing=ARM_SWING; }
  else if(step===1){ lArmSwing=ARM_SWING; rArmSwing=-ARM_SWING; }
  function arm(sx,swing){
    ctx.save();
    const px=sx+4.5, py=52; // pivô no ombro
    ctx.translate(px,py); ctx.rotate(swing); ctx.translate(-px,-py);
    rrVan(ctx,sx,52,9,13,4.5); ctx.fillStyle=white(sx,52,sx+9,52); ctx.fill();
    ctx.lineWidth=2.6; ctx.strokeStyle=OUT; ctx.stroke();
    const hx=sx+4.5, hy=67;
    cfVan(ctx,hx,hy,5,NAVY);
    ctx.lineWidth=2.3; ctx.strokeStyle=OUT; ctx.beginPath(); ctx.arc(hx,hy,5,0,Math.PI*2); ctx.stroke();
    cfVan(ctx,hx-2,hy+1.6,1.4,NAVY2); cfVan(ctx,hx+0.5,hy+2.4,1.4,NAVY2); cfVan(ctx,hx+2.5,hy+1.6,1.4,NAVY2);
    ctx.restore();
  }
  arm(17,lArmSwing); arm(70,rArmSwing);

  // ===== TRONCO (estreito: x26–70, igual à cabeça) =====
  rrVan(ctx,26,44,44,32,15); ctx.fillStyle=white(28,46,68,46); ctx.fill();
  ctx.save(); rrVan(ctx,26,44,44,32,15); ctx.clip();
  const wg=ctx.createLinearGradient(0,64,0,76); wg.addColorStop(0,"rgba(22,35,62,0)"); wg.addColorStop(0.4,"#1c2c4c"); wg.addColorStop(1,"#142038");
  ctx.fillStyle=wg; ctx.fillRect(26,62,44,16);
  ctx.strokeStyle="rgba(16,26,48,0.6)"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(28,64); ctx.lineTo(68,64); ctx.stroke();
  ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.ellipse(36,52,9,5.5,-0.5,0,Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.lineWidth=3; ctx.strokeStyle=OUT; rrVan(ctx,26,44,44,32,15); ctx.stroke();

  // ===== PAINEL DO PEITO =====
  cfVan(ctx,48,56,8,NAVY);
  ctx.lineWidth=2.5; ctx.strokeStyle=OUT; ctx.beginPath(); ctx.arc(48,56,8,0,Math.PI*2); ctx.stroke();
  const dome=ctx.createRadialGradient(45.5,53.5,1,48,56,7); dome.addColorStop(0,"#aebccf"); dome.addColorStop(0.6,"#5a6a85"); dome.addColorStop(1,"#2b3a57");
  ctx.fillStyle=dome; ctx.beginPath(); ctx.arc(48,56,5.7,0,Math.PI*2); ctx.fill();
  cfVan(ctx,46,53.8,1.5,"rgba(255,255,255,0.85)");

  // ===== EAR PODS (atrás do capacete) =====
  function pod(cx){
    cfVan(ctx,cx,32,6,NAVY);
    ctx.lineWidth=2.3; ctx.strokeStyle=OUT; ctx.beginPath(); ctx.arc(cx,32,6,0,Math.PI*2); ctx.stroke();
    cfVan(ctx,cx,32,2.8,NAVY2); cfVan(ctx,cx-0.8,31,1,"rgba(255,255,255,0.6)");
  }
  pod(25); pod(71);

  // ===== ANTENA =====
  ctx.fillStyle=NAVY; ctx.beginPath(); ctx.moveTo(45,16); ctx.lineTo(51,16); ctx.lineTo(49.2,8); ctx.lineTo(46.8,8); ctx.closePath(); ctx.fill();
  const halo=ctx.createRadialGradient(48,5,1,48,5,11); halo.addColorStop(0,"rgba(90,200,255,0.55)"); halo.addColorStop(1,"rgba(90,200,255,0)");
  ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(48,5,11,0,Math.PI*2); ctx.fill();
  const bg=ctx.createRadialGradient(46.3,3.5,0.5,48,5,5.5); bg.addColorStop(0,"#e6f7ff"); bg.addColorStop(0.4,"#48b4ff"); bg.addColorStop(1,"#1670d8");
  ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(48,5,5.5,0,Math.PI*2); ctx.fill();
  cfVan(ctx,46.2,3.4,1.6,"#ffffff");

  // ===== CAPACETE =====
  rrVan(ctx,26,14,44,34,17); ctx.fillStyle=white(28,15,68,15); ctx.fill();
  ctx.lineWidth=3; ctx.strokeStyle=OUT; ctx.stroke();
  ctx.save(); rrVan(ctx,26,14,44,34,17); ctx.clip();
  ctx.fillStyle="rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.ellipse(38,19,10,4,-0.5,0,Math.PI*2); ctx.fill(); ctx.restore();

  // ===== MOLDURA + VISEIRA =====
  rrVan(ctx,30,20,36,23,12); ctx.fillStyle=NAVY; ctx.fill();
  rrVan(ctx,32.5,22,31,19,10);
  const vg=ctx.createLinearGradient(0,22,0,41); vg.addColorStop(0,"#7fd4ff"); vg.addColorStop(0.5,"#2a9bf0"); vg.addColorStop(1,"#1366c6");
  ctx.fillStyle=vg; ctx.fill();
  ctx.save(); rrVan(ctx,32.5,22,31,19,10); ctx.clip();
  ctx.fillStyle="rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.ellipse(42,25,9,3.5,-0.4,0,Math.PI*2); ctx.fill(); ctx.restore();

  // ===== OLHOS =====
  if(!blink){
    ctx.fillStyle="#0a0f1c";
    ctx.beginPath(); ctx.ellipse(41,30,3.3,4,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(55,30,3.3,4,0,0,Math.PI*2); ctx.fill();
    cfVan(ctx,42.3,28.4,1.5,"#fff"); cfVan(ctx,39.9,31,0.8,"#fff");
    cfVan(ctx,56.3,28.4,1.5,"#fff"); cfVan(ctx,53.9,31,0.8,"#fff");
  } else if(blink==="wink"){
    // pisca-olho brincalhão — olho esquerdo aberto normal, direito fechado num arco
    ctx.fillStyle="#0a0f1c";
    ctx.beginPath(); ctx.ellipse(41,30,3.3,4,0,0,Math.PI*2); ctx.fill();
    cfVan(ctx,42.3,28.4,1.5,"#fff"); cfVan(ctx,39.9,31,0.8,"#fff");
    ctx.lineWidth=3; ctx.strokeStyle="#0a0f1c"; ctx.lineCap="round";
    ctx.beginPath(); ctx.arc(55,31,3.5,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
  } else if(blink==="happy"){
    // sorriso grande e feliz — olhos fechados em arco (mais generosos que o piscar normal)
    // + bochechas coradas, para se distinguir claramente do sorriso base neutro.
    ctx.lineWidth=3.2; ctx.strokeStyle="#0a0f1c"; ctx.lineCap="round";
    ctx.beginPath(); ctx.arc(41,31,3.9,0.10*Math.PI,0.90*Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(55,31,3.9,0.10*Math.PI,0.90*Math.PI); ctx.stroke();
    cfVan(ctx,33.5,35.5,3,"rgba(255,120,120,0.55)");
    cfVan(ctx,62.5,35.5,3,"rgba(255,120,120,0.55)");
  } else if(blink==="sad"){
    // sobrancelhas preocupadas (inclinadas para cima no centro) + olhos tristes + lágrima
    ctx.strokeStyle="#0a0f1c"; ctx.lineWidth=2.3; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(37,24); ctx.lineTo(44.5,27); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(59,24); ctx.lineTo(51.5,27); ctx.stroke();
    ctx.fillStyle="#0a0f1c";
    ctx.beginPath(); ctx.ellipse(41,32,2.8,3.1,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(55,32,2.8,3.1,0,0,Math.PI*2); ctx.fill();
    cfVan(ctx,42,30.7,1.1,"#fff"); cfVan(ctx,56,30.7,1.1,"#fff");
    // lagrimazinha a escorrer do olho direito
    ctx.fillStyle="#6fd0ff";
    ctx.beginPath();
    ctx.moveTo(56,35); ctx.quadraticCurveTo(59,40,56,43.5); ctx.quadraticCurveTo(53,40,56,35);
    ctx.closePath(); ctx.fill();
  } else {
    // piscar feliz — arcos ^_^
    ctx.lineWidth=3; ctx.strokeStyle="#0a0f1c";
    ctx.beginPath(); ctx.arc(41,31,3.5,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(55,31,3.5,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
  }
  // ===== BOCA — sorriso aberto e contente (variantes: maior no pisca-olho/feliz, invertida na tristeza) =====
  ctx.fillStyle="#0a0f1c";
  if(blink==="wink"){
    ctx.beginPath(); ctx.ellipse(48,36,5.6,3.6,0,0,Math.PI); ctx.fill();   // sorriso maroto, um pouco mais largo
    ctx.fillStyle="#ff7a7a";
    ctx.beginPath(); ctx.ellipse(48,37.6,2.9,1.7,0,0,Math.PI); ctx.fill();
  } else if(blink==="happy"){
    ctx.beginPath(); ctx.ellipse(48,36,6.2,4.2,0,0,Math.PI); ctx.fill();   // sorriso grande, o maior de todos
    ctx.fillStyle="#ff7a7a";
    ctx.beginPath(); ctx.ellipse(48,38,3.2,1.9,0,0,Math.PI); ctx.fill();
  } else if(blink==="sad"){
    // boca triste — arco invertido, cantos para baixo (sem preenchimento, só o traço)
    ctx.strokeStyle="#0a0f1c"; ctx.lineWidth=2.4; ctx.lineCap="round";
    ctx.beginPath(); ctx.arc(48,40,4.2,Math.PI,Math.PI*2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(48,36,4.6,3.2,0,0,Math.PI); ctx.fill();   // metade de baixo = sorriso
    ctx.fillStyle="#ff7a7a";
    ctx.beginPath(); ctx.ellipse(48,37.4,2.4,1.5,0,0,Math.PI); ctx.fill(); // línguinha
  }

  ctx.restore();
  return cv;
}

const VAN={};
function vanTex(key){
  if(VAN[key]) return VAN[key];
  const m={open:[false,-1],blink:[true,-1],wink:["wink",-1],happy:["happy",-1],sad:["sad",-1],walk1:[false,0],walk2:[false,1]};
  const p=m[key]||m.open;
  return (VAN[key]=makeVanBertoCanvas(p[0],p[1]));
}
function drawRobot(frame,x,y){
  const now=Date.now(), t=performance.now();
  const moving=running && !paused && (pac.px!==pac.x || pac.py!==pac.y);

  // expressão (as mesmas do outro jogo: normal, piscar, pisca-olho, feliz, triste)
  let key="open";
  if(now<hurtUntil) key="sad";
  else if(now<joyUntil) key="happy";
  else {
    const cyc=Math.floor(t/3300), ph=t%3300;
    const isWink=(cyc%3===0);
    if(ph<(isWink?240:130)) key=isWink?"wink":"blink";
    else if(moving) key=(Math.floor(t/140)%2===0)?"walk1":"walk2";
  }
  // enquanto anda, os pés mexem (walk1/walk2); olhos normais

  // pequeno balanço ao andar (igual ao outro jogo: sobe/desce + aperta/estica)
  const step=Math.floor(t/140)%4;
  const bobY=moving?[0,1.2,0,-1.4][step]:Math.sin(t/420)*0.4;
  const sx=moving?[1.0,1.05,1.0,0.96][step]:1;
  const sy=moving?[1.0,0.96,1.0,1.05][step]:1;

  const k=0.38, d=96*k;
  const cx=x*TILE+TILE/2, cy=y*TILE+TILE/2;
  ctx.save();
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
  ctx.translate(cx, cy+bobY);
  ctx.scale(sx,sy);
  ctx.drawImage(vanTex(key),-d/2,-d/2-0.5,d,d);
  ctx.restore();
  ctx.imageSmoothingEnabled=false;
}

// ---------- OS "MAUS" E O ESCUDO: os mesmos desenhos do jogo "Missão Cibersegurança" ----------
  // helper: olhos malvados com sobrancelhas
  function evilEyes(ctx,cx,cy,eyeColor){
    // Sobrancelhas malvadas (mais espessas e inclinadas)
    ctx.strokeStyle="#000"; ctx.lineWidth=3;
    ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(cx-14,cy-11); ctx.lineTo(cx-4,cy-6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+14,cy-11); ctx.lineTo(cx+4,cy-6); ctx.stroke();
    // Brancos dos olhos (com sombra)
    ctx.shadowColor="rgba(0,0,0,0.4)"; ctx.shadowBlur=3;
    ctx.fillStyle="#fff";
    ctx.beginPath(); ctx.ellipse(cx-7,cy,5.5,6.5,Math.PI*0.08,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+7,cy,5.5,6.5,-Math.PI*0.08,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    // Íris colorida
    ctx.fillStyle=eyeColor;
    ctx.beginPath(); ctx.ellipse(cx-7,cy+1,3.5,4.5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+7,cy+1,3.5,4.5,0,0,Math.PI*2); ctx.fill();
    // Pupila preta
    ctx.fillStyle="#000";
    ctx.beginPath(); ctx.ellipse(cx-7,cy+2,1.8,2.4,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+7,cy+2,1.8,2.4,0,0,Math.PI*2); ctx.fill();
    // Brilho duplo na pupila (mais realista)
    ctx.fillStyle="rgba(255,255,255,0.75)";
    ctx.beginPath(); ctx.arc(cx-8,cy-0.5,1.4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+6,cy-0.5,1.4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.45)";
    ctx.beginPath(); ctx.arc(cx-6,cy+2,0.8,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+8,cy+2,0.8,0,Math.PI*2); ctx.fill();
  }

  // helper: boca malvada com dentes e babas
  function evilMouth(ctx,cx,cy,color, drool=false){
    // Boca aberta (meia-lua)
    ctx.fillStyle="#1a0000";
    ctx.beginPath(); ctx.arc(cx,cy,10,0,Math.PI); ctx.fill();
    // Língua
    ctx.fillStyle="#cc2244";
    ctx.beginPath(); ctx.ellipse(cx, cy+5, 4, 3, 0, 0, Math.PI*2); ctx.fill();
    // Dentes (4 dentes irregulares)
    ctx.fillStyle="#ffffee";
    ctx.fillRect(cx-9, cy, 4, 6);
    ctx.fillRect(cx-4, cy, 4, 7);
    ctx.fillRect(cx+1, cy, 4, 6);
    ctx.fillRect(cx+6, cy, 4, 5);
    // Contorno da boca
    ctx.strokeStyle=color; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(cx,cy,10,0,Math.PI); ctx.stroke();
    // Babas (detalhe de vilão perigoso)
    if(drool){
      ctx.fillStyle="rgba(200,255,200,0.7)";
      ctx.beginPath(); ctx.moveTo(cx-3,cy+8); ctx.quadraticCurveTo(cx-3,cy+14,cx-2,cy+18); ctx.quadraticCurveTo(cx+0,cy+16,cx+1,cy+8); ctx.fill();
    }
  }


function makeVilaoCanvas(kind){
  const cv=document.createElement("canvas"); cv.width=64; cv.height=64; const ctx=cv.getContext("2d");
  if(kind===0){
    const cx=32,cy=32;

    // Sombra no chão
    ctx.fillStyle="rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.ellipse(cx,cy+26,20,5,0,0,Math.PI*2); ctx.fill();

    // Halo externo para contraste em qualquer fundo
    ctx.shadowColor="rgba(200,0,0,0.60)"; ctx.shadowBlur=10;
    ctx.strokeStyle="rgba(255,255,255,0.90)"; ctx.lineWidth=4.5;
    ctx.beginPath(); ctx.arc(cx,cy,23,0,Math.PI*2); ctx.stroke();
    ctx.shadowBlur=0;
    ctx.strokeStyle="rgba(0,0,0,0.30)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx,cy,25,0,Math.PI*2); ctx.stroke();

    // Corpo — gradiente esférico rico
    const gr=ctx.createRadialGradient(cx-8,cy-8,2,cx,cy,22);
    gr.addColorStop(0,"#ff7070");
    gr.addColorStop(0.25,"#ee1111");
    gr.addColorStop(0.65,"#bb0000");
    gr.addColorStop(1,"#6a0000");
    ctx.beginPath(); ctx.arc(cx,cy,22,0,Math.PI*2); ctx.fillStyle=gr; ctx.fill();

    // Padrão de pintas (marcas de perigo — como cogumelo venenoso)
    const spots = [[cx-8,cy-8,4.5],[cx+8,cy-5,3.5],[cx-5,cy+8,4],[cx+10,cy+7,3],[cx+1,cy-13,3]];
    spots.forEach(([px,py,pr])=>{
      ctx.fillStyle="rgba(255,255,255,0.22)";
      ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.fill();
      // Borda branca da pinta
      ctx.strokeStyle="rgba(255,255,255,0.15)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.stroke();
    });

    // Brilho esférico (canto sup. esq.)
    ctx.fillStyle="rgba(255,200,200,0.40)";
    ctx.beginPath(); ctx.ellipse(cx-8,cy-9,10,14,Math.PI*0.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.ellipse(cx-10,cy-12,5,7,Math.PI*0.3,0,Math.PI*2); ctx.fill();

    // Contorno final
    ctx.strokeStyle="#6a0000"; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(cx,cy,22,0,Math.PI*2); ctx.stroke();

    // Cara malvada
    evilEyes(ctx,cx,cy-3,"#ff0000");
    evilMouth(ctx,cx,cy+10,"#8a0000", false);
    }
  else if(kind===1){
    const cx=32,cy=34;

    // Sombra
    ctx.fillStyle="rgba(0,0,0,0.20)";
    ctx.beginPath(); ctx.ellipse(cx,cy+22,18,5,0,0,Math.PI*2); ctx.fill();

    // Halo azul exterior
    ctx.shadowColor="rgba(0,80,220,0.55)"; ctx.shadowBlur=10;
    ctx.strokeStyle="rgba(255,255,255,0.88)"; ctx.lineWidth=4.5;
    ctx.beginPath(); ctx.arc(cx,cy,23,0,Math.PI*2); ctx.stroke();
    ctx.shadowBlur=0;
    ctx.strokeStyle="rgba(0,0,0,0.28)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx,cy,25,0,Math.PI*2); ctx.stroke();

    // Aura azul elétrica
    ctx.fillStyle="rgba(50,100,255,0.18)";
    ctx.beginPath(); ctx.arc(cx,cy,28,0,Math.PI*2); ctx.fill();

    // Espinhos (8 ao redor) — antes do corpo para ficarem por baixo
    ctx.fillStyle="#003090";
    ctx.shadowColor="rgba(0,60,180,0.50)"; ctx.shadowBlur=4;
    for(let si=0;si<8;si++){
      const sa=Math.PI*2*si/8 - Math.PI*0.08;
      const sx1=cx+Math.cos(sa)*20, sy1=cy+Math.sin(sa)*20;
      const sx2=cx+Math.cos(sa)*30, sy2=cy+Math.sin(sa)*30;
      const sxL=cx+Math.cos(sa+0.25)*21, syL=cy+Math.sin(sa+0.25)*21;
      const sxR=cx+Math.cos(sa-0.25)*21, syR=cy+Math.sin(sa-0.25)*21;
      ctx.beginPath(); ctx.moveTo(sx2,sy2); ctx.lineTo(sxL,syL); ctx.lineTo(sxR,syR); ctx.closePath(); ctx.fill();
    }
    ctx.shadowBlur=0;

    // Corpo principal — gradiente azul elétrico
    const gr=ctx.createRadialGradient(cx-7,cy-7,2,cx,cy,21);
    gr.addColorStop(0,"#80b0ff");
    gr.addColorStop(0.30,"#2255ee");
    gr.addColorStop(0.70,"#0030cc");
    gr.addColorStop(1,"#001080");
    ctx.beginPath(); ctx.arc(cx,cy,21,0,Math.PI*2); ctx.fillStyle=gr; ctx.fill();

    // Padrão de circuitos (linhas azuis brilhantes)
    ctx.strokeStyle="rgba(150,200,255,0.35)"; ctx.lineWidth=1;
    ctx.lineCap="round";
    [[cx-6,cy-10,cx-6,cy-3],[cx-6,cy-3,cx+4,cy-3],[cx+4,cy-3,cx+4,cy+5],
     [cx-12,cy+4,cx-4,cy+4],[cx+6,cy+8,cx+12,cy+2]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
    // Nódulos dos circuitos
    ctx.fillStyle="rgba(180,220,255,0.55)";
    [[cx-6,cy-3],[cx+4,cy+5],[cx-4,cy+4]].forEach(([nx,ny])=>{
      ctx.beginPath(); ctx.arc(nx,ny,2,0,Math.PI*2); ctx.fill();
    });

    // Brilho esférico
    ctx.fillStyle="rgba(160,200,255,0.38)";
    ctx.beginPath(); ctx.ellipse(cx-7,cy-8,9,13,Math.PI*0.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.22)";
    ctx.beginPath(); ctx.ellipse(cx-9,cy-11,5,7,Math.PI*0.3,0,Math.PI*2); ctx.fill();

    // Contorno
    ctx.strokeStyle="#001580"; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(cx,cy,21,0,Math.PI*2); ctx.stroke();

    evilEyes(ctx,cx,cy-2,"#0044ff");
    evilMouth(ctx,cx,cy+10,"#001080", false);
    }
  else {
    const cx=32,cy=30;

    // Sombra
    ctx.fillStyle="rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.ellipse(cx,cy+28,22,6,0,0,Math.PI*2); ctx.fill();

    // Halo verde exterior
    ctx.shadowColor="rgba(0,160,0,0.55)"; ctx.shadowBlur=10;
    ctx.strokeStyle="rgba(255,255,255,0.82)"; ctx.lineWidth=4.5;
    ctx.beginPath(); ctx.arc(cx,cy,23,0,Math.PI*2); ctx.stroke();
    ctx.shadowBlur=0;
    ctx.strokeStyle="rgba(0,0,0,0.22)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx,cy,25,0,Math.PI*2); ctx.stroke();

    // Corpo principal — gradiente verde rico
    const gr=ctx.createRadialGradient(cx-6,cy-6,2,cx,cy,21);
    gr.addColorStop(0,"#90ff50");
    gr.addColorStop(0.35,"#30b020");
    gr.addColorStop(0.70,"#0d7010");
    gr.addColorStop(1,"#044806");
    ctx.beginPath(); ctx.arc(cx,cy,21,0,Math.PI*2); ctx.fillStyle=gr; ctx.fill();

    // Patas (3 de cada lado, com articulações)
    ctx.strokeStyle="#1a6010"; ctx.lineWidth=2.5; ctx.lineCap="round";
    for(let pi=0;pi<3;pi++){
      const py=cy-5+pi*7;
      // Pata esquerda — 2 segmentos com joelho
      ctx.beginPath(); ctx.moveTo(cx-21,py); ctx.lineTo(cx-28,py-5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-28,py-5); ctx.lineTo(cx-35,py+4); ctx.stroke();
      // Garra esquerda
      ctx.fillStyle="#064806"; ctx.beginPath(); ctx.arc(cx-35,py+4,3.5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#1a6010"; ctx.lineWidth=1; ctx.stroke();
      // Pata direita
      ctx.strokeStyle="#1a6010"; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(cx+21,py); ctx.lineTo(cx+28,py-5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+28,py-5); ctx.lineTo(cx+35,py+4); ctx.stroke();
      ctx.fillStyle="#064806"; ctx.beginPath(); ctx.arc(cx+35,py+4,3.5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#1a6010"; ctx.lineWidth=1; ctx.stroke();
    }

    // Antenas curvas com bola brilhante
    ctx.strokeStyle="#064806"; ctx.lineWidth=2.5; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(cx-7,cy-20); ctx.quadraticCurveTo(cx-18,cy-36,cx-11,cy-45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+7,cy-20); ctx.quadraticCurveTo(cx+18,cy-36,cx+11,cy-45); ctx.stroke();
    // Bolas das antenas com brilho
    ctx.shadowColor="rgba(255,100,50,0.70)"; ctx.shadowBlur=6;
    ctx.fillStyle="#ff5520";
    ctx.beginPath(); ctx.arc(cx-11,cy-45,5.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+11,cy-45,5.5,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle="#c04000"; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(cx-11,cy-45,5.5,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx+11,cy-45,5.5,0,Math.PI*2); ctx.stroke();
    // Brilho nas bolas
    ctx.fillStyle="rgba(255,220,180,0.65)";
    ctx.beginPath(); ctx.arc(cx-13,cy-47,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+9,cy-47,2,0,Math.PI*2); ctx.fill();

    // Segmentos do abdómen (3 anéis)
    ctx.strokeStyle="rgba(0,80,0,0.45)"; ctx.lineWidth=1.5;
    for(let s=0;s<3;s++){
      ctx.beginPath(); ctx.ellipse(cx,cy-3+s*9,16,3,0,0,Math.PI); ctx.stroke();
    }

    // Brilho esférico
    ctx.fillStyle="rgba(200,255,150,0.28)";
    ctx.beginPath(); ctx.ellipse(cx-7,cy-8,9,13,Math.PI*0.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.20)";
    ctx.beginPath(); ctx.ellipse(cx-9,cy-11,5,7,Math.PI*0.3,0,Math.PI*2); ctx.fill();

    // Contorno final
    ctx.strokeStyle="#044806"; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(cx,cy,21,0,Math.PI*2); ctx.stroke();

    evilEyes(ctx,cx,cy-2,"#00aa00");
    evilMouth(ctx,cx,cy+10,"#0a5000", true); // babas no inseto — mais assustador!
    }
  return cv;
}
function makeMedalhaCanvas(){
  const cv=document.createElement("canvas"); cv.width=52; cv.height=58; const ctx=cv.getContext("2d");

    const cx=26, cy=26;

    // Funcao auxiliar para desenhar a forma do escudo
    function shieldPath(ctx, x, y, w, h){
      const r=w*0.18;
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.lineTo(x+w-r, y);
      ctx.quadraticCurveTo(x+w, y, x+w, y+r);
      ctx.lineTo(x+w, y+h*0.55);
      // Curva inferior que forma a ponta do escudo
      ctx.quadraticCurveTo(x+w, y+h*0.82, x+w/2, y+h);
      ctx.quadraticCurveTo(x, y+h*0.82, x, y+h*0.55);
      ctx.lineTo(x, y+r);
      ctx.quadraticCurveTo(x, y, x+r, y);
      ctx.closePath();
    }

    // Sombra exterior
    ctx.shadowColor="rgba(255,215,0,0.55)"; ctx.shadowBlur=8;
    // Borda exterior dourada
    const borderGr=ctx.createLinearGradient(0,0,0,54);
    borderGr.addColorStop(0,"#ffe060"); borderGr.addColorStop(1,"#c07000");
    ctx.fillStyle=borderGr; shieldPath(ctx,1,1,50,54); ctx.fill();
    ctx.shadowBlur=0;

    // Corpo do escudo — gradiente azul real
    const bodyGr=ctx.createLinearGradient(4,4,4,50);
    bodyGr.addColorStop(0,"#4a90e8"); bodyGr.addColorStop(0.5,"#1a50b8"); bodyGr.addColorStop(1,"#0a2878");
    ctx.fillStyle=bodyGr; shieldPath(ctx,4,4,44,50); ctx.fill();

    // Reflexo de luz no topo esquerdo
    ctx.fillStyle="rgba(255,255,255,0.28)";
    ctx.beginPath(); ctx.ellipse(16,14,9,13,Math.PI*0.15,0,Math.PI*2); ctx.fill();

    // Divisao central horizontal (cruz do escudo — faixa horizontal)
    ctx.fillStyle="rgba(255,215,0,0.22)";
    ctx.fillRect(4,24,44,6);
    // Divisao central vertical
    ctx.fillRect(23,4,6,50);

    // Estrela dourada no centro
    ctx.save(); ctx.translate(cx, cy+4);
    ctx.shadowColor="#ffd700"; ctx.shadowBlur=6;
    const sg=ctx.createRadialGradient(-1,-2,1,0,0,10);
    sg.addColorStop(0,"#ffffff"); sg.addColorStop(0.35,"#ffe060"); sg.addColorStop(1,"#ffa000");
    ctx.fillStyle=sg;
    ctx.beginPath();
    for(let j=0;j<5;j++){
      const o=Math.PI*2*j/5-Math.PI/2, inn=o+Math.PI/5;
      j===0?ctx.moveTo(Math.cos(o)*11,Math.sin(o)*11):ctx.lineTo(Math.cos(o)*11,Math.sin(o)*11);
      ctx.lineTo(Math.cos(inn)*5,Math.sin(inn)*5);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0;
    ctx.restore();

    // Contorno exterior dourado
    ctx.strokeStyle="#ffd700"; ctx.lineWidth=2.5;
    shieldPath(ctx,4,4,44,50); ctx.stroke();
    // Linha de brilho interior
    ctx.strokeStyle="rgba(255,255,255,0.35)"; ctx.lineWidth=1.2;
    shieldPath(ctx,7,7,38,44); ctx.stroke();

    
  return cv;
}
const VIL={};
function vilTex(kind){ return VIL[kind]||(VIL[kind]=makeVilaoCanvas(kind)); }
let MEDALHA=null;
function medalhaTex(){ return MEDALHA||(MEDALHA=makeMedalhaCanvas()); }

function drawShieldRing(cx, cy, t){
  // Halo azul pulsante + barra de tempo (como no jogo "Missão Cibersegurança")
  const pulse = 0.55 + Math.sin(t*0.004)*0.45;
  ctx.save();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "rgba(68,136,255,"+(0.55*pulse+0.1)+")";
  ctx.beginPath(); ctx.arc(cx, cy, (34+pulse*6)*0.5, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(136,204,255,"+(0.7*pulse+0.1)+")";
  ctx.beginPath(); ctx.arc(cx, cy, (26+pulse*4)*0.5, 0, Math.PI*2); ctx.stroke();
  // barra de tempo por cima do robô
  const pct=Math.max(0,Math.min(1,(powerEnd-Date.now())/POWER_TIME));
  const bw=24, bh=3.5, bx=cx-bw/2, by=cy-26;
  ctx.fillStyle="rgba(0,0,0,0.45)"; roundRect(ctx,bx-1,by-1,bw+2,bh+2,2.5,true,false);
  ctx.fillStyle = pct>0.5?"#2266ff":(pct>0.25?"#55aaff":"#ff4400");
  roundRect(ctx,bx,by,Math.max(2,bw*pct),bh,2,true,false);
  ctx.fillStyle="rgba(255,255,255,0.3)"; roundRect(ctx,bx,by,Math.max(2,bw*pct),bh/2,1.5,true,false);
  ctx.restore();
}


function drawBonus(x,y,t){
  const cx = x*TILE + TILE/2, cy = y*TILE + TILE/2;
  const pulse = 0.85 + 0.25*Math.sin(t/180);
  ctx.save();
  ctx.translate(cx,cy);
  ctx.scale(pulse,pulse);
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  for(let i=0;i<10;i++){
    const a = i*Math.PI/5;
    const r = i%2===0 ? 9 : 4;
    ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHeart(x,y,t){
  const cx = x*TILE + TILE/2, cy = y*TILE + TILE/2;
  const pulse = 0.9 + 0.18*Math.sin(t/210);
  ctx.save();
  ctx.translate(cx,cy);
  ctx.scale(pulse,pulse);
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(0,6);
  ctx.bezierCurveTo(0,0,-8,-2,-8,-8);
  ctx.bezierCurveTo(-8,-14,-1,-14,0,-9);
  ctx.bezierCurveTo(1,-14,8,-14,8,-8);
  ctx.bezierCurveTo(8,-2,0,0,0,6);
  ctx.fill();
  ctx.restore();
}

function drawParticles(){
  const now = performance.now();
  particles = particles.filter(p=> (now-p.t0) < p.life);
  for(const p of particles){
    const age = now - p.t0;
    const a = 1 - age/p.life;
    const px = p.x + p.vx*age/16;
    const py = p.y + p.vy*age/16;
    ctx.save();
    ctx.globalAlpha = Math.max(0,a);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(px, py, 2, 2);
    ctx.restore();
  }
}

let lastStepAt=0, ghostCombo=100;
let best=0; try{best=+localStorage.getItem("vanberto_best")||0;}catch(e){}
let bestName=""; try{bestName=localStorage.getItem("vanberto_best_name")||"";}catch(e){}
let playerName=""; try{playerName=localStorage.getItem("vanberto_name")||"";}catch(e){}
function bestLabel(){ const v=Math.max(best,score), n=score>best?(playerName||"Jogador"):bestName; return v+(n?" ("+n+")":""); }
function saveBest(){ if(score>best){best=score; bestName=playerName||"Jogador"; try{localStorage.setItem("vanberto_best",best); localStorage.setItem("vanberto_best_name",bestName);}catch(e){}} $("best").textContent=bestLabel(); }
const tmp=document.createElement("canvas"); tmp.width=tmp.height=64; const tctx=tmp.getContext("2d");
function drawEyes(x,y){
  const px=x*TILE+TILE/2, py=y*TILE+TILE/2;
  ctx.save();
  for(const o of [-5,5]){
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(px+o,py,4.8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#1d4ed8"; ctx.beginPath(); ctx.arc(px+o,py+0.6,2.3,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
function drawVilao(kind,x,y,scared,t,id){
  const bob=Math.sin(t/220+id*1.7)*1.2;
  const sc=1+0.03*Math.sin(t/160+id);
  const d=Math.round(38*sc);
  const px=x*TILE+TILE/2, py=y*TILE+TILE/2+bob;
  ctx.save();
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
  if(scared){
    tctx.globalCompositeOperation="source-over"; tctx.globalAlpha=1; tctx.clearRect(0,0,64,64);
    tctx.drawImage(vilTex(kind),0,0);
    tctx.globalCompositeOperation="source-atop"; tctx.globalAlpha=.7;
    tctx.fillStyle=powerBlink?"#e5e7eb":"#60a5fa"; tctx.fillRect(0,0,64,64);
    tctx.globalCompositeOperation="source-over"; tctx.globalAlpha=1;
    ctx.drawImage(tmp,px-d/2,py-d/2,d,d);
    // olhos assustados (X) por cima
    const k=d/64, ex=4.4*(d/38), ey=py-1.2*(d/38);
    ctx.globalAlpha=powerBlink?0.7:1;
    ctx.fillStyle="#fff";
    ctx.beginPath(); ctx.arc(px-ex,ey,3.6*k*1.7,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(px+ex,ey,3.6*k*1.7,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#0b1020"; ctx.lineWidth=1.4; ctx.lineCap="round"; const r=2.1;
    for(const sx of [px-ex,px+ex]){
      ctx.beginPath(); ctx.moveTo(sx-r,ey-r); ctx.lineTo(sx+r,ey+r); ctx.moveTo(sx+r,ey-r); ctx.lineTo(sx-r,ey+r); ctx.stroke();
    }
  } else {
    ctx.drawImage(vilTex(kind),px-d/2,py-d/2,d,d);
  }
  ctx.restore();
  ctx.imageSmoothingEnabled=false;
}
function draw(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const csx=canvas.width/(cam.vis*TILE), csy=canvas.height/(ROWS*TILE);
  if(cam.on){
    const k0=(running&&!paused)?Math.min(1,(Date.now()-lastStepAt)/stepMs):1;
    const pxc=(pac.px+(pac.x-pac.px)*k0+0.5)*TILE;
    const tgt=Math.max(0,Math.min(COLS*TILE-cam.vis*TILE, pxc-cam.vis*TILE/2));
    cam.x = cam.snap ? tgt : cam.x+(tgt-cam.x)*0.2; cam.snap=false;
  } else cam.x=0;
  ctx.setTransform(csx,0,0,csy,-cam.x*csx,0);
  ctx.imageSmoothingEnabled=false;
  if(!allAssetsLoaded()){
    // loading fallback
    ctx.fillStyle="#e5e7eb";
    ctx.font="16px monospace";
    ctx.fillText("A carregar sprites…", 18, 28);
    return;
  }

  const t = performance.now();

  // mapa
  for(let y=0;y<ROWS;y++){
    for(let x=0;x<COLS;x++){
      if(map[y][x]===1){ ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high"; drawTile(tinted("w",ASSETS.wall,wallHue()), x, y); ctx.imageSmoothingEnabled=false; }
      else if(map[y][x]===2) {
        const ps=Math.round(TILE*0.62);
        const po=(TILE-ps)/2;
        ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
        ctx.drawImage(tinted("p",ASSETS.patch,patchHue()), x*TILE+po, y*TILE+po, ps, ps);
        ctx.imageSmoothingEnabled=false;
        } else if(map[y][x]===3){
        // 🛡️ Escudo (o mesmo do jogo "Missão Cibersegurança")
        const cx = x*TILE + TILE/2;
        const cy = y*TILE + TILE/2;
        const pulse = 1 + 0.07*Math.sin((Date.now()/180)+(x+y));
        const sh = 28*pulse, sw = sh*52/58;
        ctx.save();
        ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
        ctx.drawImage(medalhaTex(), cx-sw/2, cy-sh/2-1, sw, sh);
        ctx.restore();
      }
      else if(map[y][x]===4){
        drawBonus(x, y, t);
      } else if(map[y][x]===5){
        drawHeart(x, y, t);
      }
    }
  }

  // animação (4 frames)
  const frame = Math.floor(t/130) % 4;

  // robô
  const kk=(running&&!paused)?Math.min(1,(Date.now()-lastStepAt)/stepMs):1;
  const lp=(a,b)=>a+(b-a)*kk;
  drawRobot(frame, lp(pac.px,pac.x), lp(pac.py,pac.y));

  // brilho curto quando ativa proteção
  const now = Date.now();
  if(now < powerFlashUntil){
    const a = (powerFlashUntil - now) / 900;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.35*a;
    ctx.fillStyle = "#93c5fd";
    ctx.beginPath();
    ctx.arc(lp(pac.px,pac.x)*TILE+TILE/2, lp(pac.py,pac.y)*TILE+TILE/2, 18, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  if(power){
    const cx=lp(pac.px,pac.x)*TILE+TILE/2, cy=lp(pac.py,pac.y)*TILE+TILE/2;
    drawShieldRing(cx, cy, t);
  }

  // malware
  const mFrame = Math.floor(t/150) % 4;
  for(const g of ghosts){
    if(g.eaten) drawEyes(lp(g.px,g.x), lp(g.py,g.y));
    else drawVilao(g.id%3, lp(g.px,g.x), lp(g.py,g.y), g.scared, t, g.id);

  }
  drawParticles();

  // câmara com zoom: setas nas margens a avisar de malware que está fora de vista
  if(cam.on){
    const L=cam.x, R=cam.x+cam.vis*TILE;
    for(const g of ghosts){
      if(g.eaten) continue;
      const gx=(lp(g.px,g.x)+0.5)*TILE, gy=(lp(g.py,g.y)+0.5)*TILE;
      if(gx>=L-4 && gx<=R+4) continue;
      const left=gx<L, ex=left?L+3:R-3, d=left?11:-11;
      ctx.save(); ctx.globalAlpha=0.92; ctx.fillStyle=g.scared?"#60a5fa":"#ff4d6d";
      ctx.strokeStyle="#0a0520"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(ex,gy); ctx.lineTo(ex+d,gy-9); ctx.lineTo(ex+d,gy+9); ctx.closePath();
      ctx.stroke(); ctx.fill(); ctx.restore();
    }
  }
}

// ---------- LOOP ----------
function loop(){
  if(!running || paused) return;
  if(timer){clearTimeout(timer);timer=null;}

  // firewall spawn
  if(Date.now() > firewallSpawnAt && !firewallOnMap && !power){
    spawnFirewall();
    firewallSpawnAt = Date.now() + Math.max(6500, 11000 - level*800);
  }

  // power timer
  if(power){
    const left=powerEnd-Date.now();
    powerBlink = left<POWER_WARNING && Math.floor(left/250)%2===0;
    $("powerBar").style.width = Math.max(0, left/POWER_TIME*100) + "%";
    if(left<=0){
      power=false; powerBlink=false;
      ghosts.forEach(g=>g.scared=false);
      $("powerBar").style.width="0%";
      setStatus("");
    }
  }

  // itens extra
  if(bonusOnMap && Date.now()>bonusDespawnAt){
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(map[y][x]===4) map[y][x]=0;
    bonusOnMap=false;
  }
  if(!heartOnMap && Date.now()>heartSpawnAt){
    spawnHeartItem();
  }


  tick++;
  lastStepAt=Date.now();
  movePac();
  ghosts.forEach(g=>{
    if(g.scared && (tick%2===0)){ g.px=g.x; g.py=g.y; return; } // mais lento em modo proteção
    moveGhost(g);
  });
  collide();

  // subir nível
  if(remainingPatches()===0){
    if(level>=10){ sLevel(); draw(); showWin(); return; }
    level++;
    setStatus("🚀 Nível " + level + " — pergunta de segurança!");
    sLevel(); mascotEvent("level");

    // pausa e pergunta antes de continuar
    const qObj = pickQuestion(level);
    showQuestionOverlay(qObj, ()=>{
      setupLevel(true);
      updateMission();
    });
    draw(); clampHUD(); return;
  }

  draw();
  clampHUD();

  timer=setTimeout(loop, stepMs);
}

// ---------- START / GAME OVER ----------
function endGame(){
  running=false; paused=false;
  if(timer){ clearTimeout(timer); timer=null; }
  sOver(); saveBest(); mascotEvent("over");
  $("goMsg").textContent=(playerName||"Jogador")+", o VanBerto's foi infetado!";
  $("finalScore").textContent = score;
  $("finalLevel").textContent = level;
  showOver(true);
}

function hardReset(){
  mascotEvent("start");
  missedQs=[];
  score=0; level=1;
  lives = easyMode ? 5 : 3;
  clampHUD();
  setupLevel(false);
}

// ---------- CONTROLOS: teclado ----------
// ---------- TECLADO nos avisos e nas perguntas (sem ter de clicar) ----------
const OV_IDS=["overlayQuestion","overlayFact","overlayName","overlayHow","overlayStart","overlayWin","overlayGameOver"];
const OV_BTN={overlayFact:"btnFactContinue",overlayHow:"btnHow",overlayStart:"btnStart",overlayWin:"btnRestartWin",overlayGameOver:"btnRestart"};
let ovSeenAt=0, qSel=-1;
function visibleOverlay(){ for(const id of OV_IDS){ const el=$(id); if(el&&el.classList.contains("show")) return id; } return null; }
if(window.MutationObserver){
  const mo=new MutationObserver(ms=>{ for(const r of ms){ const el=r.target;
    if(el.classList.contains("show") && !(r.oldValue||"").split(/\s+/).includes("show")){
      ovSeenAt=performance.now();
      if(el.id!=="overlayName"){ try{ const a=document.activeElement; if(a&&a!==document.body&&a.blur) a.blur(); }catch(e){} }  // nenhum botão com foco a "roubar" o Espaço/Enter
    } } });
  OV_IDS.forEach(id=>{ const el=$(id); if(el) mo.observe(el,{attributes:true,attributeFilter:["class"],attributeOldValue:true}); });
}
function qSelect(n){
  const bs=[...$("qOptions").children]; if(!bs.length) return;
  qSel=(n+bs.length)%bs.length;
  bs.forEach((b,i)=>b.classList.toggle("sel",i===qSel));
}
// devolve true se a tecla foi tratada por um aviso/pergunta (e o jogo não deve reagir)
function overlayKeys(e){
  const id=visibleOverlay(); if(!id) return false;
  if(e.ctrlKey||e.metaKey||e.altKey) return false;
  const kq=e.key.toLowerCase(), enter=(e.key==="Enter"||e.key===" ");
  const ready=performance.now()-ovSeenAt>450;       // evita respostas sem querer (teclas de jogo ainda carregadas)
  if(id==="overlayQuestion"){
    const bs=[...$("qOptions").children];
    const n=["1","2","3","4"].indexOf(kq), l=["a","b","c","d"].indexOf(kq), idx=n>=0?n:l;
    if(idx>=0&&idx<bs.length){ e.preventDefault(); if(!e.repeat&&ready&&quizLocked) bs[idx].click(); }
    else if(kq==="arrowdown"||kq==="arrowright"){ e.preventDefault(); if(!e.repeat) qSelect(qSel<0?0:qSel+1); }
    else if(kq==="arrowup"||kq==="arrowleft"){ e.preventDefault(); if(!e.repeat) qSelect(qSel<0?bs.length-1:qSel-1); }
    else if(enter){ e.preventDefault(); if(!e.repeat&&ready&&quizLocked&&qSel>=0) bs[qSel].click(); }
    return true;
  }
  if(id==="overlayName"){
    if(e.key==="Enter"&&document.activeElement!==nameInput){ e.preventDefault(); if(!e.repeat&&ready) $("btnName").click(); return true; }
    return false;
  }
  if(enter&&OV_BTN[id]){ e.preventDefault(); if(!e.repeat&&ready){ const b=$(OV_BTN[id]); if(b) b.click(); } return true; }
  return id==="overlayFact";                         // a ler o "Sabias que": as setas não mexem no jogo
}
// vibração no telemóvel (segue o botão Som: sem som, sem vibração)
function vibe(p){ if(!soundOn) return; try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} }

window.addEventListener("keydown", (e)=>{
  // desbloqueia audio no primeiro input
  ctxEnsure();
  if(overlayKeys(e)) return;

  if(!running) return;
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault();
  const k=e.key.toLowerCase();
  if(k==="p") $("pauseBtn").click();
  if(e.key==="ArrowLeft"||k==="a") setDir(-1,0);
  if(e.key==="ArrowRight"||k==="d") setDir(1,0);
  if(e.key==="ArrowUp"||k==="w") setDir(0,-1);
  if(e.key==="ArrowDown"||k==="s") setDir(0,1);
});

// ---------- CONTROLOS: swipe no canvas ----------
let sx=0, sy=0, pid=null;
canvas.addEventListener("pointerdown", (e)=>{
  // desbloqueia audio no toque
  ctxEnsure();

  if(!running) return;
  e.preventDefault();
  pid=e.pointerId;
  canvas.setPointerCapture(pid);
  sx=e.clientX; sy=e.clientY;
},{passive:false});

canvas.addEventListener("pointermove", (e)=>{
  if(!running) return;
  if(pid===null) return;
  if(pid!==e.pointerId) return;
  e.preventDefault();
  const dx=e.clientX-sx, dy=e.clientY-sy;
  // atualiza enquanto arrasta (mais responsivo no toque)
  const TH=14;
  if(Math.abs(dx)>Math.abs(dy)){
    if(dx>TH) setDir(1,0);
    else if(dx<-TH) setDir(-1,0);
  }else{
    if(dy>TH) setDir(0,1);
    else if(dy<-TH) setDir(0,-1);
  }
},{passive:false});

canvas.addEventListener("pointercancel", ()=>{ pid=null; }, {passive:true});

canvas.addEventListener("pointerup", (e)=>{
  if(!running) return;
  if(pid!==e.pointerId) return;
  e.preventDefault();
  const dx=e.clientX-sx, dy=e.clientY-sy;

  if(Math.abs(dx)>Math.abs(dy)){
    if(dx>14) setDir(1,0);
    else if(dx<-14) setDir(-1,0);
  }else{
    if(dy>14) setDir(0,1);
    else if(dy<-14) setDir(0,-1);
  }
  pid=null;
},{passive:false});


// ---------- CONTROLOS: toque (fallback para iOS/Android) ----------
let tsx=0, tsy=0, touching=false;

function touchToDir(dx, dy){
  // define direção pela inclinação
  if(Math.abs(dx) > Math.abs(dy)){
    if(dx > 10) setDir(1,0);
    else if(dx < -10) setDir(-1,0);
  }else{
    if(dy > 10) setDir(0,1);
    else if(dy < -10) setDir(0,-1);
  }
}

canvas.addEventListener("touchstart", (e)=>{
  ctxEnsure();
  if(!running) return;
  if(e.touches.length!==1) return;
  e.preventDefault();
  touching=true;
  tsx=e.touches[0].clientX;
  tsy=e.touches[0].clientY;
}, {passive:false});

canvas.addEventListener("touchmove", (e)=>{
  if(!running) return;
  if(!touching) return;
  if(e.touches.length!==1) return;
  e.preventDefault();
  const dx=e.touches[0].clientX-tsx;
  const dy=e.touches[0].clientY-tsy;
  // atualiza continuamente (mais responsivo)
  touchToDir(dx, dy);
}, {passive:false});

canvas.addEventListener("touchend", (e)=>{
  if(!running) return;
  e.preventDefault();
  touching=false;
}, {passive:false});

canvas.addEventListener("touchcancel", ()=>{ touching=false; }, {passive:true});


// ---------- CONTROLOS: rato (desktop) ----------
// Alguns browsers/ambientes escolares às vezes não disparam pointerup como esperamos.
// Por isso, adicionamos também mousedown/mouseup e clique simples para mudar direção.

let msx=0, msy=0, mouseDown=false;

canvas.addEventListener("mousedown", (e)=>{
  ctxEnsure();
  if(!running) return;
  mouseDown=true;
  msx=e.clientX; msy=e.clientY;
});

canvas.addEventListener("mouseup", (e)=>{
  if(!running) return;
  if(!mouseDown) return;
  mouseDown=false;

  const dx=e.clientX-msx, dy=e.clientY-msy;

  // arrasto
  if(Math.abs(dx)>Math.abs(dy)){
    if(dx>12) setDir(1,0);
    else if(dx<-12) setDir(-1,0);
  }else{
    if(dy>12) setDir(0,1);
    else if(dy<-12) setDir(0,-1);
  }
});

canvas.addEventListener("mouseleave", ()=>{ mouseDown=false; });

// clique simples: decide direção pelo quadrante
canvas.addEventListener("click", (e)=>{
  ctxEnsure();
  if(!running) return;

  const rect = canvas.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;

  if(Math.abs(dx) > Math.abs(dy)){
    setDir(dx>0 ? 1 : -1, 0);
  }else{
    setDir(0, dy>0 ? 1 : -1);
  }
}, {passive:true});

// ---------- Botões mobile (d-pad) ----------
document.querySelectorAll(".dpad").forEach(btn=>{
  const apply = ()=>{
    if(!running) return;
    const dir = btn.dataset.dir;
    if(dir==="left") setDir(-1,0);
    if(dir==="right") setDir(1,0);
    if(dir==="up") setDir(0,-1);
    if(dir==="down") setDir(0,1);
  };
  btn.addEventListener("pointerdown", (e)=>{ e.preventDefault(); ctxEnsure(); apply(); try{ navigator.vibrate&&navigator.vibrate(6); }catch(_){} }, {passive:false});
});

// ---------- UI buttons ----------
// ---------- ARRANQUE: nome → "Como jogar" (só na primeira vez) → Começar ----------
const LS_HELP="vanberto_help";
const helpSeen=()=>{ try{ return localStorage.getItem(LS_HELP)==="1"; }catch(e){ return true; } };
const nameInput=$("playerName");
let nameMode=false, helpMode=false;
$("playerShow").textContent=playerName||"—";
function hideIntro(){ ["overlayName","overlayHow"].forEach(id=>$(id).classList.remove("show")); showStart(false); }
function askName(){
  if(running && !paused) return;
  hideIntro(); nameMode=true; nameInput.value=playerName;
  $("overlayName").classList.add("show");
  setTimeout(()=>{ try{ nameInput.focus(); nameInput.select(); }catch(e){} }, 60);
}
function saveName(){
  const v=nameInput.value.trim().slice(0,14);
  if(!v){ nameInput.focus(); return; }
  playerName=v; try{ localStorage.setItem("vanberto_name",v); }catch(e){}
  $("playerShow").textContent=v; clampHUD();
  nameMode=false; nameInput.blur();
  $("overlayName").classList.remove("show");
  if(running) return;                       // a meio do jogo (em pausa): só muda o nome
  if(!helpSeen()) showHelp(); else showStart(true);
}
function showHelp(){
  if(running && !paused) $("pauseBtn").click();
  hideIntro(); helpMode=true; $("overlayHow").classList.add("show");
}
function closeHelp(){
  helpMode=false; try{ localStorage.setItem(LS_HELP,"1"); }catch(e){}
  $("overlayHow").classList.remove("show");
  if(!running) showStart(true);
}
function bootIntro(){
  if(!playerName) askName();
  else if(!helpSeen()) showHelp();
  else showStart(true);
}
nameInput.addEventListener("keydown",(e)=>{ e.stopPropagation(); if(e.key==="Enter"){ e.preventDefault(); saveName(); } });
$("btnName").addEventListener("click",()=>{ ctxEnsure(); saveName(); });
$("btnHow").addEventListener("click",()=>{ ctxEnsure(); closeHelp(); });
$("helpBtn").addEventListener("click",()=>{ ctxEnsure(); showHelp(); });
$("playerRow").addEventListener("click",()=>{ ctxEnsure(); askName(); });
$("btnStart").addEventListener("click", ()=>{
  ctxEnsure();
  showStart(false);
  showOver(false);
  hardReset();
  running=true; paused=false;
  sStart();
  loop();
});

$("btnRestart").addEventListener("click", ()=>{
  ctxEnsure();
  showOver(false);
  hardReset();
  running=true; paused=false;
  sStart();
  loop();
});

$("btnEasy").addEventListener("click", ()=>{
  easyMode=!easyMode;
  $("btnEasy").textContent = easyMode ? "🟢 Modo Fácil" : "🟡 Modo Normal";
  if(running){
    hardReset();
  }
});

$("pauseBtn").addEventListener("click", ()=>{
  if(!running) return;
  if(quizLocked) return;
  paused=!paused;
  if(paused&&timer){clearTimeout(timer);timer=null;}
  $("pauseBtn").textContent = paused ? "▶ Continuar" : "⏸ Pausa";
  if(!paused) loop();
});

$("soundBtn").addEventListener("click", ()=>{
  soundOn=!soundOn;
  $("soundBtn").textContent = soundOn ? "🔊 Som" : "🔇 Som";
});

$("resetBtn").addEventListener("click", ()=>{
  if(timer){ clearTimeout(timer); timer=null; }
  running=false; paused=false;
  showOver(false);
  buildMap();
showStart(true);
  setStatus(""); mascotEvent("idle");
});

// ---------- MASCOTE (painel lateral): o VanBerto's grande a reagir ao jogo ----------
let MT={}, MT_S=0;
function mascotTex(key){
  const S=MASC.S||4;
  if(MT_S!==S){ MT={}; MT_S=S; }
  if(MT[key]) return MT[key];
  const m={open:[false,-1],blink:[true,-1],wink:["wink",-1],happy:["happy",-1],sad:["sad",-1],walk1:[false,0],walk2:[false,1],cheer:["happy",-1,true],catch:[false,-1,true]};
  const p=m[key]||m.open;
  return (MT[key]=makeVanBertoCanvas(p[0],p[1],!!p[2],S));
}
const MASC={box:$("mascot"),stage:$("mascotStage"),cv:$("mascotCv"),say:$("mascotSay"),
  w:0, h:0, wide:false, S:4, hopAt:0, catchAt:0, shakeUntil:0, cheerUntil:0, sadUntil:0, sayUntil:0, items:[], sparks:[], count:0};
const REDUCE_MOTION=!!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const pickOne=(a)=>a[Math.floor(Math.random()*a.length)];

function mascotResize(){
  if(!MASC.box||!MASC.cv) return;
  const w=Math.floor(MASC.box.clientWidth), bh=Math.floor(MASC.box.clientHeight);
  const wide=w>bh*1.5;                       // faixa baixa (telemóvel): robô à esquerda, balão à direita
  const h=wide?bh:Math.min(bh,Math.floor(w*1.5));
  const ok = w>=90 && h>=(wide?56:90);       // sem espaço: não desenha
  MASC.w=ok?w:0; MASC.h=ok?h:0; MASC.wide=wide;
  MASC.stage.style.display = ok ? "" : "none";
  if(!ok) return;
  const dpr=Math.min(window.devicePixelRatio||1,3);
  MASC.stage.classList.toggle("wide",wide);
  MASC.stage.style.width=w+"px"; MASC.stage.style.height=h+"px";
  const dcss=wide?Math.min(w*0.5,h*0.95):Math.min(w*1.2,h*0.92);
  MASC.stage.style.setProperty("--rd",(wide?dcss:0)+"px");
  MASC.stage.style.fontSize=(wide?Math.max(11,Math.round(h*0.12)):Math.max(11,Math.round(w*0.05)))+"px";
  MASC.cv.width=Math.round(w*dpr); MASC.cv.height=Math.round(h*dpr);
  MASC.S=Math.min(8,Math.max(3,Math.ceil(dcss*dpr/96)));
}
if(window.ResizeObserver && MASC.box) new ResizeObserver(mascotResize).observe(MASC.box);
window.addEventListener("resize", mascotResize);
mascotResize();

function mascotSay(txt, ms=1600){
  if(!MASC.say) return;
  MASC.say.textContent=txt; MASC.say.classList.add("show");
  MASC.sayUntil=Date.now()+ms;
}
function mascotCheer(ms){ MASC.cheerUntil=Date.now()+ms; }
function mascotEvent(type){
  const VIB={eat:40,hurt:[90,50,140],level:[40,40,40],bonus:30,heart:30,shield:30,over:300,win:[60,40,60,40,120]};
  if(VIB[type]) vibe(VIB[type]);
  if(!MASC.cv) return;
  const now=Date.now();
  switch(type){
    case "patch":
      MASC.count++;
      MASC.items.push({t0:performance.now(), x:(Math.random()*2-1)*0.55, dur:480, spin:(Math.random()*2-1)*3});
      if(MASC.count%30===0) mascotSay(pickOne(["Falha tapada! 🔧","Mais uma atualização!","Sistema mais seguro!"]),1500);
      break;
    case "bonus":  mascotCheer(900);  mascotSay("⭐ Estrela!",1200); break;
    case "heart":  mascotCheer(1000); mascotSay("❤️ Mais uma vida!",1500); break;
    case "shield": mascotCheer(1200); mascotSay("🛡️ Firewall ativa!",1800); break;
    case "eat":    mascotCheer(800);  mascotSay(pickOne(["Apanhei-te, malware!","Fora daqui! 🦠"]),1400); break;
    case "hurt":
      MASC.sadUntil=now+1300; MASC.shakeUntil=now+600;
      mascotSay(pickOne(["Ai! Fui infetado!","Cuidado com o malware!"]),1500); break;
    case "level":  mascotCheer(1600); mascotSay("Nível "+level+"! 🚀",1800); break;
    case "win":    mascotCheer(8000); mascotSay("Missão cumprida! 🏆",5000); break;
    case "over":   MASC.sadUntil=now+600000; MASC.shakeUntil=now+600; mascotSay("Oh não… tenta outra vez!",4000); break;
    case "start":  MASC.sadUntil=0; MASC.cheerUntil=0; MASC.items.length=0; MASC.sparks.length=0; MASC.count=0; MASC.hopAt=now; mascotSay("Vamos a isso!",1600); break;
    case "idle":   MASC.sadUntil=0; MASC.cheerUntil=0; MASC.items.length=0; MASC.sparks.length=0; MASC.sayUntil=1; break;
  }
}

function drawMascot(){
  if(!MASC.w) return;
  const cv=MASC.cv, g=cv.getContext("2d"), W=cv.width, H=cv.height;
  const now=Date.now(), t=performance.now();
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,W,H);
  if(MASC.sayUntil && now>MASC.sayUntil){ MASC.say.classList.remove("show"); MASC.sayUntil=0; }

  // expressão: com patches a cair levanta os braços para os apanhar
  const moving=running && !paused && (pac.px!==pac.x || pac.py!==pac.y);
  const catching = MASC.items.length>0 || (now-MASC.catchAt)<320;
  let key="open";
  if(now<MASC.sadUntil) key="sad";
  else if(now<MASC.cheerUntil) key="cheer";
  else if(catching) key="catch";
  else{
    const cyc=Math.floor(t/3300), ph=t%3300, isWink=(cyc%3===0);
    if(ph<(isWink?240:130)) key=isWink?"wink":"blink";
    else if(moving) key=(Math.floor(t/140)%2===0)?"walk1":"walk2";
  }

  // tamanho/posição: o robô ocupa o máximo possível (encostado ao fundo)
  const wide=MASC.wide;
  const d=wide?Math.min(W*0.5,H*0.95):Math.min(W*1.2,H*0.92), cx0=wide?d*0.6:W/2, x0=cx0-d/2, yBase=H-d-H*0.01;
  const rk=wide?0.66:Math.min(1,W*0.48/(d*0.70));   // o anel do escudo não sai do painel
  let dy=Math.sin(t/420)*d*0.005, dx=0, air=0;
  if(!REDUCE_MOTION){
    if(now<MASC.cheerUntil) air=Math.abs(Math.sin(t/170))*d*0.06;
    const hp=(now-MASC.hopAt)/260;
    if(hp>=0 && hp<1) air=Math.max(air, Math.sin(Math.PI*hp)*d*0.04);
    if(now<MASC.shakeUntil) dx=Math.sin(t/32)*d*0.018*((MASC.shakeUntil-now)/600);
  }
  dy-=air;
  const cx=cx0+dx, cyRing=yBase+dy+d*0.52, cyChest=yBase+dy+d*0.65;

  // sombra no chão
  g.fillStyle="rgba(0,0,0,0.35)";
  g.beginPath(); g.ellipse(cx, H-d*0.03, d*0.22*(1-air/d*3), d*0.035, 0, 0, Math.PI*2); g.fill();

  // escudo (Firewall): halo + arco com o tempo que falta
  if(power){
    const pulse=0.55+Math.sin(t*0.004)*0.45;
    const pct=Math.max(0,Math.min(1,(powerEnd-now)/POWER_TIME));
    g.save();
    g.fillStyle="rgba(68,136,255,"+(0.10+0.08*pulse)+")";
    g.beginPath(); g.arc(cx,cyRing,d*0.60*rk,0,Math.PI*2); g.fill();
    g.lineWidth=d*0.012; g.strokeStyle="rgba(136,204,255,"+(0.45+0.4*pulse)+")";
    g.beginPath(); g.arc(cx,cyRing,d*(0.62+0.02*pulse)*rk,0,Math.PI*2); g.stroke();
    g.lineCap="round"; g.lineWidth=d*0.024;
    g.strokeStyle = pct>0.5?"#2266ff":(pct>0.25?"#55aaff":"#ff4400");
    g.beginPath(); g.arc(cx,cyRing,d*0.68*rk,-Math.PI/2,-Math.PI/2+Math.PI*2*pct); g.stroke();
    g.restore();
  }

  // robô
  g.imageSmoothingEnabled=true; g.imageSmoothingQuality="high";
  g.drawImage(mascotTex(key), x0+dx, yBase+dy, d, d);

  // patches a cair, a rodar, e a serem apanhados (com faíscas)
  if(MASC.items.length && allAssetsLoaded()){
    const img=tinted("p",ASSETS.patch,patchHue()), ps=d*0.17;
    const yStart=Math.max(0, yBase-d*0.02);
    MASC.items=MASC.items.filter(it=>{
      const p=(t-it.t0)/it.dur;
      if(p>=1){
        MASC.hopAt=now; MASC.catchAt=now;
        for(let i=0;i<7;i++){ const a=Math.random()*Math.PI*2, v=0.04+Math.random()*0.07;
          MASC.sparks.push({x:cx, y:cyChest, vx:Math.cos(a)*v*d, vy:Math.sin(a)*v*d-0.03*d, t0:t, life:380+Math.random()*200, c:Math.random()<0.5?"#ffa733":"#ec1e79"}); }
        return false;
      }
      const e=p*p;
      const px=cx+it.x*d*(1-e), py=yStart+(cyChest-yStart)*e;
      const s=ps*(1-0.55*e);
      g.save(); g.translate(px,py); g.rotate(it.spin*p);
      g.drawImage(img,-s/2,-s/2,s,s); g.restore();
      return true;
    });
  }
  if(MASC.sparks.length){
    MASC.sparks=MASC.sparks.filter(s=>(t-s.t0)<s.life);
    for(const s of MASC.sparks){
      const a=(t-s.t0)/s.life, k=(t-s.t0)/16;
      g.globalAlpha=1-a; g.fillStyle=s.c;
      g.beginPath(); g.arc(s.x+s.vx*k, s.y+s.vy*k, d*0.012*(1-a*0.5)+1, 0, Math.PI*2); g.fill();
    }
    g.globalAlpha=1;
  }

  // contador de patches do nível (canto inferior esquerdo)
  if(running){
    const done=chipsEatenThisLevel, total=done+remainingPatches();
    const pulse=1+0.25*Math.max(0,1-(now-MASC.catchAt)/220);
    const dprK=W/MASC.w, fs=Math.round((wide?Math.max(H*0.15,11*dprK):d*0.05)*pulse);
    g.font="800 "+fs+"px 'Baloo 2','Nunito',sans-serif"; g.textBaseline="middle"; g.textAlign="left";
    const txt="🧩 "+done+"/"+total, tw=g.measureText(txt).width, ph=fs*1.5, pw=tw+fs*1.1;
    const bx=wide?d*1.12:W*0.03, by=wide?H-ph-H*0.04:H*0.02;
    g.fillStyle="rgba(15,5,37,0.78)"; g.strokeStyle="#ec1e79"; g.lineWidth=Math.max(1.5,d*0.007);
    g.beginPath(); g.roundRect ? g.roundRect(bx,by,pw,ph,ph/2) : g.rect(bx,by,pw,ph); g.fill(); g.stroke();
    g.fillStyle="#ffe9c4"; g.fillText(txt,bx+fs*0.55,by+ph/2+1);
  }
}

// ---------- arranque ----------
// ---------- mostrar o primeiro ecrã ----------
bootIntro();
// desenha um preview/loading
if(!map.length) buildMap();
(function warmup(){
  draw();
  drawMascot();
  requestAnimationFrame(warmup);
})();


/* ========= VITÓRIA (nível 10) ========= */
function showWin(){
  mascotEvent("win");
  running=false;
  paused=false;
  if(timer){ clearTimeout(timer); timer=null; }
  saveBest();
  const wm=$("winMsg"); if(wm) wm.textContent="Parabéns, "+(playerName||"Jogador")+"! Chegaste ao Nível 10 e protegeste o VanBerto's na Internet.";
  const el=document.getElementById("finalScoreWin");
  if(el) el.textContent=score;
  const ov=document.getElementById("overlayWin");
  if(ov) ov.classList.add("show");
}
document.addEventListener("DOMContentLoaded", ()=>{
  const bw=document.getElementById("btnRestartWin");
  if(bw) bw.addEventListener("click", ()=>{
    const ov=document.getElementById("overlayWin");
    if(ov) ov.classList.remove("show");
    $("btnRestart").click();
  });
});
// ---------- MISSÕES POR NÍVEL ----------
const MISSION_TEXTS = {
  1:"Começa devagar e apanha alguns pontos ⭐",
  2:"Evita o malware vermelho 🦠",
  3:"Apanha o escudo azul 🛡️",
  4:"Protege-te e come malware vulnerável",
  5:"Cuidado! Eles estão mais rápidos ⚡",
  6:"Aprende a reconhecer perigos online",
  7:"Mantém distância e planeia o caminho",
  8:"Recolhe quase todos os pontos",
  9:"Últimos desafios! Mantém a calma",
  10:"Missão final: protege o VanBerto's! 🚀"
};

function updateMission(){
  const el=document.getElementById("status");
  if(!el) return;
  el.textContent = "🎯 " + (MISSION_TEXTS[level] || "");
}



// ---------- MODO PROFESSOR ----------
let teacherTheme = "todos"; // todos | passwords | phishing | privacidade

function setTheme(t){
  teacherTheme=t;
  alert("Tema das perguntas: " + t);
}

const THEMES={passwords:["palavra-passe","2fa"],phishing:["phishing","link","prémio"],privacidade:["dados","publicar","https","partilh"]};
function filterQuestions(list){
  if(teacherTheme==="todos") return list;
  const keys=THEMES[teacherTheme]||[];
  return list.filter(q=>keys.some(k=>(q.q+" "+q.a.join(" ")).toLowerCase().includes(k)));
}

function toggleFullscreen(){
  const el = document.documentElement;
  if(!document.fullscreenElement){
    const r = el.requestFullscreen?.();
    // no telemóvel, em ecrã inteiro, põe na horizontal (o labirinto é largo)
    if(r && r.then) r.then(()=>{ try{ if(matchMedia("(pointer:coarse)").matches) screen.orientation?.lock?.("landscape")?.catch(()=>{}); }catch(e){} }).catch(()=>{});
  }else{
    try{ screen.orientation?.unlock?.(); }catch(e){}
    document.exitFullscreen?.();
  }
  setTimeout(onResize, 250);
}
document.addEventListener("fullscreenchange", ()=>setTimeout(onResize,250));

$("themeSel").addEventListener("change",e=>{ teacherTheme=e.target.value; toast("📚 Tema: "+e.target.selectedOptions[0].text,1400); });
document.addEventListener("visibilitychange",()=>{ if(document.hidden && running && !paused) $("pauseBtn").click(); });
$("best").textContent=bestLabel();

// ---------- INSTALAR (PWA) ----------
let deferredPrompt=null;
const installBtn=$("installBtn");
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
const isStandalone=matchMedia("(display-mode: standalone)").matches || navigator.standalone===true;
if(isIOS && !isStandalone) installBtn.hidden=false;
window.addEventListener("beforeinstallprompt",(e)=>{ e.preventDefault(); deferredPrompt=e; if(!isStandalone) installBtn.hidden=false; });
installBtn.addEventListener("click", async ()=>{
  if(deferredPrompt){
    deferredPrompt.prompt();
    try{ await deferredPrompt.userChoice; }catch(e){}
    deferredPrompt=null; installBtn.hidden=true;
  }else if(isIOS){
    setStatus("📲 No iPhone/iPad: toca em Partilhar (⬆️) e depois em “Adicionar ao ecrã principal”.");
    setTimeout(()=>setStatus(""),9000);
  }
});
window.addEventListener("appinstalled",()=>{ installBtn.hidden=true; deferredPrompt=null; setStatus("✅ Jogo instalado!"); setTimeout(()=>setStatus(""),4000); });
// ---------- TELEMÓVEL: menu ☰, ecrã sempre ligado ----------
(function(){
  const root=document.documentElement, sheet=$("menuSheet"), box=$("menuBox"), closeBtn=$("menuClose");
  const ids=["playerRow","btnEasy","resetBtn","helpBtn","fullscreenBtn","installBtn","themeLabel","themeSel"];
  const holders={};
  ids.forEach(id=>{ const el=$(id), ph=document.createComment(id); el.parentNode.insertBefore(ph,el); holders[id]=ph; });
  function place(){
    const phone=root.classList.contains("phone");
    ids.forEach(id=>{
      const el=$(id);
      if(phone){ if(el.parentNode!==box) box.insertBefore(el, closeBtn); }
      else if(el.parentNode===box){ holders[id].parentNode.insertBefore(el, holders[id]); }
    });
    if(!phone) document.body.classList.remove("menu-open");
    onResize();
  }
  let menuPaused=false;
  function openMenu(){
    if(running && !paused && !quizLocked){ $("pauseBtn").click(); menuPaused=true; } else menuPaused=false;
    document.body.classList.add("menu-open");
  }
  function closeMenu(resume){
    document.body.classList.remove("menu-open");
    if(resume && menuPaused && paused) $("pauseBtn").click();
    menuPaused=false;
  }
  $("menuBtn").addEventListener("click", openMenu);
  closeBtn.addEventListener("click", ()=>closeMenu(true));
  sheet.addEventListener("click", e=>{ if(e.target===sheet) closeMenu(true); });
  ["resetBtn","helpBtn","fullscreenBtn","btnEasy","installBtn"].forEach(id=>$(id).addEventListener("click", ()=>closeMenu(false)));
  const re=()=>{ place(); };
  window.addEventListener("resize", re);
  window.addEventListener("orientationchange", ()=>setTimeout(re,250));
  place();

  // ecrã sempre ligado enquanto se joga (o Android apaga o ecrã se não houver toques no painel)
  let wl=null;
  async function wakeOn(){ try{ if("wakeLock" in navigator && !wl){ wl=await navigator.wakeLock.request("screen"); wl.addEventListener("release",()=>{ wl=null; }); } }catch(e){} }
  window.addEventListener("pointerdown", wakeOn, {passive:true});
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) wakeOn(); });
})();
window.__vbReady=true;
