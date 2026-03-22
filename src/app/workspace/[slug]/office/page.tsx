'use client';

import { useEffect, useMemo, useState } from 'react';
import { Wifi, WifiOff, Users, Clock } from 'lucide-react';

type PresenceRow = {
  agentId: string;
  displayName: string;
  roomId: string;
  lastSeen: string;
};

export default function OfficePage() {
  const [gatewayConnected, setGatewayConnected] = useState<boolean>(true);
  const [lastGatewaySeen, setLastGatewaySeen] = useState<string | null>(null);
  const [presenceByAgent, setPresenceByAgent] = useState<Record<string, PresenceRow>>({});

  useEffect(() => {
    // Poll gateway status
    const checkGateway = async () => {
      try {
        const res = await fetch('/api/openclaw/status');
        if (res.ok) {
          const data = await res.json();
          setGatewayConnected(data.connected ?? false);
          setLastGatewaySeen(new Date().toISOString());
        }
      } catch {
        setGatewayConnected(false);
      }
    };

    checkGateway();
    const timer = setInterval(checkGateway, 10000);

    // SSE for live presence
    const source = new EventSource('/api/events/stream');

    source.onmessage = (event) => {
      if (!event.data || event.data.startsWith(':')) return;

      try {
        const sse = JSON.parse(event.data);

        if (sse.type === 'mc:presence_update') {
          const payload = sse.payload || {};
          const eventType = payload.event ?? (payload.room_id ? 'enter' : 'leave');
          const agentId = payload.agent_id;
          if (!agentId) return;

          setPresenceByAgent((prev) => {
            const next = { ...prev };
            if (eventType === 'leave') {
              delete next[agentId];
              return next;
            }
            next[agentId] = {
              agentId,
              displayName: payload.display_name || agentId,
              roomId: payload.room_id || 'unassigned',
              lastSeen: new Date().toISOString(),
            };
            return next;
          });
        }
      } catch {
        // Ignore malformed events
      }
    };

    source.onerror = () => {
      setGatewayConnected(false);
    };

    return () => {
      clearInterval(timer);
      source.close();
    };
  }, []);

  const presenceRows = useMemo(() => Object.values(presenceByAgent), [presenceByAgent]);

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-mc-accent" />
          Office
        </h1>
        <p className="text-sm text-mc-text-secondary mt-0.5">Live presence and gateway connection status</p>
      </div>

      {/* Gateway Status */}
      <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-mc-text-secondary flex items-center gap-2">
            {gatewayConnected ? <Wifi className="w-3.5 h-3.5 text-mc-accent-green" /> : <WifiOff className="w-3.5 h-3.5 text-mc-accent-red" />}
            Gateway Connection
          </h3>
          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded ${
            gatewayConnected
              ? 'bg-mc-accent-green/20 text-mc-accent-green'
              : 'bg-mc-accent-red/20 text-mc-accent-red'
          }`}>
            <span className={`w-2 h-2 rounded-full ${gatewayConnected ? 'bg-mc-accent-green animate-pulse' : 'bg-mc-accent-red'}`} />
            {gatewayConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {!gatewayConnected && lastGatewaySeen && (
          <div className="mt-2 text-xs text-mc-accent-yellow flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last seen {new Date(lastGatewaySeen).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Office Map Canvas */}
      <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
        <div className="h-[200px] rounded-lg border border-mc-border/60 bg-[linear-gradient(45deg,#171717_25%,#1f1f1f_25%,#1f1f1f_50%,#171717_50%,#171717_75%,#1f1f1f_75%,#1f1f1f_100%)] [background-size:48px_48px] flex items-center justify-center">
          <div className="text-sm text-mc-text-secondary">Office map canvas (interactive pass in P3)</div>
        </div>
      </div>

      {/* Live Presence */}
      <div className="rounded-lg border border-mc-border bg-mc-bg-secondary p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-mc-text-secondary mb-3">
          Live Presence
        </h3>
        {presenceRows.length === 0 ? (
          <div className="text-sm text-mc-text-secondary">No active presence events yet.</div>
        ) : (
          <div className="space-y-1.5">
            {presenceRows.map((row) => (
              <div key={row.agentId} className="flex items-center justify-between rounded border border-mc-border/40 bg-mc-bg p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-mc-accent-green animate-pulse" />
                  <span className="font-medium">{row.displayName}</span>
                </div>
                <span className="text-mc-text-secondary font-mono">{row.roomId}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
