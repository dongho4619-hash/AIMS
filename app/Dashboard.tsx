"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type MaterialRequest = {
  id: number; requestNumber: string; itemName: string; specification: string;
  quantity: number; unit: string; requester: string; department: string;
  requiredDate: string; purpose: string; urgency: string; status: string; createdAt: string;
};

const statusMeta: Record<string, { label: string; tone: string }> = {
  pending: { label: "승인 대기", tone: "amber" }, approved: { label: "승인 완료", tone: "purple" },
  purchasing: { label: "구매 진행", tone: "blue" }, ready: { label: "출고 대기", tone: "teal" },
  completed: { label: "출고 완료", tone: "green" }, rejected: { label: "반려", tone: "red" },
};

const emptyForm = { itemName: "", specification: "", quantity: 1, unit: "EA", requester: "", department: "기구설계 1팀", requiredDate: "", purpose: "", urgency: "normal" };

export function Dashboard() {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => { void loadRequests(); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadRequests() {
    setLoading(true);
    try {
      const response = await fetch("/api/requests");
      const data = await response.json() as { requests?: MaterialRequest[]; error?: string };
      if (!response.ok) throw new Error(data.error);
      setRequests(data.requests ?? []);
    } catch { setError("신청 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); }
    finally { setLoading(false); }
  }

  const visibleRequests = useMemo(() => requests.filter((request) => {
    const matchesStatus = filter === "all" || request.status === filter;
    const keyword = query.trim().toLowerCase();
    const matchesQuery = !keyword || `${request.requestNumber} ${request.itemName} ${request.requester} ${request.department}`.toLowerCase().includes(keyword);
    return matchesStatus && matchesQuery;
  }), [requests, filter, query]);

  const pending = requests.filter((request) => request.status === "pending").length;
  const purchasing = requests.filter((request) => ["approved", "purchasing", "ready"].includes(request.status)).length;
  const completed = requests.filter((request) => request.status === "completed").length;

  async function submitRequest(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json() as { request?: MaterialRequest; error?: string };
      if (!response.ok || !data.request) throw new Error(data.error);
      setRequests((current) => [data.request!, ...current]);
      setForm(emptyForm); setModalOpen(false); setToast("자재 신청이 등록되었습니다.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "신청 등록에 실패했습니다."); }
    finally { setSaving(false); }
  }

  async function changeStatus(id: number, status: string) {
    const previous = requests;
    setRequests((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    try {
      const response = await fetch("/api/requests", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
      if (!response.ok) throw new Error();
      setToast("진행 상태가 변경되었습니다.");
    } catch { setRequests(previous); setToast("상태를 변경하지 못했습니다."); }
  }

  const today = new Intl.DateTimeFormat("ko-KR", { dateStyle: "full" }).format(new Date());

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">M</span><span>MATFLOW</span></div>
        <nav aria-label="주요 메뉴">
          <button className="nav-item active" onClick={() => setFilter("all")}><span>⌂</span> 대시보드</button>
          <button className="nav-item" onClick={() => setModalOpen(true)}><span>▤</span> 자재 신청</button>
          <button className="nav-item" onClick={() => { setFilter("completed"); document.querySelector("#requests")?.scrollIntoView(); }}><span>□</span> 출고 현황</button>
          <button className="nav-item" onClick={() => document.querySelector("#requests")?.scrollIntoView()}><span>↻</span> 신청 내역</button>
        </nav>
        <div className="sidebar-foot">
          <div className="support-card"><span className="support-dot">?</span><strong>도움이 필요하신가요?</strong><small>자재 담당자에게 문의해 주세요</small></div>
          <div className="profile"><span className="avatar">기</span><div><strong>기술부</strong><small>자재 신청 시스템</small></div><button aria-label="사용자 메뉴">···</button></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p>{today}</p><h1>기술부 자재 신청 현황 <span>👋</span></h1></div>
          <div className="top-actions"><button className="icon-button" aria-label="알림">♢{pending > 0 && <i />}</button><button className="primary-button" onClick={() => setModalOpen(true)}>＋ 자재 신청하기</button></div>
        </header>

        <section className="hero-card">
          <div><span className="eyebrow">빠른 자재 신청</span><h2>필요한 자재를<br />간편하게 신청하세요.</h2><p>품목과 수량을 입력하면 담당자에게 바로 전달됩니다.<br />승인부터 출고까지 한눈에 확인할 수 있어요.</p><button className="dark-button" onClick={() => setModalOpen(true)}>신청서 작성하기 <span>→</span></button></div>
          <div className="hero-visual" aria-hidden="true"><div className="gear">✣</div><div className="box box-back"/><div className="box box-front"><b>MAT</b><span>TECH MATERIAL</span></div><div className="bolt">⬡</div><div className="accent-line" /></div>
        </section>

        <section className="stats-grid" aria-label="신청 요약">
          <article><span className="stat-icon amber">⌛</span><div><p>승인 대기</p><strong>{pending}<small>건</small></strong></div><em>{pending ? "확인이 필요해요" : "처리할 신청이 없어요"}</em></article>
          <article><span className="stat-icon blue">↗</span><div><p>처리 진행</p><strong>{purchasing}<small>건</small></strong></div><em>승인·구매·출고 준비</em></article>
          <article><span className="stat-icon green">✓</span><div><p>출고 완료</p><strong>{completed}<small>건</small></strong></div><em>누적 완료 건수</em></article>
        </section>

        <section className="request-section" id="requests">
          <div className="section-title request-tools">
            <div><h3>자재 신청 내역</h3><p>신청 내용을 검색하고 진행 상태를 관리하세요.</p></div>
            <div className="tool-row"><label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="품목·신청자 검색" aria-label="신청 내역 검색" /></label><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="상태 필터"><option value="all">전체 상태</option>{Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></div>
          </div>
          <div className="request-table">
            <div className="table-head"><span>신청 번호</span><span>품목 / 규격</span><span>신청자 / 부서</span><span>필요일</span><span>수량</span><span>진행 상태</span></div>
            {loading ? <div className="empty-state"><span className="spinner" />신청 내역을 불러오는 중입니다.</div> : visibleRequests.length === 0 ? <div className="empty-state"><strong>{query || filter !== "all" ? "검색 결과가 없습니다." : "아직 등록된 신청이 없습니다."}</strong><span>{query || filter !== "all" ? "검색어나 상태 필터를 바꿔 보세요." : "첫 자재 신청을 등록해 업무를 시작해 보세요."}</span>{!query && filter === "all" && <button onClick={() => setModalOpen(true)}>＋ 첫 신청 등록하기</button>}</div> : visibleRequests.map((request) => {
              const status = statusMeta[request.status] ?? statusMeta.pending;
              return <div className="table-row" key={request.id}><strong>{request.requestNumber}{request.urgency === "urgent" && <i className="urgent">긴급</i>}</strong><span className="material"><i>{request.itemName.slice(0, 1)}</i><span><b>{request.itemName}</b><small>{request.specification || "규격 미입력"}</small></span></span><span className="requester"><b>{request.requester}</b><small>{request.department}</small></span><span>{request.requiredDate.replaceAll("-", ".")}</span><span>{request.quantity.toLocaleString()} {request.unit}</span><select className={`status-select ${status.tone}`} value={request.status} onChange={(e) => void changeStatus(request.id, e.target.value)} aria-label={`${request.requestNumber} 진행 상태`}>{Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></div>;
            })}
          </div>
        </section>
      </section>

      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-head"><div><span className="eyebrow">NEW REQUEST</span><h2 id="modal-title">자재 신청서</h2><p>필수 항목을 입력하면 자재 담당자에게 전달됩니다.</p></div><button onClick={() => setModalOpen(false)} aria-label="신청서 닫기">×</button></div>
          <form onSubmit={submitRequest}>
            <div className="form-grid">
              <label className="wide">품목명 <b>*</b><input required value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="예: 스테인리스 육각볼트" /></label>
              <label className="wide">규격 / 모델명<input value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} placeholder="예: M8 × 30, SUS304" /></label>
              <label>수량 <b>*</b><input required min="1" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></label>
              <label>단위<select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option>EA</option><option>SET</option><option>BOX</option><option>M</option><option>KG</option></select></label>
              <label>신청자 <b>*</b><input required value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} placeholder="이름" /></label>
              <label>신청 부서 <b>*</b><select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}><option>기구설계 1팀</option><option>기구설계 2팀</option><option>전장설계팀</option><option>자동화기술팀</option><option>생산기술팀</option><option>기술지원팀</option></select></label>
              <label>필요일 <b>*</b><input required type="date" value={form.requiredDate} onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} /></label>
              <label>처리 구분<select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}><option value="normal">일반</option><option value="urgent">긴급</option></select></label>
              <label className="wide">사용 목적 / 요청 사항<textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="사용 설비, 프로젝트명 또는 참고 사항을 입력해 주세요." rows={3} /></label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setModalOpen(false)}>취소</button><button className="primary-button" disabled={saving}>{saving ? "등록 중…" : "신청 등록하기"}</button></div>
          </form>
        </section>
      </div>}
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}
