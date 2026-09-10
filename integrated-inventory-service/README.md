# AIMS Inventory Internal Service

기존 자재관리 원본을 복사해 만든 AIMS 전용 내부 서비스입니다.

- 외부 `workers.dev` 주소를 만들지 않습니다.
- AIMS 통합 Worker의 `INVENTORY_SERVICE` 바인딩으로만 접근합니다.
- 통합 로그인에서 전달한 사용자와 관리자 역할을 사용합니다.
- 기존 자재관리와 같은 직원 아이디를 사용하면 기존 사용자 기록을 우선 연결합니다.
- 별도 자재관리 로그인 화면은 표시하지 않습니다.
- 기존 `anywater-inventory-db`를 연결하므로 자재 기준과 업무 데이터를 재사용합니다.

## 확인 및 배포

```powershell
npm run lint
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy
```

원본 자재관리 프로젝트는 이 폴더 밖에 그대로 유지됩니다.
