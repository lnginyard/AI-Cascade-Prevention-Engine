const baseDependencyNodes = [
  { id: 'api-gateway', service: 'api-gateway', health: 'healthy', load: 52, region: 'us-east-1', role: 'edge' },
  { id: 'signature-detector', service: 'signature-detector', health: 'warning', load: 66, region: 'us-east-1', role: 'analysis' },
  { id: 'prediction-engine', service: 'prediction-engine', health: 'healthy', load: 61, region: 'us-east-1', role: 'analysis' },
  { id: 'remediation-orchestrator', service: 'remediation-orchestrator', health: 'healthy', load: 48, region: 'us-east-1', role: 'control' },
  { id: 'webhook-notifier', service: 'webhook-notifier', health: 'healthy', load: 39, region: 'us-east-1', role: 'integration' },
  { id: 'payment-service', service: 'payment-service', health: 'healthy', load: 58, region: 'us-west-2', role: 'transaction' },
  { id: 'orders-service', service: 'orders-service', health: 'healthy', load: 47, region: 'us-west-2', role: 'transaction' },
  { id: 'inventory-service', service: 'inventory-service', health: 'healthy', load: 43, region: 'eu-west-1', role: 'inventory' },
];

const dependencyEdges = [
  { source: 'api-gateway', target: 'signature-detector', weight: 0.82 },
  { source: 'signature-detector', target: 'prediction-engine', weight: 0.91 },
  { source: 'prediction-engine', target: 'remediation-orchestrator', weight: 0.72 },
  { source: 'remediation-orchestrator', target: 'webhook-notifier', weight: 0.55 },
  { source: 'api-gateway', target: 'orders-service', weight: 0.64 },
  { source: 'orders-service', target: 'payment-service', weight: 0.88 },
  { source: 'orders-service', target: 'inventory-service', weight: 0.57 },
  { source: 'payment-service', target: 'remediation-orchestrator', weight: 0.51 },
];

const regionCoordinates = {
  'us-east-1': { label: 'N. Virginia', lat: 37.4316, lng: -78.6569 },
  'us-west-2': { label: 'Oregon', lat: 43.8041, lng: -120.5542 },
  'eu-west-1': { label: 'Ireland', lat: 53.1424, lng: -7.6921 },
};

const baselineSignatures = [
  { name: 'Queue Saturation Cascade', confidence: '0.93', impact: '6 services', severity: 'high' },
  { name: 'Latency Amplification Loop', confidence: '0.88', impact: '4 services', severity: 'medium' },
  { name: 'Regional Failover Drift', confidence: '0.79', impact: '3 services', severity: 'medium' },
];

const baselinePlans = [
  {
    id: 'PLAN-2041',
    title: 'Throttle upstream ingest and enable circuit break',
    risk: 'high',
    steps: [
      'Reduce ingest by 25% on telemetry ingestion',
      'Open circuit for signature-detector dependency on model-runtime',
      'Route remediation notifications to incident commander',
    ],
  },
  {
    id: 'PLAN-2042',
    title: 'Shift read traffic and increase worker pool',
    risk: 'medium',
    steps: [
      'Shift 20% read traffic to secondary path',
      'Scale prediction workers from 6 to 10',
      'Increase alert threshold sensitivity for 15 minutes',
    ],
  },
];

const scenarioLibrary = {
  'queue-saturation': {
    title: 'Queue Saturation Cascade',
    origin: 'signature-detector',
    impacted: ['signature-detector', 'prediction-engine', 'api-gateway', 'webhook-notifier'],
    extraCompanyImpacted: ['orders-service'],
    routes: [['us-east-1', 'us-west-2'], ['us-east-1', 'eu-west-1']],
    aiSummary: 'AI forecast: queue depth acceleration is amplifying retry pressure across the analytics path and will widen into customer-facing edge traffic if not isolated.',
    mitigationTitle: 'Throttle upstream ingest and isolate queue amplification',
    steps: [
      'Throttle upstream ingest by 30% in the impacted region',
      'Apply circuit breaker on signature-detector downstream calls',
      'Shift asynchronous notifications to delayed delivery mode',
    ],
  },
  'regional-failover': {
    title: 'Regional Failover Drift',
    origin: 'api-gateway',
    impacted: ['api-gateway', 'orders-service', 'inventory-service', 'payment-service'],
    extraCompanyImpacted: ['prediction-engine', 'remediation-orchestrator'],
    routes: [['us-east-1', 'us-west-2'], ['us-west-2', 'eu-west-1']],
    aiSummary: 'AI forecast: regional failover drift is spreading through the transaction path and will expand cross-region dependencies without immediate containment.',
    mitigationTitle: 'Contain regional drift and protect the customer transaction path',
    steps: [
      'Pin customer traffic to healthy dependency endpoints',
      'Reduce write throughput on degraded regional services',
      'Escalate failover readiness to company-wide guard mode',
    ],
  },
  'payment-latency': {
    title: 'Payment Path Latency Surge',
    origin: 'payment-service',
    impacted: ['payment-service', 'orders-service', 'api-gateway'],
    extraCompanyImpacted: ['inventory-service'],
    routes: [['us-west-2', 'us-east-1'], ['us-west-2', 'eu-west-1']],
    aiSummary: 'AI forecast: payment latency amplification will trigger retry storm conditions and degrade checkout throughput in under three minutes.',
    mitigationTitle: 'Prioritize checkout stability and suppress retry storm risk',
    steps: [
      'Activate payment path circuit breaker with degraded fallback mode',
      'Throttle checkout retries at the API edge',
      'Scale remediation workers and elevate alerting sensitivity',
    ],
  },
};

let dependencyNodes = cloneNodes();
let signatures = [...baselineSignatures];
let remediationPlans = [...baselinePlans];
let selectedPlan = null;
let graphPreview = null;
let graphDetail = null;
let flatMap = null;
let previewMap = null;
let globeView = null;
let flatTileLayer = null;
let previewTileLayer = null;
let flatLayers = [];
let previewLayers = [];
let currentMapView = 'globe';
let narrationEnabled = true;
let narrationRate = 1;
let selectedDemoPreset = 'extended';
let narrationVoices = [];
let selectedNarrationVoice = null;
let narrationPrimed = false;
let narrationSupportKnown = false;

const demoPresets = {
  short: {
    label: '90-second cut',
    timings: {
      intro: 700,
      preSimulate: 550,
      graphHold: 1800,
      globeHold: 1400,
      flatHold: 1300,
      listHold: 1200,
      remediationHold: 1700,
      approvalLead: 1100,
      approvalCommit: 500,
      overviewHold: 2600,
    },
    script: {
      step1: 'Cascade Prevention Engine is now modeling a queue saturation event with company-wide protection enabled.',
      step2: 'The simulator projects the blast radius before customers are affected, giving operators time to act.',
      step3: 'The dependency graph reveals how pressure propagates across critical services and where intervention matters most.',
      globe: 'On the globe, we can see regional exposure building in real time as the cascade expands.',
      flat: 'The flat map converts that same signal into a tactical view for rapid operational coordination.',
      list: 'The region list summarizes affected areas in priority order so teams can respond with speed and clarity.',
      step5: 'Based on that forecast, the platform prepares a mitigation plan aligned to the current risk profile.',
      step6: 'With one approval, the recommended controls are applied automatically to contain the event.',
      step7: 'The cascade is contained, resilience posture is restored, and customer impact is avoided.',
    },
    voiceRate: 1.14,
  },
  extended: {
    label: '2-minute cut',
    timings: {
      intro: 1000,
      preSimulate: 900,
      graphHold: 2800,
      globeHold: 2200,
      flatHold: 1900,
      listHold: 1800,
      remediationHold: 2600,
      approvalLead: 1800,
      approvalCommit: 700,
      overviewHold: 4200,
    },
    script: {
      step1: 'Here, Cascade Prevention Engine is modeling a queue saturation scenario with company-wide safeguards enabled from the start.',
      step2: 'Instead of waiting for failure, the platform forecasts service impact early and estimates the likely blast radius in advance.',
      step3: 'This dependency graph highlights the exact service relationships carrying risk, making the cascade path immediately visible to operators.',
      globe: 'On the interactive globe, the platform shows where the cascade is spreading and which regions are moving into higher severity.',
      flat: 'For regional operations teams, the flat map provides a more tactical view with translucent overlays and guided route visibility.',
      list: 'The region list turns that same intelligence into an executive summary of affected areas, exposure level, and mitigation priority.',
      step5: 'Using that forecast, the system assembles an AI-guided remediation plan designed to reduce propagation before customer harm occurs.',
      step6: 'Once approved, mitigation controls are executed to suppress retry amplification, stabilize dependencies, and shrink the blast radius.',
      step7: 'The event is contained, the environment returns to a guarded state, and business continuity is preserved without visible customer impact.',
    },
    voiceRate: 1,
  },
};

let simulationState = {
  active: false,
  scenario: null,
  region: 'us-east-1',
  scope: 'region',
  intensity: 3,
  affectedServices: [],
  mitigated: false,
};

function cloneNodes() {
  return baseDependencyNodes.map((node) => ({ ...node }));
}

function getSeverityLabel(health) {
  return {
    healthy: 'stable',
    warning: 'warning',
    degraded: 'degraded',
    critical: 'critical',
    unknown: 'unknown',
  }[health] || 'unknown';
}

function initializePreferences() {
  const savedTheme = localStorage.getItem('cascade-theme') || 'dark';
  const savedMotion = localStorage.getItem('cascade-motion') || 'normal';
  const savedVoice = localStorage.getItem('cascade-voiceover') || 'on';
  const savedRate = localStorage.getItem('cascade-voice-rate') || '1';
  const savedDemoPreset = localStorage.getItem('cascade-demo-preset') || 'extended';

  const themeSelector = document.getElementById('themeSelector');
  const motionToggle = document.getElementById('motionToggle');
  const voiceoverToggle = document.getElementById('voiceoverToggle');
  const voiceRate = document.getElementById('voiceRate');
  const demoPresetSelector = document.getElementById('demoPresetSelector');

  if (themeSelector) themeSelector.value = savedTheme;
  if (motionToggle) motionToggle.value = savedMotion;
  if (voiceoverToggle) voiceoverToggle.value = savedVoice;
  if (voiceRate) voiceRate.value = savedRate;
  if (demoPresetSelector) demoPresetSelector.value = savedDemoPreset;

  applyTheme(savedTheme);
  applyMotionSetting(savedMotion);
  narrationEnabled = savedVoice === 'on';
  selectedDemoPreset = demoPresets[savedDemoPreset] ? savedDemoPreset : 'extended';
  narrationRate = Number(savedRate);
  updateVoiceStatus(narrationEnabled ? 'Voice initializing…' : 'Voiceover is turned off.', narrationEnabled ? '' : 'error');
}

function getDemoPreset() {
  return demoPresets[selectedDemoPreset] || demoPresets.extended;
}

function applyTheme(theme) {
  const selectedTheme = theme === 'day' ? 'day' : 'dark';
  document.body.setAttribute('data-theme', selectedTheme);
  localStorage.setItem('cascade-theme', selectedTheme);
}

function applyMotionSetting(mode) {
  if (mode === 'reduced') {
    document.body.classList.add('reduced-motion');
  } else {
    document.body.classList.remove('reduced-motion');
  }
  localStorage.setItem('cascade-motion', mode);
}

function updateVoiceStatus(message, state = '') {
  const status = document.getElementById('voiceStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `voice-status${state ? ` ${state}` : ''}`;
}

function chooseNarrationVoice(voices) {
  if (!voices.length) return null;

  const englishVoices = voices.filter((voice) => /^en(-|_)/i.test(voice.lang || ''));
  const pool = englishVoices.length ? englishVoices : voices;
  const preferredNames = ['google uk english male', 'daniel', 'aaron', 'alex', 'david', 'thomas', 'fred', 'reed', 'nathan', 'arthur', 'oliver'];

  for (const preferred of preferredNames) {
    const match = pool.find((voice) => voice.name.toLowerCase().includes(preferred));
    if (match) return match;
  }

  return pool.find((voice) => !/female|zira|samantha|victoria|karen|moira/i.test(voice.name)) || pool[0];
}

function cacheNarrationVoices() {
  if (typeof speechSynthesis === 'undefined') {
    narrationSupportKnown = true;
    updateVoiceStatus('Voiceover unavailable in this browser.', 'error');
    return [];
  }

  const voices = speechSynthesis.getVoices();
  if (voices.length) {
    narrationVoices = voices;
    selectedNarrationVoice = chooseNarrationVoice(voices);
    narrationSupportKnown = true;
    updateVoiceStatus(`Voice ready: ${selectedNarrationVoice?.name || 'System default'}`, 'ready');
  }

  return voices;
}

async function ensureNarrationReady() {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
    narrationSupportKnown = true;
    updateVoiceStatus('Voiceover unavailable in this browser.', 'error');
    return false;
  }

  let voices = cacheNarrationVoices();
  if (!voices.length) {
    voices = await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(cacheNarrationVoices());
      };

      const timer = setTimeout(() => {
        speechSynthesis.onvoiceschanged = null;
        finish();
      }, 1200);

      speechSynthesis.onvoiceschanged = () => {
        clearTimeout(timer);
        speechSynthesis.onvoiceschanged = null;
        finish();
      };
    });
  }

  if (!voices.length) {
    updateVoiceStatus('No browser voice is available yet. Open in a full browser if needed.', 'error');
    return false;
  }

  if (!narrationPrimed) {
    try {
      speechSynthesis.resume();
      const primer = new SpeechSynthesisUtterance(' ');
      primer.volume = 0;
      primer.rate = 1;
      primer.pitch = 1;
      primer.lang = selectedNarrationVoice?.lang || 'en-US';
      if (selectedNarrationVoice) primer.voice = selectedNarrationVoice;
      speechSynthesis.speak(primer);
      speechSynthesis.cancel();
    } catch {
      updateVoiceStatus('Voice engine is blocked. Try the Test Voice button.', 'error');
      return false;
    }
    narrationPrimed = true;
  }

  updateVoiceStatus(`Voice ready: ${selectedNarrationVoice?.name || 'System default'}`, 'ready');
  return true;
}

function speakNarration(text) {
  if (!narrationEnabled || !text || typeof speechSynthesis === 'undefined') return false;

  const ready = narrationSupportKnown ? true : cacheNarrationVoices().length > 0;
  if (!ready) {
    updateVoiceStatus('Voice still loading. Click Test Voice or rerun the demo.', 'error');
  }

  try {
    speechSynthesis.cancel();
    speechSynthesis.resume();
  } catch {
    updateVoiceStatus('Voice playback could not start in this browser.', 'error');
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = narrationRate;
  utterance.pitch = 0.92;
  utterance.volume = 1;
  utterance.lang = selectedNarrationVoice?.lang || 'en-US';
  if (selectedNarrationVoice) utterance.voice = selectedNarrationVoice;
  utterance.onstart = () => updateVoiceStatus(`Speaking with ${selectedNarrationVoice?.name || 'system voice'}…`, 'speaking');
  utterance.onend = () => updateVoiceStatus(`Voice ready: ${selectedNarrationVoice?.name || 'System default'}`, 'ready');
  utterance.onerror = () => updateVoiceStatus('Voice playback failed. Use Test Voice to retry.', 'error');
  speechSynthesis.speak(utterance);
  return true;
}

function healthColor(health) {
  return {
    healthy: '#39ff14',
    warning: '#00d4ff',
    degraded: '#ffb800',
    critical: '#cc0020',
    unknown: '#6ba9c9',
  }[health] || '#6ba9c9';
}

function riskLevelFromHealth(health) {
  return {
    healthy: 1,
    warning: 2,
    degraded: 3,
    critical: 4,
    unknown: 0,
  }[health] || 0;
}

function activeScenario() {
  return simulationState.scenario ? scenarioLibrary[simulationState.scenario] : null;
}

function setModeStatus(text) {
  const status = document.getElementById('modeStatus');
  if (status) status.textContent = text;
}

function buildHeaders() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const bearerToken = document.getElementById('bearerToken').value.trim();
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  return headers;
}

async function fetchLiveData() {
  const baseUrl = document.getElementById('apiBaseUrl').value.trim();
  if (!baseUrl) {
    setModeStatus('Mode: Demo data (no base URL configured)');
    return;
  }

  try {
    const headers = buildHeaders();
    const [graphRes, signaturesRes, plansRes] = await Promise.all([
      fetch(`${baseUrl}/dependency-graph`, { headers }),
      fetch(`${baseUrl}/cascade-signatures/active`, { headers }),
      fetch(`${baseUrl}/remediation-plans`, { headers }),
    ]);

    if (!graphRes.ok || !signaturesRes.ok || !plansRes.ok) {
      throw new Error(`live API request failed: ${graphRes.status}/${signaturesRes.status}/${plansRes.status}`);
    }

    const graphPayload = await graphRes.json();
    const signaturesPayload = await signaturesRes.json();
    const plansPayload = await plansRes.json();

    dependencyNodes = (graphPayload.items || []).map((item, index) => ({
      id: item.serviceId || item.serviceName || `service-${index}`,
      service: item.serviceName || item.serviceId || `service-${index}`,
      health: item.healthStatus || 'unknown',
      load: Number(item.requestRate || item.load || 0),
      region: item.region || 'us-east-1',
      role: item.role || 'service',
    }));

    signatures = (signaturesPayload.items || []).map((item) => ({
      name: item.signatureName || item.signatureId || 'unknown-signature',
      confidence: String(item.confidenceScore ?? 0),
      impact: item.predictedImpact || 'unknown impact',
      severity: item.severity?.toLowerCase() === 'high' ? 'high' : 'medium',
    }));

    remediationPlans = (plansPayload.items || []).map((item) => ({
      id: item.planId,
      title: item.summary || item.status || 'Remediation Plan',
      risk: item.risk?.toLowerCase() === 'high' ? 'high' : 'medium',
      steps: item.actions?.map((action) => action.description || JSON.stringify(action)) || ['No actions available'],
    }));

    selectedPlan = null;
    renderDashboard();
    setModeStatus('Mode: Live data connected');
  } catch (error) {
    setModeStatus(`Mode: Demo data (live failed: ${error.message})`);
  }
}

function signaturesToCards(items) {
  return items
    .map(
      (item) =>
        `<div class="signature"><strong>${item.name}</strong><span class="badge ${item.severity}">${item.severity}</span><p class="muted">Confidence ${item.confidence} · Predicted impact ${item.impact}</p></div>`
    )
    .join('');
}

function renderSignatureTable() {
  const tableBody = document.getElementById('signatureTableBody');
  tableBody.innerHTML = signatures
    .map(
      (item) =>
        `<tr><td>${item.name}</td><td>${item.confidence}</td><td>${item.impact}</td><td><span class="badge ${item.severity}">${item.severity}</span></td></tr>`
    )
    .join('');
}

function renderPlans() {
  const planList = document.getElementById('planList');
  planList.innerHTML = remediationPlans
    .map(
      (plan) =>
        `<button class="plan ${selectedPlan?.id === plan.id ? 'selected' : ''}" data-plan-id="${plan.id}"><strong>${plan.id}</strong><p>${plan.title}</p><span class="badge ${plan.risk}">${plan.risk}</span></button>`
    )
    .join('');
}

function renderPlanDetail() {
  const selectedPlanPanel = document.getElementById('selectedPlan');
  const approveBtn = document.getElementById('approveBtn');
  const rejectBtn = document.getElementById('rejectBtn');
  if (!selectedPlan) {
    selectedPlanPanel.innerHTML = 'Select a plan to review actions.';
    approveBtn.disabled = true;
    rejectBtn.disabled = true;
    return;
  }

  selectedPlanPanel.innerHTML = `<strong>${selectedPlan.id}</strong><p>${selectedPlan.title}</p><ol>${selectedPlan.steps
    .map((step) => `<li>${step}</li>`)
    .join('')}</ol>`;
  const role = document.getElementById('roleSelector').value;
  const canApprove = role === 'admin' || (role === 'operator' && selectedPlan.risk !== 'high');
  approveBtn.disabled = !canApprove;
  rejectBtn.disabled = role === 'viewer';
}

function addAuditEntry(text) {
  const auditTrail = document.getElementById('auditTrail');
  const item = document.createElement('div');
  item.className = 'audit-item';
  item.textContent = `${new Date().toLocaleTimeString()} - ${text}`;
  auditTrail.prepend(item);
}

function updateTopMetrics() {
  document.getElementById('protectedServicesMetric').textContent = String(dependencyNodes.length);
  document.getElementById('blastRadiusMetric').textContent = simulationState.active
    ? `${simulationState.affectedServices.length} services`
    : '3 services';
  document.getElementById('readinessMetric').textContent = simulationState.mitigated ? '97%' : simulationState.active ? '71%' : '92%';

  const systemStatusPill = document.getElementById('systemStatusPill');
  systemStatusPill.textContent = simulationState.mitigated
    ? 'System Status: Guarded'
    : simulationState.active
      ? 'System Status: Elevated Risk'
      : 'System Status: Stable';
}

function renderCopilotPanels() {
  const aiCopilotSummary = document.getElementById('aiCopilotSummary');
  const forecastPanel = document.getElementById('forecastPanel');
  const scenario = activeScenario();

  if (!scenario) {
    aiCopilotSummary.innerHTML = '<strong>AI status:</strong> Monitoring baseline telemetry. No pre-SLA cascade intervention required.';
    forecastPanel.innerHTML = '<strong>Forecast:</strong> Stable cross-service posture. Top residual risk remains low and regionally contained.';
    return;
  }

  aiCopilotSummary.innerHTML = `
    <strong>AI status:</strong> ${scenario.aiSummary}
    <div class="copilot-tags spaced-top">
      <span class="badge high">${simulationState.scope === 'company' ? 'company-wide' : simulationState.region}</span>
      <span class="badge medium">intensity ${simulationState.intensity}/5</span>
    </div>
  `;

  forecastPanel.innerHTML = simulationState.mitigated
    ? '<strong>Forecast:</strong> Mitigation is active. Predicted blast radius reduced to 1–2 services, customer impact avoided, and retry storm probability dropped by 68%.'
    : `<strong>Forecast:</strong> Without intervention, ${simulationState.affectedServices.length} services are projected to degrade within ${Math.max(1, 6 - simulationState.intensity)} minutes.`;
}

function renderSimulationDetails() {
  const summary = document.getElementById('simulationSummary');
  const matrix = document.getElementById('impactMatrix');
  const scenario = activeScenario();

  if (!scenario) {
    summary.innerHTML = '<strong>Ready:</strong> Select a scenario and simulate a pre-impact cascade event.';
    matrix.innerHTML = '<div class="audit-item">No active simulation. Use the AI simulator to generate a projected cascade path.</div>';
    return;
  }

  summary.innerHTML = `
    <strong>${scenario.title}</strong>
    <p>Origin service: ${scenario.origin}</p>
    <p>Scope: ${simulationState.scope === 'company' ? 'Company-wide protection' : `Regional containment · ${simulationState.region}`}</p>
    <p>${simulationState.mitigated ? 'AI mitigation has been applied.' : 'Mitigation pending operator action.'}</p>
  `;

  matrix.innerHTML = simulationState.affectedServices
    .map((service, index) => {
      const stage = simulationState.mitigated
        ? index === 0
          ? 'contained'
          : 'protected'
        : index === 0
          ? 'origin'
          : index < 3
            ? 'high-risk'
            : 'expanding';
      return `<div class="audit-item"><strong>${service}</strong> · ${stage} · ${simulationState.mitigated ? 'customer impact avoided' : `projected impact in ${index + 1} min`}</div>`;
    })
    .join('');
}

function renderTimeline(entries) {
  const timeline = document.getElementById('eventTimeline');
  timeline.innerHTML = entries.map((entry) => `<div class="timeline-item">${entry}</div>`).join('');
}

function getDefaultTimeline() {
  return [
    'Detection emitted: Queue Saturation Cascade (confidence 0.93)',
    'Prediction emitted: blast radius expanded to 6 services',
    'Remediation plan generated: PLAN-2041',
    'Webhook notification delivered to on-call endpoint',
  ];
}

function buildScenarioPlan(scenarioKey, scope) {
  const scenario = scenarioLibrary[scenarioKey];
  return {
    id: `PLAN-${Date.now().toString().slice(-4)}`,
    title: scenario.mitigationTitle,
    risk: scope === 'company' ? 'high' : 'medium',
    steps: [...scenario.steps],
  };
}

function simulateScenario() {
  const scenarioKey = document.getElementById('scenarioSelector').value;
  const region = document.getElementById('regionSelector').value;
  const scope = document.getElementById('scopeSelector').value;
  const intensity = Number(document.getElementById('intensitySlider').value);
  const scenario = scenarioLibrary[scenarioKey];
  const affectedServices = scope === 'company'
    ? [...new Set([...scenario.impacted, ...scenario.extraCompanyImpacted])]
    : [...scenario.impacted];

  simulationState = {
    active: true,
    scenario: scenarioKey,
    region,
    scope,
    intensity,
    affectedServices,
    mitigated: false,
  };

  dependencyNodes = cloneNodes().map((node) => {
    if (!affectedServices.includes(node.service)) return node;
    if (node.service === scenario.origin) {
      return { ...node, health: 'critical', load: 78 + intensity * 4 };
    }
    return { ...node, health: intensity >= 4 ? 'degraded' : 'warning', load: 54 + intensity * 7 };
  });

  const signature = {
    name: scenario.title,
    confidence: (0.72 + intensity * 0.05).toFixed(2),
    impact: `${affectedServices.length} services`,
    severity: intensity >= 4 || scope === 'company' ? 'high' : 'medium',
  };

  signatures = [signature, ...baselineSignatures.filter((item) => item.name !== scenario.title)].slice(0, 4);
  remediationPlans = [buildScenarioPlan(scenarioKey, scope), ...baselinePlans].slice(0, 4);
  selectedPlan = remediationPlans[0];

  renderTimeline([
    `Telemetry anomaly detected in ${scenario.origin} (${region})`,
    `AI forecast generated for ${scenario.title}`,
    `Predicted blast radius expanded to ${signature.impact}`,
    `Mitigation plan queued for ${scope === 'company' ? 'company-wide' : region} response`,
  ]);

  addAuditEntry(`Simulated ${scenario.title} in ${region} with ${scope} scope`);
  setModeStatus(`Mode: Demo simulator active (${scenario.title})`);
  renderDashboard();
}

function applyAiMitigation() {
  const scenario = activeScenario();
  if (!scenario) {
    addAuditEntry('No active simulation to mitigate');
    return;
  }

  simulationState.mitigated = true;
  dependencyNodes = dependencyNodes.map((node) => {
    if (!simulationState.affectedServices.includes(node.service)) return node;
    return {
      ...node,
      health: node.service === scenario.origin ? 'warning' : 'healthy',
      load: node.service === scenario.origin ? 63 : 44,
    };
  });

  signatures = signatures.map((signature, index) =>
    index === 0
      ? { ...signature, impact: '1-2 services', severity: 'medium', confidence: (Number(signature.confidence) - 0.12).toFixed(2) }
      : signature
  );

  renderTimeline([
    `AI mitigation approved for ${scenario.title}`,
    'Circuit breaker applied to origin dependency path',
    'Traffic throttling enabled to suppress retry amplification',
    'Projected customer impact avoided; system returned to guarded state',
  ]);

  addAuditEntry(`AI mitigation applied for ${scenario.title}`);
  renderDashboard();
}

function resetDemo() {
  simulationState = {
    active: false,
    scenario: null,
    region: 'us-east-1',
    scope: 'region',
    intensity: 3,
    affectedServices: [],
    mitigated: false,
  };
  dependencyNodes = cloneNodes();
  signatures = [...baselineSignatures];
  remediationPlans = [...baselinePlans];
  selectedPlan = null;
  renderTimeline(getDefaultTimeline());
  setModeStatus('Mode: Demo data');
  addAuditEntry('Demo reset to baseline monitoring state');
  renderDashboard();
}

function getGraphElements() {
  const scenario = activeScenario();
  return [
    ...dependencyNodes.map((node) => ({
      data: {
        id: node.id,
        label: node.service,
        health: node.health,
        load: node.load,
        region: node.region,
        role: node.role,
        color: healthColor(node.health),
        criticalNode: node.health === 'critical',
        hotNode: simulationState.active && simulationState.affectedServices.includes(node.service),
        origin: scenario ? scenario.origin === node.service : false,
      },
    })),
    ...dependencyEdges.map((edge) => ({
      data: {
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        riskPath: simulationState.active && simulationState.affectedServices.includes(edge.source) && simulationState.affectedServices.includes(edge.target),
      },
    })),
  ];
}

function renderGraph(containerId, isPreview = false) {
  if (typeof cytoscape === 'undefined') return;
  const container = document.getElementById(containerId);
  if (!container) return;

  const existing = containerId === 'dependencyGraphPreview' ? graphPreview : graphDetail;
  if (existing) existing.destroy();

  const instance = cytoscape({
    container,
    elements: getGraphElements(),
    layout: {
      name: 'cose',
      fit: true,
      animate: false,
      padding: isPreview ? 20 : 40,
      nodeRepulsion: isPreview ? 5200 : 8600,
      idealEdgeLength: isPreview ? 90 : 160,
      edgeElasticity: 100,
      gravity: 0.04,
    },
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          label: 'data(label)',
          color: '#f4f1eb',
          'font-size': isPreview ? 9 : 12,
          'text-valign': 'center',
          'text-halign': 'center',
          width: 'mapData(load, 30, 100, 38, 78)',
          height: 'mapData(load, 30, 100, 38, 78)',
          'border-width': 'mapData(load, 30, 100, 1, 3)',
          'border-color': '#f4f1eb',
          'text-wrap': 'wrap',
          'text-max-width': isPreview ? 70 : 110,
          'overlay-opacity': 0,
          'shadow-blur': 26,
          'shadow-color': 'data(color)',
          'shadow-opacity': 0.72,
          'text-outline-color': 'rgba(3, 12, 24, 0.9)',
          'text-outline-width': 2,
        },
      },
      {
        selector: 'node[origin]',
        style: {
          'border-color': '#ffe08a',
          'border-width': 4,
          'shadow-color': '#ffe08a',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 'mapData(weight, 0.4, 1, 2, 6)',
          'line-color': '#8fd9ff',
          'target-arrow-color': '#8fd9ff',
          'target-arrow-shape': 'none',
          'curve-style': 'bezier',
          'control-point-step-size': 52,
          'line-cap': 'round',
          opacity: 0.42,
        },
      },
      {
        selector: 'edge[riskPath]',
        style: {
          'line-color': simulationState.mitigated ? '#39ff14' : '#ffe08a',
          'target-arrow-color': simulationState.mitigated ? '#39ff14' : '#ffe08a',
          width: 7.5,
          opacity: 1,
        },
      },
      {
        selector: ':selected',
        style: {
          'border-color': '#39ff14',
          'border-width': 4,
          'shadow-blur': 24,
          'shadow-color': '#39ff14',
        },
      },
    ],
  });

  instance.on('tap', 'node', (event) => {
    const data = event.target.data();
    const inspector = document.getElementById('graphInspector');
    if (inspector) {
      inspector.innerHTML = `<strong>${data.label}</strong><p>Health: ${data.health}</p><p>Load: ${data.load}%</p><p>Region: ${data.region}</p><p>Role: ${data.role}</p>`;
    }
  });

  if (containerId === 'dependencyGraphPreview') {
    graphPreview = instance;
  } else {
    graphDetail = instance;
  }
}

function getMapPoints() {
  const affectedSet = new Set(simulationState.affectedServices);
  return Object.entries(regionCoordinates).map(([region, coords]) => {
    const nodesInRegion = dependencyNodes.filter((node) => node.region === region);
    const affectedNodes = nodesInRegion.filter((node) => affectedSet.has(node.service));
    const maxRisk = affectedNodes.reduce((max, node) => Math.max(max, riskLevelFromHealth(node.health)), 1);
    return {
      ...coords,
      region,
      size: 0.38 + maxRisk * 0.14,
      color: maxRisk >= 4 ? '#ff2d4a' : maxRisk === 3 ? '#ffb800' : maxRisk === 2 ? '#00d4ff' : '#39ff14',
      label: `${coords.label} · ${maxRisk >= 4 ? 'critical' : maxRisk === 3 ? 'elevated' : maxRisk === 2 ? 'watch' : 'stable'}`,
    };
  });
}

function getMapRoutes() {
  const scenario = activeScenario();
  if (!scenario) return [];
  return scenario.routes.map(([from, to]) => ({
    startLat: regionCoordinates[from].lat,
    startLng: regionCoordinates[from].lng,
    endLat: regionCoordinates[to].lat,
    endLng: regionCoordinates[to].lng,
    color: simulationState.mitigated ? '#39ff14' : simulationState.scope === 'company' ? '#ffe08a' : '#8fe8ff',
  }));
}

function renderRegionList() {
  const container = document.getElementById('regionListContainer');
  if (!container) return;

  const affectedServices = new Set(simulationState.affectedServices);
  const points = getMapPoints();

  const list = points
    .map((point) => {
      const nodesInRegion = dependencyNodes.filter((node) => node.region === point.region);
      const impactedCount = nodesInRegion.filter((node) => affectedServices.has(node.service)).length;
      const topHealth = nodesInRegion.reduce((highest, node) => {
        return riskLevelFromHealth(node.health) > riskLevelFromHealth(highest) ? node.health : highest;
      }, 'healthy');

      return {
        ...point,
        impactedCount,
        severity: getSeverityLabel(topHealth),
        topHealth,
      };
    })
    .sort((a, b) => b.impactedCount - a.impactedCount || riskLevelFromHealth(b.topHealth) - riskLevelFromHealth(a.topHealth));

  container.innerHTML = `
    <div class="region-list">
      ${list
        .map(
          (item) => `
            <div class="region-item">
              <span class="region-pulse" style="color:${item.color};background:${item.color};"></span>
              <div>
                <strong>${item.label.split('·')[0].trim()}</strong>
                <div class="region-meta">${item.region} · ${item.impactedCount} impacted services</div>
              </div>
              <span class="region-severity">${item.severity}</span>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function clearLayers(layerList) {
  layerList.forEach((layer) => layer.remove());
  layerList.length = 0;
}

function ensureMap(containerId) {
  if (typeof L === 'undefined') return null;

  const darkTiles = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const lightTiles = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
  const tileUrl = document.body.getAttribute('data-theme') === 'day' ? lightTiles : darkTiles;
  const tileOptions = { maxZoom: 6 };

  if (containerId === 'riskMapPreview' && !previewMap) {
    previewMap = L.map(containerId, { zoomControl: false, attributionControl: false, worldCopyJump: true }).setView([20, 0], 2);
    previewTileLayer = L.tileLayer(tileUrl, tileOptions).addTo(previewMap);
  } else if (containerId === 'riskMapPreview' && previewMap && previewTileLayer) {
    previewMap.removeLayer(previewTileLayer);
    previewTileLayer = L.tileLayer(tileUrl, tileOptions).addTo(previewMap);
  }

  if (containerId === 'flatMapContainer' && !flatMap) {
    flatMap = L.map(containerId, { zoomControl: true, attributionControl: false, worldCopyJump: true }).setView([20, 0], 2);
    flatTileLayer = L.tileLayer(tileUrl, tileOptions).addTo(flatMap);
  } else if (containerId === 'flatMapContainer' && flatMap && flatTileLayer) {
    flatMap.removeLayer(flatTileLayer);
    flatTileLayer = L.tileLayer(tileUrl, tileOptions).addTo(flatMap);
  }

  return containerId === 'riskMapPreview' ? previewMap : flatMap;
}

function renderLeafletMap(containerId) {
  const map = ensureMap(containerId);
  if (!map) return;

  const layers = containerId === 'riskMapPreview' ? previewLayers : flatLayers;
  clearLayers(layers);

  getMapPoints().forEach((point) => {
    const glow = L.circleMarker([point.lat, point.lng], {
      radius: containerId === 'riskMapPreview' ? 14 : 20,
      color: point.color,
      fillColor: point.color,
      fillOpacity: containerId === 'riskMapPreview' ? 0.08 : 0.12,
      opacity: 0.12,
      weight: 1,
    }).addTo(map);
    layers.push(glow);

    const marker = L.circleMarker([point.lat, point.lng], {
      radius: containerId === 'riskMapPreview' ? 8 : 12,
      color: point.color,
      fillColor: point.color,
      fillOpacity: 0.88,
      weight: 2,
    }).addTo(map);
    marker.bindPopup(`<strong>${point.label}</strong><br/>Region: ${point.region}`);
    layers.push(marker);

    const core = L.circleMarker([point.lat, point.lng], {
      radius: containerId === 'riskMapPreview' ? 3 : 4,
      color: '#fff7d8',
      fillColor: '#fff7d8',
      fillOpacity: 0.9,
      weight: 0,
    }).addTo(map);
    layers.push(core);
  });

  getMapRoutes().forEach((route) => {
    const glow = L.polyline([[route.startLat, route.startLng], [route.endLat, route.endLng]], {
      color: route.color,
      weight: containerId === 'riskMapPreview' ? 7 : 11,
      opacity: simulationState.mitigated ? 0.14 : 0.24,
      lineCap: 'round',
    }).addTo(map);
    layers.push(glow);

    const polyline = L.polyline([[route.startLat, route.startLng], [route.endLat, route.endLng]], {
      color: route.color,
      weight: containerId === 'riskMapPreview' ? 3 : 5,
      opacity: simulationState.mitigated ? 0.78 : 0.96,
      dashArray: simulationState.mitigated ? '8 6' : '2 8',
      lineCap: 'round',
    }).addTo(map);
    layers.push(polyline);
  });
}

function renderGlobe() {
  const container = document.getElementById('globeContainer');
  if (!container) return;

  if (typeof Globe === 'undefined') {
    container.innerHTML = '<div class="panel">Globe view needs network access to load the visualization library.</div>';
    return;
  }

  if (!globeView) {
    container.innerHTML = '';
    globeView = Globe()(container)
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#00d4ff')
      .atmosphereAltitude(0.16)
      .arcStroke(0.45)
      .arcDashLength(0.28)
      .arcDashGap(0.08)
      .arcDashAnimateTime(document.body.classList.contains('reduced-motion') ? 1 : 900)
      .pointAltitude('size')
      .pointRadius(1.2)
      .pointResolution(24)
      .enablePointerInteraction(true);

    const controls = globeView.controls();
    controls.autoRotate = !document.body.classList.contains('reduced-motion');
    controls.autoRotateSpeed = 0.32;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 170;
    controls.maxDistance = 420;
    globeView.pointOfView({ lat: 22, lng: -20, altitude: 1.8 }, 0);
  }

  globeView.width(container.clientWidth).height(container.clientHeight);
  const controls = globeView.controls();
  controls.autoRotate = !document.body.classList.contains('reduced-motion');

  globeView
    .pointsData(getMapPoints())
    .pointColor('color')
    .pointLabel((p) => `<strong>${p.label}</strong><br/>Region: ${p.region}`)
    .arcsData(getMapRoutes())
    .arcColor((d) => [d.color, 'rgba(255,255,255,0.16)'])
    .arcAltitude(() => (simulationState.scope === 'company' ? 0.36 : 0.26));
}

function renderMapLegend() {
  document.getElementById('mapLegend').innerHTML = `
    <strong>Severity legend</strong>
    <div class="legend-row spaced-top">
      <span class="legend-dot healthy"></span><span>Stable</span>
      <span class="legend-dot warning"></span><span>Watch</span>
      <span class="legend-dot degraded"></span><span>Elevated</span>
      <span class="legend-dot critical"></span><span>Critical / expanding</span>
    </div>
    <p class="muted spaced-top">Globe and Flat Map now use a darker connected-world treatment with brighter route propagation and luminous regional anchors.</p>
  `;
}

function renderDashboard() {
  document.getElementById('signatureCards').innerHTML = signaturesToCards(signatures);
  renderSignatureTable();
  renderPlans();
  renderPlanDetail();
  renderSimulationDetails();
  renderCopilotPanels();
  updateTopMetrics();
  renderGraph('dependencyGraphPreview', true);
  renderGraph('graphDetail');
  renderLeafletMap('riskMapPreview');
  renderLeafletMap('flatMapContainer');
  renderGlobe();
  renderRegionList();
  renderMapLegend();
}

function setRiskView(view) {
  currentMapView = view;
  const globeContainer = document.getElementById('globeContainer');
  const flatMapContainer = document.getElementById('flatMapContainer');
  const regionListContainer = document.getElementById('regionListContainer');
  const showGlobeBtn = document.getElementById('showGlobeBtn');
  const showFlatMapBtn = document.getElementById('showFlatMapBtn');
  const showRegionListBtn = document.getElementById('showRegionListBtn');

  globeContainer.classList.toggle('hidden', view !== 'globe');
  flatMapContainer.classList.toggle('hidden', view !== 'flat');
  regionListContainer.classList.toggle('hidden', view !== 'list');

  showGlobeBtn.classList.toggle('primary', view === 'globe');
  showFlatMapBtn.classList.toggle('primary', view === 'flat');
  showRegionListBtn.classList.toggle('primary', view === 'list');

  if (view === 'globe') {
    renderGlobe();
  } else if (view === 'flat') {
    renderLeafletMap('flatMapContainer');
    setTimeout(() => flatMap?.invalidateSize(), 50);
  } else {
    renderRegionList();
  }
}

async function submitApproval(approved) {
  const baseUrl = document.getElementById('apiBaseUrl').value.trim();
  if (!selectedPlan) return;

  if (!baseUrl) {
    addAuditEntry(`${approved ? 'Approved' : 'Rejected'} ${selectedPlan.id} (demo mode)`);
    if (approved && simulationState.active && !simulationState.mitigated) {
      applyAiMitigation();
    }
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/remediation-plans/${selectedPlan.id}/approval`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ approved, reviewer: document.getElementById('roleSelector').value }),
    });
    if (!response.ok) throw new Error(`approval failed (${response.status})`);
    addAuditEntry(`${approved ? 'Approved' : 'Rejected'} ${selectedPlan.id} (live)`);
  } catch (error) {
    addAuditEntry(`Approval error for ${selectedPlan.id}: ${error.message}`);
  }
}

function initializeNavigation() {
  const navItems = [...document.querySelectorAll('.nav-item')];
  const views = [...document.querySelectorAll('.view')];
  const viewTitle = document.getElementById('viewTitle');

  navItems.forEach((nav) => {
    nav.addEventListener('click', () => {
      navItems.forEach((item) => item.classList.remove('active'));
      nav.classList.add('active');
      const target = nav.getAttribute('data-view');
      views.forEach((view) => view.classList.remove('active'));
      document.getElementById(target).classList.add('active');
      viewTitle.textContent = nav.textContent;
      if (target === 'risk-map') {
        setTimeout(() => {
          flatMap?.invalidateSize();
          previewMap?.invalidateSize();
          setRiskView(currentMapView);
        }, 50);
      }
      if (target === 'dependency-graph') {
        setTimeout(() => renderGraph('graphDetail'), 50);
      }
    });
  });
}

function wireInteractions() {
  document.getElementById('planList').addEventListener('click', (event) => {
    const clicked = event.target.closest('[data-plan-id]');
    if (!clicked) return;
    selectedPlan = remediationPlans.find((plan) => plan.id === clicked.dataset.planId);
    renderPlans();
    renderPlanDetail();
  });

  document.getElementById('approveBtn').addEventListener('click', () => submitApproval(true));
  document.getElementById('rejectBtn').addEventListener('click', () => submitApproval(false));
  document.getElementById('refreshLiveBtn').addEventListener('click', fetchLiveData);
  document.getElementById('roleSelector').addEventListener('change', renderPlanDetail);
  document.getElementById('simulateBtn').addEventListener('click', simulateScenario);
  document.getElementById('aiMitigateBtn').addEventListener('click', applyAiMitigation);
  document.getElementById('resetDemoBtn').addEventListener('click', resetDemo);
  document.getElementById('intensitySlider').addEventListener('input', (event) => {
    document.getElementById('intensityValue').textContent = `${event.target.value} / 5`;
  });
  document.getElementById('showGlobeBtn').addEventListener('click', () => {
    setRiskView('globe');
  });
  document.getElementById('showFlatMapBtn').addEventListener('click', () => {
    setRiskView('flat');
  });
  document.getElementById('showRegionListBtn').addEventListener('click', () => {
    setRiskView('list');
  });

  document.getElementById('themeSelector').addEventListener('change', (event) => {
    applyTheme(event.target.value);
    renderDashboard();
  });
  document.getElementById('motionToggle').addEventListener('change', (event) => {
    applyMotionSetting(event.target.value);
    renderDashboard();
  });
  document.getElementById('voiceoverToggle').addEventListener('change', (event) => {
    narrationEnabled = event.target.value === 'on';
    localStorage.setItem('cascade-voiceover', narrationEnabled ? 'on' : 'off');
    updateVoiceStatus(narrationEnabled ? 'Voice readying…' : 'Voiceover is turned off.', narrationEnabled ? '' : 'error');
    if (!narrationEnabled && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  });
  document.getElementById('voiceRate').addEventListener('input', (event) => {
    narrationRate = Number(event.target.value);
    localStorage.setItem('cascade-voice-rate', String(narrationRate));
  });
  document.getElementById('demoPresetSelector').addEventListener('change', (event) => {
    selectedDemoPreset = event.target.value === 'short' ? 'short' : 'extended';
    localStorage.setItem('cascade-demo-preset', selectedDemoPreset);
  });

  document.getElementById('testVoiceBtn').addEventListener('click', async () => {
    const ready = await ensureNarrationReady();
    if (ready) {
      speakNarration('Cascade Prevention Engine is online. Predict the cascade, cut the blast radius, and keep customers protected.');
    }
  });

  document.getElementById('runDemoBtn').addEventListener('click', runAutoplayDemo);
}

// ── Autoplay demo helpers ─────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function navigateTo(viewId) {
  const navItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (navItem) navItem.click();
}

function setDemoBanner(text) {
  const banner = document.getElementById('demoProgressBanner');
  if (!banner) return;
  if (!text) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
  } else {
    banner.classList.remove('hidden');
    banner.innerHTML = `<span class="demo-step-label">&#9654; DEMO</span>${text}`;
  }
}

async function runAutoplayDemo() {
  const demoBtn = document.getElementById('runDemoBtn');
  const preset = getDemoPreset();
  const { timings, script } = preset;
  const previousVoiceRate = narrationRate;
  if (demoBtn) demoBtn.disabled = true;

  await ensureNarrationReady();

  narrationRate = preset.voiceRate;

  // Step 1 — navigate to simulator and configure scenario
  navigateTo('simulator');
  setDemoBanner(`Step 1 of 7 &mdash; ${preset.label} &mdash; Configuring a Queue Saturation Cascade at maximum company-wide scope...`);
  speakNarration(script.step1);
  await sleep(timings.intro);

  document.getElementById('scenarioSelector').value = 'queue-saturation';
  document.getElementById('regionSelector').value = 'us-east-1';
  document.getElementById('scopeSelector').value = 'company';
  document.getElementById('intensitySlider').value = '4';
  document.getElementById('intensityValue').textContent = '4 / 5';

  // Step 2 — fire the simulation
  setDemoBanner('Step 2 of 7 &mdash; Simulating cascade event &mdash; AI is projecting blast radius...');
  speakNarration(script.step2);
  await sleep(timings.preSimulate);
  simulateScenario();

  // Step 3 — dependency graph shows impact spread
  await sleep(timings.graphHold);
  navigateTo('dependency-graph');
  setDemoBanner('Step 3 of 7 &mdash; Examining live service topology &mdash; red paths mark the cascade spread...');
  speakNarration(script.step3);

  // Step 4 — risk views cycle through globe, flat map, and region list
  await sleep(timings.graphHold);
  navigateTo('risk-map');
  setRiskView('globe');
  setDemoBanner('Step 4 of 7 &mdash; Reviewing global cascade footprint across globe, flat map, and region list views...');
  speakNarration(script.globe);

  await sleep(timings.globeHold);
  setRiskView('flat');
  setDemoBanner('Step 4 of 7 &mdash; Flat map view exposes tactical regional spread and translucent route overlays...');
  speakNarration(script.flat);

  await sleep(timings.flatHold);
  setRiskView('list');
  setDemoBanner('Step 4 of 7 &mdash; Region list ranks affected areas for quick mitigation prioritization...');
  speakNarration(script.list);

  // Step 5 — remediation plan review
  await sleep(timings.listHold);
  navigateTo('remediation');
  setDemoBanner('Step 5 of 7 &mdash; AI-generated remediation plan ready for operator review...');
  speakNarration(script.step5);
  selectedPlan = remediationPlans[0];
  renderPlans();
  renderPlanDetail();

  // Step 6 — approve the plan
  await sleep(timings.remediationHold);
  setDemoBanner('Step 6 of 7 &mdash; Approving AI mitigation plan...');
  speakNarration(script.step6);
  document.getElementById('roleSelector').value = 'admin';
  renderPlanDetail();
  await sleep(timings.approvalLead);
  await submitApproval(true);

  // Step 7 — overview shows guarded state
  await sleep(timings.approvalCommit);
  navigateTo('overview');
  setDemoBanner('Step 7 of 7 &mdash; Cascade contained. System returned to Guarded state. Customer impact avoided.');
  speakNarration(script.step7);

  await sleep(timings.overviewHold);
  setDemoBanner(null);
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  narrationRate = previousVoiceRate;
  if (demoBtn) demoBtn.disabled = false;
}

// ── Dashboard bootstrap ───────────────────────────────────────────────────────
function bootstrapDashboard() {
  initializePreferences();
  cacheNarrationVoices();
  renderTimeline(getDefaultTimeline());
  initializeNavigation();
  wireInteractions();
  renderDashboard();
  setRiskView('globe');

  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.onvoiceschanged = () => cacheNarrationVoices();
  }

  window.addEventListener('resize', () => {
    if (currentMapView === 'globe') renderGlobe();
    flatMap?.invalidateSize();
    previewMap?.invalidateSize();
  });
}

bootstrapDashboard();
