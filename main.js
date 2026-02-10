// ================== ASSETS ==================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled=false;

const ASSETS = {
  robot: new Image(),
  malware: new Image(),
  patch: new Image(),
  shield: new Image(),
  wall: new Image(),
};

ASSETS.robot.src = "assets/robot_sheet.png";
ASSETS.malware.src = "assets/malware_sheet.png";
ASSETS.patch.src = "assets/patch.png";
ASSETS.shield.src = "assets/shield.png";
ASSETS.wall.src = "assets/wall.png";

function allAssetsLoaded(){
  return Object.values(ASSETS).every(img => img.complete && img.naturalWidth > 0);
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
const TILE=32, COLS=28, ROWS=20;

function resizeCanvasToScreen(){
  // resolução lógica do jogo
  const logicalW = COLS*TILE;
  const logicalH = ROWS*TILE;
  canvas.width = logicalW;
  canvas.height = logicalH;

  // espaço disponível (tira cabeçalho/padding e painel)
  const panel = document.getElementById("panel");
  const wrap = document.getElementById("wrap");
  const gap = 16;

  const wrapRect = wrap.getBoundingClientRect();
  const panelW = (window.innerWidth > 900) ? (panel ? panel.getBoundingClientRect().width : 0) : 0;

  const availW = Math.max(240, window.innerWidth - panelW - gap*3);
  const availH = Math.max(240, window.innerHeight - 160);

  const scale = Math.min(availW / logicalW, availH / logicalH);
  canvas.style.width = Math.floor(logicalW * scale) + "px";
  canvas.style.height = Math.floor(logicalH * scale) + "px";
}
window.addEventListener("resize", resizeCanvasToScreen);

resizeCanvasToScreen();
// canvas em pixel-art maior
canvas.width = COLS*TILE;
canvas.height = ROWS*TILE;

const POWER_TIME=7000;
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
"1111111111111111111111111111",
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
  $("score").textContent=score;
  $("level").textContent=level;
  $("lives").textContent="❤️".repeat(Math.max(0,lives));
}
function showStart(show){ $("overlayStart").classList.toggle("show", !!show); }
function showOver(show){ $("overlayGameOver").classList.toggle("show", !!show); }



// ---------- PERGUNTAS (progressivas por nível) ----------
const QUESTION_BANK = {
  1: [
    { q: "O que é Internet?", a: ["Uma rede que liga computadores", "Um jogo de tabuleiro", "Uma impressora"], correct: 0 },
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

function pickQuestionForLevel(lv){
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
  if(t.includes("phishing")) return "Dica: mensagens com urgência e links estranhos podem ser armadilhas.";
  if(t.includes("palavra-passe")) return "Dica: usa uma palavra-passe longa e diferente para cada conta.";
  if(t.includes("firewall")) return "Dica: a firewall ajuda a bloquear ligações suspeitas.";
  if(t.includes("https")) return "Dica: em sites sem https evita colocar dados pessoais.";
  if(t.includes("atualizar")) return "Dica: atualizações fecham falhas de segurança.";
  return "Dica: pensa antes de clicar e pede ajuda se não tiveres a certeza.";
}

function showQuestionOverlay(qObj, onCorrect){
  quizLocked=true;
  paused=true;

  const overlay = $("overlayQuestion");
  $("qText").textContent = qObj.q;
  $("qFeedback").textContent = "";

  const box = $("qOptions");
  box.innerHTML = "";

  qObj.a.forEach((txt, i)=>{
    const b=document.createElement("button");
    b.className="optBtn";
    b.textContent = txt;
    b.addEventListener("click", ()=>{
      if(quizLocked===false) return;
      const ok = i===qObj.correct;
      $("qFeedback").textContent = ok ? "✅ Certo! Boa!" : `❌ Quase… tenta outra vez. 💡 ${hintFor(qObj.q)}`;
      if(ok){
        b.classList.add("good");
        quizLocked=false;
        setTimeout(()=>{
          overlay.classList.remove("show");
          showFactOverlay(pickFact(level), ()=>{
            paused=false;
            onCorrect();
            loop();
          });
        }, 450);
      }else{
        b.classList.add("bad");
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
    ghosts.push({x:s.x,y:s.y,px:s.x,py:s.y,dir:{x:1,y:0}});
  }
  $("ghostsN").textContent=n;

  stepMs = (easyMode ? 225 : 175) - (level-1)*10;  // velocidade progressiva (Modo Fácil mais lento)
  const speedFactor = easyMode ? 1.40 : 1.00;
  stepMs = Math.max(110, Math.round(BASE_STEP_MS*speedFactor - (level-1)*8));
// firewall aparece mais cedo em níveis altos
  firewallSpawnAt = Date.now() + Math.max(2500, 6500 - (level-1)*600);
  setStatus(keepScore ? "" : "🚀 Nível " + level);
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
    map[my][mx]=0; score+=10; sPatch();
    chipsEatenThisLevel++;
    if(!bonusOnMap && chipsEatenThisLevel>0 && chipsEatenThisLevel%45===0) spawnBonus();
  }
  if(map[my][mx]===4){
    map[my][mx]=0; bonusOnMap=false;
    score += BONUS_POINTS;
    toast(`⭐ +${BONUS_POINTS}`, 900);
    spawnParticles(mx*TILE+TILE/2, my*TILE+TILE/2, 14);
    sCoin();
  }
  if(map[my][mx]===5){
    map[my][mx]=0; heartOnMap=false;
    if(lives<MAX_LIVES) lives++;
    score += HEART_POINTS;
    toast(`❤️ +1 vida`, 900);
    spawnParticles(mx*TILE+TILE/2, my*TILE+TILE/2, 16);
    sCoin();
  }
  if(map[my][mx]===3){
    map[my][mx]=0; firewallOnMap=false;
    power=true; powerEnd=Date.now()+POWER_TIME;
    $("powerBar").style.width="100%";
    setStatus("🛡️ Firewall ativada!");
    toast("🛡️ Proteção ativada!");
    scareUntil = Date.now() + 1400;
    powerFlashUntil = Date.now() + 900;
    sPower();
  }
}

function moveGhost(g){
  g.px=g.x; g.py=g.y;
  const dirs=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  let best=null, bestScore=power ? -Infinity : Infinity;

  for(const d of dirs){
    const nx=g.x+d.x, ny=g.y+d.y;
    if(isWall(nx,ny)) continue;
    // evita ir logo para trás se possível
    if(d.x===-g.dir.x && d.y===-g.dir.y) continue;

    const dist=Math.abs(nx-pac.x)+Math.abs(ny-pac.y);
    if(power ? dist>bestScore : dist<bestScore){
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
    g.dir={x:1,y:0};
  });
}

function collide(){
  for(const g of ghosts){
    const same=(g.x===pac.x && g.y===pac.y);
    const crossed=(g.x===pac.px && g.y===pac.py && g.px===pac.x && g.py===pac.y);

    if(same || crossed){
      if(power){
        score+=200; sEat();
        // respawn malware no centro
        g.x=13; g.y=9; g.dir={x:1,y:0};
      }else{
        lives--; sHurt(); clampHUD();
        if(lives<=0){
          endGame();
          return;
        }
        resetAfterHit();
        return;
      }
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
  ctx.drawImage(sheet, sx, 0, size, size, x*TILE+(TILE-size)/2, y*TILE+(TILE-size)/2, size, size);
}

function drawShieldRing(cx, cy, t){
  // ring a piscar (pixel-ish)
  ctx.save();
  ctx.globalAlpha = powerBlink ? 0.45 : 0.8;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(cx, cy, 14 + (Math.sin(t/180)*0.8), 0, Math.PI*2);
  ctx.stroke();
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

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
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
      if(map[y][x]===1) drawTile(ASSETS.wall, x, y);
      else if(map[y][x]===2) {
        const ps=Math.round(TILE*0.62);
        const po=(TILE-ps)/2;
        ctx.drawImage(ASSETS.patch, x*TILE+po, y*TILE+po, ps, ps);
        } else if(map[y][x]===3){
        // 🛡️ Firewall (emoji)
        const cx = x*TILE + TILE/2;
        const cy = y*TILE + TILE/2;
        const pulse = 1 + 0.08*Math.sin((Date.now()/180)+(x+y));

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(pulse, pulse);
        ctx.font = "26px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🛡️", 0, 1);
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
  drawSprite(ASSETS.robot, frame, pac.x, pac.y, 32);

  // brilho curto quando ativa proteção
  const now = Date.now();
  if(now < powerFlashUntil){
    const a = (powerFlashUntil - now) / 900;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.35*a;
    ctx.fillStyle = "#93c5fd";
    ctx.beginPath();
    ctx.arc(pac.x*TILE+TILE/2, pac.y*TILE+TILE/2, 22, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // mensagem rápida por cima do VanBerto
  if(toastText && now < toastUntil){
    ctx.save();
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    // caixinha
    const tx = pac.x*TILE + TILE/2;
    const ty = pac.y*TILE - 4;
    const padX = 10;
    const metrics = ctx.measureText(toastText);
    const w = metrics.width + padX*2;
    const h = 22;
    ctx.fillStyle = "rgba(2,6,23,0.75)";
    roundRect(ctx, tx - w/2, ty - h, w, h, 8, true, false);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText(toastText, tx, ty - 4);
    ctx.restore();
  }

  if(power){
    const cx=pac.x*TILE+TILE/2, cy=pac.y*TILE+TILE/2;
    drawShieldRing(cx, cy, t);
  }

  // malware
  const mFrame = Math.floor(t/150) % 4;
  for(const g of ghosts){
    // fundo para destacar o malware (fica sempre visível no labirinto)
    const mx = g.x*TILE + TILE/2;
    const my = g.y*TILE + TILE/2;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = power ? "#93c5fd" : "#ff1f1f";
    ctx.beginPath();
    ctx.arc(mx, my, 14, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    drawSprite(ASSETS.malware, mFrame, g.x, g.y, 32);

    
    if(power){
      // olhos "assustados" (sem mudar cor do corpo)
      const cx = g.x*TILE + TILE/2;
      const cy = g.y*TILE + TILE/2 - 2;
      ctx.save();
      ctx.globalAlpha = powerBlink ? 0.65 : 0.95;

      // olhos brancos
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(cx-6, cy-2, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6, cy-2, 4, 0, Math.PI*2); ctx.fill();

      // pupilas em X
      ctx.strokeStyle = "#0b1020";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx-8, cy-4); ctx.lineTo(cx-4, cy);
      ctx.moveTo(cx-4, cy-4); ctx.lineTo(cx-8, cy);
      ctx.moveTo(cx+4, cy-4); ctx.lineTo(cx+8, cy);
      ctx.moveTo(cx+8, cy-4); ctx.lineTo(cx+4, cy);
      ctx.stroke();

      ctx.restore();
    }if(power){
      // malware vulnerável → branco só no interior (sutil, mantendo olhos/contorno)
      const cx = g.x*TILE + TILE/2;
      const cy = g.y*TILE + TILE/2;

      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = powerBlink ? 0.45 : 0.70;
      ctx.fillStyle = "#ffffff";

      ctx.beginPath();
      ctx.arc(cx, cy, 5.6, 0, Math.PI*2);
      ctx.fill();

      ctx.restore();
    }

    if(Date.now() < scareUntil){
      ctx.save();
      ctx.font = "900 16px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const ex = g.x*TILE + TILE/2;
      const ey = g.y*TILE + 4;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(ex, ey, 10, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.restore();
    }

    if(power){
      // malware "assustado": tinge azul (mais visível)
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = powerBlink ? 0.55 : 0.75;
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(g.x*TILE, g.y*TILE, TILE, TILE);
      ctx.restore();
    }
  }
  drawParticles();
}

// ---------- LOOP ----------
function loop(){
  if(!running || paused) return;

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
  movePac();
  ghosts.forEach(g=>{
    if(power && (tick%2===0)) return; // mais lento em modo proteção
    moveGhost(g);
  });
  collide();

  // subir nível
  if(remainingPatches()===0){
    level++;
    setStatus("🚀 Nível " + level + " — pergunta de segurança!");
    sLevel();

    // pausa e pergunta antes de continuar
    const qObj = pickQuestion(level);
    showQuestionOverlay(qObj, ()=>{
      setupLevel(true);
      setStatus("🚀 Nível " + level + " — malware mais rápido!");
    });
  }

  draw();
  clampHUD();

  timer=setTimeout(loop, stepMs);
}

// ---------- START / GAME OVER ----------
function endGame(){
  running=false; paused=false;
  if(timer){ clearTimeout(timer); timer=null; }
  sOver();
  $("finalScore").textContent = score;
  $("finalLevel").textContent = level;
  showOver(true);
}

function hardReset(){
  score=0; level=1;
  lives = easyMode ? 5 : 3;
  clampHUD();
  setupLevel(false);
}

// ---------- CONTROLOS: teclado ----------
window.addEventListener("keydown", (e)=>{
  // desbloqueia audio no primeiro input
  ctxEnsure();

  if(!running) return;
  if(e.key==="ArrowLeft") setDir(-1,0);
  if(e.key==="ArrowRight") setDir(1,0);
  if(e.key==="ArrowUp") setDir(0,-1);
  if(e.key==="ArrowDown") setDir(0,1);
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
  btn.addEventListener("pointerdown", (e)=>{ e.preventDefault(); ctxEnsure(); apply(); }, {passive:false});
});

// ---------- UI buttons ----------
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
  paused=!paused;
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
  setStartFact();
showStart(true);
  setStatus("");
});

// ---------- arranque ----------
// ---------- "Sabias que" no início ----------
const START_FACTS = [
  {topic: "Onde nasceu a Internet", text: "A Internet começou nos EUA, no final dos anos 60, com uma rede chamada ARPANET."},
  {topic: "Phishing", text: "Phishing é quando alguém tenta enganar-te para roubar dados, por exemplo com links ou mensagens falsas."},
  {topic: "Palavras-passe", text: "Usa palavras-passe longas e diferentes para cada conta. Um gestor de palavras-passe pode ajudar."},
  {topic: "Atualizações", text: "Atualizar o sistema e as apps ajuda a fechar falhas de segurança."},
  {topic: "Dados pessoais", text: "Não partilhes morada, escola, número ou fotos privadas com desconhecidos."},
];

function setStartFact(){
  const f = START_FACTS[Math.floor(Math.random()*START_FACTS.length)];
  const t = document.getElementById("startFactTopic");
  const b = document.getElementById("startFactText");
  if(t) t.textContent = f.topic;
  if(b) b.textContent = f.text;
}

setStartFact();
showStart(true);
// desenha um preview/loading
(function warmup(){
  draw();
  requestAnimationFrame(warmup);
})();


/* ========= VITÓRIA (nível 10) ========= */
function showWin(){
  running=false;
  paused=false;
  if(gameTimer){ clearTimeout(gameTimer); gameTimer=null; }
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
    startGame();
  });
});
// ---------- MISSÕES POR NÍVEL ----------
const MISSION_TEXTS = {
  1:"Começa devagar e apanha alguns pontos ⭐",
  2:"Evita o malware vermelho 🦠",
  3:"Apanha a firewall verde 🛡️",
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

function filterQuestions(list){
  if(teacherTheme==="todos") return list;
  return list.filter(q=> (q.q||"").toLowerCase().includes(teacherTheme));
}

function toggleFullscreen(){
  const el = document.documentElement;
  if(!document.fullscreenElement){
    el.requestFullscreen?.();
  }else{
    document.exitFullscreen?.();
  }
  setTimeout(resizeCanvasToScreen, 250);
}
document.addEventListener("fullscreenchange", ()=>setTimeout(resizeCanvasToScreen,250));
