#!/usr/bin/env bash
set -euo pipefail

# Solar Runner asset downloader / organizer
# Run this from your project root, e.g. neon-runner/
# It downloads CC0 game assets into public/assets/raw and tries to auto-pick usable files.

ROOT="$(pwd)"
ASSET_ROOT="$ROOT/public/assets"
RAW_DIR="$ASSET_ROOT/raw"
DL_DIR="$ASSET_ROOT/_downloads"
MODELS_PLAYER="$ASSET_ROOT/models/player"
MODELS_OBSTACLES="$ASSET_ROOT/models/obstacles"
AUDIO_DIR="$ASSET_ROOT/audio"
DOCS_DIR="$ROOT/docs"

mkdir -p "$DL_DIR" "$RAW_DIR" "$MODELS_PLAYER" "$MODELS_OBSTACLES" "$AUDIO_DIR" "$DOCS_DIR"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERROR] Missing command: $1"
    echo "Install it first, then rerun this script."
    exit 1
  fi
}

need_cmd curl
need_cmd unzip
need_cmd python3

KENNEY_SPACE_URL="https://kenney.nl/media/pages/assets/space-kit/20874c75ac-1677698978/kenney_space-kit.zip"
OGA_60_SFX_URL="https://opengameart.org/sites/default/files/60-sci-fi-sfx_0.zip"
OGA_50_SFX_URL="https://opengameart.org/sites/default/files/sci-fi-sfx.zip"

fetch_zip() {
  local url="$1"
  local out="$2"
  if [ -f "$out" ]; then
    echo "[SKIP] Already downloaded: $out"
  else
    echo "[DOWNLOAD] $url"
    curl -L --fail --retry 3 --retry-delay 2 -o "$out" "$url"
  fi
}

extract_zip() {
  local zipfile="$1"
  local dest="$2"
  mkdir -p "$dest"
  if [ -f "$dest/.extracted" ]; then
    echo "[SKIP] Already extracted: $dest"
  else
    echo "[EXTRACT] $zipfile -> $dest"
    unzip -q -o "$zipfile" -d "$dest"
    touch "$dest/.extracted"
  fi
}

fetch_zip "$KENNEY_SPACE_URL" "$DL_DIR/kenney_space-kit.zip"
fetch_zip "$OGA_60_SFX_URL" "$DL_DIR/60-sci-fi-sfx.zip"
fetch_zip "$OGA_50_SFX_URL" "$DL_DIR/50-sci-fi-sfx.zip"

extract_zip "$DL_DIR/kenney_space-kit.zip" "$RAW_DIR/kenney_space-kit"
extract_zip "$DL_DIR/60-sci-fi-sfx.zip" "$RAW_DIR/oga_60_sci_fi_sfx"
extract_zip "$DL_DIR/50-sci-fi-sfx.zip" "$RAW_DIR/oga_50_sci_fi_sfx"

cat > "$ROOT/scripts_auto_pick_assets.py" <<'PY'
from pathlib import Path
import shutil
import re

root = Path.cwd()
asset_root = root / "public" / "assets"
raw = asset_root / "raw"
player_dir = asset_root / "models" / "player"
obs_dir = asset_root / "models" / "obstacles"
audio_dir = asset_root / "audio"

player_dir.mkdir(parents=True, exist_ok=True)
obs_dir.mkdir(parents=True, exist_ok=True)
audio_dir.mkdir(parents=True, exist_ok=True)

model_ext = {".glb", ".gltf"}
audio_ext = {".wav", ".ogg", ".mp3"}
models = [p for p in raw.rglob("*") if p.suffix.lower() in model_ext]
audios = [p for p in raw.rglob("*") if p.suffix.lower() in audio_ext]

def score_path(p: Path, terms):
    s = str(p).lower()
    score = 0
    for i, t in enumerate(terms):
        if t in s:
            score += 100 - i * 3
    # Prefer GLB over GLTF for simpler loading in Three.js when available.
    if p.suffix.lower() == ".glb":
        score += 20
    # Avoid huge files when possible.
    try:
        size = p.stat().st_size
        score -= min(size / 1_000_000, 20)
    except OSError:
        pass
    return score

def pick_one(paths, terms, used=set()):
    candidates = [p for p in paths if p not in used and score_path(p, terms) > 0]
    if not candidates:
        return None
    candidates.sort(key=lambda p: score_path(p, terms), reverse=True)
    used.add(candidates[0])
    return candidates[0]

used_models = set()
used_audio = set()

p = pick_one(models, ["fighter", "ship", "spacecraft", "craft", "space_ship", "spaceship"], used_models)
if p:
    dest = player_dir / ("solar_fighter" + p.suffix.lower())
    shutil.copy2(p, dest)
    print(f"[PICK] Player model: {p} -> {dest}")
else:
    print("[WARN] Could not auto-pick player model. Check model_candidates.txt.")

obstacle_specs = [
    ("solar_crate", ["crate", "container", "box", "cargo"]),
    ("turret_arm", ["turret", "cannon", "gun", "weapon", "laser"]),
    ("energy_pylon", ["pylon", "antenna", "station", "satellite", "tower", "support"]),
]
for name, terms in obstacle_specs:
    p = pick_one(models, terms, used_models)
    if p:
        dest = obs_dir / (name + p.suffix.lower())
        shutil.copy2(p, dest)
        print(f"[PICK] Obstacle model: {p} -> {dest}")
    else:
        print(f"[WARN] Could not auto-pick obstacle model for {name}. Check model_candidates.txt.")

# Audio picks are heuristic. You should audition them and rename if needed.
audio_specs = [
    ("boost", ["boost", "rocket", "warp", "whoosh", "laser"]),
    ("near_miss", ["phaser", "laser", "swoosh", "zap", "sci"]),
    ("solar_core", ["pickup", "beep", "coin", "power", "terminal"]),
    ("surge_ready", ["power", "charge", "beep", "terminal", "retro"]),
    ("surge_start", ["warp", "power", "explosion", "rocket", "laser"]),
    ("hit", ["hit", "metal", "explosion", "bang", "impact"]),
    ("game_over", ["down", "error", "explosion", "terminal", "weird"]),
    ("engine_loop", ["loop", "engine", "rocket", "hum", "ambient"]),
]
for name, terms in audio_specs:
    p = pick_one(audios, terms, used_audio)
    if p:
        ext = p.suffix.lower()
        dest = audio_dir / (name + ext)
        shutil.copy2(p, dest)
        print(f"[PICK] Audio: {p} -> {dest}")
    else:
        print(f"[WARN] Could not auto-pick audio for {name}. Check audio_candidates.txt.")

with open(asset_root / "model_candidates.txt", "w", encoding="utf-8") as f:
    for p in models:
        f.write(str(p.relative_to(root)) + "\n")
with open(asset_root / "audio_candidates.txt", "w", encoding="utf-8") as f:
    for p in audios:
        f.write(str(p.relative_to(root)) + "\n")

print("\n[DONE] Auto-pick complete.")
print("Review these files:")
print("- public/assets/model_candidates.txt")
print("- public/assets/audio_candidates.txt")
print("- public/assets/models/player")
print("- public/assets/models/obstacles")
print("- public/assets/audio")
PY

python3 "$ROOT/scripts_auto_pick_assets.py"
rm "$ROOT/scripts_auto_pick_assets.py"

cat > "$DOCS_DIR/ASSETS.md" <<'MD'
# External Assets

This project uses external assets only for visual/audio polish. Gameplay collision remains lane-based and procedural fallbacks should remain available.

## 3D Models

### Kenney Space Kit
- Source: https://kenney.nl/assets/space-kit
- License: Creative Commons CC0
- Usage in this project: player ship candidates, obstacle/turret/crate/pylon candidates
- Local raw path: `public/assets/raw/kenney_space-kit/`
- Curated path: `public/assets/models/`

## Audio

### 60 CC0 Sci-Fi SFX by rubberduck
- Source: https://opengameart.org/content/60-cc0-sci-fi-sfx
- License: CC0
- Usage in this project: boost, near miss, pickup, surge, hit, game over candidates
- Local raw path: `public/assets/raw/oga_60_sci_fi_sfx/`
- Curated path: `public/assets/audio/`

### 50 CC0 Sci-Fi SFX by rubberduck
- Source: https://opengameart.org/content/50-cc0-sci-fi-sfx
- License: CC0
- Usage in this project: extra sci-fi UI, loop, laser, rocket, terminal sound candidates
- Local raw path: `public/assets/raw/oga_50_sci_fi_sfx/`
- Curated path: `public/assets/audio/`

## Fonts

Do not bundle font files unless you have verified the license and project requirement. Recommended approach for this project is to use a CSS import or system fallback for a sci-fi font such as Orbitron.

Example CSS:

```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800&display=swap');
```

## Notes

- The auto-picked files are heuristic. Audition audio and preview models before final integration.
- Keep procedural fallbacks in code.
- Do not switch collision to mesh-based collision.
MD

echo "\n[DONE] Assets downloaded and organized."
echo "Check: public/assets/ and docs/ASSETS.md"
