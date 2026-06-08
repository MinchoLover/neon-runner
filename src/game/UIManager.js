export class UIManager {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = `
      <canvas class="game-canvas"></canvas>
      <div class="hud hud-left">
        <div class="brand">
          <span>NEON</span>
          <strong>TUNNEL RUNNER</strong>
        </div>
        <div class="hud-block">
          <label>SCORE</label>
          <output data-ui="score">0</output>
        </div>
        <div class="hud-block">
          <label>COMBO</label>
          <output class="combo" data-ui="combo">X 0</output>
        </div>
        <div class="hud-block" data-ui="shieldBlock">
          <label>SHIELD</label>
          <div class="shield-row" data-ui="shield"></div>
        </div>
        <div class="hud-block compact">
          <label>BEST</label>
          <output data-ui="best">0</output>
        </div>
      </div>
      <div class="hud hud-right">
        <div class="hud-block">
          <label>SPEED</label>
          <output data-ui="speed">0</output>
          <small>KM/H</small>
        </div>
        <div class="hud-block">
          <label>DISTANCE</label>
          <output data-ui="distance">0</output>
          <small>M</small>
        </div>
        <div class="hud-block compact">
          <label>BOOST</label>
          <output data-ui="boost">READY</output>
        </div>
        <div class="hud-block mission-block">
          <label>MISSIONS</label>
          <div class="mission-list" data-ui="missions"></div>
        </div>
      </div>
      <div class="hyper-banner" data-ui="hyper">HYPER MODE</div>
      <div class="zone-label" data-ui="zoneLabel">ZONE: CYBER PINK</div>
      <div class="turn-prompt" data-ui="turnPrompt">RIFT TURN</div>
      <div class="near-miss" data-ui="nearMiss">NEAR MISS</div>
      <div class="mission-toast" data-ui="missionToast">MISSION COMPLETE</div>
      <div class="control-hint">
        <span><kbd>A</kbd><b>LEFT</b></span>
        <span><kbd>D</kbd><b>RIGHT</b></span>
        <span><kbd>SPACE</kbd><b>BOOST</b></span>
      </div>
      <div class="center-panel" data-ui="panel">
        <h1>NEON TUNNEL RUNNER</h1>
        <p>PRESS <kbd>SPACE</kbd> TO START</p>
      </div>
      <div class="hit-flash" data-ui="hitFlash"></div>
    `;

    this.canvas = root.querySelector('canvas');
    this.score = root.querySelector('[data-ui="score"]');
    this.combo = root.querySelector('[data-ui="combo"]');
    this.speed = root.querySelector('[data-ui="speed"]');
    this.distance = root.querySelector('[data-ui="distance"]');
    this.best = root.querySelector('[data-ui="best"]');
    this.boost = root.querySelector('[data-ui="boost"]');
    this.shield = root.querySelector('[data-ui="shield"]');
    this.shieldBlock = root.querySelector('[data-ui="shieldBlock"]');
    this.panel = root.querySelector('[data-ui="panel"]');
    this.hitFlash = root.querySelector('[data-ui="hitFlash"]');
    this.hyper = root.querySelector('[data-ui="hyper"]');
    this.zoneLabel = root.querySelector('[data-ui="zoneLabel"]');
    this.turnPrompt = root.querySelector('[data-ui="turnPrompt"]');
    this.nearMiss = root.querySelector('[data-ui="nearMiss"]');
    this.missions = root.querySelector('[data-ui="missions"]');
    this.missionToast = root.querySelector('[data-ui="missionToast"]');
    this.shieldFlashTimer = null;
    this.hitFlashTimer = null;
  }

  flashShield() {
    if (!this.shieldBlock) return;
    window.clearTimeout(this.shieldFlashTimer);
    this.shieldBlock.classList.remove('damage-flash');
    void this.shieldBlock.offsetWidth;
    this.shieldBlock.classList.add('damage-flash');
    this.shieldFlashTimer = window.setTimeout(() => {
      this.shieldBlock.classList.remove('damage-flash');
    }, 320);
  }

  flashHit() {
    if (!this.hitFlash) return;
    window.clearTimeout(this.hitFlashTimer);
    this.hitFlash.classList.remove('active');
    void this.hitFlash.offsetWidth;
    this.hitFlash.classList.add('active');
    this.hitFlashTimer = window.setTimeout(() => {
      this.hitFlash.classList.remove('active');
    }, 220);
  }

  showNearMiss() {
    if (!this.nearMiss) return;
    this.nearMiss.classList.remove('active');
    void this.nearMiss.offsetWidth;
    this.nearMiss.classList.add('active');
  }

  showMissionComplete(label, reward = 0, tier = 'easy') {
    if (!this.missionToast) return;
    this.missionToast.textContent = `MISSION COMPLETE [${tier.toUpperCase()}]: ${label} +${reward}`;
    this.missionToast.classList.remove('active', 'failed');
    void this.missionToast.offsetWidth;
    this.missionToast.classList.add('active');
  }

  showMissionFailed(label) {
    if (!this.missionToast) return;
    this.missionToast.textContent = `MISSION FAILED: ${label}`;
    this.missionToast.classList.remove('active', 'failed');
    void this.missionToast.offsetWidth;
    this.missionToast.classList.add('active', 'failed');
  }

  setMissionFocus(visual = {}) {
    this.root.dataset.missionElite = visual.eliteActive ? 'true' : 'false';
    this.root.dataset.missionUrgent = visual.urgent ? 'true' : 'false';
  }

  showZone(name, prefix = 'ENTERING') {
    if (!this.zoneLabel) return;
    this.zoneLabel.textContent = `${prefix}: ${name}`;
    this.zoneLabel.classList.remove('active', 'warning');
    void this.zoneLabel.offsetWidth;
    this.zoneLabel.classList.add('active');
  }

  showTurnPrompt(direction) {
    if (!this.turnPrompt) return;
    this.turnPrompt.textContent = direction < 0 ? '< TURN LEFT' : 'TURN RIGHT >';
    this.turnPrompt.dataset.direction = direction < 0 ? 'left' : 'right';
    this.turnPrompt.classList.remove('active');
    void this.turnPrompt.offsetWidth;
    this.turnPrompt.classList.add('active');
  }

  showTurnResult(label, warning = false) {
    if (!this.zoneLabel) return;
    this.zoneLabel.textContent = label;
    this.zoneLabel.classList.remove('active', 'warning');
    void this.zoneLabel.offsetWidth;
    this.zoneLabel.classList.add('active');
    if (warning) this.zoneLabel.classList.add('warning');
  }

  setCountdown(value) {
    this.panel.innerHTML = `
      <h1 class="countdown-text">${value}</h1>
      <p>GET READY</p>
    `;
  }

  update(stats) {
    this.score.value = Math.floor(stats.score).toLocaleString('en-US');
    this.combo.value = `X ${stats.combo}`;
    this.speed.value = Math.floor(stats.speed * 7.2).toLocaleString('en-US');
    this.distance.value = Math.floor(stats.distance).toLocaleString('en-US');
    this.best.value = this._readBestScore().toLocaleString('en-US');
    this.boost.value = stats.boostReady ? 'READY' : `${Math.ceil(stats.boostCooldown * 10) / 10}s`;
    this.hyper.classList.toggle('active', Boolean(stats.hyperActive));
    this.root.dataset.hyper = stats.hyperActive ? 'true' : 'false';
    this._renderMissions(stats.missions || []);
    this.shield.innerHTML = '';
    for (let i = 0; i < stats.maxShield; i += 1) {
      const item = document.createElement('i');
      item.className = i < stats.shield ? 'active' : '';
      this.shield.appendChild(item);
    }
  }

  setState(state, stats) {
    this.root.dataset.state = state;
    if (state === 'ready') {
      this.panel.innerHTML = `
        <h1>NEON TUNNEL RUNNER</h1>
        <p><kbd>A</kbd> / <kbd>D</kbd> OR ARROWS : MOVE</p>
        <p><kbd>SPACE</kbd> : START / BOOST</p>
        <p>AVOID OBSTACLES. BUILD COMBO. ENTER HYPER MODE.</p>
      `;
    }
    if (state === 'playing') {
      this.panel.innerHTML = '';
    }
    if (state === 'paused') {
      this.panel.innerHTML = `
        <h1>PAUSED</h1>
        <p>PRESS <kbd>P</kbd> OR <kbd>ESC</kbd> TO RESUME</p>
      `;
    }
    if (state === 'countdown') {
      this.setCountdown('3');
    }
    if (state === 'gameover') {
      const score = Math.floor(stats.score);
      const distance = Math.floor(stats.distance);
      const previousBest = this._readBestScore();
      const newBest = score > previousBest;
      const bestScore = newBest ? score : previousBest;
      if (newBest) this._writeBestScore(score);
      const rank = this._rankFor(score);
      const nextRank = this._nextRankFor(score);
      const rankClass = rank === 'S' || rank === 'S+' ? 'elite' : '';
      const completedMissions = stats.completedMissions ?? (stats.missions || []).filter((mission) => mission.complete).length;
      this.panel.innerHTML = `
        <h1>GAME OVER</h1>
        ${newBest ? '<p class="new-best">NEW BEST!</p>' : ''}
        <div class="result-grid">
          <span>FINAL SCORE</span><strong>${score.toLocaleString('en-US')}</strong>
          <span>DISTANCE</span><strong>${distance.toLocaleString('en-US')}M</strong>
          <span>BEST SCORE</span><strong>${bestScore.toLocaleString('en-US')}</strong>
          <span>RANK</span><strong class="rank ${rankClass}">${rank}</strong>
          <span>MAX COMBO</span><strong>X ${stats.maxCombo}</strong>
          <span>NEAR MISS</span><strong>${stats.nearMisses}</strong>
          <span>HYPER</span><strong>${stats.hyperCount}</strong>
          <span>MISSIONS</span><strong>${completedMissions} DONE</strong>
        </div>
        ${nextRank ? `<p class="next-rank">${nextRank.remaining.toLocaleString('en-US')} POINTS TO RANK ${nextRank.rank}</p>` : '<p class="next-rank">MAX RANK REACHED</p>'}
        <p>PRESS <kbd>SPACE</kbd> TO RESTART</p>
      `;
    }
  }

  _renderMissions(missions) {
    if (!this.missions) return;
    this.missions.innerHTML = missions
      .map((mission) => {
        const progress = mission.target > 0 ? Math.max(0, Math.min(100, Math.round((mission.value / mission.target) * 100))) : 0;
        const timeText = mission.timeLeft != null ? `<em>${Math.ceil(mission.timeLeft)}s</em>` : '';
        const statusText = mission.failed ? 'FAILED' : mission.complete ? 'DONE' : `+${mission.reward}`;
        const timeLimitUrgent = mission.timeLimit && mission.timeLeft <= Math.min(6, mission.timeLimit * 0.35);
        const statusClass = `${mission.failed ? 'failed' : mission.complete ? 'complete' : mission.tier} ${timeLimitUrgent ? 'urgent' : ''}`;
        return `
          <div class="mission-item ${statusClass}" data-tier="${mission.tier}">
            <span>
              <b>${mission.tier}</b>
              ${mission.label}
            </span>
            <strong>${mission.value} / ${mission.target}</strong>
            <small>${statusText}${timeText}</small>
            <i style="--progress: ${progress}%"></i>
          </div>
        `;
      })
      .join('');
  }

  _rankFor(score) {
    if (score >= 26000) return 'S+';
    if (score >= 18000) return 'S';
    if (score >= 11000) return 'A';
    if (score >= 5000) return 'B';
    return 'C';
  }

  _nextRankFor(score) {
    const ranks = [
      { rank: 'B', score: 5000 },
      { rank: 'A', score: 11000 },
      { rank: 'S', score: 18000 },
      { rank: 'S+', score: 26000 },
    ];
    const next = ranks.find((rank) => score < rank.score);
    if (!next) return null;
    return {
      rank: next.rank,
      remaining: next.score - score,
    };
  }

  _readBestScore() {
    try {
      return Number.parseInt(window.localStorage.getItem('neonTunnelRunner.bestScore') || '0', 10);
    } catch {
      return 0;
    }
  }

  _writeBestScore(score) {
    try {
      window.localStorage.setItem('neonTunnelRunner.bestScore', String(score));
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }
}
