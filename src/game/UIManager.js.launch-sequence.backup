export class UIManager {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = `
      <canvas class="game-canvas"></canvas>
      <div class="hud hud-left">
        <div class="brand">
          <div><span>SOLAR</span><strong>RUNNER</strong></div>
          <small>OVERDRIVE PROTOCOL</small>
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
        <div class="hud-block compact auxiliary-block">
          <label>BEST</label>
          <output data-ui="best">0</output>
        </div>
      </div>
      <div class="mobile-summary" data-ui="mobileSummary">
        <div class="mobile-summary-brand">
          <span>SOLAR RUNNER</span>
          <small>OVERDRIVE</small>
        </div>
        <div class="mobile-summary-grid">
          <div class="mobile-summary-chip">
            <label>SCORE</label>
            <strong data-ui="mobileScore">0</strong>
          </div>
          <div class="mobile-summary-chip">
            <label>SPEED</label>
            <strong data-ui="mobileSpeed">0</strong>
          </div>
          <div class="mobile-summary-chip">
            <label>BOOST</label>
            <strong data-ui="mobileBoost">READY</strong>
          </div>
          <div class="mobile-summary-chip">
            <label>SHIELD</label>
            <strong data-ui="mobileShield">0</strong>
          </div>
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
        <div class="hud-block hyper-charge-block solar-charge-panel" data-ui="hyperChargeBlock">
          <label>SOLAR CHARGE</label>
          <div class="solar-charge-dial" data-ui="hyperChargeTrack">
            <i class="solar-charge-progress" data-ui="hyperChargeFill"></i>
            <span class="solar-emblem" aria-hidden="true"></span>
            <strong data-ui="hyperChargeValue">0%</strong>
          </div>
        </div>
        <div class="surge-status" data-ui="surgeStatus">
          <span>SOLAR SURGE</span>
          <strong>CHARGING</strong>
        </div>
        <div class="telemetry-row">
          <div class="hud-block compact flow-block">
            <label>SECTOR</label>
            <output data-ui="wave">ALPHA</output>
              <small data-ui="cores">CORES 0</small>
          </div>
          <div class="hud-block compact">
            <label>BOOST</label>
            <output data-ui="boost">READY</output>
          </div>
        </div>
        <div class="hud-block mission-block">
          <label>MISSIONS</label>
          <div class="mission-list" data-ui="missions"></div>
        </div>
      </div>
      <div class="hyper-banner" data-ui="hyper">SOLAR SURGE</div>
      <div class="zone-label" data-ui="zoneLabel">ZONE: SOLAR Alpha</div>
      <div class="near-miss" data-ui="nearMiss">NEAR MISS</div>
      <div class="surge-break" data-ui="surgeBreak">SOLAR BREAK</div>
      <div class="mission-toast" data-ui="missionToast">MISSION COMPLETE</div>
      <div class="control-hint">
        <span><kbd>A</kbd><b>LEFT</b></span>
        <span><kbd>D</kbd><b>RIGHT</b></span>
        <span><kbd>SPACE</kbd><b>BOOST / SURGE</b></span>
      </div>
      <div class="mobile-controls" data-ui="mobileControls">
        <button type="button" data-action="left" aria-label="Move left">&#9664;</button>
        <button type="button" class="mobile-boost" data-action="primary" aria-label="Start or boost">START</button>
        <button type="button" data-action="right" aria-label="Move right">&#9654;</button>
      </div>
      <div class="center-panel" data-ui="panel">
        <p class="start-prompt">PRESS <kbd>SPACE</kbd> TO IGNITE</p>
      </div>
      <div class="hit-flash" data-ui="hitFlash"></div>
    `;

    this.canvas = root.querySelector('canvas');
    this.score = root.querySelector('[data-ui="score"]');
    this.combo = root.querySelector('[data-ui="combo"]');
    this.hyperChargeBlock = root.querySelector('[data-ui="hyperChargeBlock"]');
    this.hyperChargeTrack = root.querySelector('[data-ui="hyperChargeTrack"]');
    this.hyperChargeFill = root.querySelector('[data-ui="hyperChargeFill"]');
    this.hyperChargeValue = root.querySelector('[data-ui="hyperChargeValue"]');
    this.surgeStatus = root.querySelector('[data-ui="surgeStatus"]');
    this.surgeStatusValue = this.surgeStatus?.querySelector('strong');
    this.speed = root.querySelector('[data-ui="speed"]');
    this.distance = root.querySelector('[data-ui="distance"]');
    this.wave = root.querySelector('[data-ui="wave"]');
    this.cores = root.querySelector('[data-ui="cores"]');
    this.best = root.querySelector('[data-ui="best"]');
    this.mobileSummary = root.querySelector('[data-ui="mobileSummary"]');
    this.mobileScore = root.querySelector('[data-ui="mobileScore"]');
    this.mobileSpeed = root.querySelector('[data-ui="mobileSpeed"]');
    this.mobileBoost = root.querySelector('[data-ui="mobileBoost"]');
    this.mobileShield = root.querySelector('[data-ui="mobileShield"]');
    this.boost = root.querySelector('[data-ui="boost"]');
    this.shield = root.querySelector('[data-ui="shield"]');
    this.shieldBlock = root.querySelector('[data-ui="shieldBlock"]');
    this.panel = root.querySelector('[data-ui="panel"]');
    this.hitFlash = root.querySelector('[data-ui="hitFlash"]');
    this.hyper = root.querySelector('[data-ui="hyper"]');
    this.zoneLabel = root.querySelector('[data-ui="zoneLabel"]');
    this.nearMiss = root.querySelector('[data-ui="nearMiss"]');
    this.surgeBreak = root.querySelector('[data-ui="surgeBreak"]');
    this.missions = root.querySelector('[data-ui="missions"]');
    this.missionToast = root.querySelector('[data-ui="missionToast"]');
    this.mobileControls = root.querySelector('[data-ui="mobileControls"]');
    this.mobilePrimary = root.querySelector('[data-action="primary"]');
    this.shieldFlashTimer = null;
    this.hitFlashTimer = null;
    this.solarCoreFlashTimer = null;
    this.displayCache = new Map();
    this.missionRenderKey = '';
    this.shieldRenderKey = '';
    this.isCompactMode = false;
    this.bestScore = this._readBestScore();
  }

  setCompactMode(active) {
    const next = Boolean(active);
    if (this.isCompactMode === next) return;
    this.isCompactMode = next;
    this.root.dataset.compact = next ? 'true' : 'false';
    this.missionRenderKey = '';
    this.missions?.replaceChildren();
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
    this.hitFlash.classList.remove('active', 'gameover-flash');
    void this.hitFlash.offsetWidth;
    this.hitFlash.classList.add('active');
    this.hitFlashTimer = window.setTimeout(() => {
      this.hitFlash.classList.remove('active');
    }, 220);
  }

  flashGameOver() {
    if (!this.hitFlash) return;
    window.clearTimeout(this.hitFlashTimer);
    this.hitFlash.classList.remove('active', 'gameover-flash');
    void this.hitFlash.offsetWidth;
    this.hitFlash.classList.add('active', 'gameover-flash');
    this.hitFlashTimer = window.setTimeout(() => {
      this.hitFlash.classList.remove('active', 'gameover-flash');
    }, 500);
  }

  showNearMiss(chain = 1, hyperGain = 0) {
    if (!this.nearMiss) return;
    const chainLabel = chain > 1 ? ` X${chain}` : '';
    const chargeLabel = hyperGain > 0 ? ` +${hyperGain} SOLAR` : '';
    this.nearMiss.textContent = `NEAR MISS${chainLabel}${chargeLabel}`;
    this.nearMiss.dataset.chain = String(Math.min(chain, 4));
    this.nearMiss.classList.remove('active');
    void this.nearMiss.offsetWidth;
    this.nearMiss.classList.add('active');
  }

  showSolarCore(scoreGain, chargeGain, riskLevel = 'safe', surgeReady = false, surgeActive = false) {
    const prefix = riskLevel === 'lateDodge' ? 'LATE DODGE CORE' : riskLevel === 'risk' ? 'RISK CORE' : 'SOLAR CORE';
    const chargeText = surgeActive ? 'SURGE BONUS' : surgeReady ? 'SURGE READY' : `+${chargeGain} CHARGE`;
    this.showStatus(`${prefix} +${scoreGain} | ${chargeText}`);
    if (!this.hyperChargeBlock) return;
    window.clearTimeout(this.solarCoreFlashTimer);
    this.hyperChargeBlock.classList.remove('core-pickup');
    void this.hyperChargeBlock.offsetWidth;
    this.hyperChargeBlock.classList.add('core-pickup');
    this.solarCoreFlashTimer = window.setTimeout(() => {
      this.hyperChargeBlock.classList.remove('core-pickup');
    }, 520);
  }

  showSurgeBreak(chain = 1, scoreGain = 0) {
    if (!this.surgeBreak) return;
    const chainLabel = chain > 1 ? ` X${chain}` : '';
    this.surgeBreak.textContent = `SOLAR BREAK${chainLabel} +${scoreGain}`;
    this.surgeBreak.dataset.chain = String(Math.min(chain, 6));
    this.surgeBreak.classList.remove('active');
    void this.surgeBreak.offsetWidth;
    this.surgeBreak.classList.add('active');
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
    this._setDataset('missionElite', visual.eliteActive);
    this._setDataset('missionUrgent', visual.urgent);
    this._setDataset('missionNear', visual.focus?.near);
    this._setDataset('missionNoBoost', visual.focus?.noBoost);
    this._setDataset('missionHyper', visual.focus?.hyper);
  }

  showZone(name, prefix = 'ENTERING') {
    if (!this.zoneLabel) return;
    this.zoneLabel.textContent = `${prefix}: ${name}`;
    this.zoneLabel.classList.remove('active', 'warning');
    void this.zoneLabel.offsetWidth;
    this.zoneLabel.classList.add('active');
  }

  showStatus(label, warning = false) {
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
    this._setOutput('score', this.score, Math.floor(stats.score).toLocaleString('en-US'));
    this._setOutput('combo', this.combo, `X ${stats.combo}`);
    this._setOutput('speed', this.speed, Math.floor(stats.speed * 7.2).toLocaleString('en-US'));
    this._setOutput('distance', this.distance, Math.floor(stats.distance).toLocaleString('en-US'));
    this._setOutput('wave', this.wave, this._formatWave(stats.wave));
    this._setText('cores', this.cores, `CORES ${stats.solarCores ?? 0}`);
    this._setOutput('best', this.best, this.bestScore.toLocaleString('en-US'));
    this._setText('mobileScore', this.mobileScore, Math.floor(stats.score).toLocaleString('en-US'));
    this._setText('mobileSpeed', this.mobileSpeed, Math.floor(stats.speed * 7.2).toLocaleString('en-US'));
    this._setText(
      'mobileBoost',
      this.mobileBoost,
      stats.missionVisual?.focus?.noBoost ? 'HOLD' : stats.boostReady ? 'READY' : `${Math.ceil(stats.boostCooldown * 10) / 10}s`,
    );
    this._setText('mobileShield', this.mobileShield, `${stats.shield}/${stats.maxShield}`);
    this._setOutput(
      'boost',
      this.boost,
      stats.missionVisual?.focus?.noBoost ? 'HOLD' : stats.boostReady ? 'READY' : `${Math.ceil(stats.boostCooldown * 10) / 10}s`,
    );
    this._renderHyper(stats);
    this._setDataset('hyper', stats.hyperActive);
    this._setDataset('hyperReady', stats.hyperReady);
    if (this.isCompactMode) {
      if (this.missions && this.missionRenderKey !== '__compact__') {
        this.missionRenderKey = '__compact__';
        this.missions.replaceChildren();
      }
    } else {
      this._renderMissions(stats.missions || []);
    }
    this._renderShield(stats.shield, stats.maxShield);
  }

  _renderHyper(stats) {
    const maxCharge = 100;
    const charge = Math.max(0, Math.min(maxCharge, stats.hyperCharge ?? 0));
    const roundedCharge = Math.round(charge);
    const displayCharge = stats.hyperActive ? maxCharge : roundedCharge;
    const chargeText = stats.hyperActive
      ? `SURGE ${Math.max(0, stats.hyperTime ?? 0).toFixed(1)}s`
      : stats.hyperReady
        ? 'READY'
        : `${roundedCharge}%`;
    const bannerText = stats.hyperActive
      ? `SURGE ACTIVE X2 | BREAK ${Math.max(0, stats.hyperTime ?? 0).toFixed(1)}s`
      : 'SOLAR SURGE READY';

    this._setText('hyperChargeValue', this.hyperChargeValue, chargeText);
    this._setText('hyperBannerText', this.hyper, bannerText);
    if (this.hyperChargeBlock && this.displayCache.get('hyperChargeFill') !== displayCharge) {
      this.displayCache.set('hyperChargeFill', displayCharge);
      this.hyperChargeBlock.style.setProperty('--charge-angle', `${displayCharge * 3.6}deg`);
    }
    const surgeStatusText = stats.hyperActive
      ? `SURGE ACTIVE ${Math.max(0, stats.hyperTime ?? 0).toFixed(1)}s`
      : stats.hyperReady
        ? 'READY'
        : 'CHARGING';
    this._setText('surgeStatusText', this.surgeStatusValue, surgeStatusText);
    this._setClass('hyperChargeHigh', this.hyperChargeBlock, 'high', !stats.hyperActive && charge >= 70);
    this._setClass('hyperChargeReady', this.hyperChargeBlock, 'ready', Boolean(stats.hyperReady));
    this._setClass('hyperChargeActive', this.hyperChargeBlock, 'active', Boolean(stats.hyperActive));
    this._setClass('hyperBannerActive', this.hyper, 'active', Boolean(stats.hyperActive || stats.hyperReady));
    this._setClass('hyperBannerReady', this.hyper, 'ready', Boolean(stats.hyperReady));
    this._setClass('surgeStatusReady', this.surgeStatus, 'ready', Boolean(stats.hyperReady));
    this._setClass('surgeStatusActive', this.surgeStatus, 'active', Boolean(stats.hyperActive));
  }

  setState(state, stats) {
    this.root.dataset.state = state;
    if (this.mobilePrimary) {
      this.mobilePrimary.textContent = state === 'playing' ? 'BOOST' : state === 'countdown' ? 'READY' : 'START';
      this.mobilePrimary.disabled = state === 'countdown' || state === 'crashing';
    }
    if (state === 'ready') {
      this.panel.innerHTML = `
        <p class="start-prompt">PRESS <kbd>SPACE</kbd> TO IGNITE</p>
        <p class="start-subtitle">DODGE GATES · COLLECT CORES · UNLEASH SOLAR SURGE</p>
      `;
    }
    if (state === 'playing') {
      this.panel.innerHTML = '';
    }
    if (state === 'paused') {
      this.panel.innerHTML = `
        <h1>BURNOUT</h1>
        <p>PRESS <kbd>P</kbd> OR <kbd>ESC</kbd> TO IGNITE</p>
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
      if (newBest) {
        this._writeBestScore(score);
        this.bestScore = score;
        this.displayCache.delete('best');
      }
      const rank = this._rankFor(score);
      const nextRank = this._nextRankFor(score);
      const rankClass = rank === 'S' || rank === 'S+' ? 'elite' : '';
      const completedMissions = stats.completedMissions ?? (stats.missions || []).filter((mission) => mission.complete).length;
      this.panel.innerHTML = `
        <h1>RUN COMPLETE</h1>
        ${newBest ? '<p class="new-best">RECORD BROKEN!</p>' : ''}
        <div class="result-grid">
          <span>FINAL SCORE</span><strong>${score.toLocaleString('en-US')}</strong>
          <span>DISTANCE</span><strong>${distance.toLocaleString('en-US')}M</strong>
          <span>BEST SCORE</span><strong>${bestScore.toLocaleString('en-US')}</strong>
          <span>RANK</span><strong class="rank ${rankClass}">${rank}</strong>
          <span>MAX COMBO</span><strong>X ${stats.maxCombo}</strong>
          <span>NEAR MISS</span><strong>${stats.nearMisses}</strong>
          <span>SURGE COUNT</span><strong>${stats.hyperCount}</strong>
          <span>SOLAR CORES</span><strong>${stats.solarCores ?? 0}</strong>
          <span>MISSIONS</span><strong>${completedMissions} DONE</strong>
        </div>
        ${nextRank ? `<p class="next-rank">${nextRank.remaining.toLocaleString('en-US')} POINTS TO RANK ${nextRank.rank}</p>` : '<p class="next-rank">MAX RANK REACHED</p>'}
        <p>PRESS <kbd>SPACE</kbd> TO RELAUNCH</p>
      `;
    }
  }

  _renderMissions(missions) {
    if (!this.missions) return;
    const renderKey = missions
      .map((mission) => [
        mission.id,
        mission.value,
        mission.target,
        mission.status,
        mission.timeLeft == null ? '' : Math.ceil(mission.timeLeft),
        mission.hint,
      ].join(':'))
      .join('|');
    if (renderKey === this.missionRenderKey) return;
    this.missionRenderKey = renderKey;
    this.missions.innerHTML = missions
      .map((mission) => {
        const progress = mission.target > 0 ? Math.max(0, Math.min(100, Math.round((mission.value / mission.target) * 100))) : 0;
        const timeText = mission.timeLeft != null ? `<em>${Math.ceil(mission.timeLeft)}s</em>` : '';
        const statusText = mission.failed ? 'FAILED' : mission.complete ? 'DONE' : mission.hint || `+${mission.reward}`;
        const timeLimitUrgent = mission.timeLimit && mission.timeLeft <= Math.min(6, mission.timeLimit * 0.35);
        const statusClass = `${mission.failed ? 'failed' : mission.complete ? 'complete' : mission.tier} ${timeLimitUrgent ? 'urgent' : ''}`;
        return `
          <div class="mission-item ${statusClass}" data-tier="${mission.tier}" data-focus="${mission.focus || 'score'}">
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

  _renderShield(shield, maxShield) {
    const renderKey = `${shield}:${maxShield}`;
    if (!this.shield || renderKey === this.shieldRenderKey) return;
    this.shieldRenderKey = renderKey;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < maxShield; i += 1) {
      const item = document.createElement('i');
      item.className = i < shield ? 'active' : '';
      fragment.appendChild(item);
    }
    this.shield.replaceChildren(fragment);
  }

  _setOutput(key, element, value) {
    if (!element || this.displayCache.get(key) === value) return;
    this.displayCache.set(key, value);
    element.value = value;
  }

  _setText(key, element, value) {
    if (!element || this.displayCache.get(key) === value) return;
    this.displayCache.set(key, value);
    element.textContent = value;
  }

  _setClass(key, element, className, active) {
    const value = Boolean(active);
    if (!element || this.displayCache.get(key) === value) return;
    this.displayCache.set(key, value);
    element.classList.toggle(className, value);
  }

  _setDataset(key, active) {
    const cacheKey = `dataset:${key}`;
    const value = active ? 'true' : 'false';
    if (this.displayCache.get(cacheKey) === value) return;
    this.displayCache.set(cacheKey, value);
    this.root.dataset[key] = value;
  }

  _formatWave(wave = null) {
    if (!wave?.name) return 'WARMUP';
    return wave.name.toUpperCase();
  }

  _rankFor(score) {
    if (score >= 70000) return 'S+';
    if (score >= 40000) return 'S';
    if (score >= 11000) return 'A';
    if (score >= 5000) return 'B';
    return 'C';
  }

  _nextRankFor(score) {
    const ranks = [
      { rank: 'B', score: 5000 },
      { rank: 'A', score: 11000 },
      { rank: 'S', score: 40000 },
      { rank: 'S+', score: 70000 },
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
