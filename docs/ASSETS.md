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
