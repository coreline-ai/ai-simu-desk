/** Min waits for evidence, rechecks a discrepancy, then makes a small commitment. */
export const profile=Object.freeze({
 id:'min',
 label:'민 · 확인하고 확정하는 QA',
 startOffset:2.4,
 workDuration:11.2,
 signatures:Object.freeze([
  '항목을 차례로 짚고 화면과 길게 대조한 뒤 짧게 표시',
  '불일치를 발견하면 펜을 멈추고 종이와 화면을 다시 확인',
  '최종 항목을 검토하고 작은 체크 두 개와 두 번의 끄덕임으로 확정',
 ]),
 habit:'손가락을 펴서 기준 카드를 가리키고 종이와 화면을 번갈아 확인한다',
 completion:'펜을 띄우고 두 번 작게 끄덕인 뒤 안심한 표정으로 손을 푼다',
});
