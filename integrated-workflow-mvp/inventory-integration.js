const legacyInventoryUrl = "https://anywater-inventory.dongho4619.chatgpt.site/?version=192";

inventoryPage = function inventoryPage() {
  return `<div class="sectionhead inventory-source-head"><div><h2>재고·자재</h2><p>기존 애니워터 자재관리 프로그램을 원본 그대로 사용합니다.</p></div><a class="primary inventory-open" href="${legacyInventoryUrl}" target="_blank" rel="noopener noreferrer">새 창에서 열기</a></div><section class="inventory-embed"><iframe title="애니워터 자재관리 프로그램" src="${legacyInventoryUrl}" loading="eager" allow="clipboard-read; clipboard-write"></iframe><p>화면이 표시되지 않으면 <a href="${legacyInventoryUrl}" target="_blank" rel="noopener noreferrer">기존 자재관리 프로그램을 새 창에서 여세요.</a></p></section>`;
};
