"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ServiceStatus {
  status: "up" | "down";
  latency?: number;
}

interface HealthResponse {
  status: "healthy" | "degraded";
  timestamp: string;
  services: Record<string, ServiceStatus>;
}

const SERVICE_LABELS: Record<string, string> = {
  database: "Cơ sở dữ liệu",
  supabase: "Supabase Auth",
};

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
    } catch {
      setError("Không thể kết nối đến máy chủ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg backdrop-blur-xl bg-[var(--material-glass)] border border-[var(--border-color)] shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Trạng thái hệ thống</CardTitle>
          {health && (
            <div className="flex justify-center mt-2">
              <Badge
                className={
                  health.status === "healthy"
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-red-500/20 text-red-400 border-red-500/30"
                }
              >
                {health.status === "healthy" ? "Hoạt động bình thường" : "Có sự cố"}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !health && (
            <p className="text-center text-muted-foreground">Đang kiểm tra...</p>
          )}

          {error && (
            <p className="text-center text-red-400">{error}</p>
          )}

          {health &&
            Object.entries(health.services).map(([key, service]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--material-glass)] p-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      service.status === "up" ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="font-medium">
                    {SERVICE_LABELS[key] || key}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {service.latency !== undefined && (
                    <span className="text-sm text-muted-foreground">
                      {service.latency}ms
                    </span>
                  )}
                  <Badge
                    variant={service.status === "up" ? "default" : "destructive"}
                    className={
                      service.status === "up"
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                    }
                  >
                    {service.status === "up" ? "Hoạt động" : "Ngừng hoạt động"}
                  </Badge>
                </div>
              </div>
            ))}

          {health && (
            <p className="text-center text-xs text-muted-foreground mt-4">
              Lần kiểm tra cuối:{" "}
              {new Date(health.timestamp).toLocaleString("vi-VN")}
            </p>
          )}

          <div className="flex justify-center pt-2">
            <Button
              onClick={fetchHealth}
              disabled={loading}
              variant="outline"
              className="backdrop-blur-sm bg-[var(--material-glass)] border-[var(--border-color)] hover:opacity-80"
            >
              {loading ? "Đang kiểm tra..." : "Kiểm tra lại"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
