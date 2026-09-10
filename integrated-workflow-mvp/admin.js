if (window.location.pathname.startsWith("/integrated-app")) {
  const originalIntegratedFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith("/api/")) input = `/integrated-app${input}`;
    return originalIntegratedFetch(input, init);
  };
}
const adminStyle = document.createElement("style");
adminStyle.textContent = ".integrated-admin-banner{display:none;align-items:center;justify-content:space-between;gap:18px;margin:0 0 18px;padding:18px 20px;border:1px solid #ead7c5;border-radius:18px;background:linear-gradient(110deg,#fff8f1,#fff);box-shadow:0 10px 28px #8a673c12}.integrated-admin-banner.visible{display:flex}.integrated-admin-banner-copy{display:grid;gap:5px}.integrated-admin-banner-copy span{color:#a26838;font-size:9px;font-weight:850;letter-spacing:.14em}.integrated-admin-banner-copy strong{font-size:15px}.integrated-admin-banner-copy small{color:#7b766f;font-size:10px}.integrated-admin-banner-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.integrated-admin-banner-actions button{min-height:38px;padding:0 12px;border:1px solid #ead7c5;border-radius:10px;background:#fff;color:#7b542f;font-size:10px;font-weight:850;cursor:pointer}.integrated-admin-banner-actions button:hover{background:#fff3e7;border-color:#d9b898}@media(max-width:620px){.integrated-admin-banner{align-items:stretch;flex-direction:column;padding:16px}.integrated-admin-banner-actions{display:grid;grid-template-columns:1fr 1fr}.integrated-admin-banner-actions button{width:100%}.integrated-admin-banner-actions button:last-child{grid-column:1/-1}}";
document.head.appendChild(adminStyle);

let integratedSession = { isAdmin: false };
async function loadIntegratedSession() {
  try {
    const response = await fetch("/api/session", { headers: { accept: "application/json" } });
    if (response.ok) integratedSession = await response.json();
  } catch {}
  renderIntegratedAdminBanner();
}

function renderIntegratedAdminBanner() {
  const app = document.querySelector("#app");
  if (!app || !integratedSession.isAdmin || document.querySelector(".integrated-admin-banner")) return;
  const banner = document.createElement("section");
  banner.className = "integrated-admin-banner visible";
  banner.setAttribute("aria-label", "관리자 업무 바로가기");
  banner.innerHTML = `<div class="integrated-admin-banner-copy"><span>ADMIN ONLY</span><strong>관리자 확인이 필요한 업무</strong><small>전체 부서 업무, 승인 대기, 재고 부족과 변경 이력을 확인합니다.</small></div><div class="integrated-admin-banner-actions"><button type="button" data-admin-action="cases">C/S 배정 확인</button><button type="button" data-admin-action="inventory">재고 부족 확인</button><button type="button" data-admin-action="reports">관리자 통계 보기</button></div>`;
  app.prepend(banner);
  banner.querySelectorAll("[data-admin-action]").forEach(button => button.addEventListener("click", () => window.dispatchEvent(new CustomEvent("integrated-admin-navigate", { detail: button.dataset.adminAction }))));
}

new MutationObserver(renderIntegratedAdminBanner).observe(document.querySelector("#app"), { childList: true });
window.addEventListener("integrated-admin-navigate", event => {
  if (typeof go === "function") go(event.detail);
});
loadIntegratedSession();
