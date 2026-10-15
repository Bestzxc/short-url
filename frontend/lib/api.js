export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Calls the backend through the /api rewrite in next.config.mjs (same origin, cookie sent automatically)
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่', 0);
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Free hosts return 502/503 while the backend is waking up
    const fallback = res.status >= 500 ? 'เซิร์ฟเวอร์กำลังเริ่มทำงาน กรุณาลองใหม่อีกครั้ง' : 'เกิดข้อผิดพลาด';
    throw new ApiError(data?.error || fallback, res.status);
  }
  return data;
}
