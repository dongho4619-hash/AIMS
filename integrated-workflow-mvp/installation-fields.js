export const intakeFields = [
  ['상호(지점명)', 'store'], ['주소', 'address'], ['설치일', 'installDate', 'date'],
  ['담당자 연락처', 'contact', 'tel'], ['점주님 연락처', 'ownerContact', 'tel'],
  ['모델명', 'model'], ['월사용료 (부가세 별도)', 'monthlyFee'],
  ['납부형태', 'payment'], ['의무사용기간', 'term'], ['정기점검', 'inspection'],
  ['필터교체', 'filterCycle'], ['소유권이전', 'ownership'], ['설치비', 'installationFee'],
  ['등록비', 'registrationFee'], ['철거비', 'removalFee'],
  ['오픈 예정일', 'openingDate', 'date'], ['접수일', 'receivedDate', 'date'],
  ['영업여부', 'businessStatus'], ['접수자', 'receivedBy'], ['설치형태', 'installationType'],
  ['확인 / 현장 계약서 진행 안내', 'confirmation', 'textarea']
];
export const engineerFields = [
  ['오픈', 'opening'], ['휴무', 'closedDays'], ['수압', 'waterPressure'],
  ['액자', 'frame'], ['S/N (1)', 'serialNumber1'], ['S/N (2)', 'serialNumber2'],
  ['기타 설치내용', 'installationNotes', 'textarea']
];
export function cleanFields(data, fields) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('입력 내용을 확인해주세요.');
  const result = {};
  for (const [, key, type] of fields) {
    const value = data[key] ?? '';
    if (typeof value !== 'string' || value.length > (type === 'textarea' ? 5000 : 500)) throw new Error('입력 길이 또는 형식을 확인해주세요.');
    if (type === 'date' && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)))) throw new Error('날짜를 확인해주세요.');
    result[key] = value.trim();
  }
  return result;
}
