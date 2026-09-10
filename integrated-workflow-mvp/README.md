# Anywater Integrated Management System

사내 통합업무관리 프로그램입니다. 통합 로그인, 고객·매장, C/S, 현장 작업,
생산·품질, 경영지원 업무와 자재관리 화면을 한 주소에서 제공합니다.

## 구성

- 통합 사이트 Worker: `anywater-integrated-management-system`
- 통합업무 D1: `anywater-integrated-management-system-db`
- 자재관리 내부 서비스: `anywater-inventory-integrated-service`
- 자재관리 D1: 기존 `anywater-inventory-db` 재사용
- 내부 서비스 바인딩: `INVENTORY_SERVICE`

기존 자재관리 원본 사이트와 Worker는 수정하거나 교체하지 않습니다. 통합 사이트는
로그인한 사용자만 내부 자재관리 서비스에 연결하며, 자재관리에서 별도 로그인을
요구하지 않습니다.

## 로컬 실행

```powershell
cd integrated-workflow-mvp
npm run dev
```

로컬 주소는 `http://localhost:4173`입니다. 로컬에서는 Cloudflare의 실제 D1과
내부 서비스 연결이 없으므로 통합 로그인과 자재관리 데이터는 배포 주소에서
확인해야 합니다.

## 배포 순서

먼저 자재관리 내부 서비스를 빌드하고 배포합니다.

```powershell
cd integrated-inventory-service
npm run build
npx wrangler deploy
```

그 다음 통합 사이트를 배포합니다.

```powershell
cd integrated-workflow-mvp
npx wrangler deploy --config wrangler.toml
```

배포 주소:
`https://anywater-integrated-management-system.dongho4619.workers.dev`

## 보안

- `.env`, `.dev.vars`, API 키와 인증 파일은 Git에 포함하지 않습니다.
- 자재관리 내부 서비스는 `workers_dev = false`로 외부 공개 주소가 없습니다.
- 통합 사이트가 확인한 사용자 정보만 내부 서비스에 전달합니다.
- 자재관리 경로와 통합 업무 API는 로그인하지 않으면 `401`을 반환합니다.
