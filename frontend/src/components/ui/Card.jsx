export function Card({ title, action, children, className = '', bodyClassName = '' }) {
  return (
    <section
      className={`rounded-lg border border-surface-700 bg-surface-900 shadow-panel ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-surface-700 px-4 py-3">
          {title && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className={bodyClassName || 'p-4'}>{children}</div>
    </section>
  );
}
