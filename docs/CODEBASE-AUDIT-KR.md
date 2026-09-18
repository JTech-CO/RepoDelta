# RepoDelta v1.0.3 코드베이스 전면 검토

## 결론

1.0.0부터 1.0.2까지 지속된 API 실패의 직접 원인은 `src/background/github.js`의 네이티브 fetch 수신 객체 손실이다. `WorkerGlobalScope.fetch`를 `this.fetcher`에 저장한 뒤 메서드 형태로 호출하여 Chrome이 `Illegal invocation`을 던졌다. 토큰 값, GitHub API 권한, CORS, CSP, 프록시는 이번 오류의 직접 원인이 아니다.

## 주요 발견

### Critical - native fetch receiver loss

기존:

```js
constructor(store, fetcher = fetch) {
  this.fetcher = fetcher;
}
// ...
await this.fetcher(url, init);
```

수정:

```js
constructor(store, fetcher = globalThis.fetch) {
  this.fetcher = fetcher.bind(globalThis);
}
```

서비스 워커 전역의 WebIDL 메서드는 올바른 수신 객체가 필요할 수 있다. `this.fetcher(...)`는 `this`를 GitHubClient로 바꾸므로 네트워크 요청 전에 실패한다.

### High - QA가 실제 전송 경로를 검증하지 못함

Node 테스트와 오프라인 브라우저 하네스는 모두 `this`를 검사하지 않는 모의 fetch를 주입했다. 따라서 코드 구조상의 receiver 오류를 재현하지 못했다. v1.0.3은 수신 객체가 `globalThis`인지 검사하는 회귀 테스트를 추가했다. 실제 unpacked extension + service worker + live api.github.com 검증은 별도의 릴리스 게이트로 유지해야 한다.

### Medium - compatibility retry가 프로그래밍 오류까지 네트워크 문제처럼 보이게 함

1.0.2의 재시도는 첫 fetch가 어떤 이유로 예외를 던져도 최소 헤더로 다시 호출한다. Illegal invocation 같은 결정적 코드 오류에는 의미가 없었다. 이번 수정으로 직접 원인은 제거했지만 향후에는 네트워크 계열 예외와 내부 호출 오류를 구분하는 진단을 유지하는 것이 좋다.

### Low - 진단/권한 UI는 핵심 원인과 무관했음

`api.github.com`은 이미 필수 `host_permissions`에 선언되어 있으며 Chrome 공식 문서상 서비스 워커의 cross-origin fetch에 필요한 구조다. `permissions.contains/request` 진단은 사용자가 필수 호스트 권한을 보류한 경우에는 유용하지만 이번 Illegal invocation과는 관계가 없다.

## 나머지 코드 검토

- 토큰은 `chrome.storage.session` + `TRUSTED_CONTEXTS`에만 저장되고 local backup에 포함되지 않는다.
- GitHub 요청은 고정 `https://api.github.com` origin과 저장소 메타/커밋/compare allowlist에 한정되어 있다.
- content script가 임의 URL을 worker에 전달해 프록시로 쓰는 경로는 없다.
- repository text는 `textContent`/DOM node로 렌더링되며 `innerHTML` 기반 삽입은 없다.
- baseline revision과 auth epoch로 다중 탭 stale write 및 인증 변경 중 write를 방지한다.
- 비교 결과의 파일 300개/커밋 500개 한도를 사용자에게 명시하고, 필터 결과만 확인 완료로 오인하지 않도록 확인 문구가 있다.
- `Date.now`도 함수로 저장해 메서드 형태로 호출하지만 Date.now는 receiver-sensitive WebIDL 메서드가 아니므로 동일 결함은 아니다. 현재 source에서 다른 브라우저 네이티브 메서드를 분리 저장한 패턴은 확인되지 않았다.

## 릴리스 게이트

1. 실제 Chrome에서 unpacked v1.0.3 로드
2. 설정 진단에서 최소 요청 HTTP 200 확인
3. 공개 저장소에서 토큰 없이 repo/head/compare 확인
4. session token 입력 후 authenticated 진단 확인
5. 비공개 저장소에서 선택 저장소 Contents read 토큰 확인
6. 브라우저 재시작/확장 reload 후 token 소멸 및 checkpoint 유지 확인
7. 새 커밋 추가 후 이전 checkpoint 대비 Delta +N 확인
8. 다른 탭에서 checkpoint 변경 후 stale write 차단 확인
