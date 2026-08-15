/**
 * Generic status pill. Pass a style object shaped like the ones in
 * utils/constants.js: { label, text, bg, dot? }.
 */
export function Badge({ style, showDot = false, className = '' }) {
  if (!style) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide ${style.bg} ${style.text} ${className}`}
    >
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />}
      {style.label}
    </span>
  );
}
