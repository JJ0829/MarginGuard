# 마진가드 (MarginGuard)

외식업 사장님을 위한 AI 기반 수익·원가 관리 서비스의 랜딩 페이지 및 클릭형 웹앱 프로토타입입니다.

## 주요 기능

- 반응형 서비스 소개 홈페이지
- 외식업 비용 절감 효과 계산기
- 클릭 가능한 서비스 대시보드
- 영수증 이미지 업로드 및 AI 분석 시뮬레이션
- 식자재 원가·가격 변동 분석 화면
- 공급처 가격 비교 화면
- 다점포 통합 관리 화면
- 좋아요 및 댓글 등록·삭제 데모

현재 버전은 프론트엔드 프로토타입입니다. 좋아요와 댓글은 동작 확인을 위해 브라우저 `localStorage`에만 저장되므로 다른 사용자와 공유되지 않습니다. 실제 다중 사용자 커뮤니티, 영수증 OCR, 회원가입, 데이터 저장 및 공급처 연결에는 별도의 백엔드와 API 연동이 필요합니다.

## 프로젝트 구조

```text
marginguard-github/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml  # GitHub Pages 자동 배포
├── .gitignore
├── .nojekyll
├── index.html                # HTML·CSS·JavaScript가 포함된 전체 서비스
└── README.md
```

## 로컬에서 실행하기

별도의 설치 과정은 없습니다. `index.html`을 브라우저로 열거나 아래 명령으로 로컬 서버를 실행하세요.

```bash
python3 -m http.server 8080
```

그다음 브라우저에서 `http://localhost:8080`에 접속합니다.

## GitHub에 올리기

새 GitHub 저장소를 만든 다음 이 폴더 안에서 실행합니다.

```bash
git init
git add .
git commit -m "Initial MarginGuard prototype"
git branch -M main
git remote add origin https://github.com/사용자명/저장소명.git
git push -u origin main
```

## GitHub Pages 배포하기

1. GitHub 저장소의 **Settings**로 이동합니다.
2. 왼쪽 메뉴에서 **Pages**를 선택합니다.
3. **Build and deployment → Source**를 `GitHub Actions`로 설정합니다.
4. `main` 브랜치에 push하면 `deploy-pages.yml`이 자동으로 실행됩니다.
5. 저장소의 **Actions** 탭에서 배포 완료 여부를 확인합니다.

배포 주소는 보통 아래 형식입니다.

```text
https://사용자명.github.io/저장소명/
```

## 수정할 위치

`index.html` 하나에 디자인과 기능이 모두 포함되어 있습니다.

- `<style>`: 색상, 레이아웃, 모바일 반응형 디자인
- `<body>`: 홈페이지와 웹앱 화면 구성
- `<script>`: 화면 전환, 계산기, 이미지 업로드 시뮬레이션

## 실제 서비스 전환 시 필요한 작업

1. 회원가입·로그인 및 매장 계정 구조
2. OCR·Document AI API 연동
3. 영수증 원본과 분석 결과 저장용 데이터베이스
4. 품목명·규격 표준화 로직
5. 공급처 및 가격 비교 데이터 확보
6. 개인정보처리방침과 이용약관 정식 작성
7. 관리자 페이지, 오류 모니터링 및 보안 설정

## 주의사항

이 프로토타입에 표시된 매출, 원가, 공급처, 가격 및 절감액은 서비스 설명을 위한 예시 데이터입니다. 실제 서비스에서는 AI 분석 결과를 사용자가 저장 전에 검수할 수 있도록 하고, 금액 계산과 공급처 정보에 대한 별도의 검증 체계가 필요합니다.

---

© 2026 MarginGuard. All rights reserved.
