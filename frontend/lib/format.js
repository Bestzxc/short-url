const dateTimeFormat = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(value) {
  return value ? dateTimeFormat.format(new Date(value)) : '-';
}

export function formatNumber(value) {
  return new Intl.NumberFormat('th-TH').format(value);
}
