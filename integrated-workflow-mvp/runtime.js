const runtimeKey = "anywater-integrated-records";
const runtimeStyle = document.createElement("style");
runtimeStyle.textContent = ".runtime-field{display:block;margin:12px 0;color:#738496;font-size:11px}.runtime-field input,.runtime-field select,.runtime-field textarea{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid #dce5e8;border-radius:7px;font:inherit;color:#183047;background:#fff}.runtime-field textarea{resize:vertical}.runtime-modal{z-index:20}";
document.head.appendChild(runtimeStyle);
const runtimeForm = document.createElement("div");
runtimeForm.className = "modal runtime-modal";
runtimeForm.setAttribute("aria-hidden", "true");
runtimeForm.innerHTML = `<div class="modal-backdrop" data-runtime-close="1"></div><section class="modal-card"><button class="modal-close" data-runtime-close="1">×</button><p class="detail-kicker">NEW WORK ITEM</p><h2 class="detail-title" id="runtimeTitle"></h2><p class="detail-subtitle">입력 내용은 현재 브라우저에 저장됩니다. 운영 전환 시 D1 저장으로 연결합니다.</p><form id="runtimeForm"><div id="runtimeFields"></div><div class="detail-actions"><button type="button" data-runtime-close="1">취소</button><button type="submit" class="primary">저장</button></div></form></section>`;
document.body.appendChild(runtimeForm);
const runtimeDefinitions = {
  cs: {title: "신규 C/S 접수", fields: [["고객·매장명", "store", "text", "한빛카페 성수점"], ["접수 유형", "type", "select", ["설치", "정기점검", "A/S", "상담"]], ["방문 희망일", "date", "date", ""]]},
  log: {title: "기술부 업무일지", fields: [["고객·매장명", "store", "text", ""], ["작업 유형", "type", "select", ["설치", "정기점검", "A/S", "출장"]], ["작업 결과", "result", "textarea", "사진·시리얼·고객서명 확인"]]},
  survey: {title: "매장 조사 등록", fields: [["고객·매장명", "store", "text", ""], ["영업 가능성", "sales", "select", ["검토중", "높음", "보류", "낮음"]], ["설치 가능성", "install", "select", ["확인 필요", "가능", "불가"]]]},
  material: {title: "자재 요청", fields: [["요청 품목", "item", "text", "필터 HK30"], ["요청 수량", "quantity", "number", "1"], ["사용 목적", "purpose", "text", "현장 작업"]]},
  production: {title: "생산실적 등록", fields: [["제품명", "item", "text", "애니워터 HK30"], ["생산 LOT", "lot", "text", "LOT-260910-A"], ["생산 수량", "quantity", "number", "0"]]},
  contract: {title: "엔컴 거래처 등록", fields: [["거래처명", "store", "text", ""], ["계약 유형", "type", "select", ["설치·관리계약", "필터관리계약", "양도·양수", "정기관리"]], ["계약 금액", "amount", "number", "0"]]},
  recovered: {title: "회수필터 등록", fields: [["고객·매장명", "store", "text", ""], ["필터·LOT", "item", "text", "HK30 · LOT-2609"], ["회수 사유", "reason", "select", ["물맛 이상", "누수", "파손", "기타"]]]}
};
function runtimeRecords() { try { return JSON.parse(localStorage.getItem(runtimeKey) || "[]"); } catch { return []; } }
function runtimeToast(message) { const target = document.querySelector("#toast"); target.textContent = message; target.classList.add("show"); setTimeout(() => target.classList.remove("show"), 2200); }
function runtimeOpen(kind) { const definition = runtimeDefinitions[kind]; if (!definition) return; document.querySelector("#runtimeTitle").textContent = definition.title; document.querySelector("#runtimeFields").innerHTML = definition.fields.map(([label, name, type, value]) => { if (type === "select") return `<label class="runtime-field">${label}<select name="${name}">${value.map(option => `<option>${option}</option>`).join("")}</select></label>`; if (type === "textarea") return `<label class="runtime-field">${label}<textarea name="${name}" rows="3" placeholder="${value}"></textarea></label>`; return `<label class="runtime-field">${label}<input required name="${name}" type="${type}" value="${value}"></label>`; }).join(""); runtimeForm.dataset.kind = kind; runtimeForm.classList.add("open"); runtimeForm.setAttribute("aria-hidden", "false"); runtimeForm.querySelector("input,select,textarea")?.focus(); }
function runtimeClose() { runtimeForm.classList.remove("open"); runtimeForm.setAttribute("aria-hidden", "true"); }
const runtimeKinds = new Map([["신규 C/S 접수", "cs"], ["+ 신규 접수", "cs"], ["업무일지 등록", "log"], ["+ 업무일지 등록", "log"], ["매장 조사 등록", "survey"], ["+ 매장 조사 등록", "survey"], ["자재 요청", "material"], ["+ 자재 요청", "material"], ["생산실적 등록", "production"], ["+ 생산실적 등록", "production"], ["거래처 등록", "contract"], ["+ 거래처 등록", "contract"], ["회수 등록", "recovered"], ["+ 회수 등록", "recovered"]]);
document.addEventListener("click", event => { const target = event.target.closest("button"); if (!target) return; const key = runtimeKinds.get(target.textContent.trim()); if (key) { event.preventDefault(); event.stopImmediatePropagation(); runtimeOpen(key); } }, true);
runtimeForm.addEventListener("click", event => { if (event.target.dataset.runtimeClose) runtimeClose(); });
runtimeForm.querySelector("form").addEventListener("submit", event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const records = runtimeRecords(); records.unshift({id: crypto.randomUUID(), kind: runtimeForm.dataset.kind, createdAt: new Date().toISOString(), status: "등록대기", ...data}); localStorage.setItem(runtimeKey, JSON.stringify(records.slice(0, 100))); runtimeClose(); runtimeToast("업무가 저장되었습니다. 담당자 확인 대기 상태입니다."); });
