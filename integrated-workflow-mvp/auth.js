const authStyle = document.createElement("style");
authStyle.textContent = ".auth-gate{position:fixed;inset:0;z-index:100;background:#102d3eeb;display:grid;place-items:center;padding:20px}.auth-card{width:min(420px,100%);padding:30px;border-radius:18px;background:#fff;box-shadow:0 24px 80px #07192366}.auth-card h2{margin:0 0 7px;color:#183047;font-size:24px}.auth-card p{margin:0 0 20px;color:#738496;font-size:12px;line-height:1.6}.auth-card label{display:grid;gap:6px;margin:12px 0;color:#5e6c7b;font-size:11px}.auth-card input{height:42px;padding:0 11px;border:1px solid #dce5e8;border-radius:8px;font:inherit}.auth-card button{width:100%;height:44px;margin-top:10px;border:0;border-radius:8px;background:#183047;color:#fff;font-weight:700;cursor:pointer}.auth-error{margin:10px 0!important;color:#c4544e!important}.auth-caption{margin-top:14px!important;font-size:10px!important}";
document.head.appendChild(authStyle);
const authGate = document.createElement("div");
authGate.className = "auth-gate";
authGate.innerHTML = `<form class="auth-card"><span class="detail-kicker">ANYWATER INTEGRATED MANAGEMENT SYSTEM</span><h2></h2><p class="auth-description"></p><label>아이디<input name="username" autocomplete="username" required></label><label>비밀번호<input name="password" type="password" autocomplete="current-password" required></label><label class="password-confirm-field">비밀번호 확인<input name="passwordConfirm" type="password" autocomplete="new-password" required></label><label class="display-name-field">관리자 이름<input name="displayName" value="관리자" autocomplete="name"></label><p class="auth-error"></p><button type="submit"></button><p class="auth-caption">계정과 세션은 통합업무관리 전용 DB에 저장됩니다.</p></form>`;
document.body.appendChild(authGate);
const authCard = authGate.querySelector(".auth-card");
const authError = authCard.querySelector(".auth-error");
let authMode = "login";
function showAuth(mode) { authMode = mode; authGate.hidden = false; authCard.querySelector("h2").textContent = mode === "setup" ? "관리자 계정 만들기" : "로그인"; authCard.querySelector(".auth-description").textContent = mode === "setup" ? "처음 한 번만 관리자 아이디와 비밀번호를 설정하세요." : "통합업무관리 계정으로 로그인하세요."; authCard.querySelector("button").textContent = mode === "setup" ? "관리자 계정 저장" : "로그인"; authCard.querySelector(".display-name-field").hidden = mode !== "setup"; authCard.querySelector(".password-confirm-field").hidden = mode !== "setup"; authCard.querySelector("[name=passwordConfirm]").required = mode === "setup"; authCard.querySelector("[name=password]").autocomplete = mode === "setup" ? "new-password" : "current-password"; }
function hideAuth(session) { authGate.hidden = true; addPasswordButton(); window.dispatchEvent(new CustomEvent("integrated-authenticated", { detail: session })); }
function addPasswordButton() {
  if (document.querySelector(".password-change-button")) return;
  const button = document.createElement("button");
  button.className = "password-change-button";
  button.textContent = "비밀번호 변경";
  button.type = "button";
  button.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:40;border:1px solid #dce5e8;border-radius:8px;background:#fff;color:#183047;padding:10px 13px;font-size:11px;font-weight:700;cursor:pointer";
  button.onclick = () => {
    const dialog = document.createElement("div");
    dialog.style.cssText = "position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(10,24,35,.32);padding:18px";
    dialog.innerHTML = `<form style="width:min(100%,360px);display:grid;gap:12px;padding:22px;border-radius:16px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.22)"><strong>관리자 비밀번호 변경</strong><label>현재 비밀번호<input name="currentPassword" type="password" autocomplete="current-password" required style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid #ccd8dc;border-radius:8px"></label><label>새 비밀번호<input name="newPassword" type="password" minlength="8" autocomplete="new-password" required style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid #ccd8dc;border-radius:8px"></label><label>새 비밀번호 확인<input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid #ccd8dc;border-radius:8px"></label><p class="password-error" style="margin:0;color:#b42318;font-size:12px"></p><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="cancel-password">취소</button><button type="submit">변경 저장</button></div></form>`;
    const form = dialog.querySelector("form");
    const error = dialog.querySelector(".password-error");
    dialog.querySelector(".cancel-password").onclick = () => dialog.remove();
    form.onsubmit = async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      if (values.newPassword !== values.confirmPassword) { error.textContent = "새 비밀번호가 일치하지 않습니다."; return; }
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }) });
      const data = await response.json();
      if (!response.ok) { error.textContent = data.error || "비밀번호를 변경하지 못했습니다."; return; }
      dialog.remove();
      window.alert("비밀번호를 변경했습니다.");
    };
    document.body.appendChild(dialog);
  };
  document.body.appendChild(button);
}
authCard.addEventListener("submit", async event => { event.preventDefault(); authError.textContent = ""; const body = Object.fromEntries(new FormData(authCard)); body.password = String(body.password || "").trim(); body.passwordConfirm = String(body.passwordConfirm || "").trim(); if (authMode === "setup" && body.password !== body.passwordConfirm) { authError.textContent = "비밀번호가 서로 일치하지 않습니다. 두 칸을 다시 입력하세요."; return; } delete body.passwordConfirm; const endpoint = authMode === "setup" ? "/api/auth/setup" : "/api/auth/login"; try { const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const contentType = response.headers.get("content-type") || ""; const data = contentType.includes("application/json") ? await response.json() : { error: "현재 화면은 로컬 미리보기입니다. 배포된 통합관리 주소에서 다시 시도하세요." }; if (!response.ok) throw new Error(data.error || "처리하지 못했습니다."); if (authMode === "setup") { showAuth("login"); authError.textContent = "관리자 계정이 생성되었습니다. 로그인하세요."; } else hideAuth(data); } catch (error) { authError.textContent = error.message; } });
(async function initAuth() { try { const response = await fetch("/api/auth/status"); const data = await response.json(); if (data.authenticated) hideAuth(data); else showAuth(data.setupRequired ? "setup" : "login"); } catch { showAuth("login"); authError.textContent = "로그인 서버에 연결할 수 없습니다."; } })();
