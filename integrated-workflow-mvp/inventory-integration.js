const integratedInventoryUrl = "/inventory-app/";

inventoryPage = function inventoryPage() {
  return `<div class="sectionhead inventory-source-head"><div><h2>재고·자재</h2><p>통합 시스템 로그인 계정으로 기존 자재관리 기능과 데이터에 바로 연결합니다.</p></div><a class="primary inventory-open" href="${integratedInventoryUrl}" target="_blank" rel="noopener noreferrer">새 창에서 열기</a></div><section class="inventory-embed"><iframe title="애니워터 자재관리 프로그램" src="${integratedInventoryUrl}" loading="eager" allow="clipboard-read; clipboard-write"></iframe><p>화면이 표시되지 않으면 <a href="${integratedInventoryUrl}" target="_blank" rel="noopener noreferrer">통합 자재관리 화면을 새 창에서 여세요.</a></p></section>`;
};
