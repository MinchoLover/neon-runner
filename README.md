# Solar Runner Asset Downloader

이 폴더는 Solar Runner 프로젝트에 쓸 외부 에셋을 자동으로 받아오고 정리하는 스크립트입니다.

## 사용법

1. 이 폴더의 `download_assets.sh`를 네 프로젝트 루트에 복사합니다.
2. 프로젝트 루트에서 실행합니다.

```bash
chmod +x download_assets.sh
./download_assets.sh
```

그러면 다음 구조가 생성됩니다.

```text
public/assets/_downloads/
public/assets/raw/
public/assets/models/player/
public/assets/models/obstacles/
public/assets/audio/
docs/ASSETS.md
```

## 다운로드되는 에셋

- Kenney Space Kit: 3D ship/space object 후보
- OpenGameArt 60 CC0 Sci-Fi SFX: 효과음 후보
- OpenGameArt 50 CC0 Sci-Fi SFX: 효과음 후보

## 주의

- 자동 선택은 완벽하지 않습니다. `public/assets/model_candidates.txt`, `public/assets/audio_candidates.txt`를 확인하고 직접 골라도 됩니다.
- 폰트 파일은 포함하지 않았습니다. HUD 폰트는 CSS import 또는 시스템 fallback을 권장합니다.
- 외부 모델은 visual 용도로만 쓰고, collision은 기존 lane-based 방식을 유지하세요.
