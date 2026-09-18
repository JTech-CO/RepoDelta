# RepoDelta 1.0.4 검증 보고서

[English](QA.md) · [README](../README-KR.md) · [아이콘 변경 내용](BRANDING-KR.md)

## 범위

새 로고의 일괄 반영과 배포 파일 동기화를 검증했습니다. 기반 저장소는 `JTech-CO/RepoDelta`, 커밋 `5ead41a0f8a3f5bebb4ed98aefb1b002dd1b6b88`입니다. 기존 대화 소스 패키지의 src/dist/scripts/docs/tests/qa/releases Git 트리 해시가 이 커밋과 일치하는 것을 확인하고, 커넥터로 새 원본을 읽었습니다. SVG에는 viewBox만 추가했고 제공된 원본 PNG는 바이트 그대로 유지했습니다.

## 이번 실행 결과

| 검사 | 결과 |
| --- | --- |
| Node 단위·API·서비스·브랜딩 회귀 | 107개 통과, 실패 0 |
| 오프라인 Chromium 앱 DOM 회귀 | 46개 통과, page error 0 |
| 오프라인 문서·PNG·ICO 브라우저 검사 | 50개 통과, page error 0, 누락 자산 0 |
| 이미지 정합성 | SVG 원본 보존, 모든 파생 파일 해시·크기 검증 |
| 패키지 정합성 | 최종 결과는 `qa-results/artifact-checks.json`에 기록 |

Node 22.16.0, Chromium 144.0.7559.96에서 실행했습니다. 기록은 `qa-results/`에 있으며 이전 결과는 `docs/qa-history/1.0.3/`에 별도로 보관했습니다. 원격 GitHub Actions 성공을 뜻하지 않습니다.

앱 검사는 실제 shared/background/content/options/popup 코드를 실행하고 모의 Chrome API·GitHub 응답을 사용합니다. 새 로고의 실제 이미지 디코딩, 16/28/32px 표시, 배지 상태 변화 후 이미지 유지, 기존 파일·커밋·언어·키보드·오류 처리 회귀를 검사했습니다. 문서 검사는 public과 dist 양쪽의 개인정보 처리방침·사용 안내를 실제 CSS/이미지 바이트와 함께 라이트/1280px 및 다크/390px로 렌더링하고 36px 로고·32px 파비콘·가로 넘침을 확인했습니다.

## 수정하지 않은 기능

`src/background/` 전체는 기반 코드와 바이트가 동일합니다. API transport, 토큰·저장소, 메시지 권한 검사, 기준점 저장을 변경하지 않았습니다. `src/shared/core.js`는 제품 버전 상수만 변경했습니다. 추가한 웹 공개 자산은 GitHub에서 읽을 수 있는 `icons/logo.svg` 한 파일이며, 기존 API·호스트 권한은 그대로입니다.

## 아직 확인하지 않은 범위

표준 옵션으로 Chromium에 unpacked extension 로드를 시도했으나 6초 관찰 동안 확장 서비스 워커가 등록되지 않았습니다. 환경의 보안·관리 정책은 변경하지 않았습니다. 따라서 네이티브 설치, 실제 도구 모음 표시, 실제 GitHub 페이지에서의 확장 자산 허용, 세션 수명과 API 인증 성공을 검증했다고 주장하지 않습니다.

사용자 Chrome, 배포된 GitHub Pages, Chrome 웹스토어에 변경을 업로드한 것도 아닙니다. 이번 연결의 push 권한이 없으므로 전체 소스·설치 ZIP을 제공하는 방식입니다. 사용자 환경의 마지막 확인은 같은 폴더 덮어쓰기 후 확장 재로드·GitHub 새로고침과 공개 문서 재배포 후 확인입니다.

## 재실행

```sh
npm run package
python tests/browser_smoke.py
python tests/branding_documents.py
```

마지막 두 명령은 선택적인 Python·Playwright·Chromium이 필요합니다. 기본 패키지 빌드는 Node.js만 사용합니다.
