/**
 * 날짜를 YYYY-MM-DD 형식의 문자열로 변환
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 시간을 HH:MM 형식의 문자열로 변환
 */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * YYYY-MM-DD 형식의 문자열을 Date 객체로 변환
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * HH:MM 형식의 문자열을 Date 객체로 변환
 */
export function parseTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * 게시글의 만료 여부를 확인
 * 시간 정보가 없으면 날짜만으로 판단, 날짜도 없으면 만료되지 않은 것으로 간주
 */
export function isPostExpired(post: { date?: string; endDate?: string; endTime?: string }): boolean {
  const now = new Date();

  // 날짜와 시간 모두 없으면 만료되지 않은 것으로 간주
  if (!post.date && !post.endTime) {
    return false;
  }

  // 시간이 있는 경우: endDate(있으면) 또는 date + endTime으로 판단
  if (post.endTime) {
    const endDateStr = post.endDate || post.date;
    if (endDateStr) {
      const postEndDateTime = new Date(`${endDateStr}T${post.endTime}:00`);
      return postEndDateTime < now;
    } else {
      const today = now.toISOString().split('T')[0];
      const postEndDateTime = new Date(`${today}T${post.endTime}:00`);
      return postEndDateTime < now;
    }
  }

  // 날짜만 있는 경우: 해당 날짜의 끝(23:59:59)까지 유효
  if (post.date) {
    const postEndOfDay = new Date(`${post.date}T23:59:59`);
    return postEndOfDay < now;
  }

  return false;
}

/**
 * FirestoreTimestamp를 Date로 변환 (Timestamp 인스턴스, plain object, Date 모두 처리)
 */
export function toDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date();
}

/**
 * 메시지 타임스탬프: "오전 9:42" / "오후 3:42"
 */
export function formatMessageTime(ts: any): string {
  const date = toDate(ts);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * 같은 날인지 확인
 */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/**
 * 날짜 그룹 라벨: "오늘", "어제", "2025년 3월 16일"
 */
export function getDateGroupLabel(ts: any): string {
  const date = toDate(ts);
  const now = new Date();
  if (isSameDay(date, now)) return '오늘';
  if (isSameDay(date, new Date(now.getTime() - 86400000))) return '어제';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * 채팅 목록 시간: 오늘→"HH:MM", 어제→"어제", 그외→"M/D"
 */
export function formatChatListTime(ts: any): string {
  if (!ts) return '';
  const date = toDate(ts);
  const now = new Date();
  const isToday = isSameDay(date, now);
  const isYesterday = isSameDay(date, new Date(now.getTime() - 86400000));
  if (isToday) return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return '어제';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
