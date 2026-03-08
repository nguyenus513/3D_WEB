export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-void)]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-[var(--color-accent)] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--text-secondary)] animate-pulse">Đang tải giỏ hàng...</p>
      </div>
    </div>
  );
}
