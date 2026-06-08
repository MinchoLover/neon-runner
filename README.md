# Neon Tunnel Runner

A fast 3D tunnel runner built with Vite, Three.js, and WebGL post-processing.

Race through neon lanes, dodge obstacles, chain near misses, hit rift turns, and push into Hyper Mode as the tunnel palette and speed escalate.

## Features

- Three-lane arcade runner with keyboard controls
- Bloom-lit procedural tunnel visuals
- Rotating obstacle patterns, narrow gates, and rift-turn prompts
- Shield, combo, boost, score, distance, and best-score HUD
- Hyper Mode triggered by strong combo play, near misses, or distance
- Local best score saved in browser storage
- Synth-style procedural audio effects

## Controls

| Key | Action |
| --- | --- |
| `Space` | Start, restart, or boost |
| `A` / `ArrowLeft` | Move left |
| `D` / `ArrowRight` | Move right |
| `P` / `Esc` | Pause or resume |

## Getting Started

Install dependencies:

```sh
npm install
```

Run the development server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

## Project Structure

```text
src/
  main.js                 App entry point
  style.css               Game HUD and layout styles
  game/
    Game.js               Main game loop and state management
    Player.js             Player ship model and movement
    Tunnel.js             Tunnel geometry and palette transitions
    ObstacleManager.js    Obstacle spawning and collision checks
    ParticleManager.js    Boost, hit, rift, and near-miss effects
    AudioManager.js       Procedural game audio
    UIManager.js          HUD, overlays, score, and status UI
    constants.js          Shared gameplay and color constants
public/
  models/player_fighter.glb
```

## Tech Stack

- Vite
- Three.js
- JavaScript modules
