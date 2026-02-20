const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const levelLabel = document.getElementById("levelLabel");
const livesLabel = document.getElementById("livesLabel");
const restartBtn = document.getElementById("restartBtn");

const WORLD = {
  width: canvas.width,
  height: canvas.height,
  gravity: 0.5,
  friction: 0.85,
  maxLevels: 100,
};

const input = {
  left: false,
  right: false,
  jump: false,
};

const state = {
  level: 1,
  lives: 3,
  won: false,
};

const player = {
  x: 30,
  y: 0,
  w: 30,
  h: 42,
  vx: 0,
  vy: 0,
  speed: 0.9,
  jumpPower: 11,
  onGround: false,
};

let platforms = [];
let goal = null;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration = 0.12, type = "triangle", gain = 0.03) {
  const osc = audioCtx.createOscillator();
  const vol = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.value = gain;
  osc.connect(vol);
  vol.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playJumpSound() {
  playTone(560, 0.1, "square", 0.025);
  setTimeout(() => playTone(760, 0.08, "square", 0.02), 40);
}

function playCoinSound() {
  playTone(840, 0.07, "sine", 0.03);
  setTimeout(() => playTone(1100, 0.08, "sine", 0.03), 55);
}

function playHitSound() {
  playTone(190, 0.18, "sawtooth", 0.035);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function generateLevel(levelNum) {
  const floor = { x: 0, y: WORLD.height - 40, w: WORLD.width, h: 40 };
  const p = [floor];

  const count = 4 + Math.floor(levelNum / 4);
  const spacingY = (WORLD.height - 180) / count;

  for (let i = 0; i < count; i++) {
    const y = WORLD.height - 100 - i * spacingY;
    const width = clamp(140 - levelNum * 0.6, 70, 140);
    const wave = Math.sin((levelNum + i) * 1.7) * 0.5 + 0.5;
    const x = 12 + wave * (WORLD.width - width - 24);
    p.push({ x, y, w: width, h: 16 });
  }

  const goalPlatform = p[p.length - 1];
  const g = {
    x: goalPlatform.x + goalPlatform.w - 22,
    y: goalPlatform.y - 26,
    w: 18,
    h: 26,
  };

  return { platforms: p, goal: g };
}

function loadLevel(levelNum) {
  const generated = generateLevel(levelNum);
  platforms = generated.platforms;
  goal = generated.goal;

  player.x = 24;
  player.y = WORLD.height - 100;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;

  levelLabel.textContent = String(levelNum);
  livesLabel.textContent = String(state.lives);
}

function loseLife() {
  state.lives -= 1;
  livesLabel.textContent = String(state.lives);
  playHitSound();

  if (state.lives <= 0) {
    state.level = 1;
    state.lives = 3;
  }
  loadLevel(state.level);
}

function update() {
  if (state.won) return;

  if (input.left) player.vx -= player.speed;
  if (input.right) player.vx += player.speed;

  player.vx *= WORLD.friction;
  player.vy += WORLD.gravity;

  player.x += player.vx;
  player.y += player.vy;

  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
  }
  if (player.x + player.w > WORLD.width) {
    player.x = WORLD.width - player.w;
    player.vx = 0;
  }

  player.onGround = false;
  for (const platform of platforms) {
    const prevBottom = player.y + player.h - player.vy;
    const currBottom = player.y + player.h;
    const horizontalHit =
      player.x + player.w > platform.x && player.x < platform.x + platform.w;

    if (
      horizontalHit &&
      prevBottom <= platform.y &&
      currBottom >= platform.y &&
      player.vy >= 0
    ) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }

  if (input.jump && player.onGround) {
    player.vy = -player.jumpPower;
    player.onGround = false;
    playJumpSound();
  }

  if (player.y > WORLD.height + 100) {
    loseLife();
  }

  if (rectsOverlap(player, goal)) {
    playCoinSound();
    if (state.level >= WORLD.maxLevels) {
      state.won = true;
      return;
    }
    state.level += 1;
    loadLevel(state.level);
  }
}

function drawPlayer() {
  ctx.fillStyle = "#251f1b";
  ctx.fillRect(player.x + 8, player.y + 4, 14, 12);

  ctx.fillStyle = "#deb887";
  ctx.fillRect(player.x + 8, player.y + 16, 14, 12);

  ctx.fillStyle = "#2f5fed";
  ctx.fillRect(player.x + 4, player.y + 28, 22, 14);

  ctx.fillStyle = "#111";
  ctx.fillRect(player.x + 12, player.y + 20, 3, 3);
}

function draw() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(80, 90, 26, 0, Math.PI * 2);
  ctx.arc(122, 85, 30, 0, Math.PI * 2);
  ctx.arc(160, 93, 22, 0, Math.PI * 2);
  ctx.fill();

  for (const platform of platforms) {
    ctx.fillStyle = "#6f4a2b";
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = "#2ac16d";
    ctx.fillRect(platform.x, platform.y - 6, platform.w, 8);
  }

  ctx.fillStyle = "#ffd447";
  ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
  ctx.fillStyle = "#f53";
  ctx.fillRect(goal.x + 2, goal.y + 2, goal.w - 4, 6);

  drawPlayer();

  if (state.won) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("100 Levels Done!", WORLD.width / 2, WORLD.height / 2);
    ctx.font = "20px sans-serif";
    ctx.fillText("You beat the tower 🎉", WORLD.width / 2, WORLD.height / 2 + 40);
  }
}

function frame() {
  update();
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "a", "A"].includes(e.key)) input.left = true;
  if (["ArrowRight", "d", "D"].includes(e.key)) input.right = true;
  if (["ArrowUp", " ", "w", "W"].includes(e.key)) input.jump = true;
});

window.addEventListener("keyup", (e) => {
  if (["ArrowLeft", "a", "A"].includes(e.key)) input.left = false;
  if (["ArrowRight", "d", "D"].includes(e.key)) input.right = false;
  if (["ArrowUp", " ", "w", "W"].includes(e.key)) input.jump = false;
});

for (const btn of document.querySelectorAll(".controls button")) {
  const action = btn.dataset.action;
  btn.addEventListener("pointerdown", () => {
    input[action] = true;
  });
  btn.addEventListener("pointerup", () => {
    input[action] = false;
  });
  btn.addEventListener("pointerleave", () => {
    input[action] = false;
  });
}

restartBtn.addEventListener("click", () => {
  state.level = 1;
  state.lives = 3;
  state.won = false;
  loadLevel(state.level);
});

loadLevel(state.level);
frame();
