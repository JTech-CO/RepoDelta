# RepoDelta 1.0.4 아이콘 일괄 적용

[English](BRANDING.md) · [README](../README-KR.md)

## 원본과 적용 범위

생산용 원본은 `public/icons/logo.svg`입니다. GitHub 커밋 `5ead41a0f8a3f5bebb4ed98aefb1b002dd1b6b88`에 업로드된 새 SVG의 도형·정사각형 배경·선 비율·#1A7F37 색상을 유지하고 `viewBox="0 0 412 412"`와 마지막 줄바꿈만 추가했습니다. 변환 전 SVG는 `docs/brand/uploaded-logo.svg`, 제공된 PNG는 `public/icons/original.png`에 원본 바이트 그대로 보존했습니다. PNG 원본은 참고용이며 별도의 생성 입력이 아닙니다.

| 위치 | 적용 |
| --- | --- |
| Chrome 설치·관리·도구 모음 | 새 16/32/48/128 PNG |
| GitHub Delta 배지·패널 | 공통 로고 SVG, 16px·28px |
| 설정·팝업 | 공통 로고 SVG, 32px |
| 개인정보 처리방침·사용 안내 | 헤더 SVG 36px, 탭 파비콘 32px |
| README·README-KR | 새 SVG 72px, 새 앱 스크린샷 |
| ICO·dist·설치 ZIP | 같은 원본으로 재생성·동기화 |

인접한 제품명 텍스트가 접근성 이름을 제공하므로 장식용 로고에는 빈 alt를 사용합니다. 상태가 바뀌어도 배지 이미지는 유지하고 상태 텍스트만 갱신합니다. CSS로 배경색·둥근 모서리·도형을 다시 그리지 않습니다.

GitHub 페이지 안에서는 확장 패키지의 `icons/logo.svg`만 사용합니다. 이 파일 하나만 `https://github.com/*`에 공개하며 토큰·설정·코드·API 응답은 공개 자산에 포함하지 않습니다. 개발자 서버로 아이콘을 요청하지 않습니다.

## 다음 아이콘 변경 절차

기존 파일의 빌드·설치에는 Node.js 22+만 필요합니다. Python이나 npm 패키지 설치는 필요하지 않습니다. 원본 SVG를 다시 수정할 때만 선택적 이미지 생성 도구를 설치합니다.

```sh
python -m pip install -r scripts/requirements-icons.txt
python scripts/generate-icons.py
npm run package
```

선택적 생성기는 CairoSVG와 Pillow를 사용하며 외부 SVG 자원 참조를 거부합니다. `scripts/icon-assets.json`에 SVG·PNG·ICO의 SHA-256을 기록합니다. `npm run check`와 `npm run build`는 원본 또는 파생 파일이 바뀌어 기록과 다르면 실패합니다. 따라서 SVG만 교체하고 이전 PNG를 그대로 배포하는 누락을 잡을 수 있습니다. 이 검사는 전자서명이 아니라 자산 동기화 검사입니다. 참고용 `original.png`만 바꾸면 반영되지 않습니다. 생산용 SVG를 바꾸고 재생성하세요.

선택적 브라우저 검사에는 Python·Playwright·로컬 Chromium이 필요합니다.

```sh
python tests/browser_smoke.py
python tests/branding_documents.py
```

실제 코드·문서·이미지를 렌더링하되 Chrome API·GitHub 응답은 모의 데이터입니다. 실제 설치·배포 검증과 구분해야 합니다. [QA](QA-KR.md)를 참고하세요.

## 배포

`npm run package`는 `dist`와 `releases/RepoDelta-v1.0.4-chrome.zip`을 생성합니다. 아이콘 폴더 하나만 아니라 `public`, `src`, `scripts`, `dist`, 문서를 함께 반영하세요. Pages에는 `public/`의 HTML·CSS·icons를 함께 올려야 합니다. 기존 `public/privacy-policy.html` 경로는 바꾸지 않았습니다. 웹스토어 관리 화면에 따로 업로드한 소개 이미지·아이콘은 저장소 수정으로 자동 변경되지 않습니다.

참고: [Chrome 매니페스트 아이콘](https://developer.chrome.com/docs/extensions/reference/manifest/icons), [웹 접근 가능 자산](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources).
