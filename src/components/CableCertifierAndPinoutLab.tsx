import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  RotateCcw,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import { CABLE_COLORS } from '../data/rackData';
import { PatchCable, PlacedDevice, WallOutlet } from '../types/rack';
import { getTemplateById } from '../utils/rackEngine';

interface WireSpec {
  id: string;
  label: string;
  shortCode: string;
  primaryHex: string;
  striped: boolean;
  pairNumber: number;
  signalRole: string;
}

const T568B_ORDER: WireSpec[] = [
  {
    id: 'wo',
    label: 'Blanco-Naranja',
    shortCode: 'B-N',
    primaryHex: '#f97316',
    striped: true,
    pairNumber: 2,
    signalRole: 'TX+ (BI_DA+)',
  },
  {
    id: 'o',
    label: 'Naranja',
    shortCode: 'NAR',
    primaryHex: '#ea580c',
    striped: false,
    pairNumber: 2,
    signalRole: 'TX- (BI_DA-)',
  },
  {
    id: 'wg',
    label: 'Blanco-Verde',
    shortCode: 'B-V',
    primaryHex: '#22c55e',
    striped: true,
    pairNumber: 3,
    signalRole: 'RX+ (BI_DB+)',
  },
  {
    id: 'b',
    label: 'Azul',
    shortCode: 'AZU',
    primaryHex: '#2563eb',
    striped: false,
    pairNumber: 1,
    signalRole: 'BI_DC+ (PoE Mode B)',
  },
  {
    id: 'wb',
    label: 'Blanco-Azul',
    shortCode: 'B-A',
    primaryHex: '#3b82f6',
    striped: true,
    pairNumber: 1,
    signalRole: 'BI_DC- (PoE Mode B)',
  },
  {
    id: 'g',
    label: 'Verde',
    shortCode: 'VER',
    primaryHex: '#16a34a',
    striped: false,
    pairNumber: 3,
    signalRole: 'RX- (BI_DB-)',
  },
  {
    id: 'wbr',
    label: 'Blanco-Marrón',
    shortCode: 'B-M',
    primaryHex: '#a16207',
    striped: true,
    pairNumber: 4,
    signalRole: 'BI_DD+ (PoE Mode B)',
  },
  {
    id: 'br',
    label: 'Marrón',
    shortCode: 'MAR',
    primaryHex: '#78350f',
    striped: false,
    pairNumber: 4,
    signalRole: 'BI_DD- (PoE Mode B)',
  },
];

const T568A_ORDER: WireSpec[] = [
  T568B_ORDER[2], // Blanco-Verde
  T568B_ORDER[5], // Verde
  T568B_ORDER[0], // Blanco-Naranja
  T568B_ORDER[3], // Azul
  T568B_ORDER[4], // Blanco-Azul
  T568B_ORDER[1], // Naranja
  T568B_ORDER[6], // Blanco-Marrón
  T568B_ORDER[7], // Marrón
];

interface CableCertifierAndPinoutLabProps {
  wallOutlets: WallOutlet[];
  devices: PlacedDevice[];
  cables: PatchCable[];
}

export const CableCertifierAndPinoutLab: React.FC<CableCertifierAndPinoutLabProps> = ({
  wallOutlets,
  devices,
  cables,
}) => {
  const [selectedOutletId, setSelectedOutletId] = useState<string>(
    wallOutlets[0]?.id || ''
  );
  const [normStandard, setNormStandard] = useState<'T568B' | 'T568A'>('T568B');
  const [userPinout, setUserPinout] = useState<(WireSpec | null)[]>(() =>
    Array(8).fill(null)
  );
  const [activePinIndex, setActivePinIndex] = useState<number>(0);

  const selectedOutlet =
    wallOutlets.find((w) => w.id === selectedOutletId) || wallOutlets[0];

  const patchPanels = devices.filter(
    (d) => getTemplateById(d.templateId)?.category === 'patch_panel'
  );
  const switches = devices.filter(
    (d) => getTemplateById(d.templateId)?.category === 'switch'
  );

  const ppIds = new Set(patchPanels.map((p) => p.instanceId));
  const swIds = new Set(switches.map((s) => s.instanceId));

  // Buscar si la roseta seleccionada tiene su latiguillo conectado al Switch
  const patchedCable = selectedOutlet
    ? cables.find(
        (c) =>
          (ppIds.has(c.fromInstanceId) &&
            c.fromPort === selectedOutlet.patchPanelPort &&
            swIds.has(c.toInstanceId)) ||
          (ppIds.has(c.toInstanceId) &&
            c.toPort === selectedOutlet.patchPanelPort &&
            swIds.has(c.fromInstanceId))
      )
    : undefined;

  const connectedSwitchPort = patchedCable
    ? swIds.has(patchedCable.toInstanceId)
      ? patchedCable.toPort
      : patchedCable.fromPort
    : null;

  // Calcular presupuesto PoE total consumido en el Switch
  const totalPoeWatts = wallOutlets.reduce((acc, outlet) => {
    const isConnected = cables.some(
      (c) =>
        (ppIds.has(c.fromInstanceId) &&
          c.fromPort === outlet.patchPanelPort &&
          swIds.has(c.toInstanceId)) ||
        (ppIds.has(c.toInstanceId) &&
          c.toPort === outlet.patchPanelPort &&
          swIds.has(c.fromInstanceId))
    );
    if (!isConnected) return acc;
    if (outlet.serviceType === 'wifi_ap') return acc + 24.5; // PoE+ 802.3at
    if (outlet.serviceType === 'voip_phone') return acc + 7.2; // PoE Class 2
    return acc;
  }, 0);

  const maxSwitchPoeBudget = 185; // 185W Switch PoE+ Budget

  // Longitud determinista simulada de la tirada horizontal (m)
  const simulatedLengthMeters = selectedOutlet
    ? 14.5 + ((selectedOutlet.patchPanelPort * 3.7) % 38)
    : 22.0;
  const insertionLossDb = (simulatedLengthMeters * 0.19).toFixed(1);
  const nextMarginDb = (44.2 - simulatedLengthMeters * 0.12).toFixed(1);

  // Verificación del entrenador de crimpado T568B / T568A
  const targetOrder = normStandard === 'T568B' ? T568B_ORDER : T568A_ORDER;
  const allPinsFilled = userPinout.every((w) => w !== null);
  const isCrimpCorrect =
    allPinsFilled &&
    userPinout.every((w, idx) => w && w.id === targetOrder[idx].id);

  const handleAssignWireToPin = (wire: WireSpec) => {
    const nextPinout = [...userPinout];
    // Si ese hilo ya estaba puesto en otro pin, liberarlo primero
    const existingIdx = nextPinout.findIndex((w) => w?.id === wire.id);
    if (existingIdx !== -1) {
      nextPinout[existingIdx] = null;
    }
    nextPinout[activePinIndex] = wire;
    setUserPinout(nextPinout);

    // Avanzar al siguiente pin vacío automáticamente
    const nextEmpty = nextPinout.findIndex((w, i) => i > activePinIndex && w === null);
    if (nextEmpty !== -1) {
      setActivePinIndex(nextEmpty);
    } else {
      const anyEmpty = nextPinout.findIndex((w) => w === null);
      if (anyEmpty !== -1) setActivePinIndex(anyEmpty);
    }
  };

  const handleAutoCompletePinout = () => {
    setUserPinout([...targetOrder]);
  };

  const handleResetPinout = () => {
    setUserPinout(Array(8).fill(null));
    setActivePinIndex(0);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <span>Certificador de Cableado Estructurado Cat6 y Taller de Crimpado RJ45</span>
          </h2>
          <p className="text-xs text-slate-400">
            Comprueba la continuidad extremo a extremo (Roseta → Patch Panel → Switch), el consumo PoE (IEEE 802.3af/at) y practica el código de pines TIA/EIA-568B.
          </p>
        </div>

        {/* Presupuesto PoE en vivo */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 shrink-0 font-mono text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Presupuesto PoE+ Switch:
            </span>
            <span className="font-bold text-amber-300">
              {totalPoeWatts.toFixed(1)} W / {maxSwitchPoeBudget} W
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-amber-400 transition-all duration-200"
              style={{
                width: `${Math.min(100, (totalPoeWatts / maxSwitchPoeBudget) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* COLUMNA 1: CERTIFICador FLUKE / MAPA DE HILOS DE TOMA DE PARED */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="certifier-outlet-select"
              className="text-xs font-semibold text-slate-200"
            >
              1. Analizador de Enlace Permanente + Canal (ISO/IEC 11801):
            </label>
            <select
              id="certifier-outlet-select"
              value={selectedOutlet?.id || ''}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="w-full sm:w-auto max-w-full min-w-0 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-400"
            >
              {wallOutlets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.label} (PP #{w.patchPanelPort})
                </option>
              ))}
            </select>
          </div>

          {selectedOutlet && (
            <>
              {/* Estado de certificación de la línea */}
              <div
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  patchedCable
                    ? patchedCable.color === selectedOutlet.expectedColor
                      ? 'bg-emerald-950/30 border-emerald-500/50'
                      : 'bg-amber-950/30 border-amber-500/50'
                    : 'bg-rose-950/30 border-rose-500/40'
                }`}
              >
                <div>
                  <div className="text-xs font-bold font-mono flex items-center gap-1.5">
                    {patchedCable ? (
                      patchedCable.color === selectedOutlet.expectedColor ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">
                            PASS · ENLACE CAT6 CERTIFICADO (1000BASE-T)
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-300">
                            LINK ACTIVO · AVISO COLOR NORMATIVO ({CABLE_COLORS[patchedCable.color].name.split(' ')[0]})
                          </span>
                        </>
                      )
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span className="text-rose-300">
                          CIRCUITO ABIERTO · FALTA LATIGUILLO EN PATCH PANEL #{selectedOutlet.patchPanelPort}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    Ruta: {selectedOutlet.code} ({selectedOutlet.roomZone}) → PP Boca #
                    {selectedOutlet.patchPanelPort} →{' '}
                    {connectedSwitchPort
                      ? `Switch Boca #${connectedSwitchPort}`
                      : 'Sin parchear al Switch'}
                  </div>
                </div>

                <div className="text-right font-mono shrink-0">
                  <span className="text-sm font-bold text-slate-100 block">
                    {simulatedLengthMeters.toFixed(1)} m
                  </span>
                  <span className="text-[10px] text-slate-400">Máx. 90m + 10m</span>
                </div>
              </div>

              {/* Mapa visual de los 8 hilos (Wiremap 1-8) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>ROSETA {selectedOutlet.code} (T568B)</span>
                  <span>CONTINUIDAD 8 PARES</span>
                  <span>SWITCH {connectedSwitchPort ? `BOCA #${connectedSwitchPort}` : 'ABIERTO'}</span>
                </div>

                <div className="space-y-1 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                  {T568B_ORDER.map((wire, idx) => {
                    const pinNum = idx + 1;
                    return (
                      <div
                        key={wire.id}
                        className="grid grid-cols-[95px_24px_1fr_24px_115px] items-center gap-2 font-mono text-[10px]"
                      >
                        <span className="text-slate-300 truncate">{wire.label}</span>
                        <span className="w-5 h-4 rounded-xs bg-slate-800 text-center text-slate-200 font-bold">
                          {pinNum}
                        </span>
                        <div className="relative h-2 rounded-full overflow-hidden bg-slate-950 border border-slate-800">
                          {patchedCable ? (
                            <div
                              className="w-full h-full"
                              style={{
                                background: wire.striped
                                  ? `repeating-linear-gradient(90deg, #ffffff 0px, #ffffff 6px, ${wire.primaryHex} 6px, ${wire.primaryHex} 14px)`
                                  : wire.primaryHex,
                              }}
                            />
                          ) : (
                            <div className="w-1/2 h-full border-r-2 border-rose-500 bg-slate-700" />
                          )}
                        </div>
                        <span className="w-5 h-4 rounded-xs bg-slate-800 text-center text-slate-200 font-bold">
                          {pinNum}
                        </span>
                        <span className="text-slate-400 text-right truncate">
                          {wire.signalRole}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Parámetros RF de Certificación */}
              <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">ATENUACIÓN (IL)</span>
                  <span className="font-bold text-sky-300">{insertionLossDb} dB</span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">MARGEN NEXT</span>
                  <span className="font-bold text-emerald-300">+{nextMarginDb} dB</span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">ALIMENTACIÓN PoE</span>
                  <span className="font-bold text-amber-300">
                    {selectedOutlet.serviceType === 'wifi_ap'
                      ? '24.5W (802.3at)'
                      : selectedOutlet.serviceType === 'voip_phone'
                      ? '7.2W (802.3af)'
                      : '0W (Solo Datos)'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* COLUMNA 2: ENTRENADOR PRÁCTICO DE CRIMPADO RJ45 (T568B / T568A) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  <span>2. Entrenador de Crimpado de Conector RJ45 (8P8C)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Ordena los 8 hilos de izquierda a derecha (Pin 1 a Pin 8, pestaña del conector hacia abajo).
                </p>
              </div>

              {/* Selector de norma T568B / T568A */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setNormStandard('T568B');
                    handleResetPinout();
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold cursor-pointer ${
                    normStandard === 'T568B'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  T568B (Estándar)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNormStandard('T568A');
                    handleResetPinout();
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold cursor-pointer ${
                    normStandard === 'T568A'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  T568A
                </button>
              </div>
            </div>

            {/* Vista del Cabezal RJ45 con sus 8 carriles */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="text-[10px] font-mono text-slate-400 text-center mb-2">
                CABEZAL RJ45 TRANSPARENTE · CONTACTOS DORADOS ARRIBA (PIN 1 → PIN 8)
              </div>

              <div className="grid grid-cols-8 gap-1.5">
                {userPinout.map((assignedWire, idx) => {
                  const isActiveSlot = activePinIndex === idx;
                  const isSlotCorrect =
                    assignedWire && assignedWire.id === targetOrder[idx].id;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePinIndex(idx)}
                      className={`h-24 rounded border flex flex-col items-center justify-between p-1.5 transition-all cursor-pointer ${
                        isActiveSlot
                          ? 'border-sky-400 ring-2 ring-sky-400/50 bg-slate-800'
                          : assignedWire
                          ? isSlotCorrect
                            ? 'border-emerald-500/60 bg-slate-950'
                            : 'border-rose-500/70 bg-rose-950/30'
                          : 'border-slate-700 bg-slate-950/60 hover:border-slate-500'
                      }`}
                    >
                      {/* Contacto chapado en oro */}
                      <div className="w-2.5 h-3.5 rounded-xs bg-amber-400/90 border border-amber-200 shrink-0" />

                      {/* Hilo insertado en el canal */}
                      {assignedWire ? (
                        <div
                          className="w-3.5 flex-1 my-1 rounded-xs border border-white/30"
                          style={{
                            background: assignedWire.striped
                              ? `repeating-linear-gradient(180deg, #ffffff 0px, #ffffff 5px, ${assignedWire.primaryHex} 5px, ${assignedWire.primaryHex} 11px)`
                              : assignedWire.primaryHex,
                          }}
                        />
                      ) : (
                        <div className="w-2 flex-1 my-1 border border-dashed border-slate-700 rounded-xs" />
                      )}

                      <span className="font-mono text-[10px] font-bold text-slate-300">
                        P{idx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botonera de los 8 hilos del par trenzado para insertar en el Pin activo */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1.5 flex items-center justify-between">
                <span>
                  Haz clic en el hilo para insertarlo en el{' '}
                  <strong className="text-sky-300 font-mono">Pin {activePinIndex + 1}</strong>:
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  Norma activa: {normStandard}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {T568B_ORDER.map((wire) => {
                  const alreadyUsedPin = userPinout.findIndex((w) => w?.id === wire.id);
                  return (
                    <button
                      key={wire.id}
                      type="button"
                      onClick={() => handleAssignWireToPin(wire)}
                      className={`p-1.5 rounded border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                        alreadyUsedPin !== -1
                          ? 'bg-slate-900/40 border-slate-800 text-slate-500'
                          : 'bg-slate-900 border-slate-700 hover:border-sky-400 text-slate-200'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/40"
                        style={{
                          background: wire.striped
                            ? `linear-gradient(135deg, #ffffff 45%, ${wire.primaryHex} 45%)`
                            : wire.primaryHex,
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium truncate">{wire.label}</div>
                        <div className="font-mono text-[9px] text-slate-400">
                          {alreadyUsedPin !== -1
                            ? `En Pin ${alreadyUsedPin + 1}`
                            : `Par ${wire.pairNumber}`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Resultado de la validación del conector RJ45 */}
          <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-xs font-mono">
              {!allPinsFilled ? (
                <span className="text-slate-400">
                  Inserta los 8 conductores para validar el crimpado {normStandard}.
                </span>
              ) : isCrimpCorrect ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  ¡Crimpado {normStandard} PERFECTO! Pares balanceados sin diafonía.
                </span>
              ) : (
                <span className="text-rose-400 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Error de pines en {normStandard} (Pares cruzados). Revisa las casillas en rojo.
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleResetPinout}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reiniciar</span>
              </button>
              <button
                type="button"
                onClick={handleAutoCompletePinout}
                className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Ver Orden {normStandard}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
