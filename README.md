# MarginGuard Railway 배포본

마진가드 홈페이지와 공유형 좋아요·댓글 API를 Railway에 배포하기 위한 프로젝트입니다.

## 구조

```text
index.html   # 홈페이지·웹앱 화면
server.js    # Express 서버와 좋아요·댓글 API
package.json # 실행 의존성
```

## 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다.

`DATABASE_URL`이 없으면 메모리 저장 모드로 실행됩니다. 이 모드는 서버를 재시작하면 데이터가 사라지므로 테스트 전용입니다.

## Railway 배포

1. 이 폴더의 파일을 GitHub 저장소 루트에 올립니다.
2. Railway에서 **New Project → Deploy from GitHub Repo**를 선택합니다.
3. PostgreSQL을 같은 Railway 프로젝트에 추가합니다.
4. PostgreSQL 서비스의 `DATABASE_URL`을 앱 서비스에 연결합니다. Railway의 **Variables → Add Reference**에서 PostgreSQL의 `DATABASE_URL`을 선택하면 됩니다.
5. 앱 서비스의 Start Command는 기본값인 `npm start`를 사용합니다.
6. **Settings → Networking → Generate Domain**으로 공개 주소를 생성합니다.

서버가 시작될 때 `comments`, `likes` 테이블을 자동으로 생성합니다.

## API

```text
GET    /api/health
GET    /api/feedback?visitorId=...
POST   /api/likes/toggle
POST   /api/comments
DELETE /api/comments/:id
```

## 보안 참고

- 댓글 텍스트는 서버에서 길이를 제한하고 SQL 파라미터 바인딩으로 저장합니다.
- 브라우저별 방문자 ID로 데모 좋아요·댓글 작성자를 구분합니다.
- 실제 서비스에서는 회원가입, CAPTCHA/레이트 리밋, 관리자 신고·삭제, 개인정보 정책이 추가로 필요합니다.
- `DATABASE_URL`은 GitHub 코드에 직접 작성하지 말고 Railway Variables에서만 설정합니다.
- Railway 무료 크레딧이 종료된 계정은 사용량에 따라 결제가 발생할 수 있으므로 Billing을 확인하세요.
