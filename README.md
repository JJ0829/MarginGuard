# MarginGuard Railway 배포본

마진가드 홈페이지와 PostgreSQL 기반 공유형 좋아요·댓글을 Railway에 배포하기 위한 베타 프로젝트입니다.

## 배포 전 필수 확인

- 이 프로젝트는 아직 **베타 프로토타입**이며 결제·실제 OCR·실제 공급처 연결 기능은 없습니다.
- 좋아요와 댓글은 예시 숫자를 사용하지 않고 실제 등록 데이터만 표시합니다.
- Railway 서비스에 PostgreSQL의 `DATABASE_URL`이 연결되지 않으면 배포가 실패하도록 구성했습니다. 데이터가 메모리 모드로 조용히 유실되는 것을 방지하기 위함입니다.
- Railway 무료 크레딧이 끝난 계정은 비용이 발생할 수 있으므로 배포 전에 **Billing과 Usage limit**을 확인하세요.
- 배포 후에는 GitHub Pages 주소가 아니라 **Railway에서 생성한 도메인**을 공유해야 서버 댓글이 작동합니다.

## 구조

```text
index.html        # 홈페이지·웹앱 화면
server.js         # Express 서버와 좋아요·댓글 API
package.json      # 실행 의존성
package-lock.json # 설치 버전 고정
railway.json      # 시작 명령과 헬스체크
.env.example      # 로컬 환경변수 예시
```

## 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
npm ci
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다. 로컬에서 `DATABASE_URL`이 없으면 메모리 모드로 실행되며 서버 재시작 시 데이터가 사라집니다.

## Railway 배포 순서

1. 이 폴더 **안의 파일 전체**를 GitHub 저장소 루트에 올립니다.
2. Railway에서 **New Project → Deploy from GitHub Repo**를 선택합니다.
3. 같은 Railway 프로젝트에 **PostgreSQL** 서비스를 추가합니다.
4. 앱 서비스의 **Variables → Add Reference**에서 PostgreSQL의 `DATABASE_URL`을 연결합니다. 값을 직접 복사해 GitHub 코드에 적지 마세요.
5. 앱 서비스가 다시 배포되면 `/api/health`가 `{"ok":true,"storage":"postgres"}`를 반환하는지 확인합니다.
6. **Settings → Networking → Generate Domain**으로 공개 주소를 생성합니다.
7. 일반 창에서 댓글을 작성한 뒤 시크릿 창 또는 다른 휴대폰에서 같은 댓글이 보이는지 확인합니다.

서버가 시작될 때 `comments`, `likes` 테이블과 인덱스를 자동 생성합니다. Railway 내부 PostgreSQL은 기본적으로 강제 SSL을 사용하지 않으며, 외부 DB에서 SSL이 필요할 때만 `PGSSLMODE=require`를 설정합니다.

## API

```text
GET    /api/health
GET    /api/feedback?visitorId=...
POST   /api/likes/toggle
POST   /api/comments
DELETE /api/comments/:id
```

## 적용된 기본 방어

- Helmet 보안 헤더
- API 및 작성 요청 IP 속도 제한
- JSON 요청 크기 제한
- SQL 파라미터 바인딩
- 댓글 길이·링크 수 제한
- 봇용 허니팟 필드
- 본인 브라우저 식별자와 일치하는 댓글만 삭제
- Railway에서 DB 미연결 시 시작 중단
- 종료 시 DB 연결 정리

## 베타 단계의 한계

브라우저별 무작위 식별자는 로그인 계정이 아니므로 브라우저 데이터를 지우면 본인 댓글을 직접 삭제하지 못할 수 있습니다. 정식 서비스 전에는 다음 기능이 추가되어야 합니다.

- 회원가입과 인증
- CAPTCHA 또는 봇 방어 서비스
- 관리자 댓글 숨김·삭제 및 신고 화면
- 정식 개인정보처리방침과 이용약관
- 로그·오류 모니터링과 DB 백업 정책
- 실제 도메인과 운영 이메일
