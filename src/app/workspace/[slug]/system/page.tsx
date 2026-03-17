'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';

type ProviderProbe = {
  name: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

type ChannelHealth = {
  channel: string;
  ok: boolean;
  activeSessions: number;
  lastSeen?: string;
};

type SystemStatus = {
  gateway: { connected: boolean; url?: string; version?: string };
  providers: ProviderProbe[];
  channels: ChannelHealth[];
  uptime?: string;
  mcVersion?: string;
};

export default function SystemPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // Fetch gateway status
      const [gatewayRes, sessionsRes] = await Promise.all([
        fetch('/api/openclaw/status'),
        fetch('/api/openclaw/sessions?session_type=persistent'),
      ]);

      const gatewayData = gatewayRes.ok ? await gatewayRes.json() : { connected: false };
      const sessionsData = sessionsRes.ok ? await sessionsRes.json() : [];
      const sessions = Array.isArray(sessionsData) ? sessionsData : sessionsData?.sessions || [];

      // Build channel health from sessions
      const channelMap = new Map<string, { ok: boolean; activeSessions: number; lastSeen?: string }>();
      for (const s of sessions) {
        const ch = s.channel || 'default';
        const existing = channelMap.get(ch) || { ok: false, activeSessions: 0 };
        existing.activeSessions += 1;
        if (!s.ended_at) existing.ok = true;
        if (s.updated_at && (!existing.lastSeen || s.updated_at > existing.lastSeen)) {
          existing.lastSeen = s.updated_at;
        }
        channelMap.set(ch, existing);
      }

      const channels: ChannelHealth[] = Array.from(channelMap.entries()).map(([channel, data]) => ({
        channel,
        ...data,
      }));

      // Probe models endpoint for provider health
      const providers: ProviderProbe[] = [];
      try {
        const start = Date.now();
        const modelsRes = await fetch('/api/openclaw/models');
        const latencyMs = Date.now() - start;
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          const models = Array.isArray(modelsData) ? modelsData : modelsData?.models || [];
          if (models.length > 0) {
            providers.push({ name: 'OpenClaw Gateway', ok: true, latencyMs });
          } else {
            providers.push({ name: 'OpenClaw Gateway', ok: gatewayData.connected, latencyMs });
          }
        } else {
          providers.push({ name: 'OpenClaw Gateway', ok: false, error: 'Models endpoint unreachable' });
        }
      } catch {
        providers.push({ name: 'OpenClaw Gateway', ok: false, error: 'Connection failed' });
      }

      setStatus({
        gateway: {
          connected: gatewayData.connected ?? false,
          version: gatewayData.version,
        },
        providers,
        channels,
        mcVersion: 'v1.5.3',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load system status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const timer = setInterval(() => loadStatus(true), 15000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  // Health score calculation with Gateway weighted at 50%
  const { healthScore, healthBreakdown, isCritical } = useMemo(() => {
    if (!status) return { healthScore: 0, healthBreakdown: null, isCritical: false };

    // Gateway is weighted at 50% of total score
    const gatewayScore = status.gateway.connected ? 50 : 0;

    // Providers and channels split the remaining 50%
    const providerCount = status.providers.length;
    const channelCount = status.channels.length;
    const otherTotal = providerCount + channelCount;

    let otherScore = 0;
    if (otherTotal > 0) {
      const providerOk = status.providers.filter(p => p.ok).length;
      const channelOk = status.channels.filter(c => c.ok).length;
      otherScore = Math.round(((providerOk + channelOk) / otherTotal) * 50);
    } else {
      // If no providers/channels, gateway is 100% of score
      otherScore = status.gateway.connected ? 50 : 0;
    }

    const totalScore = gatewayScore + otherScore;

    // Gateway down is a critical failure
    const critical = !status.gateway.connected;

    const breakdown = {
      gateway: status.gateway.connected ? 'OK' : 'DOWN',
      providers: `${status.providers.filter(p => p.ok).length}/${status.providers.length} OK`,
      channels: `${status.channels.filter(c => c.ok).length}/${status.channels.length} active`,
    };

    return { healthScore: totalScore, healthBreakdown: breakdown, isCritical: critical };
  }, [status]);

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Server className="w-5 h-5 text-mc-accent" />
              System Health
            </h1>
            <p className="text-sm text-mc-text-secondary mt-0.5">
              Gateway status, provider probes, channel health
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className={`text-2xl font-bold flex items-center gap-2 ${isCritical ? 'text-mc-accent-red' : healthScore >= 80 ? 'text-mc-accent-green' : healthScore >= 50 ? 'text-mc-accent-yellow' : 'text-mc-accent-red'}`}>
                {loading ? '…' : `${healthScore}%`}
                {isCritical && !loading && (
                  <span className="px-2 py-0.5 text-xs bg-mc-accent-red/20 text-mc-accent-red rounded">CRITICAL</span>
                )}
              </div>
              {healthBreakdown && !loading && (
                <div className="absolute right-0 top-full mt-2 z-10 hidden group-hover:block bg-mc-bg-secondary border border-mc-border rounded-lg p-3 text-xs min-w-[180px] shadow-lg">
                  <div className="font-medium mb-2 text-mc-text">Health Breakdown</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-mc-text-secondary">Gateway (50%):</span>
                      <span className={healthBreakdown.gateway === 'OK' ? 'text-mc-accent-green' : 'text-mc-accent-red font-medium'}>{healthBreakdown.gateway}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mc-text-secondary">Providers:</span>
                      <span className="text-mc-text">{healthBreakdown.providers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mc-text-secondary">Channels:</span>
                      <span className="text-mc-text">{healthBreakdown.channels}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-mc-border text-mc-text-secondary/60">
                    Gateway is weighted at 50% of total score
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => loadStatus(false)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-mc-border text-xs text-mc-text-secondary hover:text-mc-text hover:border-mc-accent/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-mc-accent-red/40 bg-mc-accent-red/5 p-4 text-sm text-mc-accent-red flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading && !status ? (
        <div className="flex items-center justify-center py-16 text-sm text-mc-text-secondary gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading system status…
        </div>
      ) : status && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gateway Status */}
          <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-mc-text-secondary mb-3 flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5" />
              Gateway Connection
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status</span>
                {status.gateway.connected ? (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-mc-accent-green/20 text-mc-accent-green">
                    <span className="w-2 h-2 rounded-full bg-mc-accent-green animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-mc-accent-red/20 text-mc-accent-red">
                    <WifiOff className="w-3 h-3" />
                    Disconnected
                  </span>
                )}
              </div>
              {status.gateway.version && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-mc-text-secondary">Gateway Version</span>
                  <span className="font-mono">{status.gateway.version}</span>
                </div>
              )}
              {status.mcVersion && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-mc-text-secondary">Mission Control</span>
                  <span className="font-mono">{status.mcVersion}</span>
                </div>
              )}
            </div>
          </div>

          {/* Provider Probes */}
          <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-mc-text-secondary mb-3 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" />
              Provider Probes
            </h3>
            {status.providers.length === 0 ? (
              <div className="text-xs text-mc-text-secondary/60 py-2">No providers probed</div>
            ) : (
              <div className="space-y-2">
                {status.providers.map((p) => (
                  <div
                    key={p.name}
                    className={`rounded border p-3 text-xs flex items-center justify-between gap-3 ${
                      p.ok ? 'border-mc-accent-green/30 bg-mc-accent-green/5' : 'border-mc-accent-red/30 bg-mc-accent-red/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {p.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-mc-accent-green flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-mc-accent-red flex-shrink-0" />
                      )}
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {p.latencyMs !== undefined && (
                        <span className="text-mc-text-secondary">{p.latencyMs}ms</span>
                      )}
                      {p.error && (
                        <span className="text-mc-accent-red">{p.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Channel Health */}
          <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-mc-text-secondary mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Channel Health
            </h3>
            {status.channels.length === 0 ? (
              <div className="text-xs text-mc-text-secondary/60 py-2">No active channels</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {status.channels.map((ch) => (
                  <div
                    key={ch.channel}
                    className={`rounded border p-3 text-xs ${
                      ch.ok ? 'border-mc-accent-green/30 bg-mc-accent-green/5' : 'border-mc-border bg-mc-bg'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-medium">{ch.channel}</span>
                      <span className={ch.ok ? 'text-mc-accent-green' : 'text-mc-text-secondary/50'}>
                        {ch.ok ? '● live' : '○ idle'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-mc-text-secondary">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {ch.activeSessions} sessions
                      </span>
                      {ch.lastSeen && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(ch.lastSeen).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
