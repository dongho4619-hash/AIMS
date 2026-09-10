# 애니워터 통합업무관리 MVP

기존 자재관리 프로그램과 분리된 통합업무관리 프로그램입니다. 이 폴더만 별도 저장소로 옮겨 독립 배포할 수 있습니다. 브라우저에서 `index.html`을 열면 고객·매장 조사·C/S·현장·재고·생산·통계 화면과 샘플 업무 흐름을 확인할 수 있습니다.

## 로컬 실행

```powershell
cd integrated-workflow-mvp
npm run dev
```

접속 주소: `http://localhost:4173`

## Cloudflare Workers + D1 독립 배포

이 프로그램은 기존 재고 프로그램과 다른 Workers 프로젝트와 전용 D1 데이터베이스로 배포합니다.

```powershell
cd integrated-workflow-mvp
npx wrangler login
npx wrangler d1 create anywater-integrated-workflow-db
# 위 명령이 반환한 database_id를 wrangler.toml에 입력
npx wrangler d1 execute anywater-integrated-workflow-db --remote --file=schema.sql
npm run deploy
```

`anywater-integrated-workflow`라는 별도 Worker와 전용 D1 데이터베이스가 생성되며, 기존 재고 프로그램의 Worker·D1 데이터베이스와 분리됩니다. 실제 회사 데이터가 연결되기 전에는 샘플 데이터만 노출해야 합니다.

## 운영 전환 순서

1. 별도 GitHub 저장소 생성
2. Cloudflare Pages 별도 프로젝트 생성
3. 정식 로그인·부서/역할 권한 구현
4. D1에 업무·고객·계약·미납·회계보조 데이터를 별도 저장
5. R2에 사진·서명·첨부파일 저장
6. 문자 발송업체와 CMS 사업자 API 연결
7. 샘플 데이터 제거 후 내부 사용자 시범운영

현재 버전은 화면과 업무 흐름을 검토하면서 D1 저장 API를 연결할 수 있는 MVP입니다. 기존 재고 프로그램의 DB와 코드를 수정하지 않으며, 운영 전환 시 서버 검증 재고원장, 정식 로그인·권한, 파일 저장소, 감사이력이 필요합니다.
