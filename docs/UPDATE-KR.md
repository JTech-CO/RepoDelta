# RepoDelta 1.0.4 반영 방법

## GitHub 소스

전체 소스 ZIP 안 `RepoDelta/`의 내용을 기존 저장소 루트에 반영합니다. `RepoDelta/RepoDelta/`로 중첩하지 마세요. `src`, `public`, `scripts`, `tests`, `docs`, `dist`, 버전 파일을 함께 적용합니다. 기존 로컬 `.git` 폴더는 유지하세요.

검증한 기반은 커밋 `5ead41a0f8a3f5bebb4ed98aefb1b002dd1b6b88`입니다. 이후 별도 수정이 있다면 먼저 변경 내용을 비교하여 병합합니다. 이미 업로드한 옛 버전 ZIP은 역사 자료이며 현재 설치 파일로 이름을 바꾸지 마세요. 이 소스 패키지의 `releases`에는 새 설치 ZIP만 넣었습니다.

```sh
npm run package
```

`releases/`는 기존 `.gitignore`에 포함되어 있습니다. ZIP을 저장소 파일로도 올리려면 명시적으로 추가하거나 GitHub Release 첨부를 이용합니다.

```sh
git add -A
git add -f releases/RepoDelta-v1.0.4-chrome.zip
```

커밋·푸시 또는 웹 업로드는 사용자의 저장소에서 수행해야 합니다. 이번 작업은 원격 저장소·Pages·스토어를 수정하지 않았습니다.

## 로컬 Chrome 업데이트와 기록 보존

설정의 JSON 내보내기로 기준점을 먼저 백업하세요. 확장을 제거하지 말고, 기존에 Chrome에 등록한 폴더 경로에 새 설치 ZIP의 내용을 덮어씁니다. `chrome://extensions`에서 RepoDelta를 새로고침하고 버전 `1.0.4`를 확인한 뒤 열려 있던 GitHub 탭과 설정 탭도 새로고침합니다.

동일 확장의 같은 폴더를 업데이트하는 방식으로 로컬 기준점을 유지합니다. 제거하면 로컬 데이터가 삭제되고 다른 폴더를 새로 로드하면 다른 확장 ID가 될 수 있으므로 백업이 중요합니다. 세션 토큰은 재로드 시 삭제되므로 필요하면 다시 입력합니다. 이전 아이콘이 캐시에 남아 있으면 페이지 강력 새로고침 또는 Chrome 재시작 후 확인합니다.

## 개인정보 처리방침과 사용 안내

Pages 배포 소스에 `public/privacy-policy.html`, `public/help.html`, `public/document.css`, `public/icons/`를 함께 반영합니다. 기존 주소 `/RepoDelta/public/privacy-policy.html`을 유지했습니다. 현재 배포 소스가 다른 폴더라면 그 폴더의 상대 경로 구조도 동일하게 유지해야 합니다. HTML만 단독 업로드하지 마세요.

## 최종 확인

Chrome 관리·도구 모음은 새 PNG, 팝업·설정·GitHub 패널과 배지는 새 SVG가 표시되어야 합니다. 문서에서는 헤더 로고와 탭 파비콘이 모두 바뀌어야 합니다. 웹스토어 관리 화면에 별도로 등록한 아이콘·스크린샷은 새 패키지와 별개이므로 필요한 경우 새 파일로 다시 등록합니다.

Chrome 저장소 설명: https://developer.chrome.com/docs/extensions/reference/api/storage
