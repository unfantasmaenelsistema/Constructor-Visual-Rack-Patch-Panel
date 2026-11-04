import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Cpu,
  Flame,
  HardDrive,
  Info,
  Layers,
  Plus,
  Printer,
  Scale,
  Thermometer,
  XCircle,
} from 'lucide-react';
import { CABLE_COLORS, DEVICE_TEMPLATES } from '../data/rackData';
import {
  PlacedDevice,
  RackDeviceTemplate,
  RackEvaluationReport,
  ScenarioDefinition,
} from '../types/rack';

interface HardwareCatalogAndRubricProps {
  activeTab: 'catalog' | 'evaluation' | 'guide';
  onTabChange: (tab: 'catalog' | 'evaluation' | 'guide') => void;
  scenario: ScenarioDefinition;
  devices: PlacedDevice[];
  evaluation: RackEvaluationReport;
  pendingTemplateId: string | null;
  onSelectTemplateForMount: (templateId: string | null) => void;
  onQuickAutoMount: (templateId: string) => void;
}

export const HardwareCatalogAndRubric: React.FC<HardwareCatalogAndRubricProps> = ({
  activeTab,
  onTabChange,
  scenario,
  devices,
  evaluation,
  pendingTemplateId,
  onSelectTemplateForMount,
  onQuickAutoMount,
}) => {
  const [studentName, setStudentName] = useState('');
  const [studentGroup, setStudentGroup] = useState('FP Redes / SMR-ASIR');

  const countInstalled = (templateId: string) =>
    devices.filter((d) => d.templateId === templateId).length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col h-full overflow-hidden">
      {/* Controles segmentados de navegación del panel lateral */}
      <div className="p-2 bg-slate-950 border-b border-slate-800 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onTabChange('catalog')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'catalog'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Catálogo 19&quot;</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('evaluation')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'evaluation'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Evaluación ({evaluation.totalScore}/100)</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('guide')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'guide'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Normativa</span>
        </button>
      </div>

      {/* Contenido de la pestaña activa */}
      <div className="p-4 overflow-y-auto space-y-4 flex-1">
        {/* PESTAÑA 1: CATÁLOGO DE HARDWARE ENRACABLE */}
        {activeTab === 'catalog' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Elementos Enracables (19 Pulgadas)
              </h2>
              <span className="font-mono text-xs text-slate-400">
                Arrastra o haz clic para montar
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Selecciona un elemento y haz clic en la unidad <code className="text-sky-300">U</code> deseada del bastidor, o arrástralo directamente.
            </p>

            <div className="space-y-2.5">
              {DEVICE_TEMPLATES.map((tpl: RackDeviceTemplate) => {
                const installedCount = countInstalled(tpl.id);
                const isRecommended = scenario.recommendedTemplates.includes(tpl.id);
                const isSelectedForMount = pendingTemplateId === tpl.id;

                return (
                  <div
                    key={tpl.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/rack-template', tpl.id);
                    }}
                    className={`p-3 rounded-lg border transition-all ${
                      isSelectedForMount
                        ? 'bg-sky-950/40 border-sky-400 ring-1 ring-sky-400'
                        : 'bg-slate-950/75 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-100">
                            {tpl.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mt-0.5">
                          <span>Altura: {tpl.uHeight}U</span>
                          <span aria-hidden="true">·</span>
                          <span>Peso: {tpl.weightKg} kg</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {tpl.heatOutputWatts > 0
                              ? `Calor: +${tpl.heatOutputWatts}W`
                              : tpl.airflowDissipation > 0
                              ? `Enfría: -${tpl.airflowDissipation}W`
                              : 'Pasivo (0W)'}
                          </span>
                        </div>
                      </div>

                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        En rack: {installedCount}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {tpl.didacticPrinciple}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-slate-400">
                        {isRecommended ? 'Requerido en esta práctica' : 'Opcional / Auxiliar'} ·{' '}
                        {tpl.idealZoneLabel}
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectTemplateForMount(isSelectedForMount ? null : tpl.id)
                          }
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            isSelectedForMount
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          {isSelectedForMount ? 'Elegir U en Rack...' : 'Elegir U'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickAutoMount(tpl.id)}
                          title="Insertar en la primera unidad U libre desde abajo"
                          className="px-2.5 py-1 rounded text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Montar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PESTAÑA 2: RÚBRICA DE EVALUACIÓN Y DIAGNÓSTICO EN TIEMPO REAL */}
        {activeTab === 'evaluation' && (
          <div className="space-y-4">
            {/* Resumen ejecutivo de nota y telemetría física */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">
                    Calificación Técnica en Tiempo Real
                  </span>
                  <h3 className="text-lg font-bold text-slate-100 mt-0.5">
                    {evaluation.gradeLabel}
                  </h3>
                </div>
                <div className="text-right font-mono">
                  <span
                    className={`text-2xl font-bold ${
                      evaluation.totalScore >= 85
                        ? 'text-emerald-400'
                        : evaluation.totalScore >= 50
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {evaluation.totalScore}
                  </span>
                  <span className="text-sm text-slate-500"> / 100 pts</span>
                </div>
              </div>

              {/* Barra de progreso general */}
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    evaluation.totalScore >= 85
                      ? 'bg-emerald-500'
                      : evaluation.totalScore >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${evaluation.totalScore}%` }}
                />
              </div>

              {/* Métricas físicas del rack */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">CENTRO GRAVEDAD</span>
                  <span
                    className={`font-bold ${
                      evaluation.stabilityStatus === 'stable'
                        ? 'text-emerald-400'
                        : evaluation.stabilityStatus === 'warning'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {evaluation.centerOfGravityU > 0
                      ? `U${evaluation.centerOfGravityU}`
                      : 'Vacío'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">PESO TOTAL</span>
                  <span className="font-bold text-slate-200">
                    {evaluation.totalWeightKg} kg
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">TEMP. PICO</span>
                  <span
                    className={`font-bold ${
                      evaluation.maxTemperatureC >= 37
                        ? 'text-rose-400'
                        : evaluation.maxTemperatureC >= 34
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {evaluation.maxTemperatureC.toFixed(1)} °C
                  </span>
                </div>
              </div>
            </div>

            {/* Desglose de los 5 criterios didácticos */}
            <div className="space-y-3">
              {evaluation.items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.status === 'pass' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : item.status === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-100">
                        {item.category}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-200 shrink-0">
                      {item.score} / {item.maxScore} pts
                    </span>
                  </div>

                  <ul className="space-y-1 text-xs text-slate-300 pl-6 list-disc">
                    {item.findings.map((f, idx) => (
                      <li key={idx} className="leading-snug">
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                    <strong className="text-slate-300">Criterio Técnico:</strong> {item.didacticTip}
                  </div>
                </div>
              ))}
            </div>

            {/* Generador de ficha de entrega para el alumno */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 no-print">
              <h4 className="text-xs font-semibold text-slate-200">
                Exportar Informe de Práctica para el Profesor
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Nombre y Apellidos del Alumno..."
                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                />
                <input
                  type="text"
                  value={studentGroup}
                  onChange={(e) => setStudentGroup(e.target.value)}
                  placeholder="Curso / Grupo (ej. 1º SMR)..."
                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                />
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir / Guardar PDF de Calificación</span>
              </button>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: NORMATIVA Y GUÍA DIDÁCTICA */}
        {activeTab === 'guide' && (
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Scale className="w-4 h-4 text-sky-400" />
                <span>1. Ordenación Vertical y Gravedad (Estándar EIA-310-D)</span>
              </h3>
              <p>
                Un bastidor de 19 pulgadas (<code className="text-sky-300">482.6 mm</code> de ancho entre extremos de montaje) se divide verticalmente en Unidades Rack (<code className="text-sky-300">1U = 44.45 mm = 1.75&quot;</code>), numeradas siempre desde abajo (<code className="text-sky-300">U1</code> en la base) hacia arriba (<code className="text-sky-300">U12</code> en cabeza).
              </p>
              <ul className="space-y-1.5 pl-4 list-disc text-slate-300">
                <li>
                  <strong>Base (U1–U2):</strong> Reservada obligatoriamente para el <strong>SAI / UPS</strong> por su gran masa (baterías). Reduce el centro de gravedad e impide que el armario vuelque al extraer un servidor sobre raíles.
                </li>
                <li>
                  <strong>Zona Inferior-Media (U3–U6):</strong> <strong>Servidores enracables</strong>, <strong>PDU eléctrica</strong> y <strong>Bandeja de ventilación</strong> para evacuar el calor antes de que alcance la electrónica de red.
                </li>
                <li>
                  <strong>Zona Media-Alta (U7–U10):</strong> <strong>Switch de Acceso</strong> y <strong>Patch Panel</strong> separados por un <strong>Pasahilos horizontal (1U)</strong>.
                </li>
                <li>
                  <strong>Cabeza (U11–U12):</strong> <strong>Router / Firewall perimetral</strong> próximo a la entrada superior de canaleta de fibra óptica / acometida WAN.
                </li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-amber-400" />
                <span>2. Gestión Térmica y Convección Natural</span>
              </h3>
              <p>
                El aire caliente es menos denso y asciende hacia la parte superior del armario. Si apilas el SAI, un Servidor y un Switch sin separación ni extracción activa, el calor inferior recalienta los equipos superiores. Además, dejar latiguillos colgando sin <strong>Pasahilos</strong> tapona las rejillas frontales de admisión de aire.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-100">
                3. Código de Colores de Latiguillos (ANSI/TIA-606-C)
              </h3>
              <div className="space-y-2">
                {Object.values(CABLE_COLORS).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-2.5 p-2 rounded bg-slate-900/90 border border-slate-800"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 border border-white/40"
                      style={{ backgroundColor: c.hex }}
                    />
                    <div>
                      <div className="font-semibold text-slate-100">
                        {c.name} · <span className="font-mono text-[11px] text-slate-400">{c.vlanTag}</span>
                      </div>
                      <div className="text-slate-400 text-[11px]">{c.usage}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
