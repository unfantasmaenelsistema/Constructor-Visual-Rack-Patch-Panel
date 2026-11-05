import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Fan,
  Flame,
  Power,
  RotateCw,
  Trash2,
  Wind,
  Zap,
} from 'lucide-react';
import { CABLE_COLORS } from '../data/rackData';
import {
  CableColor,
  PatchCable,
  PlacedDevice,
  UThermalSlot,
  WallOutlet,
} from '../types/rack';
import {
  canPlaceDeviceAt,
  getOccupiedUnits,
  getTemplateById,
  hasCableManagerBetween,
  TOTAL_RACK_UNITS,
} from '../utils/rackEngine';

interface SelectedPort {
  instanceId: string;
  port: number;
  deviceLabel: string;
}

interface RackCabinetViewProps {
  devices: PlacedDevice[];
  cables: PatchCable[];
  wallOutlets: WallOutlet[];
  thermalSlots: UThermalSlot[];
  selectedColor: CableColor;
  selectedPort: SelectedPort | null;
  pendingTemplateId: string | null;
  showThermalOverlay: boolean;
  highlightedOutletId: string | null;
  onSelectPort: (portInfo: SelectedPort) => void;
  onRemoveCable: (cableId: string) => void;
  onMoveDevice: (instanceId: string, newBottomU: number) => void;
  onRemoveDevice: (instanceId: string) => void;
  onMountDeviceAtU: (templateId: string, bottomU: number) => void;
  onHighlightOutlet: (outletId: string | null) => void;
}

interface PortCoordinates {
  x: number;
  y: number;
  u: number;
}

export const RackCabinetView: React.FC<RackCabinetViewProps> = ({
  devices,
  cables,
  wallOutlets,
  thermalSlots,
  selectedPort,
  pendingTemplateId,
  showThermalOverlay,
  highlightedOutletId,
  onSelectPort,
  onRemoveCable,
  onMoveDevice,
  onRemoveDevice,
  onMountDeviceAtU,
  onHighlightOutlet,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const portRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [portCoords, setPortCoords] = useState<Map<string, PortCoordinates>>(new Map());
  const [hoveredCableId, setHoveredCableId] = useState<string | null>(null);
  const [draggedDeviceId, setDraggedDeviceId] = useState<string | null>(null);
  const [dragOverU, setDragOverU] = useState<number | null>(null);
  const [rackPerspective, setRackPerspective] = useState<'front' | 'rear'>('front');

  const occupiedMap = getOccupiedUnits(devices);

  // Recalcular posiciones exactas de cada boca RJ45 para dibujar los latiguillos SVG
  const updatePortPositions = () => {
    if (!containerRef.current || rackPerspective !== 'front') return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const nextMap = new Map<string, PortCoordinates>();

    portRefs.current.forEach((el, key) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const [instanceId] = key.split(':');
      const dev = devices.find((d) => d.instanceId === instanceId);
      nextMap.set(key, {
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2,
        u: dev ? dev.bottomU : 1,
      });
    });
    setPortCoords(nextMap);
  };

  useEffect(() => {
    updatePortPositions();
    const timer = setTimeout(updatePortPositions, 80);
    window.addEventListener('resize', updatePortPositions);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePortPositions);
    };
  }, [devices, cables, showThermalOverlay, rackPerspective]);

  const registerPortRef = (instanceId: string, port: number, el: HTMLButtonElement | null) => {
    const key = `${instanceId}:${port}`;
    if (el) {
      portRefs.current.set(key, el);
    } else {
      portRefs.current.delete(key);
    }
  };

  const getCablesForPort = (instanceId: string, port: number) => {
    return cables.filter(
      (c) =>
        (c.fromInstanceId === instanceId && c.fromPort === port) ||
        (c.toInstanceId === instanceId && c.toPort === port)
    );
  };

  const hasUpsInstalled = devices.some(
    (d) => getTemplateById(d.templateId)?.category === 'ups'
  );
  const hasPduInstalled = devices.some(
    (d) => getTemplateById(d.templateId)?.category === 'pdu'
  );

  // Unidades ordenadas de arriba (U12) a abajo (U1)
  const unitsTopToBottom = Array.from(
    { length: TOTAL_RACK_UNITS },
    (_, idx) => TOTAL_RACK_UNITS - idx
  );

  const pendingTemplate = pendingTemplateId ? getTemplateById(pendingTemplateId) : undefined;

  return (
    // En pantallas estrechas el bastidor mantiene una anchura mínima y se desplaza en horizontal
    // (como un plano); el SVG de latiguillos usa coordenadas relativas a containerRef y no se desalinea.
    <div className="overflow-x-auto max-w-full">
    <div className="relative select-none min-w-[680px]" ref={containerRef}>
      {/* Marco metálico superior del armario Rack 19" con selector Frontal / Trasero */}
      <div className="bg-slate-900 border-2 border-slate-700 rounded-t-xl px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-600 inline-block" />
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-600 inline-block" />
          </div>
          <span className="font-mono text-xs font-semibold tracking-wider text-slate-200">
            BASTIDOR 19&quot; EIA-310-D · {rackPerspective === 'front' ? 'VISTA FRONTAL (PARCHEO RJ45)' : 'VISTA TRASERA (IDC KRONE & ELÉCTRICA IEC)'}
          </span>
        </div>

        {/* Conmutador de Vista Frontal vs Vista Trasera */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setRackPerspective('front')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              rackPerspective === 'front'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Frontal (RJ45)</span>
          </button>
          <button
            type="button"
            onClick={() => setRackPerspective('rear')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              rackPerspective === 'rear'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Trasera (Krone / IEC)</span>
          </button>
        </div>
      </div>

      {/* Cuerpo principal del Rack 19" */}
      <div className="bg-slate-950 border-x-2 border-b-2 border-slate-700 rounded-b-xl p-2 sm:p-3 relative shadow-2xl">
        <div className="space-y-1">
          {unitsTopToBottom.map((u) => {
            const devAtU = occupiedMap.get(u);
            const thermal = thermalSlots[u - 1];
            const isTopRowOf2U = devAtU && devAtU.bottomU !== u;

            if (isTopRowOf2U) {
              return null;
            }

            const tpl = devAtU ? getTemplateById(devAtU.templateId) : undefined;
            const uHeight = tpl ? tpl.uHeight : 1;
            const topU = u + uHeight - 1;

            const canMountPendingHere =
              pendingTemplate && canPlaceDeviceAt(devices, u, pendingTemplate.uHeight);

            const isDragTarget = dragOverU === u;

            return (
              <div
                key={u}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverU(u);
                }}
                onDragLeave={() => setDragOverU(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverU(null);
                  const droppedInstanceId = e.dataTransfer.getData('text/rack-instance');
                  const droppedTemplateId = e.dataTransfer.getData('text/rack-template');
                  if (droppedInstanceId) {
                    onMoveDevice(droppedInstanceId, u);
                  } else if (droppedTemplateId) {
                    onMountDeviceAtU(droppedTemplateId, u);
                  }
                  setDraggedDeviceId(null);
                }}
                className={`grid grid-cols-[54px_minmax(0,1fr)_76px] items-stretch rounded-md transition-colors ${
                  uHeight === 2 ? 'min-h-[116px]' : 'min-h-[56px]'
                } ${
                  isDragTarget
                    ? 'ring-2 ring-sky-400 bg-sky-950/30'
                    : 'bg-slate-900/70'
                }`}
              >
                {/* Riel Izquierdo Numerado (EIA-310 Square Holes) */}
                <div className="bg-slate-900 border-r border-slate-800 flex flex-col justify-between py-1.5 px-1.5 select-none">
                  {uHeight === 2 ? (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
                        <div className="flex flex-col gap-1">
                          <span className="w-2 h-2 border border-slate-600 bg-slate-950 block" />
                          <span className="w-2 h-2 border border-slate-600 bg-slate-950 block" />
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-300">
                          U{topU}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-col gap-1">
                          <span className="w-2 h-2 border border-slate-600 bg-slate-950 block" />
                          <span className="w-2 h-2 border border-slate-600 bg-slate-950 block" />
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-300">
                          U{u}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between h-full">
                      <div className="flex flex-col justify-between h-full py-0.5">
                        <span className="w-2 h-2 border border-slate-600 bg-slate-950 block" />
                        <span className="w-2 h-2 border border-slate-600 bg-slate-950 block" />
                        <span className="w-2 h-2 border border-slate-600 bg-slate-950 block" />
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-slate-300 block">
                          U{u}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 block">
                          {u <= 2 ? 'BASE' : u >= 11 ? 'CABEZA' : 'MEDIA'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bahía Central de 19 Pulgadas */}
                <div className="relative flex items-stretch px-1.5 py-1">
                  {!devAtU ? (
                    /* Bahía U Vacía */
                    <div
                      onClick={() => {
                        if (pendingTemplate && canMountPendingHere) {
                          onMountDeviceAtU(pendingTemplate.id, u);
                        }
                      }}
                      className={`w-full rounded border border-dashed flex items-center justify-between px-3 transition-all ${
                        pendingTemplate
                          ? canMountPendingHere
                            ? 'border-sky-500/70 bg-sky-950/30 hover:bg-sky-900/40 cursor-pointer text-sky-200'
                            : 'border-rose-500/40 bg-rose-950/20 cursor-not-allowed text-rose-300/70'
                          : 'border-slate-800 bg-slate-950/50 text-slate-500 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-[11px] text-slate-400">
                          [Ranura Libre 1U]
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-xs">
                          {u === 1 || u === 2
                            ? 'Zona de Base (Ideal SAI / Equipos Pesados)'
                            : u >= 11
                            ? 'Zona de Cabeza (Ideal Router / Firewall WAN)'
                            : 'Zona Media (Ideal Switch, Pasahilos, Patch Panel, Ventilación)'}
                        </span>
                      </div>
                      {pendingTemplate && (
                        <span className="font-mono text-xs font-semibold">
                          {canMountPendingHere
                            ? `+ Clic para montar ${pendingTemplate.shortName} en U${u}`
                            : `No cabe ${pendingTemplate.uHeight}U aquí`}
                        </span>
                      )}
                    </div>
                  ) : (
                    /* Equipo Instalado en la Unidad U */
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDraggedDeviceId(devAtU.instanceId);
                        e.dataTransfer.setData('text/rack-instance', devAtU.instanceId);
                      }}
                      onDragEnd={() => setDraggedDeviceId(null)}
                      className={`w-full rounded border flex flex-col justify-between px-2.5 py-1.5 relative transition-all ${
                        draggedDeviceId === devAtU.instanceId ? 'opacity-50' : 'opacity-100'
                      } ${
                        tpl?.category === 'ups'
                          ? 'bg-zinc-900 border-amber-500/40 shadow-inner'
                          : tpl?.category === 'server'
                          ? 'bg-slate-900 border-emerald-500/40'
                          : tpl?.category === 'switch'
                          ? 'bg-slate-900 border-sky-500/50'
                          : tpl?.category === 'patch_panel'
                          ? 'bg-zinc-900 border-indigo-400/50'
                          : tpl?.category === 'router'
                          ? 'bg-slate-900 border-rose-500/50'
                          : tpl?.category === 'cable_manager'
                          ? 'bg-neutral-950 border-slate-700'
                          : tpl?.category === 'fan_tray'
                          ? 'bg-cyan-950/40 border-cyan-500/40'
                          : 'bg-slate-900 border-slate-700'
                      }`}
                    >
                      {/* Cabecera compacta del chasis con controles de movimiento en rack */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11px] font-bold text-slate-200 truncate">
                            {tpl?.name} {rackPerspective === 'rear' ? '(PANEL TRASERO)' : ''}
                          </span>
                          <span className="text-slate-600" aria-hidden="true">·</span>
                          <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                            {tpl?.weightKg} kg
                          </span>
                          {tpl && tpl.heatOutputWatts > 0 && (
                            <>
                              <span className="text-slate-600" aria-hidden="true">·</span>
                              <span className="font-mono text-[10px] text-amber-400 whitespace-nowrap">
                                {tpl.heatOutputWatts}W
                              </span>
                            </>
                          )}
                        </div>

                        {/* Botones de ajuste de altura U y desmontaje */}
                        <div className="flex items-center gap-1 shrink-0 z-20">
                          <button
                            type="button"
                            onClick={() => onMoveDevice(devAtU.instanceId, devAtU.bottomU + 1)}
                            disabled={
                              !canPlaceDeviceAt(
                                devices,
                                devAtU.bottomU + 1,
                                uHeight,
                                devAtU.instanceId
                              )
                            }
                            title="Subir 1U"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-200 transition-colors"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveDevice(devAtU.instanceId, devAtU.bottomU - 1)}
                            disabled={
                              !canPlaceDeviceAt(
                                devices,
                                devAtU.bottomU - 1,
                                uHeight,
                                devAtU.instanceId
                              )
                            }
                            title="Bajar 1U"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-200 transition-colors"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveDevice(devAtU.instanceId)}
                            title="Desmontar equipo del rack"
                            className="p-1 rounded bg-rose-950/80 hover:bg-rose-800 text-rose-200 transition-colors ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* CONTENIDO DEL CHASIS: FRONTAL vs TRASERO */}
                      {rackPerspective === 'front' ? (
                        <div className="pt-1 flex-1 flex items-center">
                          {/* 1. SAI / UPS 2U (Frontal) */}
                          {tpl?.category === 'ups' && (
                            <div className="w-full grid grid-cols-3 gap-3 items-center py-1">
                              <div className="space-y-1.5 bg-black/40 p-2 rounded border border-slate-800">
                                <div className="h-1.5 bg-slate-800 rounded" />
                                <div className="h-1.5 bg-slate-800 rounded" />
                                <div className="h-1.5 bg-slate-800 rounded" />
                                <span className="font-mono text-[10px] text-amber-400 block">
                                  BATERÍAS PLOMO-ÁCIDO · 28.5 KG
                                </span>
                              </div>
                              <div className="bg-sky-950/90 border border-sky-500/50 rounded px-3 py-1.5 font-mono text-center shadow-inner">
                                <div className="text-[10px] text-sky-300 flex items-center justify-between">
                                  <span>IN: 230V 50Hz</span>
                                  <span>OUT: 230V</span>
                                </div>
                                <div className="text-xs font-bold text-emerald-300 tracking-wider my-0.5">
                                  ONLINE · BATT 100%
                                </div>
                                <div className="text-[10px] text-sky-400">
                                  {devAtU.bottomU === 1
                                    ? 'POSICIÓN BASE OK (U1-U2)'
                                    : `¡ALERTA PESO EN U${devAtU.bottomU}! BAJAR A U1`}
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-3 pr-2">
                                <div className="text-right font-mono text-[10px] text-slate-400">
                                  <div>CARGA: 38%</div>
                                  <div>AUTONOMÍA: 42m</div>
                                </div>
                                <div className="w-8 h-8 rounded-full border-2 border-emerald-500/60 bg-emerald-950/50 flex items-center justify-center text-emerald-300">
                                  <Power className="w-4 h-4" />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 2. SERVIDOR RACK 2U (Frontal) */}
                          {tpl?.category === 'server' && (
                            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 py-1">
                              <div className="grid grid-cols-4 gap-1.5 flex-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((disk) => (
                                  <div
                                    key={disk}
                                    className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 flex items-center justify-between"
                                  >
                                    <span className="font-mono text-[9px] text-slate-400">
                                      NVMe {disk}
                                    </span>
                                    <span className="w-1.5 h-1.5 rounded-xs bg-emerald-400 inline-block" />
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 px-2.5 py-1.5 rounded shrink-0 z-20">
                                <span className="font-mono text-[10px] text-emerald-400 mr-1">
                                  NICs RJ45 (Verde → SW):
                                </span>
                                {[1, 2, 3, 4].map((portNum) => {
                                  const portCables = getCablesForPort(devAtU.instanceId, portNum);
                                  const isConnected = portCables.length > 0;
                                  const isSelected =
                                    selectedPort?.instanceId === devAtU.instanceId &&
                                    selectedPort?.port === portNum;
                                  const cableColorHex = isConnected
                                    ? CABLE_COLORS[portCables[0].color].hex
                                    : undefined;

                                  return (
                                    <button
                                      key={portNum}
                                      ref={(el) => registerPortRef(devAtU.instanceId, portNum, el)}
                                      type="button"
                                      onClick={() =>
                                        onSelectPort({
                                          instanceId: devAtU.instanceId,
                                          port: portNum,
                                          deviceLabel: `Servidor NIC #${portNum}`,
                                        })
                                      }
                                      title={`Servidor Puerto NIC #${portNum} (Conectar con latiguillo VERDE al Switch)`}
                                      className={`w-7 h-7 rounded border font-mono text-[10px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                                        isSelected
                                          ? 'ring-2 ring-white border-sky-400 bg-sky-900 text-white scale-110'
                                          : isConnected
                                          ? 'text-white border-white/60 shadow'
                                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-emerald-400'
                                      }`}
                                      style={
                                        isConnected && !isSelected
                                          ? { backgroundColor: cableColorHex }
                                          : undefined
                                      }
                                    >
                                      <span>G{portNum}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 3. SWITCH GESTIONABLE 24 PUERTOS (1U Frontal) */}
                          {tpl?.category === 'switch' && (
                            <div className="w-full min-w-0 flex items-center justify-between gap-2 py-0.5 z-20">
                              <div className="font-mono text-[10px] text-sky-400 shrink-0 pr-1">
                                <div>L2+ PoE+</div>
                                <div className="text-[9px] text-slate-400">
                                  1-22 LAN · 23-24 WAN
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 min-w-0">
                                {[0, 12].map((offset) => (
                                <div key={offset} className="flex flex-nowrap items-center gap-1">
                                {Array.from({ length: 12 }, (_, idx) => offset + idx + 1).map((portNum) => {
                                  const portCables = getCablesForPort(devAtU.instanceId, portNum);
                                  const isConnected = portCables.length > 0;
                                  const isSelected =
                                    selectedPort?.instanceId === devAtU.instanceId &&
                                    selectedPort?.port === portNum;
                                  const isUplinkPort = portNum >= 23;
                                  const cableColorHex = isConnected
                                    ? CABLE_COLORS[portCables[0].color].hex
                                    : undefined;

                                  return (
                                    <button
                                      key={portNum}
                                      ref={(el) => registerPortRef(devAtU.instanceId, portNum, el)}
                                      type="button"
                                      onClick={() =>
                                        onSelectPort({
                                          instanceId: devAtU.instanceId,
                                          port: portNum,
                                          deviceLabel: `Switch Boca #${portNum}${
                                            isUplinkPort ? ' (Uplink)' : ''
                                          }`,
                                        })
                                      }
                                      title={
                                        isUplinkPort
                                          ? `Switch Boca #${portNum} (UPLINK/TRUNK recomendado hacia Router/Firewall con cable ROJO)`
                                          : `Switch Boca #${portNum} (Acceso LAN / PoE+)`
                                      }
                                      className={`w-6 h-6 rounded-xs border font-mono text-[9px] font-bold flex items-center justify-center transition-transform cursor-pointer ${
                                        portNum === 23 ? 'ml-1.5' : ''
                                      } ${
                                        isSelected
                                          ? 'ring-2 ring-white border-sky-300 bg-sky-700 text-white scale-115 z-30'
                                          : isConnected
                                          ? 'text-white border-white/70 shadow-sm'
                                          : isUplinkPort
                                          ? 'bg-rose-950/60 border-rose-500/60 text-rose-200 hover:border-rose-400'
                                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-sky-400'
                                      }`}
                                      style={
                                        isConnected && !isSelected
                                          ? { backgroundColor: cableColorHex }
                                          : undefined
                                      }
                                    >
                                      {portNum}
                                    </button>
                                  );
                                })}
                                </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 4. PATCH PANEL CAT6 24 BOCAS (1U Frontal) */}
                          {tpl?.category === 'patch_panel' && (
                            <div className="w-full min-w-0 flex items-center justify-between gap-2 py-0.5 z-20">
                              <div className="font-mono text-[10px] text-indigo-300 shrink-0 pr-1">
                                <div>PATCH CAT6</div>
                                <div className="text-[9px] text-slate-400">
                                  Rosetas Aula/Oficina
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 min-w-0">
                                {[0, 12].map((offset) => (
                                <div key={offset} className="flex flex-nowrap items-center gap-1">
                                {Array.from({ length: 12 }, (_, idx) => offset + idx + 1).map((portNum) => {
                                  const outlet = wallOutlets.find(
                                    (w) => w.patchPanelPort === portNum
                                  );
                                  const portCables = getCablesForPort(devAtU.instanceId, portNum);
                                  const isConnected = portCables.length > 0;
                                  const isSelected =
                                    selectedPort?.instanceId === devAtU.instanceId &&
                                    selectedPort?.port === portNum;
                                  const isHighlightedOutlet =
                                    outlet && highlightedOutletId === outlet.id;

                                  const cableColorHex = isConnected
                                    ? CABLE_COLORS[portCables[0].color].hex
                                    : undefined;

                                  return (
                                    <button
                                      key={portNum}
                                      ref={(el) => registerPortRef(devAtU.instanceId, portNum, el)}
                                      type="button"
                                      onMouseEnter={() => {
                                        if (outlet) onHighlightOutlet(outlet.id);
                                      }}
                                      onMouseLeave={() => onHighlightOutlet(null)}
                                      onClick={() =>
                                        onSelectPort({
                                          instanceId: devAtU.instanceId,
                                          port: portNum,
                                          deviceLabel: outlet
                                            ? `Patch Panel #${portNum} (${outlet.code}: ${outlet.label})`
                                            : `Patch Panel Boca #${portNum} (Sin roseta asignada)`,
                                        })
                                      }
                                      title={
                                        outlet
                                          ? `Boca #${portNum} ← Conectada por detrás a ${outlet.code}: ${outlet.label} (Color requerido: ${
                                              CABLE_COLORS[outlet.expectedColor].name
                                            })`
                                          : `Boca #${portNum} (Libre en pared)`
                                      }
                                      className={`w-6 h-6 rounded-xs border font-mono text-[9px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                                        isSelected || isHighlightedOutlet
                                          ? 'ring-2 ring-amber-300 border-white bg-indigo-700 text-white scale-115 z-30'
                                          : isConnected
                                          ? 'text-white border-white/70'
                                          : outlet
                                          ? 'bg-indigo-950/90 border-indigo-400 text-indigo-100 hover:bg-indigo-900'
                                          : 'bg-slate-950/70 border-slate-800 text-slate-500 hover:border-slate-600'
                                      }`}
                                      style={
                                        isConnected && !isSelected
                                          ? { backgroundColor: cableColorHex }
                                          : undefined
                                      }
                                    >
                                      <span>{portNum}</span>
                                      {outlet && !isConnected && (
                                        <span
                                          className="w-3 h-0.5 rounded-full mt-0.5"
                                          style={{
                                            backgroundColor:
                                              CABLE_COLORS[outlet.expectedColor].strokeHex,
                                          }}
                                        />
                                      )}
                                    </button>
                                  );
                                })}
                                </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 5. ROUTER / FIREWALL PERIMETRAL (1U Frontal) */}
                          {tpl?.category === 'router' && (
                            <div className="w-full min-w-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-0.5 z-20">
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-[10px] text-rose-400 font-semibold">
                                  FIREWALL UTM · FRONTERA WAN
                                </span>
                                <span className="font-mono text-[10px] text-slate-400 hidden sm:inline">
                                  Fibra Óptica ISP: LINK OK
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] text-slate-400 mr-1 hidden sm:inline">
                                  Bocas (1-2 WAN/Trunk Rojo):
                                </span>
                                {Array.from({ length: 8 }, (_, idx) => idx + 1).map((portNum) => {
                                  const portCables = getCablesForPort(devAtU.instanceId, portNum);
                                  const isConnected = portCables.length > 0;
                                  const isSelected =
                                    selectedPort?.instanceId === devAtU.instanceId &&
                                    selectedPort?.port === portNum;
                                  const isWanPort = portNum <= 2;
                                  const cableColorHex = isConnected
                                    ? CABLE_COLORS[portCables[0].color].hex
                                    : undefined;

                                  return (
                                    <button
                                      key={portNum}
                                      ref={(el) => registerPortRef(devAtU.instanceId, portNum, el)}
                                      type="button"
                                      onClick={() =>
                                        onSelectPort({
                                          instanceId: devAtU.instanceId,
                                          port: portNum,
                                          deviceLabel: `Router/Firewall Boca #${portNum}${
                                            isWanPort ? ' (Trunk/WAN)' : ''
                                          }`,
                                        })
                                      }
                                      title={`Router/Firewall Boca #${portNum} (Enlazar con Switch Boca 24 usando latiguillo ROJO)`}
                                      className={`w-7 h-6 rounded-xs border font-mono text-[9px] font-bold flex items-center justify-center transition-transform cursor-pointer ${
                                        isSelected
                                          ? 'ring-2 ring-white border-rose-300 bg-rose-700 text-white scale-115'
                                          : isConnected
                                          ? 'text-white border-white/70'
                                          : isWanPort
                                          ? 'bg-rose-950/70 border-rose-500/70 text-rose-200 hover:border-rose-300'
                                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                                      }`}
                                      style={
                                        isConnected && !isSelected
                                          ? { backgroundColor: cableColorHex }
                                          : undefined
                                      }
                                    >
                                      {portNum <= 2 ? `W${portNum}` : `L${portNum - 2}`}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 6. PASAHILOS / GUÍA PASACABLES HORIZONTAL (1U Frontal) */}
                          {tpl?.category === 'cable_manager' && (
                            <div className="w-full flex items-center justify-between gap-1 py-1 px-2 bg-neutral-950 rounded border border-slate-800/90">
                              <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                PEINE ORGANIZADOR DE LATIGUILLOS
                              </span>
                              <div className="flex items-center gap-1.5 flex-1 justify-center overflow-hidden px-2">
                                {Array.from({ length: 18 }, (_, i) => (
                                  <span
                                    key={i}
                                    className="w-2.5 h-3.5 rounded-xs bg-slate-900 border border-slate-700/80 inline-block"
                                  />
                                ))}
                              </div>
                              <span className="font-mono text-[10px] text-emerald-400 shrink-0">
                                FLUJO AIRE LIBRE
                              </span>
                            </div>
                          )}

                          {/* 7. BANDEJA DE VENTILACIÓN TÉRMICA (1U Frontal) */}
                          {tpl?.category === 'fan_tray' && (
                            <div className="w-full flex items-center justify-between px-3 py-0.5">
                              <div className="flex items-center gap-4">
                                {[1, 2, 3].map((fanIdx) => (
                                  <div
                                    key={fanIdx}
                                    className="flex items-center gap-1.5 bg-cyan-950/70 border border-cyan-500/30 px-2.5 py-0.5 rounded"
                                  >
                                    <Fan className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
                                    <span className="font-mono text-[10px] text-cyan-200">
                                      TURBINA 0{fanIdx} · 2400 RPM
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <span className="font-mono text-[10px] text-cyan-300">
                                EXTRACCIÓN ACTIVA (-6.0 °C)
                              </span>
                            </div>
                          )}

                          {/* 8. PDU REGLETA ELÉCTRICA (1U Frontal) */}
                          {tpl?.category === 'pdu' && (
                            <div className="w-full flex items-center justify-between px-2 py-0.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-rose-600/90 text-white font-mono text-[9px] font-bold rounded-xs">
                                  ON · 16A
                                </span>
                                <span className="font-mono text-[10px] text-slate-300">
                                  8 TOMAS IEC C13 PROTEGIDAS
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {Array.from({ length: 8 }, (_, i) => (
                                  <span
                                    key={i}
                                    className="w-5 h-3.5 bg-slate-950 border border-slate-700 rounded-xs inline-block"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 9. PANEL CIEGO MICROPERFORADO (1U Frontal) */}
                          {tpl?.category === 'blank_panel' && (
                            <div className="w-full flex items-center justify-between px-3 py-0.5 opacity-80">
                              <span className="font-mono text-[10px] text-slate-400">
                                PANEL CIEGO DEFLECTOR DE FLUJO LAMINAR
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">
                                EIA-310 MICROPERFORADO
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* VISTA TRASERA DEL CHASIS (Crimpado IDC Krone 110, Fuentes Redundantes y Cableado Eléctrico IEC C13) */
                        <div className="pt-1 flex-1 flex items-center justify-between px-2 bg-slate-950/70 rounded border border-slate-800/80 font-mono text-[10px]">
                          {tpl?.category === 'patch_panel' && (
                            <div className="w-full flex items-center justify-between gap-2 py-0.5 overflow-x-auto">
                              <span className="text-indigo-300 font-semibold shrink-0">
                                BLOQUES IDC KRONE 110 (T568B):
                              </span>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 24 }, (_, idx) => idx + 1).map((pNum) => {
                                  const outlet = wallOutlets.find((w) => w.patchPanelPort === pNum);
                                  return (
                                    <div
                                      key={pNum}
                                      title={
                                        outlet
                                          ? `Bloque IDC #${pNum} ← Cable UTP Rígido desde ${outlet.code} (${outlet.label})`
                                          : `Bloque IDC #${pNum} sin cable horizontal`
                                      }
                                      className={`w-6 h-6 rounded-xs border flex flex-col items-center justify-center ${
                                        outlet
                                          ? 'bg-indigo-950 border-indigo-400 text-indigo-100'
                                          : 'bg-slate-900 border-slate-800 text-slate-600'
                                      }`}
                                    >
                                      <span className="text-[8px]">{pNum}</span>
                                      {outlet && (
                                        <span className="w-3.5 h-1 rounded-xs bg-sky-400 mt-0.5" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {tpl?.category === 'ups' && (
                            <div className="w-full flex items-center justify-between py-1">
                              <div className="space-y-0.5">
                                <span className="text-amber-300 font-bold block">
                                  ENTRADA RED 230V AC (IEC C20 16A) + DISYUNTOR TÉRMICO
                                </span>
                                <span className="text-slate-400 block">
                                  6 Salidas IEC C13 Respaldadas por Batería → Alimentando PDU y Equipos Activos
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4, 5, 6].map((iec) => (
                                  <span
                                    key={iec}
                                    className="px-2 py-1 rounded bg-emerald-950 border border-emerald-500/60 text-emerald-300 font-bold"
                                  >
                                    IEC #{iec}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {tpl?.category === 'server' && (
                            <div className="w-full flex items-center justify-between py-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold">
                                  PSU 1 · 750W 80+ PLATINUM (OK)
                                </span>
                                <span className="px-2 py-1 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold">
                                  PSU 2 · REDUNDANTE (OK)
                                </span>
                              </div>
                              <span className="text-slate-400">
                                Extracción Trasera de Calor (+135W) · Puerto IPMI/iDRAC Dedicado
                              </span>
                            </div>
                          )}

                          {(tpl?.category === 'switch' || tpl?.category === 'router') && (
                            <div className="w-full flex items-center justify-between">
                              <span className="text-slate-300 flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                                Alimentación IEC C13:{' '}
                                {hasUpsInstalled || hasPduInstalled
                                  ? 'PROTEGIDA POR SAI / PDU'
                                  : 'SIN SAI (RIESGO ANTE CORTE ELÉCTRICO)'}
                              </span>
                              <span className="text-slate-400">
                                Bornes Toma de Tierra M6 Conectados al Bastidor · Rejilla Escape Trasero
                              </span>
                            </div>
                          )}

                          {(tpl?.category === 'cable_manager' ||
                            tpl?.category === 'fan_tray' ||
                            tpl?.category === 'pdu' ||
                            tpl?.category === 'blank_panel') && (
                            <div className="w-full flex items-center justify-between text-slate-400">
                              <span>
                                Paso Trasero de Canaleta Vertical y Bridas de Velcros Organizadoras
                              </span>
                              <span className="text-sky-300">
                                {tpl.category === 'pdu'
                                  ? '8 Latiguillos Eléctricos IEC C13-C14 Distribuidos'
                                  : 'Flujo de Aire Franco'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Termometría por Unidad U */}
                <div className="bg-slate-900 border-l border-slate-800 px-2 py-1 flex flex-col justify-center items-end font-mono">
                  <div
                    className={`text-xs font-bold flex items-center gap-1 ${
                      thermal.status === 'critical'
                        ? 'text-rose-400'
                        : thermal.status === 'hot'
                        ? 'text-amber-400'
                        : thermal.status === 'warm'
                        ? 'text-sky-300'
                        : 'text-emerald-400'
                    }`}
                  >
                    {(thermal.status === 'critical' || thermal.status === 'hot') && (
                      <Flame className="w-3 h-3 shrink-0" />
                    )}
                    <span>{thermal.temperatureC.toFixed(1)}°C</span>
                  </div>
                  <span className="text-[9px] text-slate-400 uppercase tracking-tight">
                    {thermal.status === 'critical'
                      ? 'CRÍTICO'
                      : thermal.status === 'hot'
                      ? 'CALIENTE'
                      : thermal.status === 'warm'
                      ? 'TEMPLADO'
                      : 'ÓPTIMO'}
                  </span>
                  {showThermalOverlay && thermal.airflowBlockedByCables && (
                    <span
                      className="text-[8px] text-rose-300 leading-tight text-right"
                      title="Latiguillos sin pasahilos obstruyen la ventilación"
                    >
                      Cables sin guía
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Capa SVG Superpuesta de Latiguillos RJ45 (Solo en Vista Frontal) */}
        {rackPerspective === 'front' && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-25"
            style={{ overflow: 'visible' }}
          >
            <defs>
              <filter id="cableShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="2"
                  floodColor="#000000"
                  floodOpacity="0.65"
                />
              </filter>
            </defs>
            {cables.map((cable, idx) => {
              const fromKey = `${cable.fromInstanceId}:${cable.fromPort}`;
              const toKey = `${cable.toInstanceId}:${cable.toPort}`;
              const p1 = portCoords.get(fromKey);
              const p2 = portCoords.get(toKey);
              if (!p1 || !p2) return null;

              const colorSpec = CABLE_COLORS[cable.color];
              const isHovered = hoveredCableId === cable.id;

              const routedViaCableManager = hasCableManagerBetween(devices, p1.u, p2.u);

              const midY = (p1.y + p2.y) / 2;
              const sagOffset = routedViaCableManager
                ? (idx % 3) * 4 - 4
                : 24 + (idx % 5) * 7;

              const pathD = routedViaCableManager
                ? `M ${p1.x} ${p1.y} C ${p1.x} ${midY + sagOffset}, ${p2.x} ${midY + sagOffset}, ${p2.x} ${p2.y}`
                : `M ${p1.x} ${p1.y} Q ${(p1.x + p2.x) / 2 + (idx % 2 === 0 ? 18 : -18)} ${
                    Math.max(p1.y, p2.y) + sagOffset
                  } ${p2.x} ${p2.y}`;

              return (
                <g key={cable.id} className="pointer-events-auto cursor-pointer">
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#020617"
                    strokeWidth={isHovered ? 7 : 5.5}
                    strokeLinecap="round"
                    onMouseEnter={() => setHoveredCableId(cable.id)}
                    onMouseLeave={() => setHoveredCableId(null)}
                    onClick={() => onRemoveCable(cable.id)}
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke={colorSpec.strokeHex}
                    strokeWidth={isHovered ? 4.5 : 3.2}
                    strokeLinecap="round"
                    filter="url(#cableShadow)"
                    onMouseEnter={() => setHoveredCableId(cable.id)}
                    onMouseLeave={() => setHoveredCableId(null)}
                    onClick={() => onRemoveCable(cable.id)}
                  >
                    <title>{`Latiguillo ${colorSpec.name} · Clic para desconectar`}</title>
                  </path>
                  <circle
                    cx={p1.x}
                    cy={p1.y}
                    r={4}
                    fill={colorSpec.hex}
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                  <circle
                    cx={p2.x}
                    cy={p2.y}
                    r={4}
                    fill={colorSpec.hex}
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Patas niveladoras y anclaje de suelo del armario Rack */}
      <div className="flex items-center justify-between px-8">
        <div className="w-12 h-3 bg-slate-800 border-x border-b border-slate-600 rounded-b" />
        <div className="text-[11px] font-mono text-slate-400 py-1 flex items-center gap-2">
          <span>ANCLAJE DE BASTIDOR AL SUELO (U1 BASE DE GRAVEDAD)</span>
          {cables.length > 0 && rackPerspective === 'front' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-sky-300">
                Haz clic sobre cualquier latiguillo tendido para desconectarlo
              </span>
            </>
          )}
        </div>
        <div className="w-12 h-3 bg-slate-800 border-x border-b border-slate-600 rounded-b" />
      </div>
    </div>
    </div>
  );
};
