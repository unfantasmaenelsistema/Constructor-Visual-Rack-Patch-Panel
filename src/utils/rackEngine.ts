import { CABLE_COLORS, DEVICE_TEMPLATES } from '../data/rackData';
import {
  EvaluationBreakdownItem,
  PatchCable,
  PlacedDevice,
  RackDeviceTemplate,
  RackEvaluationReport,
  ScenarioDefinition,
  UThermalSlot,
} from '../types/rack';

export const TOTAL_RACK_UNITS = 12;

export function getTemplateById(templateId: string): RackDeviceTemplate | undefined {
  return DEVICE_TEMPLATES.find((t) => t.id === templateId);
}

export function getOccupiedUnits(devices: PlacedDevice[]): Map<number, PlacedDevice> {
  const map = new Map<number, PlacedDevice>();
  for (const dev of devices) {
    const tpl = getTemplateById(dev.templateId);
    const height = tpl ? tpl.uHeight : 1;
    for (let u = dev.bottomU; u < dev.bottomU + height; u++) {
      map.set(u, dev);
    }
  }
  return map;
}

export function canPlaceDeviceAt(
  devices: PlacedDevice[],
  bottomU: number,
  uHeight: 1 | 2,
  ignoreInstanceId?: string
): boolean {
  if (bottomU < 1 || bottomU + uHeight - 1 > TOTAL_RACK_UNITS) {
    return false;
  }
  const filtered = ignoreInstanceId
    ? devices.filter((d) => d.instanceId !== ignoreInstanceId)
    : devices;
  const occupied = getOccupiedUnits(filtered);
  for (let u = bottomU; u < bottomU + uHeight; u++) {
    if (occupied.has(u)) {
      return false;
    }
  }
  return true;
}

export function hasCableManagerBetween(
  devices: PlacedDevice[],
  uA: number,
  uB: number
): boolean {
  const minU = Math.min(uA, uB);
  const maxU = Math.max(uA, uB);
  return devices.some((d) => {
    const tpl = getTemplateById(d.templateId);
    if (tpl?.category !== 'cable_manager') return false;
    // Directo entre ambos o pegado al switch/patch panel
    return (
      (d.bottomU >= minU && d.bottomU <= maxU) ||
      Math.abs(d.bottomU - uA) === 1 ||
      Math.abs(d.bottomU - uB) === 1
    );
  });
}

export function computeThermalProfile(
  devices: PlacedDevice[],
  cables: PatchCable[],
  ambientTempC = 22.0
): UThermalSlot[] {
  const occupied = getOccupiedUnits(devices);
  const slots: UThermalSlot[] = [];

  for (let u = 1; u <= TOTAL_RACK_UNITS; u++) {
    slots.push({
      u,
      temperatureC: ambientTempC,
      status: 'optimal',
      heatSources: [],
      airflowBlockedByCables: false,
    });
  }

  // Verificar si hay cables conectados sin pasahilos cerca del switch
  const switches = devices.filter((d) => getTemplateById(d.templateId)?.category === 'switch');
  const cableManagers = devices.filter(
    (d) => getTemplateById(d.templateId)?.category === 'cable_manager'
  );

  // 1. Aportación térmica directa y convección ascendente (el calor sube hacia U superiores)
  for (const dev of devices) {
    const tpl = getTemplateById(dev.templateId);
    if (!tpl) continue;

    if (tpl.heatOutputWatts > 0) {
      const baseDelta = tpl.heatOutputWatts * 0.085;
      for (let u = dev.bottomU; u < dev.bottomU + tpl.uHeight; u++) {
        const slot = slots[u - 1];
        if (slot) {
          slot.temperatureC += baseDelta;
          slot.heatSources.push(tpl.shortName);
        }
      }
      // Convección hacia las 3 unidades superiores
      const topU = dev.bottomU + tpl.uHeight - 1;
      for (let offset = 1; offset <= 3; offset++) {
        const targetU = topU + offset;
        if (targetU <= TOTAL_RACK_UNITS) {
          const decay = offset === 1 ? 0.65 : offset === 2 ? 0.38 : 0.18;
          slots[targetU - 1].temperatureC += baseDelta * decay;
          slots[targetU - 1].heatSources.push(`Convección de ${tpl.shortName}`);
        }
      }
    }

    // Penalización por apilamiento térmico directo (dos equipos activos calientes pegados sin ventilación ni espacio)
    if (tpl.heatOutputWatts >= 35) {
      const topU = dev.bottomU + tpl.uHeight;
      const aboveDev = occupied.get(topU);
      if (aboveDev && aboveDev.instanceId !== dev.instanceId) {
        const aboveTpl = getTemplateById(aboveDev.templateId);
        if (aboveTpl && aboveTpl.heatOutputWatts >= 35) {
          slots[topU - 1].temperatureC += 4.8;
          slots[dev.bottomU - 1].temperatureC += 2.6;
          slots[topU - 1].heatSources.push('Apilamiento térmico sin disipación');
        }
      }
    }
  }

  // 2. Penalización por obstrucción de latiguillos si hay cables pero no hay pasahilos junto al switch
  if (cables.length > 0 && switches.length > 0) {
    for (const sw of switches) {
      const hasAdjacentCM = cableManagers.some(
        (cm) => Math.abs(cm.bottomU - sw.bottomU) === 1
      );
      if (!hasAdjacentCM) {
        const penalty = Math.min(6.5, cables.length * 0.75);
        slots[sw.bottomU - 1].temperatureC += penalty;
        slots[sw.bottomU - 1].airflowBlockedByCables = true;
        slots[sw.bottomU - 1].heatSources.push('Latiguillos sin pasahilos obstruyen rejilla');
      }
    }
  }

  // 3. Refrigeración activa (Bandeja de ventilación y paneles microperforados)
  for (const dev of devices) {
    const tpl = getTemplateById(dev.templateId);
    if (!tpl || tpl.airflowDissipation <= 0) continue;

    const coolingDelta = tpl.airflowDissipation * 0.11;
    // Enfría su propia U, la inferior y las 3 superiores
    for (let u = Math.max(1, dev.bottomU - 2); u <= Math.min(TOTAL_RACK_UNITS, dev.bottomU + 3); u++) {
      slots[u - 1].temperatureC = Math.max(
        ambientTempC,
        slots[u - 1].temperatureC - coolingDelta
      );
    }
  }

  // Clasificar estado térmico por U
  for (const slot of slots) {
    slot.temperatureC = Math.round(slot.temperatureC * 10) / 10;
    if (slot.temperatureC >= 40) {
      slot.status = 'critical';
    } else if (slot.temperatureC >= 35) {
      slot.status = 'hot';
    } else if (slot.temperatureC >= 29) {
      slot.status = 'warm';
    } else {
      slot.status = 'optimal';
    }
  }

  return slots;
}

export function evaluateRackConfiguration(
  devices: PlacedDevice[],
  cables: PatchCable[],
  scenario: ScenarioDefinition,
  ambientTempC = 22.0
): RackEvaluationReport {
  const thermalSlots = computeThermalProfile(devices, cables, ambientTempC);

  // Peso total y Centro de Gravedad (CoG)
  let totalWeightKg = 0;
  let weightedUSum = 0;

  for (const dev of devices) {
    const tpl = getTemplateById(dev.templateId);
    if (!tpl) continue;
    const centerU = dev.bottomU + (tpl.uHeight - 1) / 2;
    totalWeightKg += tpl.weightKg;
    weightedUSum += tpl.weightKg * centerU;
  }

  const centerOfGravityU =
    totalWeightKg > 0 ? Math.round((weightedUSum / totalWeightKg) * 100) / 100 : 0;

  const upsDevices = devices.filter((d) => getTemplateById(d.templateId)?.category === 'ups');
  const serverDevices = devices.filter((d) => getTemplateById(d.templateId)?.category === 'server');
  const routerDevices = devices.filter((d) => getTemplateById(d.templateId)?.category === 'router');
  const switchDevices = devices.filter((d) => getTemplateById(d.templateId)?.category === 'switch');
  const patchPanels = devices.filter(
    (d) => getTemplateById(d.templateId)?.category === 'patch_panel'
  );
  const cableManagers = devices.filter(
    (d) => getTemplateById(d.templateId)?.category === 'cable_manager'
  );
  const fanTrays = devices.filter((d) => getTemplateById(d.templateId)?.category === 'fan_tray');

  // --- CRITERIO 1: Distribución de Peso y SAI en la Base (20 pts) ---
  let weightScore = 0;
  const weightFindings: string[] = [];

  if (upsDevices.length === 0) {
    weightFindings.push('Falta instalar el SAI / UPS en el armario rack.');
  } else {
    const ups = upsDevices[0];
    if (ups.bottomU === 1) {
      weightScore += 14;
      weightFindings.push('Correcto: El SAI (28.5 kg) está anclado en la base (U1–U2).');
    } else if (ups.bottomU <= 3) {
      weightScore += 7;
      weightFindings.push(
        `Mejorable: El SAI está en U${ups.bottomU}; debería ir estrictamente en U1–U2.`
      );
    } else {
      weightFindings.push(
        `Peligro mecánico: El SAI (28.5 kg) está en U${ups.bottomU}–U${ups.bottomU + 1}. Riesgo severo de vuelco del bastidor.`
      );
    }
  }

  if (scenario.needsServerLink) {
    if (serverDevices.length === 0) {
      weightFindings.push('Este escenario requiere instalar el Servidor Rack 2U (18.2 kg).');
    } else {
      const srv = serverDevices[0];
      if (srv.bottomU >= 2 && srv.bottomU <= 5) {
        weightScore += 6;
        weightFindings.push(
          `Correcto: Servidor 2U ubicado en zona baja (U${srv.bottomU}–U${srv.bottomU + 1}).`
        );
      } else {
        weightScore += 2;
        weightFindings.push(
          `El Servidor 2U (18.2 kg) en U${srv.bottomU} eleva innecesariamente el centro de gravedad (ideal U3–U5).`
        );
      }
    }
  } else {
    if (centerOfGravityU > 0 && centerOfGravityU <= 4.5 && upsDevices.length > 0 && upsDevices[0].bottomU === 1) {
      weightScore += 6;
      weightFindings.push(`Centro de gravedad estable y bajo (${centerOfGravityU} U).`);
    } else if (centerOfGravityU > 5.5) {
      weightFindings.push(`Centro de gravedad demasiado alto (${centerOfGravityU} U > 5.0 U).`);
    }
  }

  const stabilityStatus: 'stable' | 'warning' | 'tipping_hazard' =
    upsDevices.some((u) => u.bottomU >= 6) || centerOfGravityU >= 6.2
      ? 'tipping_hazard'
      : centerOfGravityU <= 4.6 && upsDevices.some((u) => u.bottomU === 1)
      ? 'stable'
      : 'warning';

  // --- CRITERIO 2: Jerarquía de Red (Router en cabeza, Patch Panel y Switch) (20 pts) ---
  let hierarchyScore = 0;
  const hierarchyFindings: string[] = [];

  if (routerDevices.length === 0) {
    hierarchyFindings.push('Falta instalar el Router / Firewall perimetral.');
  } else {
    const rtr = routerDevices[0];
    if (rtr.bottomU >= 10) {
      hierarchyScore += 8;
      hierarchyFindings.push(
        `Correcto: Router/Firewall situado en cabeza (U${rtr.bottomU}), próximo a la acometida WAN.`
      );
    } else {
      hierarchyScore += 3;
      hierarchyFindings.push(
        `El Router/Firewall está en U${rtr.bottomU}; por normativa didáctica debe ir en cabeza (U10–U12).`
      );
    }
  }

  if (patchPanels.length === 0) {
    hierarchyFindings.push('Falta instalar el Patch Panel de 24 bocas.');
  } else {
    const pp = patchPanels[0];
    if (pp.bottomU >= 6 && pp.bottomU <= 11) {
      hierarchyScore += 6;
      hierarchyFindings.push(`Correcto: Patch Panel situado en zona media-alta (U${pp.bottomU}).`);
    } else {
      hierarchyScore += 3;
      hierarchyFindings.push(
        `El Patch Panel en U${pp.bottomU} está demasiado bajo; conviene situarlo en U7–U10.`
      );
    }
  }

  if (switchDevices.length === 0) {
    hierarchyFindings.push('Falta instalar el Switch Gestionable de 24 bocas.');
  } else {
    const sw = switchDevices[0];
    if (sw.bottomU >= 5 && sw.bottomU <= 10) {
      hierarchyScore += 6;
      hierarchyFindings.push(`Correcto: Switch situado en zona de distribución (U${sw.bottomU}).`);
    } else {
      hierarchyScore += 3;
      hierarchyFindings.push(`Switch en U${sw.bottomU}; ubícalo próximo al Patch Panel (U6–U9).`);
    }
  }

  // --- CRITERIO 3: Organización de Pasahilos y Guiado Horizontal (15 pts) ---
  let cableMgmtScore = 0;
  const cableMgmtFindings: string[] = [];

  if (patchPanels.length > 0 && switchDevices.length > 0) {
    const ppU = patchPanels[0].bottomU;
    const swU = switchDevices[0].bottomU;
    const distance = Math.abs(ppU - swU);

    const hasBetween = cableManagers.some(
      (cm) =>
        (cm.bottomU > Math.min(ppU, swU) && cm.bottomU < Math.max(ppU, swU)) ||
        Math.abs(cm.bottomU - swU) === 1
    );

    if (distance === 2 && hasBetween) {
      cableMgmtScore = 15;
      cableMgmtFindings.push(
        'Excelente: Pasahilos 1U intercalado exactamente entre el Patch Panel y el Switch.'
      );
    } else if (hasBetween && distance <= 3) {
      cableMgmtScore = 12;
      cableMgmtFindings.push('Correcto: Hay guía pasahilos dando servicio al bloque Switch / Patch Panel.');
    } else if (distance === 1) {
      cableMgmtScore = 4;
      cableMgmtFindings.push(
        'Error común: El Patch Panel y el Switch están pegados sin un Pasahilos 1U en medio.'
      );
    } else {
      cableMgmtFindings.push(
        'Falta intercalar un Pasahilos 1U entre el Patch Panel y el Switch para ordenar los latiguillos.'
      );
    }
  } else {
    cableMgmtFindings.push('Instala tanto el Patch Panel como el Switch junto con un Pasahilos 1U.');
  }

  // --- CRITERIO 4: Gestión Térmica y Convección (15 pts) ---
  let thermalScore = 0;
  const thermalFindings: string[] = [];
  const maxTemperatureC = Math.max(...thermalSlots.map((s) => s.temperatureC));
  const avgTemperatureC =
    Math.round(
      (thermalSlots.reduce((acc, s) => acc + s.temperatureC, 0) / thermalSlots.length) * 10
    ) / 10;

  const hotSlots = thermalSlots.filter((s) => s.temperatureC >= 35);
  const blockedSlots = thermalSlots.filter((s) => s.airflowBlockedByCables);

  if (devices.length >= 4) {
    if (maxTemperatureC <= 33.5 && blockedSlots.length === 0) {
      thermalScore = 15;
      thermalFindings.push(
        `Flujo térmico óptimo: Pico máximo de ${maxTemperatureC} °C sin obstrucción de rejillas.`
      );
    } else if (maxTemperatureC <= 36.5) {
      thermalScore = 10;
      thermalFindings.push(
        `Temperatura moderada (máx. ${maxTemperatureC} °C). Añadir ventilación o separación mejorará la disipación.`
      );
    } else {
      thermalScore = 4;
      thermalFindings.push(
        `Alerta de sobrecalentamiento (${maxTemperatureC} °C en ${hotSlots
          .map((s) => `U${s.u}`)
          .join(', ')}). Separa los equipos calientes o instala una Bandeja de Ventilación 1U.`
      );
    }

    if (fanTrays.length > 0) {
      thermalFindings.push('Bandeja de ventilación activa instalada ayudando a la convección.');
    }
  } else {
    thermalFindings.push('Instala los equipos activos del escenario para evaluar la disipación térmica.');
  }

  // --- CRITERIO 5: Parcheo de Tomas de Red y Código de Colores (30 pts) ---
  let cablingScore = 0;
  const cablingFindings: string[] = [];

  const totalOutlets = scenario.wallOutlets.length;
  const totalExpectedCables =
    totalOutlets + (scenario.needsRouterUplink ? 1 : 0) + (scenario.needsServerLink ? 1 : 0);
  const pointsPerCable = 30 / totalExpectedCables;

  let rawCablingPoints = 0;

  if (patchPanels.length === 0 || switchDevices.length === 0) {
    cablingFindings.push('Instala el Patch Panel y el Switch para poder conectar los latiguillos RJ45.');
  } else {
    const ppIds = new Set(patchPanels.map((p) => p.instanceId));
    const swIds = new Set(switchDevices.map((s) => s.instanceId));
    const rtrIds = new Set(routerDevices.map((r) => r.instanceId));
    const srvIds = new Set(serverDevices.map((s) => s.instanceId));

    // Evaluar cada toma del aula/oficina
    let correctOutletsCount = 0;
    let wrongColorCount = 0;

    for (const outlet of scenario.wallOutlets) {
      // Buscar cable que conecte PatchPanel(puerto = outlet.patchPanelPort) <-> Switch(cualquier puerto 1..22)
      const cable = cables.find(
        (c) =>
          (ppIds.has(c.fromInstanceId) &&
            c.fromPort === outlet.patchPanelPort &&
            swIds.has(c.toInstanceId)) ||
          (ppIds.has(c.toInstanceId) &&
            c.toPort === outlet.patchPanelPort &&
            swIds.has(c.fromInstanceId))
      );

      if (!cable) {
        cablingFindings.push(
          `Falta parchear ${outlet.code} (${outlet.label}) desde Boca #${outlet.patchPanelPort} del Patch Panel hacia el Switch.`
        );
      } else {
        const swPort = swIds.has(cable.toInstanceId) ? cable.toPort : cable.fromPort;
        if (cable.color === outlet.expectedColor) {
          rawCablingPoints += pointsPerCable;
          correctOutletsCount++;
        } else {
          rawCablingPoints += pointsPerCable * 0.4;
          wrongColorCount++;
          const expectedSpec = CABLE_COLORS[outlet.expectedColor];
          const usedSpec = CABLE_COLORS[cable.color];
          cablingFindings.push(
            `Color incorrecto en ${outlet.code} (Boca PP #${outlet.patchPanelPort} → SW #${swPort}): usaste ${usedSpec.name.split(' ')[0]}, pero corresponde ${expectedSpec.name}.`
          );
        }
      }
    }

    if (correctOutletsCount === totalOutlets) {
      cablingFindings.push(
        `Perfecto: Las ${totalOutlets} tomas de red del aula/oficina están parcheadas al Switch con su código de color correcto.`
      );
    }

    // Evaluar enlace Router/Firewall (Rojo)
    if (scenario.needsRouterUplink) {
      const uplinkCable = cables.find(
        (c) =>
          (swIds.has(c.fromInstanceId) && rtrIds.has(c.toInstanceId)) ||
          (rtrIds.has(c.fromInstanceId) && swIds.has(c.toInstanceId))
      );
      if (!uplinkCable) {
        cablingFindings.push(
          'Falta el latiguillo de Uplink entre el Switch (recomendado boca 24) y el Router/Firewall.'
        );
      } else if (uplinkCable.color === 'red') {
        rawCablingPoints += pointsPerCable;
        cablingFindings.push(
          'Correcto: Enlace crítico Uplink Switch ↔ Router/Firewall conectado con latiguillo ROJO.'
        );
      } else {
        rawCablingPoints += pointsPerCable * 0.4;
        cablingFindings.push(
          'El enlace crítico entre Switch y Router/Firewall debe utilizar un latiguillo de color ROJO.'
        );
      }
    }

    // Evaluar enlace Servidor (Verde)
    if (scenario.needsServerLink) {
      const serverCable = cables.find(
        (c) =>
          (swIds.has(c.fromInstanceId) && srvIds.has(c.toInstanceId)) ||
          (srvIds.has(c.fromInstanceId) && swIds.has(c.toInstanceId))
      );
      if (!serverCable) {
        cablingFindings.push(
          'Falta conectar el Servidor Rack 2U al Switch mediante un latiguillo VERDE.'
        );
      } else if (serverCable.color === 'green') {
        rawCablingPoints += pointsPerCable;
        cablingFindings.push(
          'Correcto: Servidor Rack 2U conectado al Switch con latiguillo VERDE.'
        );
      } else {
        rawCablingPoints += pointsPerCable * 0.4;
        cablingFindings.push(
          'El enlace entre el Servidor Rack y el Switch debe ir con latiguillo de color VERDE.'
        );
      }
    }
  }

  cablingScore = Math.min(30, Math.round(rawCablingPoints));

  const items: EvaluationBreakdownItem[] = [
    {
      id: 'gravity',
      category: '1. Gravedad, Peso y SAI en Base',
      score: weightScore,
      maxScore: 20,
      status: weightScore >= 16 ? 'pass' : weightScore >= 10 ? 'warning' : 'fail',
      findings: weightFindings,
      didacticTip:
        'Los equipos más pesados (SAI y Servidores) se instalan siempre en las unidades inferiores (U1–U4) para bajar el centro de gravedad.',
    },
    {
      id: 'hierarchy',
      category: '2. Jerarquía Física de Red (Cabeza y Acceso)',
      score: hierarchyScore,
      maxScore: 20,
      status: hierarchyScore >= 16 ? 'pass' : hierarchyScore >= 10 ? 'warning' : 'fail',
      findings: hierarchyFindings,
      didacticTip:
        'El Router/Firewall se ubica en cabeza (U10–U12) cerca de la entrada WAN, seguido del bloque Patch Panel y Switch.',
    },
    {
      id: 'cable_mgmt',
      category: '3. Gestión de Pasahilos',
      score: cableMgmtScore,
      maxScore: 15,
      status: cableMgmtScore >= 12 ? 'pass' : cableMgmtScore >= 7 ? 'warning' : 'fail',
      findings: cableMgmtFindings,
      didacticTip:
        'Intercala siempre un Pasahilos horizontal de 1U entre el Patch Panel y el Switch para conducir los latiguillos con limpieza.',
    },
    {
      id: 'thermal',
      category: '4. Termodinámica y Convección',
      score: thermalScore,
      maxScore: 15,
      status: thermalScore >= 12 ? 'pass' : thermalScore >= 8 ? 'warning' : 'fail',
      findings: thermalFindings,
      didacticTip:
        'El calor asciende por convección. Evita apilar equipos de alta potencia sin bandeja de ventilación o unidades de desahogo.',
    },
    {
      id: 'patching',
      category: '5. Parcheo RJ45 y Código de Colores',
      score: cablingScore,
      maxScore: 30,
      status: cablingScore >= 26 ? 'pass' : cablingScore >= 15 ? 'warning' : 'fail',
      findings: cablingFindings,
      didacticTip:
        'Azul: Tomas Usuario · Amarillo: Wi-Fi/PoE · Rojo: WAN/Firewall · Verde: Servidores/Impresoras · Violeta: VoIP.',
    },
  ];

  const totalScore = items.reduce((acc, item) => acc + item.score, 0);

  let gradeLabel = 'Insuficiente · Requiere Correcciones';
  if (totalScore >= 90) gradeLabel = 'Sobresaliente · Instalación Certificada';
  else if (totalScore >= 75) gradeLabel = 'Notable · Montaje Profesional';
  else if (totalScore >= 50) gradeLabel = 'Aprobado · Funcional con Avisos';

  return {
    totalScore,
    gradeLabel,
    centerOfGravityU,
    totalWeightKg: Math.round(totalWeightKg * 10) / 10,
    maxTemperatureC,
    avgTemperatureC,
    stabilityStatus,
    items,
  };
}
