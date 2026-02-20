 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/game.js b/game.js
new file mode 100644
index 0000000000000000000000000000000000000000..9992de0dab8cfed78186de7ef2ce934698f37303
--- /dev/null
+++ b/game.js
@@ -0,0 +1,644 @@
+const canvas = document.getElementById("gameCanvas");
+const ctx = canvas.getContext("2d");
+
+const ui = {
+  world: document.getElementById("worldLabel"),
+  level: document.getElementById("levelLabel"),
+  lives: document.getElementById("livesLabel"),
+  coins: document.getElementById("coinsLabel"),
+  score: document.getElementById("scoreLabel"),
+  timer: document.getElementById("timerLabel"),
+  mode: document.getElementById("modeLabel"),
+  leaderboard: document.getElementById("leaderboardList"),
+  restartBtn: document.getElementById("restartBtn"),
+};
+
+const GAME = {
+  width: canvas.width,
+  height: canvas.height,
+  gravity: 0.52,
+  friction: 0.84,
+  maxFPSDelta: 1 / 20,
+  levelsPerWorld: 16,
+  worldCount: 8,
+};
+
+const WORLD_THEMES = [
+  { name: "Green Hills", sky: ["#8ce7ff", "#4da0ff"], ground: "#3b8d4c" },
+  { name: "Desert Ruins", sky: ["#ffd58a", "#d48f3f"], ground: "#a77c46" },
+  { name: "Ice Mountains", sky: ["#b4f1ff", "#74bbff"], ground: "#9bd6ff" },
+  { name: "Jungle", sky: ["#8de2a4", "#328a55"], ground: "#2f7148" },
+  { name: "Underground Caves", sky: ["#5f5f72", "#1f1f29"], ground: "#6c5a4d" },
+  { name: "Lava World", sky: ["#ff9a66", "#a4291a"], ground: "#8b2d21" },
+  { name: "Sky Floating Islands", sky: ["#d8f1ff", "#80beff"], ground: "#5ca07a" },
+  { name: "Dark Castle", sky: ["#626285", "#121225"], ground: "#50435e" },
+];
+
+const ENEMY_TYPES = [
+  "Walker", "Bat", "Spiky", "Slime", "FirePlant", "NightGhost", "Lancer", "Mole",
+  "Crawler", "Wisp", "Golem", "Sentinel", "Orbiter", "Spider", "Bomber", "Ninja",
+  "Knight", "Turret", "Shade", "Rogue"
+];
+
+const input = { left: false, right: false, jump: false, attack: false, slide: false };
+const POWER = ["Normal", "Giant", "Fire"]; 
+
+const state = {
+  level: 1,
+  unlocked: 1,
+  world: 1,
+  score: 0,
+  coins: 0,
+  combo: 0,
+  lives: 3,
+  totalTime: 0,
+  levelTime: 0,
+  speedrunStart: performance.now(),
+  mode: 0,
+  bossPhase: 0,
+  ended: false,
+};
+
+const player = {
+  x: 36,
+  y: 0,
+  w: 28,
+  h: 42,
+  vx: 0,
+  vy: 0,
+  speed: 1.1,
+  jumpPower: 11.3,
+  onGround: false,
+  jumpsLeft: 2,
+  facing: 1,
+  hp: 4,
+  anim: "idle",
+  slideTimer: 0,
+  attackCd: 0,
+  checkpoint: null,
+};
+
+let levelData = null;
+let lastTs = performance.now();
+let audioCtx;
+
+function ensureAudio() {
+  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
+}
+
+function sfx(freq, duration = 0.1, wave = "triangle", gain = 0.025) {
+  if (!audioCtx) return;
+  const o = audioCtx.createOscillator();
+  const g = audioCtx.createGain();
+  o.type = wave;
+  o.frequency.value = freq;
+  g.gain.value = gain;
+  o.connect(g);
+  g.connect(audioCtx.destination);
+  o.start();
+  o.stop(audioCtx.currentTime + duration);
+}
+
+function playWorldMusic() {
+  if (!audioCtx) return;
+  const base = 180 + state.world * 25;
+  sfx(base, 0.2, "sine", 0.015);
+  setTimeout(() => sfx(base * 1.26, 0.22, "square", 0.012), 130);
+}
+
+function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
+function overlap(a, b) {
+  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
+}
+
+function levelToWorld(level) {
+  return Math.min(GAME.worldCount, Math.ceil(level / GAME.levelsPerWorld));
+}
+
+function createLevel(levelNum) {
+  const world = levelToWorld(levelNum);
+  const theme = WORLD_THEMES[world - 1];
+  const height = 2200 + world * 120;
+  const difficulty = 1 + levelNum * 0.06;
+  const solids = [{ x: 0, y: height - 38, w: GAME.width, h: 40, moving: false }];
+  const hazards = [];
+  const coins = [];
+  const enemies = [];
+  const portals = [];
+  const hiddenRooms = [];
+  const checkpoints = [];
+
+  for (let i = 0; i < 24 + world * 2; i++) {
+    const w = clamp(130 - levelNum * 0.35 + (i % 3) * 16, 66, 140);
+    const y = height - 130 - i * (64 - Math.min(28, levelNum * 0.1));
+    const x = 16 + ((Math.sin(i * 1.2 + levelNum) + 1) / 2) * (GAME.width - w - 32);
+    const moving = i % 5 === 0;
+    solids.push({ x, y, w, h: 14, moving, baseX: x, amp: 34 + world * 4, speed: 0.5 + i * 0.02 });
+
+    if (i % 4 === 0) hazards.push({ type: "spike", x: x + 8, y: y - 10, w: 20, h: 10 });
+    if (i % 6 === 0 && world >= 3) hazards.push({ type: "lava", x: x + 12, y: y + 14, w: Math.min(44, w - 20), h: 8 });
+    if (i % 3 === 0) coins.push({ x: x + w * 0.5 - 6, y: y - 18, w: 12, h: 12, rare: i % 9 === 0, taken: false });
+
+    if (i % 5 === 2) {
+      const et = ENEMY_TYPES[(i + world + levelNum) % ENEMY_TYPES.length];
+      enemies.push({
+        kind: et,
+        x: x + w * 0.4,
+        y: y - 20,
+        w: 20,
+        h: 20,
+        vx: (i % 2 ? 1 : -1) * (0.7 + difficulty * 0.08),
+        vy: 0,
+        hp: 1 + Math.floor(levelNum / 18),
+        t: 0,
+        dead: false,
+      });
+    }
+
+    if (i === 10 || i === 19) checkpoints.push({ x: x + 4, y: y - 32, w: 12, h: 32, active: false });
+  }
+
+  if (levelNum % 7 === 0) {
+    hiddenRooms.push({ x: 24, y: height - 500, w: 110, h: 70, open: false });
+    portals.push({ x: 32, y: height - 170, w: 24, h: 36, targetY: height - 520 });
+  }
+
+  const isBoss = levelNum % 10 === 0;
+  if (isBoss) {
+    enemies.push({ kind: "MainBoss", x: GAME.width / 2 - 35, y: 180, w: 70, h: 70, vx: 1.2, vy: 0, hp: 14 + world * 3, t: 0, dead: false, boss: true });
+  }
+
+  const goal = { x: GAME.width - 44, y: 96, w: 22, h: 30 };
+  return { world, theme, levelNum, height, solids, hazards, coins, enemies, portals, hiddenRooms, checkpoints, goal, isBoss };
+}
+
+function saveProgress() {
+  localStorage.setItem("neoTowerSave", JSON.stringify({
+    level: state.level,
+    unlocked: state.unlocked,
+    lives: state.lives,
+    score: state.score,
+    coins: state.coins,
+    mode: state.mode,
+    speedrunStart: state.speedrunStart,
+  }));
+}
+
+function loadProgress() {
+  try {
+    const raw = localStorage.getItem("neoTowerSave");
+    if (!raw) return;
+    const data = JSON.parse(raw);
+    state.level = clamp(data.level || 1, 1, GAME.worldCount * GAME.levelsPerWorld);
+    state.unlocked = clamp(data.unlocked || 1, 1, GAME.worldCount * GAME.levelsPerWorld);
+    state.lives = data.lives || 3;
+    state.score = data.score || 0;
+    state.coins = data.coins || 0;
+    state.mode = clamp(data.mode || 0, 0, 2);
+    state.speedrunStart = data.speedrunStart || performance.now();
+  } catch (_) {
+    // ignore malformed save
+  }
+}
+
+function loadLeaderboard() {
+  const raw = localStorage.getItem("neoTowerBoard");
+  const list = raw ? JSON.parse(raw) : [];
+  ui.leaderboard.innerHTML = "";
+  for (const item of list.slice(0, 5)) {
+    const li = document.createElement("li");
+    li.textContent = `${item.name}: ${item.time.toFixed(1)}s`;
+    ui.leaderboard.appendChild(li);
+  }
+}
+
+function updateLeaderboard() {
+  const run = (performance.now() - state.speedrunStart) / 1000;
+  const raw = localStorage.getItem("neoTowerBoard");
+  const list = raw ? JSON.parse(raw) : [];
+  list.push({ name: "Hero", time: run });
+  list.sort((a, b) => a.time - b.time);
+  localStorage.setItem("neoTowerBoard", JSON.stringify(list.slice(0, 10)));
+  loadLeaderboard();
+}
+
+function resetPlayer(spawnFromCheckpoint = false) {
+  const spawnY = levelData.height - 120;
+  player.x = spawnFromCheckpoint && player.checkpoint ? player.checkpoint.x : 24;
+  player.y = spawnFromCheckpoint && player.checkpoint ? player.checkpoint.y : spawnY;
+  player.vx = 0;
+  player.vy = 0;
+  player.jumpsLeft = 2;
+}
+
+function startLevel(level) {
+  state.level = level;
+  state.world = levelToWorld(level);
+  state.levelTime = 0;
+  state.bossPhase = 0;
+  levelData = createLevel(level);
+  player.mode = POWER[state.mode];
+  player.w = state.mode === 1 ? 38 : 28;
+  player.h = state.mode === 1 ? 52 : 42;
+  player.checkpoint = null;
+  resetPlayer(false);
+  playWorldMusic();
+  saveProgress();
+}
+
+function loseLife() {
+  state.lives -= 1;
+  sfx(170, 0.2, "sawtooth", 0.035);
+  if (state.lives <= 0) {
+    state.level = 1;
+    state.lives = 3;
+    state.score = 0;
+    state.coins = 0;
+    state.mode = 0;
+    state.speedrunStart = performance.now();
+  }
+  startLevel(state.level);
+}
+
+function awardCoins(amount, comboBonus = true) {
+  state.coins += amount;
+  if (comboBonus) state.combo += 1;
+  if (state.combo >= 4) {
+    state.score += 25 * state.combo;
+    state.combo = 0;
+  }
+  if (state.coins >= 100) {
+    state.coins -= 100;
+    state.lives += 1;
+    sfx(980, 0.18, "square", 0.03);
+  }
+}
+
+function spawnProjectile() {
+  if (player.attackCd > 0) return;
+  player.attackCd = 0.25;
+  if (state.mode === 2) {
+    levelData.enemies.push({ kind: "PlayerFire", x: player.x + player.w / 2, y: player.y + 8, w: 10, h: 6, vx: player.facing * 5.2, vy: 0, hp: 1, t: 0, dead: false, friendly: true });
+    sfx(720, 0.08, "square", 0.022);
+  } else {
+    sfx(420, 0.04, "triangle", 0.018);
+  }
+}
+
+function handleInput() {
+  const accel = player.slideTimer > 0 ? 0.5 : player.speed;
+  if (input.left) {
+    player.vx -= accel;
+    player.facing = -1;
+  }
+  if (input.right) {
+    player.vx += accel;
+    player.facing = 1;
+  }
+  if (input.slide && player.onGround && Math.abs(player.vx) > 1.2 && player.slideTimer <= 0) {
+    player.slideTimer = 0.28;
+    sfx(240, 0.05, "sawtooth", 0.015);
+  }
+  if (input.jump && player.jumpsLeft > 0 && !player.jumpLock) {
+    player.vy = -player.jumpPower;
+    player.jumpsLeft -= 1;
+    player.jumpLock = true;
+    sfx(560, 0.09, "square", 0.024);
+  }
+  if (!input.jump) player.jumpLock = false;
+  if (input.attack) spawnProjectile();
+}
+
+function updateEnemies(dt) {
+  for (const e of levelData.enemies) {
+    if (e.dead) continue;
+    e.t += dt;
+    if (e.friendly) {
+      e.x += e.vx;
+      if (e.x < -30 || e.x > GAME.width + 30) e.dead = true;
+      continue;
+    }
+
+    if (e.boss) {
+      e.x += e.vx;
+      if (e.x < 20 || e.x + e.w > GAME.width - 20) e.vx *= -1;
+      if (e.hp < 10) state.bossPhase = 1;
+      if (e.hp < 5) state.bossPhase = 2;
+      if (state.bossPhase >= 1 && Math.random() < 0.015) {
+        levelData.hazards.push({ type: "fireball", x: e.x + e.w / 2, y: e.y + e.h, w: 10, h: 14, vy: 2.5 + state.bossPhase });
+      }
+    } else if (e.kind.includes("Bat") || e.kind.includes("Ghost") || e.kind.includes("Wisp")) {
+      e.x += e.vx;
+      e.y += Math.sin(e.t * 3) * 0.7;
+    } else if (e.kind.includes("Slime") || e.kind.includes("Spider")) {
+      e.x += e.vx;
+      if (Math.random() < 0.01) e.vy = -5.5;
+      e.vy += GAME.gravity * 0.4;
+      e.y += e.vy;
+      if (e.y > levelData.height - 58) {
+        e.y = levelData.height - 58;
+        e.vy = 0;
+      }
+    } else {
+      e.x += e.vx;
+    }
+
+    if (e.x < 12 || e.x + e.w > GAME.width - 12) e.vx *= -1;
+    if (overlap(player, e)) {
+      if (player.vy > 1.5 && !e.boss) {
+        e.dead = true;
+        player.vy = -6;
+        state.score += 60;
+        sfx(820, 0.08, "triangle", 0.022);
+      } else {
+        loseLife();
+        return;
+      }
+    }
+  }
+
+  for (const p of levelData.enemies.filter((x) => x.friendly && !x.dead)) {
+    for (const e of levelData.enemies.filter((x) => !x.friendly && !x.dead)) {
+      if (overlap(p, e)) {
+        e.hp -= 1;
+        p.dead = true;
+        if (e.hp <= 0) {
+          e.dead = true;
+          state.score += e.boss ? 900 : 120;
+          sfx(920, 0.11, "square", 0.024);
+        }
+      }
+    }
+  }
+  levelData.enemies = levelData.enemies.filter((e) => !e.dead);
+}
+
+function update(dt) {
+  if (state.ended) return;
+
+  state.levelTime += dt;
+  state.totalTime += dt;
+  player.attackCd = Math.max(0, player.attackCd - dt);
+  player.slideTimer = Math.max(0, player.slideTimer - dt);
+
+  handleInput();
+
+  player.vx *= GAME.friction;
+  player.vy += GAME.gravity;
+  player.x += player.vx;
+  player.y += player.vy;
+
+  player.x = clamp(player.x, 0, GAME.width - player.w);
+
+  player.onGround = false;
+  for (const s of levelData.solids) {
+    if (s.moving) s.x = s.baseX + Math.sin(state.totalTime * s.speed) * s.amp;
+    const prevBottom = player.y + player.h - player.vy;
+    const currBottom = player.y + player.h;
+    if (player.x + player.w > s.x && player.x < s.x + s.w && prevBottom <= s.y && currBottom >= s.y && player.vy >= 0) {
+      player.y = s.y - player.h;
+      player.vy = 0;
+      player.onGround = true;
+      player.jumpsLeft = 2;
+    }
+  }
+
+  for (const hz of levelData.hazards) {
+    if (hz.type === "fireball") {
+      hz.y += hz.vy;
+      if (hz.y > levelData.height + 100) hz.dead = true;
+    }
+    if (overlap(player, hz)) {
+      loseLife();
+      return;
+    }
+  }
+  levelData.hazards = levelData.hazards.filter((h) => !h.dead);
+
+  for (const c of levelData.coins) {
+    if (!c.taken && overlap(player, c)) {
+      c.taken = true;
+      awardCoins(c.rare ? 10 : 1, true);
+      state.score += c.rare ? 150 : 15;
+      sfx(c.rare ? 1180 : 920, 0.08, "sine", 0.02);
+    }
+  }
+
+  for (const p of levelData.portals) {
+    if (overlap(player, p)) {
+      player.y = p.targetY;
+      sfx(640, 0.13, "triangle", 0.02);
+    }
+  }
+
+  for (const cp of levelData.checkpoints) {
+    if (overlap(player, cp)) {
+      cp.active = true;
+      player.checkpoint = { x: cp.x, y: cp.y - 40 };
+      state.score += 40;
+    }
+  }
+
+  updateEnemies(dt);
+
+  if (player.y > levelData.height + 120) {
+    if (player.checkpoint) {
+      resetPlayer(true);
+      loseLife();
+      return;
+    }
+    loseLife();
+    return;
+  }
+
+  if (overlap(player, levelData.goal)) {
+    if (levelData.isBoss && levelData.enemies.some((e) => e.boss)) return;
+
+    state.score += 250 + Math.max(0, 90 - Math.floor(state.levelTime * 2));
+    state.unlocked = Math.max(state.unlocked, state.level + 1);
+
+    if (state.level >= GAME.levelsPerWorld * GAME.worldCount) {
+      state.ended = true;
+      updateLeaderboard();
+      sfx(1040, 0.22, "square", 0.03);
+      return;
+    }
+
+    if (state.level % 5 === 0) state.mode = (state.mode + 1) % 3;
+    startLevel(state.level + 1);
+  }
+}
+
+function drawBackground(cameraY) {
+  const grd = ctx.createLinearGradient(0, 0, 0, GAME.height);
+  grd.addColorStop(0, levelData.theme.sky[0]);
+  grd.addColorStop(1, levelData.theme.sky[1]);
+  ctx.fillStyle = grd;
+  ctx.fillRect(0, 0, GAME.width, GAME.height);
+
+  for (let i = 0; i < 5; i++) {
+    const py = ((i * 160 + state.totalTime * 10) % (GAME.height + 120)) - 60;
+    ctx.fillStyle = "rgba(255,255,255,0.18)";
+    ctx.beginPath();
+    ctx.arc(70 + i * 70, py, 24, 0, Math.PI * 2);
+    ctx.fill();
+  }
+
+  ctx.fillStyle = "rgba(0,0,0,0.18)";
+  ctx.fillRect(0, GAME.height - 34, GAME.width, 34);
+}
+
+function drawEntityBox(e, cameraY, color) {
+  ctx.fillStyle = color;
+  ctx.fillRect(e.x, e.y - cameraY, e.w, e.h);
+}
+
+function drawPlayer(cameraY) {
+  const modeColor = ["#325cff", "#48b067", "#ff813a"][state.mode];
+  const bodyY = player.y - cameraY;
+  player.anim = player.onGround ? (Math.abs(player.vx) > 0.6 ? "run" : "idle") : (player.vy < 0 ? "jump" : "fall");
+
+  drawEntityBox({ x: player.x, y: player.y, w: player.w, h: player.h }, cameraY, modeColor);
+  ctx.fillStyle = "#f4d1aa";
+  ctx.fillRect(player.x + 8, bodyY + 8, player.w - 14, 12);
+  ctx.fillStyle = "#141419";
+  ctx.fillRect(player.x + (player.facing > 0 ? player.w - 10 : 4), bodyY + 13, 3, 3);
+  if (player.slideTimer > 0) {
+    ctx.fillStyle = "rgba(255,255,255,0.55)";
+    ctx.fillRect(player.x - 4, bodyY + player.h - 8, player.w + 8, 4);
+  }
+}
+
+function drawWorld(cameraY) {
+  for (const s of levelData.solids) drawEntityBox(s, cameraY, levelData.theme.ground);
+  for (const hz of levelData.hazards) drawEntityBox(hz, cameraY, hz.type === "spike" ? "#dce7ff" : hz.type === "lava" ? "#ff5b32" : "#ffb22a");
+
+  for (const c of levelData.coins) {
+    if (c.taken) continue;
+    ctx.fillStyle = c.rare ? "#ffdf47" : "#ffe78c";
+    ctx.fillRect(c.x, c.y - cameraY, c.w, c.h);
+  }
+
+  for (const p of levelData.portals) drawEntityBox(p, cameraY, "#8f64ff");
+  for (const cp of levelData.checkpoints) drawEntityBox(cp, cameraY, cp.active ? "#4dffae" : "#6aa2ff");
+
+  for (const hr of levelData.hiddenRooms) {
+    if (Math.abs(player.x - hr.x) < 80 && Math.abs(player.y - hr.y) < 100) hr.open = true;
+    if (hr.open) drawEntityBox(hr, cameraY, "#d7cdb5");
+  }
+
+  for (const e of levelData.enemies) {
+    const color = e.boss ? "#a20f3a" : e.friendly ? "#ffb655" : "#2a2430";
+    drawEntityBox(e, cameraY, color);
+    if (e.boss) {
+      ctx.fillStyle = "#fff";
+      ctx.fillRect(12, 12, 180, 10);
+      ctx.fillStyle = "#ff4d7e";
+      const maxHp = 14 + levelData.world * 3;
+      ctx.fillRect(12, 12, (e.hp / maxHp) * 180, 10);
+    }
+  }
+
+  drawEntityBox(levelData.goal, cameraY, "#ffd54f");
+}
+
+function drawEnding() {
+  ctx.fillStyle = "rgba(0,0,0,0.72)";
+  ctx.fillRect(0, 0, GAME.width, GAME.height);
+  ctx.fillStyle = "#fff";
+  ctx.font = "bold 30px sans-serif";
+  ctx.textAlign = "center";
+  ctx.fillText("Cinematic Ending", GAME.width / 2, 190);
+  ctx.font = "18px sans-serif";
+  ctx.fillText("The Dark Castle has fallen.", GAME.width / 2, 230);
+  ctx.fillText("Credits: Design, Code, Hero - You", GAME.width / 2, 270);
+  ctx.fillText("Thanks for playing NeoTower Quest!", GAME.width / 2, 300);
+}
+
+function render() {
+  const cameraY = clamp(player.y - GAME.height * 0.55, 0, Math.max(0, levelData.height - GAME.height));
+  drawBackground(cameraY);
+  drawWorld(cameraY);
+  drawPlayer(cameraY);
+
+  if (state.ended) drawEnding();
+}
+
+function syncHUD() {
+  ui.world.textContent = `${state.world} - ${WORLD_THEMES[state.world - 1].name}`;
+  ui.level.textContent = `${state.level}/${GAME.worldCount * GAME.levelsPerWorld}`;
+  ui.lives.textContent = String(state.lives);
+  ui.coins.textContent = String(state.coins);
+  ui.score.textContent = String(state.score);
+  ui.timer.textContent = `${((performance.now() - state.speedrunStart) / 1000).toFixed(1)}s`;
+  ui.mode.textContent = `${POWER[state.mode]} (${player.anim})`;
+}
+
+function tick(ts) {
+  const dt = Math.min(GAME.maxFPSDelta, (ts - lastTs) / 1000);
+  lastTs = ts;
+  update(dt);
+  render();
+  syncHUD();
+  requestAnimationFrame(tick);
+}
+
+function bindControls() {
+  window.addEventListener("keydown", (e) => {
+    ensureAudio();
+    if (["ArrowLeft", "a", "A"].includes(e.key)) input.left = true;
+    if (["ArrowRight", "d", "D"].includes(e.key)) input.right = true;
+    if (["ArrowUp", "w", "W", " "].includes(e.key)) input.jump = true;
+    if (["ArrowDown", "s", "S"].includes(e.key)) input.slide = true;
+    if (["x", "X", "k", "K"].includes(e.key)) input.attack = true;
+  });
+
+  window.addEventListener("keyup", (e) => {
+    if (["ArrowLeft", "a", "A"].includes(e.key)) input.left = false;
+    if (["ArrowRight", "d", "D"].includes(e.key)) input.right = false;
+    if (["ArrowUp", "w", "W", " "].includes(e.key)) input.jump = false;
+    if (["ArrowDown", "s", "S"].includes(e.key)) input.slide = false;
+    if (["x", "X", "k", "K"].includes(e.key)) input.attack = false;
+  });
+
+  for (const btn of document.querySelectorAll(".controls button")) {
+    const action = btn.dataset.action;
+    const press = () => {
+      ensureAudio();
+      btn.classList.add("active");
+      if (action === "attack") input.attack = true;
+      if (action === "jump") input.jump = true;
+      if (action === "left") input.left = true;
+      if (action === "right") input.right = true;
+    };
+    const release = () => {
+      btn.classList.remove("active");
+      if (action === "attack") input.attack = false;
+      if (action === "jump") input.jump = false;
+      if (action === "left") input.left = false;
+      if (action === "right") input.right = false;
+    };
+    btn.addEventListener("pointerdown", press);
+    btn.addEventListener("pointerup", release);
+    btn.addEventListener("pointerleave", release);
+    btn.addEventListener("pointercancel", release);
+  }
+
+  ui.restartBtn.addEventListener("click", () => {
+    state.level = 1;
+    state.unlocked = 1;
+    state.lives = 3;
+    state.coins = 0;
+    state.score = 0;
+    state.mode = 0;
+    state.ended = false;
+    state.speedrunStart = performance.now();
+    startLevel(1);
+  });
+}
+
+loadProgress();
+loadLeaderboard();
+bindControls();
+startLevel(state.level);
+requestAnimationFrame(tick);
 
EOF
)
