import { CheckCircle2, DatabaseBackup, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { BackupStatusResponse } from "../types";
import WidgetCard from "./WidgetCard";

interface BackupWidgetProps {
  refreshKey: number;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function BackupWidget({ refreshKey }: BackupWidgetProps) {
  const [data, setData] = useState<BackupStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [verifying, setVerifying] = useState(false);

  function load() {
    api
      .backupStatus()
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function handleRunBackup() {
    setRunning(true);
    setError(null);

    try {
      const response = await api.runBackup();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setRunning(false);
    }
  }

  async function handleVerifyBackup() {
    setVerifying(true);
    setError(null);

    try {
      const response = await api.verifyBackup(data?.lastRun?.id);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup verification failed");
    } finally {
      setVerifying(false);
    }
  }

  const lastRun = data?.lastRun ?? null;
  const status = data?.targetAvailable === false || lastRun?.status === "failed" ? "offline" : lastRun?.status === "success" ? "online" : "unknown";
  const verification = data?.lastVerification;

  return (
    <WidgetCard
      title="Backup"
      icon={<DatabaseBackup className="h-5 w-5" />}
      status={status}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleVerifyBackup}
            disabled={verifying || !lastRun}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-emerald-200/30 hover:text-emerald-100 disabled:opacity-50"
            title="Verify latest backup"
          >
            <CheckCircle2 className={`h-4 w-4 ${verifying ? "animate-pulse" : ""}`} />
          </button>
          <button
            type="button"
            onClick={handleRunBackup}
            disabled={running}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-amber-200/30 hover:text-amber-100 disabled:opacity-50"
            title="Run backup"
          >
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-slate-500">Last run</p>
          <p className="mt-1 font-semibold text-slate-100">{formatDate(lastRun?.finishedAt ?? lastRun?.startedAt)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-slate-500">Size</p>
          <p className="mt-1 font-semibold text-slate-100">{lastRun ? formatBytes(lastRun.bytesWritten) : "-"}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-slate-500">Target</p>
          <p className={`mt-1 font-semibold ${data?.targetAvailable === false ? "text-rose-100" : "text-emerald-100"}`}>
            {data ? (data.targetAvailable ? "Writable" : "Blocked") : "-"}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-slate-500">Verify</p>
          <p className={`mt-1 font-semibold ${verification?.status === "failed" ? "text-rose-100" : verification ? "text-emerald-100" : "text-slate-100"}`}>
            {verification?.status ?? "Not checked"}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3 text-xs text-slate-400">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-200">{data?.targetLabel ?? "Backup target"}</span>
          <span className={`rounded-full border px-2 py-0.5 uppercase tracking-[0.12em] ${data?.targetType === "external" ? "border-emerald-200/20 bg-emerald-400/10 text-emerald-100" : "border-amber-200/20 bg-amber-400/10 text-amber-100"}`}>
            {data?.targetType ?? "local"}
          </span>
        </div>
        <p className="truncate">
          <span className="text-slate-500">Path </span>
          {data?.backupDirectory ?? "Loading..."}
        </p>
        {data?.targetMessage ? <p className="mt-2 text-slate-300">{data.targetMessage}</p> : null}
        {data?.recommendedTarget ? <p className="mt-2 text-amber-100/80">{data.recommendedTarget}</p> : null}
        {lastRun?.message ? <p className="mt-2 text-slate-300">{lastRun.message}</p> : null}
      </div>

      {verification ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3 text-xs text-slate-300">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-100">{verification.message}</span>
            <span className="uppercase tracking-[0.12em] text-slate-500">{formatDate(verification.checkedAt)}</span>
          </div>
          <div className="space-y-1.5">
            {verification.items.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3">
                <span>{item.name}</span>
                <span className={item.status === "ok" ? "text-emerald-100" : item.status === "warning" ? "text-amber-100" : "text-rose-100"}>
                  {item.status === "ok" ? "OK" : item.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
    </WidgetCard>
  );
}
