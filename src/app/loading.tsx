export default function Loading() {
    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-void)' }}>
            <div className="flex flex-col items-center gap-4">
                <div className="relative w-10 h-10">
                    <div
                        className="absolute inset-0 rounded-full animate-spin"
                        style={{
                            border: '2px solid var(--material-glass)',
                            borderTopColor: 'var(--color-accent)',
                        }}
                    />
                </div>
                <p className="text-sm animate-pulse" style={{ color: 'var(--text-tertiary)' }}>
                    Đang tải...
                </p>
            </div>
        </div>
    );
}
