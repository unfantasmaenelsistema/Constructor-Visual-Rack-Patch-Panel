import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Cable,
  Network,
  Wifi,
  Printer,
  PhoneCall,
  Monitor,
  ShieldAlert,
  Server,
  ArrowRight,
} from 'lucide-react';
import { CABLE_COLORS } from '../data/rackData';
import {
  CableColor,
  PatchCable,
  PlacedDevice,
  WallOutlet,
} from '../types/rack';
import { getTemplateById } from '../utils/rackEngine';

interface ClassroomOutletsPanelProps {
  wallOutlets: WallOutlet[];
  devices: PlacedDevice[];
  cables: PatchCable[];
  selectedColor: CableColor;
  needsRouterUplink: boolean;
  needsServerLink: boolean;
  highlightedOutletId: string | null;
  onSelectColor: (color: CableColor) => void;
  onHighlightOutlet: (outletId: string | null) => void;
  onStartPatchFromOutlet: (outlet: WallOutlet) => void;
  onQuickPatchAllOptimal?: () => void;
}

export const ClassroomOutletsPanel: React.FC<ClassroomOutletsPanelProps> = ({
  wallOutlets,
  devices,
  cables,
  selectedColor,
  needsRouterUplink,
  needsServerLink,
  highlightedOutletId,
  onSelectColor,
  onHighlightOutlet,
  onStartPatchFromOutlet,
}) => {
  const patchPanels = devices.filter(
    (d) => getTemplateById(d.templateId)?.category === 'patch_panel'
  );
  const switches = devices.filter(
    (d) => getTemplateById(d.templateId)?.category === 'switch'
  );
  const routers = devices.filter(
    (d) => getTemplateById(d.templateId)?.category === 'router'
  );
  const servers = devices.filter(
    (d) => getTemplateById(d.templateId)?.category === 'server'
  );

  const ppIds = new Set(patchPanels.map((p) => p.instanceId));
  const swIds = new Set(switches.map((s) => s.instanceId));
  const rtrIds = new Set(routers.map((r) => r.instanceId));
  const srvIds = new Set(servers.map((s) => s.instanceId));

  const getServiceIcon = (type: WallOutlet['serviceType']) => {
    switch (type) {
      case 'workstation':
        return <Monitor className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'wifi_ap':
        return <Wifi className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'server_nas':
        return <Printer className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'voip_phone':
        return <PhoneCall className="w-4 h-4 text-purple-400 shrink-0" />;
      default:
        return <Network className="w-4 h-4 text-rose-400 shrink-0" />;
    }
  };

  // Verificar enlace Router Uplink
  const routerCable = cables.find(
    (c) =>
      (swIds.has(c.fromInstanceId) && rtrIds.has(c.toInstanceId)) ||
      (rtrIds.has(c.fromInstanceId) && swIds.has(c.toInstanceId))
  );

  // Verificar enlace Servidor
  const serverCable = cables.find(
    (c) =>
      (swIds.has(c.fromInstanceId) && srvIds.has(c.toInstanceId)) ||
      (srvIds.has(c.fromInstanceId) && swIds.has(c.toInstanceId))
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
      {/* Selector de rollo de latiguillos RJ45 por código de colores */}
      <div className="border-b border-slate-800 pb-3.5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Cable className="w-4 h-4 text-sky-400" />
            <span>1. Selecciona Color de Latiguillo RJ45 (Normativa ANSI/TIA-606-C)</span>
          </h3>
          <span className="font-mono text-xs text-slate-400">
            Activo: {CABLE_COLORS[selectedColor].name.split(' ')[0]}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {Object.values(CABLE_COLORS).map((spec) => {
            const isSelected = selectedColor === spec.id;
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => onSelectColor(spec.id)}
                className={`text-left p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-800 border-white ring-1 ring-white shadow-md'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/40"
                    style={{ backgroundColor: spec.hex }}
                  />
                  <span className="font-mono text-xs font-bold text-slate-100 truncate">
                    {spec.name.split(' ')[0]}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                  {spec.usage}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tomas de Red del Aula / Oficina (Rosetas RJ45 consolidadas al Patch Panel) */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              2. Tomas de Red del Aula / Oficina → Patch Panel → Switch
            </h3>
            <p className="text-xs text-slate-400">
              Haz clic en una roseta de pared para activar su boca en el Patch Panel y luego pulsa una boca libre del Switch.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-400 shrink-0">
            {patchPanels.length === 0
              ? 'Instala antes el Patch Panel en el Rack'
              : `${wallOutlets.length} rosetas terminadas`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {wallOutlets.map((outlet) => {
            const connectedCable = cables.find(
              (c) =>
                (ppIds.has(c.fromInstanceId) &&
                  c.fromPort === outlet.patchPanelPort &&
                  swIds.has(c.toInstanceId)) ||
                (ppIds.has(c.toInstanceId) &&
                  c.toPort === outlet.patchPanelPort &&
                  swIds.has(c.fromInstanceId))
            );

            const switchPort = connectedCable
              ? swIds.has(connectedCable.toInstanceId)
                ? connectedCable.toPort
                : connectedCable.fromPort
              : null;

            const isColorCorrect =
              connectedCable && connectedCable.color === outlet.expectedColor;

            const isHighlighted = highlightedOutletId === outlet.id;

            return (
              <div
                key={outlet.id}
                onMouseEnter={() => onHighlightOutlet(outlet.id)}
                onMouseLeave={() => onHighlightOutlet(null)}
                onClick={() => onStartPatchFromOutlet(outlet)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isHighlighted
                    ? 'bg-indigo-950/50 border-indigo-400'
                    : connectedCable
                    ? isColorCorrect
                      ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                      : 'bg-amber-950/25 border-amber-500/50 hover:border-amber-400'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5">{getServiceIcon(outlet.serviceType)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                      <span className="font-mono text-indigo-300">{outlet.code}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{outlet.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                      <span>{outlet.roomZone}</span>
                      <span aria-hidden="true">→</span>
                      <span className="text-indigo-200 font-semibold">
                        Patch Panel Boca #{outlet.patchPanelPort}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {connectedCable ? (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1 font-mono text-xs font-semibold">
                        {isColorCorrect ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span
                          className={
                            isColorCorrect ? 'text-emerald-300' : 'text-amber-300'
                          }
                        >
                          SW Boca #{switchPort}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {isColorCorrect
                          ? `Color ${CABLE_COLORS[connectedCable.color].name.split(' ')[0]} OK`
                          : `Usado ${
                              CABLE_COLORS[connectedCable.color].name.split(' ')[0]
                            } (Pide ${
                              CABLE_COLORS[outlet.expectedColor].name.split(' ')[0]
                            })`}
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-mono text-sky-300 hover:text-sky-200">
                      <span>Parchear</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enlaces Troncales Internos del Rack (Router Uplink y Servidor) */}
      <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-2">
        {needsRouterUplink && (
          <div
            className={`p-2.5 rounded-lg border flex items-center justify-between ${
              routerCable
                ? routerCable.color === 'red'
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-amber-950/25 border-amber-500/50'
                : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-100">
                  Enlace Troncal WAN (Switch ↔ Router/Firewall)
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Conectar Switch (Boca 23/24) a Router (Boca W1) con cable ROJO
                </div>
              </div>
            </div>
            <span className="font-mono text-xs font-semibold shrink-0">
              {routerCable ? (
                routerCable.color === 'red' ? (
                  <span className="text-emerald-300">OK (Rojo)</span>
                ) : (
                  <span className="text-amber-300">Color erróneo</span>
                )
              ) : (
                <span className="text-rose-300">Pendiente</span>
              )}
            </span>
          </div>
        )}

        {needsServerLink && (
          <div
            className={`p-2.5 rounded-lg border flex items-center justify-between ${
              serverCable
                ? serverCable.color === 'green'
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-amber-950/25 border-amber-500/50'
                : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-100">
                  Enlace Servidor Rack 2U (Servidor ↔ Switch)
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Conectar Servidor (NIC G1) a Switch con cable VERDE
                </div>
              </div>
            </div>
            <span className="font-mono text-xs font-semibold shrink-0">
              {serverCable ? (
                serverCable.color === 'green' ? (
                  <span className="text-emerald-300">OK (Verde)</span>
                ) : (
                  <span className="text-amber-300">Color erróneo</span>
                )
              ) : (
                <span className="text-emerald-300">Pendiente</span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
