// name@domain.tld, checked step by step (a single regex for this can backtrack for a long time)
export function isValidEmail(value) {
  if (/\s/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2 || !parts[0]) return false;
  const dot = parts[1].lastIndexOf('.');
  return dot > 0 && dot < parts[1].length - 1;
}
