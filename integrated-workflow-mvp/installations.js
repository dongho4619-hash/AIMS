import { intakeFields, engineerFields } from './installation-fields.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const style = document.createElement('style');
style.textContent = '.installation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.installation-grid .wide{grid-column:1/-1}.installation-sheet{max-height:85vh;overflow:auto;width:min(760px,94vw)}.installation-list{margin-bottom:20px}.installation-item{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #e3ebee}.installation-readonly{white-space:pre-wrap;overflow-wrap:anywhere;padding:8px 0;color:#183047}.installation-error{color:#b42318;white-space:pre-wrap}@media(max-width:560px){.installation-grid{grid-template-columns:1fr}}';
document.head.append(style);
const dialog = document.createElement('div');
dialog.className = 'modal runtime-modal';
dialog.setAttribute('aria-hidden', 'true');
document.body.append(dialog);
let activeRecord = null;
let saving = false;
let previousFocus;

async function api(path = '', options = {}) {
  const response = await fetch(`/api/installations${path}`, { ...options, headers: { 'content-type': 'application/json' } });
  const data = await response.json().catch(() => ({ error: '서버 응답을 확인할 수 없습니다. 다시 시도해주세요.' }));
  if (!response.ok) throw new Error(data.error || '저장하지 못했습니다. 다시 시도해주세요.');
  return data;
}
function inputs(fields, values = {}) {
  return fields.map(([label, key, type = 'text']) => `<label class="runtime-field ${type === 'textarea' ? 'wide' : ''}">${escape(label)}${type === 'textarea'
    ? `<textarea name="${key}" maxlength="5000" rows="4">${escape(values[key])}</textarea>`
    : `<input name="${key}" type="${type}" maxlength="500" value="${escape(values[key])}" ${['store', 'address'].includes(key) ? 'required' : ''}>`}</label>`).join('');
}
function readonly(fields, values) {
  return fields.map(([label, key]) => `<div class="runtime-field">${escape(label)}<div class="installation-readonly">${escape(values[key] || '미입력')}</div></div>`).join('');
}
function open(record = null, engineering = false) {
  activeRecord = record;
  previousFocus = document.activeElement;
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  dialog.innerHTML = `<div class="modal-backdrop" data-install-close></div><section class="modal-card installation-sheet" role="dialog" aria-modal="true" aria-labelledby="installation-title">
    <button class="modal-close" data-install-close aria-label="닫기">×</button>
    <p class="detail-kicker">INSTALLATION REQUEST</p><h2 id="installation-title">${record ? '설치요청서 · ' + escape(record.intake.store) : '기술부 설치요청서 접수'}</h2>
    <p>접수팀이 요청서를 작성하고 엔지니어가 현장에서 작업 내용을 추가합니다.</p>
    <form><h3>C/S 접수팀 작성</h3><div class="installation-grid">${record ? readonly(intakeFields, record.intake) : inputs(intakeFields, { receivedDate: localDate })}</div>
    <h3>엔지니어 현장 작성</h3>${record ? `<div class="installation-grid">${engineering ? inputs(engineerFields, record.engineer) : readonly(engineerFields, record.engineer)}</div>` : '<p>오픈 · 휴무 · 수압 · 액자 · S/N 2개 · 기타 설치내용은 현장 작업에서 입력합니다.</p>'}
    <p class="installation-error" role="alert"></p><div class="detail-actions"><button type="button" data-install-close>닫기</button>${!record || engineering ? '<button class="primary" type="submit">저장</button>' : ''}</div></form></section>`;
  dialog.classList.add('open');
  dialog.setAttribute('aria-hidden', 'false');
  dialog.querySelector('input,button').focus();
}
function close() {
  if (saving) return;
  dialog.classList.remove('open');
  dialog.setAttribute('aria-hidden', 'true');
  previousFocus?.focus();
}
dialog.addEventListener('click', event => { if (event.target.closest('[data-install-close]')) close(); });
dialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') close();
  if (event.key === 'Tab') {
    const items = [...dialog.querySelectorAll('button,input,textarea')].filter(item => !item.disabled);
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  }
});
dialog.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  if (activeRecord) data.updatedAt = activeRecord.updatedAt;
  saving = true;
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  submit.textContent = '저장 중…';
  try {
    await api(activeRecord ? `/${encodeURIComponent(activeRecord.id)}` : '', { method: activeRecord ? 'PATCH' : 'POST', body: JSON.stringify(data) });
    saving = false;
    close();
    document.querySelectorAll('.installation-list').forEach(load);
    runtimeToast('설치요청서가 서버에 저장되었습니다.');
  } catch (error) { form.querySelector('[role=alert]').textContent = error.message; }
  finally { saving = false; submit.disabled = false; submit.textContent = '저장'; }
});

async function load(panel) {
  const list = panel.querySelector('[data-install-list]');
  list.textContent = '불러오는 중…';
  try {
    const { records } = await api();
    list.replaceChildren();
    if (!records.length) list.textContent = '아직 등록된 설치요청서가 없습니다.';
    for (const record of records) {
      const row = document.createElement('div');
      row.className = 'installation-item';
      row.innerHTML = `<div><strong>${escape(record.intake.store)}</strong><p>${escape(record.intake.installDate || '설치일 미정')} · ${escape(record.intake.model)} · ${record.engineerUpdatedAt ? '현장 내용 저장됨' : '현장 입력 대기'}</p></div>`;
      const button = document.createElement('button');
      button.className = 'primary';
      button.textContent = panel.dataset.mode === 'field' ? '현장 내용 작성' : '요청서 보기';
      button.addEventListener('click', () => open(record, panel.dataset.mode === 'field'));
      row.append(button);
      list.append(row);
    }
    const note = document.createElement('p');
    note.textContent = '최근 설치요청서 최대 500건을 표시합니다.';
    list.append(note);
  } catch (error) { list.textContent = error.message; }
}
function mount() {
  const page = document.querySelector('#nav .navitem.active')?.dataset.page;
  const host = document.querySelector('#app');
  if (!['cases', 'field'].includes(page) || host.querySelector('.installation-list')) return;
  const panel = document.createElement('section');
  panel.className = 'panel installation-list';
  panel.dataset.mode = page;
  panel.innerHTML = '<div class="panelhead"><h3>기술부 설치요청서 · 실제 접수</h3><button type="button" class="link">새로고침</button></div><div data-install-list></div>';
  panel.querySelector('button').onclick = () => load(panel);
  if (page === 'cases') {
    const create = document.createElement('button');
    create.className = 'primary';
    create.textContent = '+ 설치요청서 접수';
    create.onclick = () => open();
    panel.querySelector('.panelhead').append(create);
  }
  host.prepend(panel);
  load(panel);
}
window.openInstallationRequest = () => open();
new MutationObserver(mount).observe(document.querySelector('#app'), { childList: true });
mount();
