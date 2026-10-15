// bcrypt on the backend only reads the first 72 BYTES of a password. Thai letters take 3 bytes
// each (English 1), so the limit is checked in bytes. Keep in sync with backend/src/lib/links.js.
const MAX_PASSWORD_BYTES = 72;

export const PASSWORD_TOO_LONG = 'รหัสผ่านยาวเกินไป (สูงสุด 72 ไบต์: ภาษาอังกฤษ 72 ตัว หรือภาษาไทยประมาณ 24 ตัว)';

export function passwordTooLong(password) {
  return new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES;
}
