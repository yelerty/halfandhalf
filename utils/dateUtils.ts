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
 */
export function isPostExpired(post: { date?: string; endTime: string }): boolean {
  const now = new Date();

  if (post.date && post.endTime) {
    const postEndDateTime = new Date(`${post.date}T${post.endTime}:00`);
    return postEndDateTime < now;
  } else if (post.endTime) {
    // 날짜가 없는 경우 (기존 게시글 호환성)
    const today = now.toISOString().split('T')[0];
    const postEndDateTime = new Date(`${today}T${post.endTime}:00`);
    return postEndDateTime < now;
  }

  return false;
}
