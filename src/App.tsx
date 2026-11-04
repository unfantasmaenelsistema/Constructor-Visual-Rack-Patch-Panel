import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Flame,
  RotateCcw,
  Shuffle,
  Sparkles,
  Thermometer,
  Trash2,
  Unplug,
  Upload,
  Wrench,
} from 'lucide-react';
import { CableCertifierAndPinoutLab } from './components/CableCertifierAndPinoutLab';
import { ClassroomOutletsPanel } from './components/ClassroomOutletsPanel';
import { HardwareCatalogAndRubric } from './components/HardwareCatalogAndRubric';
import { RackCabinetView } from './components/RackCabinetView';
import { CABLE_COLORS, SCENARIOS } from './data/rackData';
import {
  CableColor,
  PatchCable,
  PlacedDevice,
  ScenarioDefinition,
  WallOutlet,
} from './types/rack';
import {
  canPlaceDeviceAt,
  computeThermalProfile,
  evaluateRackConfiguration,
  getTemplateById,
  TOTAL_RACK_UNITS,
} from './utils/rackEngine';

interface SelectedPortState {
  instanceId: string;
  port: number;
  deviceLabel: string;
}

const STORAGE_KEY = 'fgs_rack_simulator_state_v2';

export default function App() {
  const [activeScenarioId, setActiveScenarioId] = useState<string>(SCENARIOS[0].id);
  const [customRandomScenario, setCustomRandomScenario] =
    useState<ScenarioDefinition | null>(null);

  const currentScenario = useMemo(() => {
    if (activeScenarioId === 'random_exam' && customRandomScenario) {
      return customRandomScenario;
    }
    return SCENARIOS.find((s) => s.id === activeScenarioId) || SCENARIOS[0];
  }, [activeScenarioId, customRandomScenario]);

  // Estado de dispositivos montados en el Rack
  const [devices, setDevices] = useState<PlacedDevice[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.devices)) return parsed.devices;
      }
    } catch {
      // Ignore storage error
    }
    return SCENARIOS[0].messyInitialRack.map((item, idx) => ({
      instanceId: `dev_init_${idx}_${item.templateId}`,
      templateId: item.templateId,
      bottomU: item.bottomU,
    }));
  });

  // Estado de latiguillos RJ45 conectados
  const [cables, setCables] = useState<PatchCable[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.cables)) return parsed.cables;
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Color de latiguillo activo
  const [selectedColor, setSelectedColor] = useState<CableColor>('blue');

  // Boca RJ45 seleccionada como origen al tender un latiguillo
  const [selectedPort, setSelectedPort] = useState<SelectedPortState | null>(null);

  // Plantilla de equipo seleccionada desde el catálogo para montar haciendo clic en una U
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  // Temperatura ambiente de la sala/aula (°C)
  const [ambientTempC, setAmbientTempC] = useState<number>(22);

  // Mostrar detalles de bloqueo térmico
  const [showThermalOverlay, setShowThermalOverlay] = useState<boolean>(true);

  // Toma de pared resaltada al pasar el ratón
  const [highlightedOutletId, setHighlightedOutletId] = useState<string | null>(null);

  // Pestaña activa en el panel derecho
  const [rightPanelTab, setRightPanelTab] = useState<'catalog' | 'evaluation' | 'guide'>(
    'catalog'
  );

  // Mensaje de feedback didáctico instantáneo
  const [statusFeedback, setStatusFeedback] = useState<string>(
    'Modo Práctica Activo: Ordena primero las unidades U del rack (SAI en U1-U2, Router en cabeza, Pasahilos entre Patch Panel y Switch) y luego conecta los latiguillos.'
  );

  // Guardar automáticamente en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeScenarioId,
          devices,
          cables,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [activeScenarioId, devices, cables]);

  // Cálculos térmicos y evaluación didáctica en tiempo real
  const thermalSlots = useMemo(
    () => computeThermalProfile(devices, cables, ambientTempC),
    [devices, cables, ambientTempC]
  );

  const evaluation = useMemo(
    () => evaluateRackConfiguration(devices, cables, currentScenario, ambientTempC),
    [devices, cables, currentScenario, ambientTempC]
  );

  // Cambiar de escenario didáctico
  const handleSelectScenario = (scenarioId: string) => {
    const nextScenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (!nextScenario) return;
    setActiveScenarioId(scenarioId);
    setDevices(
      nextScenario.messyInitialRack.map((item, idx) => ({
        instanceId: `dev_${scenarioId}_${idx}_${Date.now()}`,
        templateId: item.templateId,
        bottomU: item.bottomU,
      }))
    );
    setCables([]);
    setSelectedPort(null);
    setPendingTemplateId(null);
    setStatusFeedback(
      `Escenario cargado: ${nextScenario.title}. Revisa la colocación de los equipos y completa el parcheo.`
    );
  };

  // Generar un reto de examen completamente aleatorio para evaluar en clase
  const handleGenerateRandomExam = () => {
    const pool: Omit<WallOutlet, 'id' | 'code' | 'patchPanelPort'>[] = [
      {
        label: 'PC Docente Aula Taller',
        roomZone: 'Mesa Profesor',
        serviceType: 'workstation',
        expectedColor: 'blue',
      },
      {
        label: 'Estación Trabajo Alumno 01',
        roomZone: 'Bancada Norte',
        serviceType: 'workstation',
        expectedColor: 'blue',
      },
      {
        label: 'Estación Trabajo Alumno 02',
        roomZone: 'Bancada Sur',
        serviceType: 'workstation',
        expectedColor: 'blue',
      },
      {
        label: 'Punto Acceso Wi-Fi 6 Pasillo (PoE)',
        roomZone: 'Techo Central',
        serviceType: 'wifi_ap',
        expectedColor: 'yellow',
        requiresPoE: true,
      },
      {
        label: 'Cámara IP Vigilancia Entrada (PoE)',
        roomZone: 'Vestíbulo',
        serviceType: 'wifi_ap',
        expectedColor: 'yellow',
        requiresPoE: true,
      },
      {
        label: 'Impresora Multifunción Red',
        roomZone: 'Reprografía',
        serviceType: 'server_nas',
        expectedColor: 'green',
      },
      {
        label: 'NAS Almacenamiento Copias',
        roomZone: 'Armario Auxiliar',
        serviceType: 'server_nas',
        expectedColor: 'green',
      },
      {
        label: 'Teléfono VoIP Secretaría',
        roomZone: 'Mostrador',
        serviceType: 'voip_phone',
        expectedColor: 'purple',
      },
      {
        label: 'Teléfono VoIP Jefatura',
        roomZone: 'Despacho 02',
        serviceType: 'voip_phone',
        expectedColor: 'purple',
      },
    ];

    // Escoger 6 tomas aleatorias y asignarles bocas de Patch Panel ordenadas entre 1 y 22
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 6);
    const usedPorts = new Set<number>();
    while (usedPorts.size < 6) {
      usedPorts.add(Math.floor(Math.random() * 22) + 1);
    }
    const sortedPorts = Array.from(usedPorts).sort((a, b) => a - b);

    const generatedOutlets: WallOutlet[] = shuffled.map((item, idx) => ({
      ...item,
      id: `rnd_out_${idx}_${Date.now()}`,
      code: `TO-0${idx + 1}`,
      patchPanelPort: sortedPorts[idx],
    }));

    const examCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    const randomScenario: ScenarioDefinition = {
      id: 'random_exam',
      title: `Examen Práctico Aleatorio #${examCode} (12U)`,
      level: 'Avanzado',
      environment: `Evaluación Individual · Semilla #${examCode}`,
      summary:
        'Reto generado dinámicamente con asignación única de bocas en el Patch Panel y hardware desubicado. Ordena el rack según su peso/temperatura y parchea todos los servicios.',
      objectives: [
        'Bajar el SAI (28.5 kg) a U1–U2 y situar el Servidor 2U en U3–U4 con ventilación en U5.',
        'Colocar el Router/Firewall en cabeza (U11) e intercalar Pasahilos 1U entre Patch Panel y Switch.',
        'Parchear las 6 rosetas generadas aleatoriamente, el Servidor (Verde) y el Uplink WAN (Rojo).',
      ],
      recommendedTemplates: [
        'ups_2u',
        'server_2u',
        'fan_tray_1u',
        'pdu_1u',
        'switch_24p',
        'cable_manager_1u',
        'patch_panel_24p',
        'router_firewall_1u',
      ],
      needsServerLink: true,
      needsRouterUplink: true,
      wallOutlets: generatedOutlets,
      messyInitialRack: [
        { templateId: 'ups_2u', bottomU: 9 },
        { templateId: 'server_2u', bottomU: 6 },
        { templateId: 'patch_panel_24p', bottomU: 4 },
        { templateId: 'switch_24p', bottomU: 3 },
        { templateId: 'router_firewall_1u', bottomU: 1 },
      ],
      optimalRack: [
        { templateId: 'ups_2u', bottomU: 1 },
        { templateId: 'server_2u', bottomU: 3 },
        { templateId: 'fan_tray_1u', bottomU: 5 },
        { templateId: 'pdu_1u', bottomU: 6 },
        { templateId: 'switch_24p', bottomU: 7 },
        { templateId: 'cable_manager_1u', bottomU: 8 },
        { templateId: 'patch_panel_24p', bottomU: 9 },
        { templateId: 'cable_manager_1u', bottomU: 10 },
        { templateId: 'router_firewall_1u', bottomU: 11 },
        { templateId: 'blank_panel_1u', bottomU: 12 },
      ],
    };

    setCustomRandomScenario(randomScenario);
    setActiveScenarioId('random_exam');
    setDevices(
      randomScenario.messyInitialRack.map((item, idx) => ({
        instanceId: `dev_rnd_${idx}_${Date.now()}`,
        templateId: item.templateId,
        bottomU: item.bottomU,
      }))
    );
    setCables([]);
    setSelectedPort(null);
    setPendingTemplateId(null);
    setStatusFeedback(
      `Generado Examen Aleatorio #${examCode}: bocas de Patch Panel y tomas de aula reasignadas.`
    );
  };

  // Exportar configuración actual a archivo .JSON
  const handleExportJson = () => {
    const payload = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      scenarioId: activeScenarioId,
      customRandomScenario,
      ambientTempC,
      devices,
      cables,
      evaluationSummary: {
        totalScore: evaluation.totalScore,
        gradeLabel: evaluation.gradeLabel,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `montaje-rack-19-${activeScenarioId}-${evaluation.totalScore}pts.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusFeedback('Proyecto exportado correctamente en formato .JSON.');
  };

  // Importar configuración desde archivo .JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result));
        if (Array.isArray(parsed.devices) && Array.isArray(parsed.cables)) {
          if (parsed.customRandomScenario) {
            setCustomRandomScenario(parsed.customRandomScenario);
          }
          if (parsed.scenarioId) {
            setActiveScenarioId(parsed.scenarioId);
          }
          setDevices(parsed.devices);
          setCables(parsed.cables);
          if (typeof parsed.ambientTempC === 'number') {
            setAmbientTempC(parsed.ambientTempC);
          }
          setStatusFeedback('Proyecto .JSON importado correctamente.');
        }
      } catch {
        setStatusFeedback('El archivo seleccionado no es un proyecto .JSON válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Mover un dispositivo ya instalado a otra unidad U
  const handleMoveDevice = (instanceId: string, newBottomU: number) => {
    const dev = devices.find((d) => d.instanceId === instanceId);
    if (!dev) return;
    const tpl = getTemplateById(dev.templateId);
    const uHeight = tpl ? tpl.uHeight : 1;

    if (!canPlaceDeviceAt(devices, newBottomU, uHeight, instanceId)) {
      setStatusFeedback(
        `No es posible mover ${tpl?.shortName || 'el equipo'} a U${newBottomU}: ranura ocupada o fuera de rango.`
      );
      return;
    }

    setDevices((prev) =>
      prev.map((d) => (d.instanceId === instanceId ? { ...d, bottomU: newBottomU } : d))
    );
    setStatusFeedback(
      `${tpl?.shortName} reubicado en U${newBottomU}${
        uHeight === 2 ? `–U${newBottomU + 1}` : ''
      }.`
    );
  };

  // Desmontar un dispositivo del rack (y desconectar sus latiguillos asociados)
  const handleRemoveDevice = (instanceId: string) => {
    const dev = devices.find((d) => d.instanceId === instanceId);
    const tpl = dev ? getTemplateById(dev.templateId) : undefined;
    setDevices((prev) => prev.filter((d) => d.instanceId !== instanceId));
    setCables((prev) =>
      prev.filter((c) => c.fromInstanceId !== instanceId && c.toInstanceId !== instanceId)
    );
    if (selectedPort?.instanceId === instanceId) {
      setSelectedPort(null);
    }
    setStatusFeedback(`${tpl?.shortName || 'Equipo'} desmontado del armario rack.`);
  };

  // Montar un equipo nuevo en una unidad U específica
  const handleMountDeviceAtU = (templateId: string, bottomU: number) => {
    const tpl = getTemplateById(templateId);
    if (!tpl) return;
    if (!canPlaceDeviceAt(devices, bottomU, tpl.uHeight)) {
      setStatusFeedback(
        `No hay espacio suficiente en U${bottomU} para montar ${tpl.shortName} (${tpl.uHeight}U).`
      );
      return;
    }
    const newDevice: PlacedDevice = {
      instanceId: `dev_${templateId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      templateId,
      bottomU,
    };
    setDevices((prev) => [...prev, newDevice]);
    setPendingTemplateId(null);
    setStatusFeedback(
      `${tpl.name} montado en U${bottomU}${tpl.uHeight === 2 ? `–U${bottomU + 1}` : ''}.`
    );
  };

  // Auto-montar en la primera U libre compatible (priorizando su zona ideal si está libre)
  const handleQuickAutoMount = (templateId: string) => {
    const tpl = getTemplateById(templateId);
    if (!tpl) return;

    for (let u = tpl.idealURange[0]; u <= tpl.idealURange[1]; u++) {
      if (canPlaceDeviceAt(devices, u, tpl.uHeight)) {
        handleMountDeviceAtU(templateId, u);
        return;
      }
    }
    for (let u = 1; u <= TOTAL_RACK_UNITS; u++) {
      if (canPlaceDeviceAt(devices, u, tpl.uHeight)) {
        handleMountDeviceAtU(templateId, u);
        return;
      }
    }
    setStatusFeedback(
      `El armario de 12U no tiene ${tpl.uHeight}U contiguas libres para montar ${tpl.shortName}.`
    );
  };

  // Seleccionar una boca RJ45 para conectar un latiguillo
  const handleSelectPort = (portInfo: SelectedPortState) => {
    if (
      selectedPort &&
      selectedPort.instanceId === portInfo.instanceId &&
      selectedPort.port === portInfo.port
    ) {
      setSelectedPort(null);
      setStatusFeedback('Selección de boca RJ45 cancelada.');
      return;
    }

    const existingOnTarget = cables.find(
      (c) =>
        (c.fromInstanceId === portInfo.instanceId && c.fromPort === portInfo.port) ||
        (c.toInstanceId === portInfo.instanceId && c.toPort === portInfo.port)
    );

    if (!selectedPort) {
      if (existingOnTarget) {
        setCables((prev) => prev.filter((c) => c.id !== existingOnTarget.id));
        setStatusFeedback(
          `Latiguillo retirado de ${portInfo.deviceLabel}. Haz clic de nuevo para conectar uno nuevo.`
        );
        return;
      }
      setSelectedPort(portInfo);
      setStatusFeedback(
        `Origen seleccionado: ${portInfo.deviceLabel}. Ahora haz clic en la boca de destino (Color activo: ${CABLE_COLORS[selectedColor].name}).`
      );
      return;
    }

    if (selectedPort.instanceId === portInfo.instanceId) {
      setStatusFeedback(
        'No debes puentear dos bocas del mismo equipo en bucle (Loopback). Conecta equipos distintos (ej. Patch Panel → Switch).'
      );
      setSelectedPort(null);
      return;
    }

    if (existingOnTarget) {
      setStatusFeedback(
        `La boca de destino (${portInfo.deviceLabel}) ya está ocupada por otro latiguillo.`
      );
      return;
    }

    const newCable: PatchCable = {
      id: `cab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromInstanceId: selectedPort.instanceId,
      fromPort: selectedPort.port,
      toInstanceId: portInfo.instanceId,
      toPort: portInfo.port,
      color: selectedColor,
    };

    setCables((prev) => [...prev, newCable]);
    setSelectedPort(null);
    setStatusFeedback(
      `Latiguillo ${CABLE_COLORS[selectedColor].name.split(' ')[0]} conectado: ${
        selectedPort.deviceLabel
      } ↔ ${portInfo.deviceLabel}.`
    );
  };

  // Iniciar parcheo directamente haciendo clic en una Toma de Red del Aula/Oficina
  const handleStartPatchFromOutlet = (outlet: WallOutlet) => {
    const patchPanel = devices.find(
      (d) => getTemplateById(d.templateId)?.category === 'patch_panel'
    );
    if (!patchPanel) {
      setStatusFeedback(
        'Primero debes montar un Patch Panel de 24 bocas en el rack para conectar las tomas del aula/oficina.'
      );
      setRightPanelTab('catalog');
      return;
    }

    setSelectedColor(outlet.expectedColor);
    setSelectedPort({
      instanceId: patchPanel.instanceId,
      port: outlet.patchPanelPort,
      deviceLabel: `Patch Panel #${outlet.patchPanelPort} (${outlet.code}: ${outlet.label})`,
    });
    setStatusFeedback(
      `Seleccionada ${outlet.code} (${outlet.label}) en Patch Panel Boca #${outlet.patchPanelPort} con latiguillo ${
        CABLE_COLORS[outlet.expectedColor].name.split(' ')[0]
      }. Ahora haz clic en una boca libre del Switch.`
    );
  };

  // Eliminar un latiguillo
  const handleRemoveCable = (cableId: string) => {
    setCables((prev) => prev.filter((c) => c.id !== cableId));
    setStatusFeedback('Latiguillo RJ45 desconectado.');
  };

  // Cargar la solución óptima completa (Hardware ordenado + todos los latiguillos con su color normativo)
  const handleLoadOptimalSolution = () => {
    const optimalDevs: PlacedDevice[] = currentScenario.optimalRack.map((item, idx) => ({
      instanceId: `opt_${idx}_${item.templateId}`,
      templateId: item.templateId,
      bottomU: item.bottomU,
    }));

    const ppDev = optimalDevs.find(
      (d) => getTemplateById(d.templateId)?.category === 'patch_panel'
    );
    const swDev = optimalDevs.find(
      (d) => getTemplateById(d.templateId)?.category === 'switch'
    );
    const rtrDev = optimalDevs.find(
      (d) => getTemplateById(d.templateId)?.category === 'router'
    );
    const srvDev = optimalDevs.find(
      (d) => getTemplateById(d.templateId)?.category === 'server'
    );

    const optimalCables: PatchCable[] = [];

    if (ppDev && swDev) {
      currentScenario.wallOutlets.forEach((outlet, idx) => {
        optimalCables.push({
          id: `opt_cab_outlet_${idx}`,
          fromInstanceId: ppDev.instanceId,
          fromPort: outlet.patchPanelPort,
          toInstanceId: swDev.instanceId,
          toPort: outlet.patchPanelPort,
          color: outlet.expectedColor,
        });
      });
    }

    if (currentScenario.needsRouterUplink && swDev && rtrDev) {
      optimalCables.push({
        id: 'opt_cab_uplink',
        fromInstanceId: swDev.instanceId,
        fromPort: 24,
        toInstanceId: rtrDev.instanceId,
        toPort: 1,
        color: 'red',
      });
    }

    if (currentScenario.needsServerLink && swDev && srvDev) {
      optimalCables.push({
        id: 'opt_cab_server',
        fromInstanceId: srvDev.instanceId,
        fromPort: 1,
        toInstanceId: swDev.instanceId,
        toPort: 23,
        color: 'green',
      });
    }

    setDevices(optimalDevs);
    setCables(optimalCables);
    setSelectedPort(null);
    setPendingTemplateId(null);
    setRightPanelTab('evaluation');
    setStatusFeedback(
      'Solución Didáctica de Referencia cargada (100/100 pts): SAI en base, Servidor con ventilación, Pasahilos intercalados, Router en cabeza y código de colores TIA-606-C.'
    );
  };

  const handleResetScenario = () => {
    if (activeScenarioId === 'random_exam') {
      handleGenerateRandomExam();
      return;
    }
    handleSelectScenario(currentScenario.id);
  };

  const handleClearRack = () => {
    setDevices([]);
    setCables([]);
    setSelectedPort(null);
    setPendingTemplateId(null);
    setStatusFeedback('Armario rack completamente vaciado. Monta los equipos desde el catálogo.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* TOP BAR CONTRACT: 3 Zonas Limpias separadas por gap-8 */}
      <header className="flex items-center justify-between gap-8 px-4 sm:px-6 py-3 bg-slate-900/95 border-b border-slate-800 sticky top-0 z-40 backdrop-blur no-print">
        {/* Zona 1: Marca (1 línea con logo del autor) */}
        <a
          href="https://www.unfantasmaenelsistema.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 text-base font-bold tracking-tight text-slate-100 hover:text-sky-300 transition-colors whitespace-nowrap shrink-0"
        >
          <img
            src="./assets/aistudio/icono_81a3db5b.png"
            alt="Logo Un Fantasma en el Sistema"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-md object-contain bg-slate-800/80 p-0.5 border border-slate-700"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="font-display">Un Fantasma en el Sistema · RackLab 19&quot;</span>
        </a>

        {/* Zona 2: 4 enlaces de navegación concisos de una sola línea */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setRightPanelTab('catalog')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Catálogo 19&quot;
          </button>
          <button
            type="button"
            onClick={() => setRightPanelTab('evaluation')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Evaluación ({evaluation.totalScore}/100)
          </button>
          <a
            href="#certificador-t568b"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Certificador y T568B
          </a>
          <button
            type="button"
            onClick={() => setRightPanelTab('guide')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Normativa EIA/TIA
          </button>
        </nav>

        {/* Zona 3: 1 Acción Primaria (Enlace a la web del autor) */}
        <div className="flex items-center shrink-0">
          <a
            href="https://www.unfantasmaenelsistema.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
          >
            <span>unfantasmaenelsistema.com</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL DE TRABAJO (1440px max-w) */}
      <main className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 flex-1 space-y-5">
        {/* Cabecera de Escenario Didáctico y Barra de Herramientas del Simulador */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1 max-w-3xl">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Simulador de Infraestructura de Red y Cableado Estructurado</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-sky-400">{currentScenario.environment}</span>
                <span aria-hidden="true">·</span>
                <span>Nivel {currentScenario.level}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight text-balance">
                Constructor Visual de Armario Rack 19&quot; y Patch Panel
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {currentScenario.summary}
              </p>
            </div>

            {/* Selector de Práctica / Escenario + Generador de Examen Aleatorio */}
            <div className="flex flex-col gap-2 shrink-0 no-print">
              <label className="text-xs font-medium text-slate-400">
                Seleccionar Práctica de Laboratorio:
              </label>
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                {SCENARIOS.map((scen, idx) => (
                  <button
                    key={scen.id}
                    type="button"
                    onClick={() => handleSelectScenario(scen.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeScenarioId === scen.id
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Práctica {idx + 1}: {scen.level}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleGenerateRandomExam}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1 ${
                    activeScenarioId === 'random_exam'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-indigo-300 hover:text-white hover:bg-indigo-950/60'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Examen Aleatorio</span>
                </button>
              </div>
            </div>
          </div>

          {/* Barra de Controles de Simulación Física, Guardar/Cargar JSON y Acciones Rápidas */}
          <div className="flex flex-wrap items-center justify-between gap-3 no-print">
            {/* Control de Temperatura Ambiente y Overlay Térmico */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
                <Thermometer className="w-4 h-4 text-amber-400 shrink-0" />
                <label
                  htmlFor="ambient-slider"
                  className="text-xs font-medium text-slate-300 whitespace-nowrap"
                >
                  Temp. Sala:{' '}
                  <strong className="font-mono text-amber-300">{ambientTempC} °C</strong>
                </label>
                <input
                  id="ambient-slider"
                  type="range"
                  min={18}
                  max={32}
                  step={1}
                  value={ambientTempC}
                  onChange={(e) => setAmbientTempC(Number(e.target.value))}
                  className="w-24 accent-sky-500 cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowThermalOverlay((prev) => !prev)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  showThermalOverlay
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Avisos Térmicos: {showThermalOverlay ? 'Visibles' : 'Ocultos'}</span>
              </button>

              {/* Exportar / Importar JSON */}
              <button
                type="button"
                onClick={handleExportJson}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="Descargar el montaje actual en un archivo .json"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Guardar .JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="Cargar un montaje guardado previamente desde un archivo .json"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>Cargar .JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </div>

            {/* Botones de Acción de Práctica */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleResetScenario}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar Reto</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCables([]);
                  setSelectedPort(null);
                  setStatusFeedback('Todos los latiguillos han sido desconectados.');
                }}
                disabled={cables.length === 0}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Unplug className="w-3.5 h-3.5" />
                <span>Retirar Latiguillos ({cables.length})</span>
              </button>

              <button
                type="button"
                onClick={handleClearRack}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/70 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar Rack</span>
              </button>

              <button
                type="button"
                onClick={handleLoadOptimalSolution}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ver Montaje Óptimo (100/100)</span>
              </button>
            </div>
          </div>

          {/* Barra de Estado Interactiva / Instrucción Contextual */}
          <div
            className={`px-3.5 py-2.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              selectedPort
                ? 'bg-sky-950/60 border-sky-400 text-sky-100'
                : pendingTemplateId
                ? 'bg-amber-950/60 border-amber-400 text-amber-100'
                : evaluation.stabilityStatus === 'tipping_hazard'
                ? 'bg-rose-950/60 border-rose-500/70 text-rose-100'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {evaluation.stabilityStatus === 'tipping_hazard' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Wrench className="w-4 h-4 text-sky-400 shrink-0" />
              )}
              <span>{statusFeedback}</span>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs shrink-0">
              <span>
                Estabilidad:{' '}
                <strong
                  className={
                    evaluation.stabilityStatus === 'stable'
                      ? 'text-emerald-400'
                      : evaluation.stabilityStatus === 'warning'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                >
                  {evaluation.stabilityStatus === 'stable'
                    ? 'ESTABLE (SAI EN BASE)'
                    : evaluation.stabilityStatus === 'warning'
                    ? 'MEJORABLE'
                    : 'PELIGRO DE VUELCO'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Puntuación:{' '}
                <strong className="text-sky-300">{evaluation.totalScore}/100 pts</strong>
              </span>
            </div>
          </div>
        </section>

        {/* SANDBOX DE DOS ZONAS: Izquierda (Rack 19" + Rosetas Aula) | Derecha (Catálogo + Rúbrica + Normativa) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ZONA IZQUIERDA (7 Columnas): Bastidor 19" y Panel de Tomas de Red del Aula/Oficina */}
          <div className="lg:col-span-7 space-y-5">
            <RackCabinetView
              devices={devices}
              cables={cables}
              wallOutlets={currentScenario.wallOutlets}
              thermalSlots={thermalSlots}
              selectedColor={selectedColor}
              selectedPort={selectedPort}
              pendingTemplateId={pendingTemplateId}
              showThermalOverlay={showThermalOverlay}
              highlightedOutletId={highlightedOutletId}
              onSelectPort={handleSelectPort}
              onRemoveCable={handleRemoveCable}
              onMoveDevice={handleMoveDevice}
              onRemoveDevice={handleRemoveDevice}
              onMountDeviceAtU={handleMountDeviceAtU}
              onHighlightOutlet={setHighlightedOutletId}
            />

            <div id="tomas-aula">
              <ClassroomOutletsPanel
                wallOutlets={currentScenario.wallOutlets}
                devices={devices}
                cables={cables}
                selectedColor={selectedColor}
                needsRouterUplink={currentScenario.needsRouterUplink}
                needsServerLink={currentScenario.needsServerLink}
                highlightedOutletId={highlightedOutletId}
                onSelectColor={(color) => {
                  setSelectedColor(color);
                  setStatusFeedback(
                    `Rollo de latiguillos cambiado a ${CABLE_COLORS[color].name}.`
                  );
                }}
                onHighlightOutlet={setHighlightedOutletId}
                onStartPatchFromOutlet={handleStartPatchFromOutlet}
              />
            </div>
          </div>

          {/* ZONA DERECHA (5 Columnas): Catálogo de Equipos, Evaluación en Vivo y Normativa */}
          <div className="lg:col-span-5 lg:sticky lg:top-16">
            <HardwareCatalogAndRubric
              activeTab={rightPanelTab}
              onTabChange={setRightPanelTab}
              scenario={currentScenario}
              devices={devices}
              evaluation={evaluation}
              pendingTemplateId={pendingTemplateId}
              onSelectTemplateForMount={(tplId) => {
                setPendingTemplateId(tplId);
                if (tplId) {
                  const tpl = getTemplateById(tplId);
                  setStatusFeedback(
                    `Seleccionado ${tpl?.name}. Haz clic en cualquier ranura libre U del bastidor para instalarlo.`
                  );
                }
              }}
              onQuickAutoMount={handleQuickAutoMount}
            />
          </div>
        </div>

        {/* SECCIÓN DE CERTIFICADOR FLUKE CAT6, PRESUPUESTO PoE Y TALLER DE CRIMPADO RJ45 T568B */}
        <section id="certificador-t568b" className="pt-2">
          <CableCertifierAndPinoutLab
            wallOutlets={currentScenario.wallOutlets}
            devices={devices}
            cables={cables}
          />
        </section>
      </main>

      {/* PIE DE PÁGINA CON CRÉDITO, LOGO Y ENLACE A UNFANTASMAENELSISTEMA.COM */}
      <footer className="bg-slate-900 border-t border-slate-800 mt-10 py-6 px-4 sm:px-6">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <a
              href="https://www.unfantasmaenelsistema.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <img
                src="./assets/aistudio/icono_81a3db5b.png"
                alt="Un Fantasma en el Sistema"
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-lg bg-slate-800 p-1 border border-slate-700 hover:border-sky-400 transition-colors object-contain"
              />
            </a>
            <div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Constructor Visual de Rack 19&quot; y Patch Panel</span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <a
                  href="https://www.unfantasmaenelsistema.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300 underline underline-offset-4"
                >
                  Un Fantasma en el Sistema
                </a>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Recurso educativo interactivo para Formación Profesional (Redes Locales, SMR, ASIR, STI) · Estándares EIA-310-D, ANSI/TIA-568B y ANSI/TIA-606-C.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <a
              href="https://www.unfantasmaenelsistema.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors flex items-center gap-1.5"
            >
              <span>Visitar www.unfantasmaenelsistema.com</span>
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
