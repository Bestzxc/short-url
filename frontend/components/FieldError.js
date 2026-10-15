// Red border classes for an invalid input, and the Thai message shown under it
export const INVALID = 'border-brand ring-4 ring-brand/10';

export default function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 pl-4 text-sm font-normal text-brand-dark">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 6h2v5H9V6zm0 6h2v2H9v-2z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}
