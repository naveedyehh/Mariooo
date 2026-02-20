const GAME_WIDTH = 720;
const GAME_HEIGHT = 1280;
const WORLD_WIDTH = 2600;

class MainScene extends Phaser.Scene {
  constructor() {
    super("main");
    this.player = null;
    this.platforms = null;
    this.coins = null;
    this.enemies = null;
    this.bgFar = null;
    this.bgMid = null;
    this.bgNear = null;

    this.score = 0;
    this.lives = 3;
    this.scoreText = null;
    this.livesText = null;

    this.cursors = null;
    this.keys = null;
    this.jumpPressed = false;
    this.touch = { left: false, right: false, jump: false };

    this.respawn = { x: 140, y: 980 };
    this.hudEl = null;
  }

  preload() {
    this.createTextures();
  }

  create() {
    this.hudEl = document.getElementById("hudText");

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.bgFar = this.add
      .tileSprite(0, 0, WORLD_WIDTH, GAME_HEIGHT, "bgFar")
      .setOrigin(0, 0)
      .setScrollFactor(0.15);

    this.bgMid = this.add
      .tileSprite(0, 0, WORLD_WIDTH, GAME_HEIGHT, "bgMid")
      .setOrigin(0, 0)
      .setScrollFactor(0.35);

    this.bgNear = this.add
      .tileSprite(0, 0, WORLD_WIDTH, GAME_HEIGHT, "bgNear")
      .setOrigin(0, 0)
      .setScrollFactor(0.6);

    this.platforms = this.physics.add.staticGroup();
    this.platforms
      .create(WORLD_WIDTH / 2, GAME_HEIGHT - 40, "ground")
      .setScale(14, 1)
      .refreshBody();

    const platformData = [
      [380, 1080], [620, 940], [880, 1040], [1120, 910], [1390, 1020],
      [1620, 890], [1900, 980], [2180, 900], [2440, 1010],
      [560, 780], [860, 700], [1200, 650], [1520, 730], [1850, 640], [2230, 700]
    ];

    platformData.forEach(([x, y]) => {
      this.platforms.create(x, y, "platform");
    });

    this.player = this.physics.add.sprite(this.respawn.x, this.respawn.y, "hero-idle-1");
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0.05);
    this.player.body.setSize(54, 84).setOffset(5, 6);

    this.physics.add.collider(this.player, this.platforms);

    this.createAnimations();
    this.player.play("idle");

    this.coins = this.physics.add.group({ allowGravity: false, immovable: true });
    for (let i = 0; i < 24; i += 1) {
      const x = 240 + i * 95;
      const y = 520 + (i % 6) * 90;
      const coin = this.coins.create(x, y, "coin");

      this.tweens.add({
        targets: coin,
        y: y - 12,
        duration: 600 + (i % 4) * 100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    this.enemies = this.physics.add.group();
    const enemySpawns = [760, 1260, 1730, 2060, 2360];
    enemySpawns.forEach((x, i) => {
      const enemy = this.enemies.create(x, GAME_HEIGHT - 96, "enemy");
      enemy.setCollideWorldBounds(true);
      enemy.setBounce(0.1);
      enemy.setVelocityX(i % 2 === 0 ? 90 : -90);
      enemy.body.setSize(58, 52).setOffset(3, 6);
    });

    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.enemies, this.enemies);

    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(100, 220);

    this.scoreText = this.add
      .text(16, 16, "Score: 0", {
        fontFamily: "Inter, sans-serif",
        fontSize: "34px",
        color: "#ffffff",
        stroke: "#0a1230",
        strokeThickness: 7,
      })
      .setScrollFactor(0);

    this.livesText = this.add
      .text(16, 62, "Lives: 3", {
        fontFamily: "Inter, sans-serif",
        fontSize: "30px",
        color: "#ffffff",
        stroke: "#0a1230",
        strokeThickness: 6,
      })
      .setScrollFactor(0);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("A,D,W,SPACE");

    this.createTouchControls();
    this.syncHud();
  }

  update() {
    const left = this.touch.left || this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.touch.right || this.cursors.right.isDown || this.keys.D.isDown;
    const jump =
      this.touch.jump || this.cursors.up.isDown || this.cursors.space.isDown || this.keys.W.isDown;

    this.enemies.children.iterate((enemy) => {
      if (!enemy) return;
      if (enemy.body.blocked.left) enemy.setVelocityX(90);
      if (enemy.body.blocked.right) enemy.setVelocityX(-90);
    });

    if (left) {
      this.player.setVelocityX(-280);
      this.player.setFlipX(true);
    } else if (right) {
      this.player.setVelocityX(280);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    if (jump && this.player.body.blocked.down && !this.jumpPressed) {
      this.player.setVelocityY(-620);
      this.jumpPressed = true;
    }
    if (!jump) this.jumpPressed = false;

    if (!this.player.body.blocked.down) {
      this.player.play("jump", true);
    } else if (Math.abs(this.player.body.velocity.x) > 25) {
      this.player.play("run", true);
    } else {
      this.player.play("idle", true);
    }

    this.bgFar.tilePositionX = this.cameras.main.scrollX * 0.08;
    this.bgMid.tilePositionX = this.cameras.main.scrollX * 0.18;
    this.bgNear.tilePositionX = this.cameras.main.scrollX * 0.3;

    if (this.player.y > GAME_HEIGHT + 100) {
      this.loseLife();
    }
  }

  collectCoin(_player, coin) {
    coin.disableBody(true, true);
    this.score += 10;
    this.scoreText.setText(`Score: ${this.score}`);
    this.syncHud();
  }

  hitEnemy(player, enemy) {
    if (player.body.velocity.y > 120 && player.y < enemy.y - 20) {
      enemy.disableBody(true, true);
      player.setVelocityY(-420);
      this.score += 25;
      this.scoreText.setText(`Score: ${this.score}`);
      this.syncHud();
      return;
    }

    this.loseLife();
  }

  loseLife() {
    this.lives -= 1;
    this.livesText.setText(`Lives: ${this.lives}`);
    this.syncHud();

    if (this.lives <= 0) {
      this.score = 0;
      this.lives = 3;
      this.scene.restart();
      return;
    }

    this.player.setPosition(this.respawn.x, this.respawn.y);
    this.player.setVelocity(0, 0);
  }

  createTouchControls() {
    const makeButton = (x, y, label) => {
      const circle = this.add
        .circle(x, y, 62, 0x2c4fa8, 0.62)
        .setScrollFactor(0)
        .setDepth(20)
        .setInteractive();

      this.add
        .text(x, y, label, {
          fontFamily: "Inter, sans-serif",
          fontSize: "34px",
          color: "#ffffff",
          fontStyle: "700",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(21);

      return circle;
    };

    const leftBtn = makeButton(85, 1180, "◀");
    const rightBtn = makeButton(225, 1180, "▶");
    const jumpBtn = makeButton(635, 1180, "⤒");

    this.bindTouchButton(leftBtn, "left");
    this.bindTouchButton(rightBtn, "right");
    this.bindTouchButton(jumpBtn, "jump");
  }

  bindTouchButton(button, action) {
    button.on("pointerdown", () => {
      this.touch[action] = true;
    });
    button.on("pointerup", () => {
      this.touch[action] = false;
    });
    button.on("pointerout", () => {
      this.touch[action] = false;
    });
    button.on("pointerupoutside", () => {
      this.touch[action] = false;
    });
  }

  syncHud() {
    if (this.hudEl) {
      this.hudEl.textContent = `Score: ${this.score} | Lives: ${this.lives}`;
    }
  }

  createAnimations() {
    this.anims.create({
      key: "idle",
      frames: [{ key: "hero-idle-1" }, { key: "hero-idle-2" }],
      frameRate: 4,
      repeat: -1,
    });

    this.anims.create({
      key: "run",
      frames: [
        { key: "hero-run-1" },
        { key: "hero-run-2" },
        { key: "hero-run-3" },
        { key: "hero-run-4" },
      ],
      frameRate: 12,
      repeat: -1,
    });

    this.anims.create({
      key: "jump",
      frames: [{ key: "hero-jump" }],
      frameRate: 1,
      repeat: -1,
    });
  }

  createTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const makeRectTexture = (key, w, h, bodyColor, faceColor = null) => {
      g.clear();
      g.fillStyle(bodyColor, 1);
      g.fillRoundedRect(0, 0, w, h, 12);
      if (faceColor !== null) {
        g.fillStyle(faceColor, 1);
        g.fillRoundedRect(8, 8, w - 16, Math.max(10, h * 0.35), 8);
      }
      g.generateTexture(key, w, h);
    };

    g.clear();
    g.fillStyle(0x6f462e, 1);
    g.fillRect(0, 0, 160, 28);
    g.fillStyle(0x4cc065, 1);
    g.fillRect(0, 0, 160, 8);
    g.generateTexture("platform", 160, 28);

    g.clear();
    g.fillStyle(0x5d402b, 1);
    g.fillRect(0, 0, 220, 40);
    g.fillStyle(0x45b45d, 1);
    g.fillRect(0, 0, 220, 10);
    g.generateTexture("ground", 220, 40);

    makeRectTexture("hero-idle-1", 64, 92, 0x2f62ff, 0xf0caa0);
    makeRectTexture("hero-idle-2", 64, 92, 0x3b6fff, 0xe8be90);
    makeRectTexture("hero-run-1", 64, 92, 0x3f7bff, 0xf0caa0);
    makeRectTexture("hero-run-2", 64, 92, 0x2a5cff, 0xf0caa0);
    makeRectTexture("hero-run-3", 64, 92, 0x3668ff, 0xeebf8a);
    makeRectTexture("hero-run-4", 64, 92, 0x2d60ff, 0xf0caa0);
    makeRectTexture("hero-jump", 64, 92, 0x4a83ff, 0xf3d2ad);

    g.clear();
    g.fillStyle(0xffe066, 1);
    g.fillCircle(18, 18, 16);
    g.lineStyle(4, 0xf8be35, 1);
    g.strokeCircle(18, 18, 16);
    g.generateTexture("coin", 36, 36);

    makeRectTexture("enemy", 64, 58, 0xa03440, 0xf2c6c8);

    g.clear();
    g.fillStyle(0x8fd8ff, 1);
    g.fillRect(0, 0, 256, 256);
    g.fillStyle(0xc9edff, 1);
    g.fillCircle(60, 56, 24);
    g.fillCircle(95, 58, 26);
    g.fillCircle(130, 60, 22);
    g.generateTexture("bgFar", 256, 256);

    g.clear();
    g.fillStyle(0x60b7ff, 1);
    g.fillRect(0, 0, 256, 256);
    g.fillStyle(0x87d2ff, 1);
    g.fillTriangle(0, 210, 70, 120, 140, 210);
    g.fillTriangle(120, 210, 190, 115, 256, 210);
    g.generateTexture("bgMid", 256, 256);

    g.clear();
    g.fillStyle(0x4a9cff, 1);
    g.fillRect(0, 0, 256, 256);
    g.fillStyle(0x3e8cf0, 1);
    g.fillRect(0, 190, 256, 66);
    g.generateTexture("bgNear", 256, 256);

    g.destroy();
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-shell",
  backgroundColor: "#6bc4ff",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1200 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MainScene],
};

new Phaser.Game(config);
        
