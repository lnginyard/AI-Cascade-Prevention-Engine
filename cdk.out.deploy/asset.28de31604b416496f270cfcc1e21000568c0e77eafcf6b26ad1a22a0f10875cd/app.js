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
let runtimeDependencyEdges = [...dependencyEdges];
let signatures = [...baselineSignatures];
let remediationPlans = [...baselinePlans];
let selectedPlan = null;
let graphPreview = null;
let graphDetail = null;
let flatMap = null;
let previewMap = null;
let globeView = null;
let techGlobeCanvas = null;
let techGlobeAnimationId = null;
let techGlobeRotation = 0;
let flatTileLayer = null;
let previewTileLayer = null;
let flatVideoOverlay = null;
let previewVideoOverlay = null;
let flatLayers = [];
let previewLayers = [];
let currentMapView = 'globe';
let narrationEnabled = true;
let narrationRate = 1;
let selectedDemoPreset = 'full';
let narrationVoices = [];
let selectedNarrationVoice = null;
let narrationPrimed = false;
let narrationSupportKnown = false;
let activeNarrationAudio = null;
let narrationSessionId = 0;
let demoRunning = false;
let liveRefreshTimer = null;
const LIVE_REFRESH_INTERVAL_MS = 15000;
let mapRoutePhase = 0;
let mapAnimationTimer = null;
let simulationShockUntil = 0;

// AI Chat State
let chatSessionId = null;
let chatMessages = [];
let chatLoading = false;
const CHAT_API_PATH = '/ai-copilot/chat';

const demoPresets = {
  full: {
    label: 'Full voiceover',
    timings: {
      transition: 220,
      overviewHold: 1200,
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
  const savedDemoPreset = localStorage.getItem('cascade-demo-preset') || 'full';

  const themeSelector = document.getElementById('themeSelector');
  const motionToggle = document.getElementById('motionToggle');
  const voiceoverToggle = document.getElementById('voiceoverToggle');
  const voiceRate = document.getElementById('voiceRate');
  const demoPresetSelector = document.getElementById('demoPresetSelector');
  const apiBaseUrl = document.getElementById('apiBaseUrl');
  const apiKey = document.getElementById('apiKey');
  const bearerToken = document.getElementById('bearerToken');

  const savedApiBaseUrl = localStorage.getItem('cascade-live-api-base-url') || '';
  const savedApiKey = localStorage.getItem('cascade-live-api-key') || '';
  const savedBearerToken = localStorage.getItem('cascade-live-bearer-token') || '';

  if (themeSelector) themeSelector.value = savedTheme;
  if (motionToggle) motionToggle.value = savedMotion;
  if (voiceoverToggle) voiceoverToggle.value = savedVoice;
  if (voiceRate) voiceRate.value = savedRate;
  if (demoPresetSelector) demoPresetSelector.value = savedDemoPreset;
  if (apiBaseUrl) apiBaseUrl.value = savedApiBaseUrl;
  if (apiKey) apiKey.value = savedApiKey;
  if (bearerToken) bearerToken.value = savedBearerToken;

  applyTheme(savedTheme);
  applyMotionSetting(savedMotion);
  narrationEnabled = savedVoice === 'on';
  selectedDemoPreset = demoPresets[savedDemoPreset] ? savedDemoPreset : 'full';
  narrationRate = Number(savedRate);
  updateVoiceStatus(narrationEnabled ? 'Voice initializing…' : 'Voiceover is turned off.', narrationEnabled ? '' : 'error');
}

function persistLiveConfig() {
  const apiBaseUrl = document.getElementById('apiBaseUrl')?.value?.trim() || '';
  const apiKey = document.getElementById('apiKey')?.value?.trim() || '';
  const bearerToken = document.getElementById('bearerToken')?.value?.trim() || '';

  localStorage.setItem('cascade-live-api-base-url', apiBaseUrl);
  localStorage.setItem('cascade-live-api-key', apiKey);
  localStorage.setItem('cascade-live-bearer-token', bearerToken);
}

function startLiveAutoRefresh() {
  if (liveRefreshTimer) {
    clearInterval(liveRefreshTimer);
  }

  const baseUrl = document.getElementById('apiBaseUrl')?.value?.trim();
  if (!baseUrl) return;

  liveRefreshTimer = setInterval(() => {
    fetchLiveData(true);
  }, LIVE_REFRESH_INTERVAL_MS);
}

function stopLiveAutoRefresh() {
  if (liveRefreshTimer) {
    clearInterval(liveRefreshTimer);
    liveRefreshTimer = null;
  }
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
    console.warn('Speech Synthesis API not available');
    return [];
  }

  const voices = speechSynthesis.getVoices();
  console.log(`Cached ${voices.length} voice(s)`);
  
  if (voices.length) {
    narrationVoices = voices;
    selectedNarrationVoice = chooseNarrationVoice(voices);
    narrationSupportKnown = true;
    console.log('Selected voice:', selectedNarrationVoice?.name);
    updateVoiceStatus('Voice ready: Lorenzo', 'ready');
  }

  return voices;
}

async function ensureNarrationReady() {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
    narrationSupportKnown = true;
    updateVoiceStatus('Voiceover unavailable in this browser.', 'error');
    return false;
  }

  // Get voices with timeout
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
      }, 2000);

      speechSynthesis.onvoiceschanged = () => {
        clearTimeout(timer);
        speechSynthesis.onvoiceschanged = null;
        finish();
      };
    });
  }

  if (!voices.length) {
    updateVoiceStatus('No browser voice available. Try refreshing the page.', 'error');
    return false;
  }

  // Prime the speech synthesis by speaking and canceling a brief utterance
  if (!narrationPrimed) {
    try {
      // Resume any paused synthesis
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
      }

      // Speak a true-silent utterance to satisfy the browser's user-gesture
      // requirement and activate the synthesis engine without audible output.
      await new Promise((resolve) => {
        const primer = new SpeechSynthesisUtterance('\u200B'); // zero-width space
        primer.volume = 0;
        primer.rate = 2;
        primer.lang = selectedNarrationVoice?.lang || 'en-US';
        if (selectedNarrationVoice) primer.voice = selectedNarrationVoice;
        primer.onend = resolve;
        primer.onerror = resolve; // resolve regardless so we don't hang
        speechSynthesis.speak(primer);
        // Safety fallback in case onend never fires
        setTimeout(resolve, 600);
      });
    } catch (e) {
      console.warn('Voice priming error:', e);
      // Don't fail — might still be able to speak
    }

    // Prime the HTML Audio API so personal recordings can play after async delays.
    // Without this, Chrome blocks audio.play() once the user-gesture context expires.
    try {
      const audioPrimer = new Audio('./assets/voice/voice/test.mp3');
      audioPrimer.volume = 0;
      audioPrimer.preload = 'auto';
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 600);
        audioPrimer.addEventListener('canplay', () => {
          audioPrimer.play().then(() => {
            setTimeout(() => {
              audioPrimer.pause();
              audioPrimer.currentTime = 0;
              clearTimeout(t);
              resolve();
            }, 100);
          }).catch(() => { clearTimeout(t); resolve(); });
        }, { once: true });
        audioPrimer.onerror = () => { clearTimeout(t); resolve(); };
        audioPrimer.load();
      });
    } catch (e) {
      console.warn('Audio API priming error:', e);
    }

    narrationPrimed = true;
  }

  updateVoiceStatus('Voice ready: Lorenzo', 'ready');
  return true;
}

// ── Voice engine ─────────────────────────────────────────────────────────────
// speakNarration is the single public entry point. It is ASYNC and AWAITABLE —
// callers can `await speakNarration(text, key)` to pause until the line ends.
//
// Priority order:
//   1. If `key` is supplied, try to play ui/assets/voice/<key>.mp3  (your own recording)
//   2. Fall back to Web Speech API TTS with the best available system voice

async function speakNarration(text, key = null) {
  if (!narrationEnabled || (!text && !key)) return;

  narrationSessionId += 1;
  const sessionId = narrationSessionId;
  stopActiveNarration();

  if (key) {
    const played = await playVoiceFile(key, sessionId);
    if (played) return;
    updateVoiceStatus(`Missing personal voice clip: ${key}.mp3`, 'error');
    return;
  }

  updateVoiceStatus('Personal voice mode requires a recording key.', 'error');
}

function stopActiveNarration() {
  if (activeNarrationAudio) {
    activeNarrationAudio.pause();
    activeNarrationAudio.currentTime = 0;
    activeNarrationAudio.src = '';
    activeNarrationAudio = null;
  }
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel();
  }
}

// Play a personal recorded voice file. Returns true if it played to completion,
// false if the file doesn't exist or any error occurs.
function playVoiceFile(key, sessionId) {
  const candidates = [
    `./assets/voice/voice/${key}.mp3`,
    `./assets/voice/voice/${key}.m4a`,
    `./assets/voice/${key}.mp3`,
    `./assets/voice/${key}.m4a`,
  ];

  const tryPath = (path) =>
    new Promise((resolve) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      let settled = false;
      let started = false;
      const loadTimer = setTimeout(() => finish(false), 4500);

      const finish = (ok) => {
        if (!settled) {
          settled = true;
          clearTimeout(loadTimer);
          if (!ok) {
            audio.pause();
            audio.currentTime = 0;
          }
          resolve(ok);
        }
      };

      const startPlayback = () => {
        if (started || settled || sessionId !== narrationSessionId) {
          finish(false);
          return;
        }

        started = true;
        clearTimeout(loadTimer);
        updateVoiceStatus(`Playing your recording: ${key}`, 'speaking');
        activeNarrationAudio = audio;

        audio.onended = () => {
          if (sessionId !== narrationSessionId) {
            finish(false);
            return;
          }
          if (activeNarrationAudio === audio) activeNarrationAudio = null;
          updateVoiceStatus('Voice ready', 'ready');
          finish(true);
        };

        audio
          .play()
          .then(() => {})
          .catch(() => {
            if (activeNarrationAudio === audio) activeNarrationAudio = null;
            finish(false);
          });
      };

      audio.onerror = () => finish(false);
      audio.addEventListener('canplay', startPlayback, { once: true });

      audio.load();
    });

  return (async () => {
    for (const path of candidates) {
      const ok = await tryPath(path);
      if (ok) return true;
    }
    return false;
  })();
}

// Web Speech API TTS — fully awaitable; resolves when the utterance finishes.
function speakTTS(text, sessionId) {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve();

  if (!narrationSupportKnown || selectedNarrationVoice === null) {
    updateVoiceStatus('Voice not ready. Open the sidebar and click Test Voice.', 'error');
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const wasPlaying = speechSynthesis.speaking || speechSynthesis.pending;
    if (wasPlaying) speechSynthesis.cancel();

    const doSpeak = () => {
      if (sessionId !== narrationSessionId) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = narrationRate;
      utterance.pitch = 0.92;
      utterance.volume = 1;
      utterance.lang = selectedNarrationVoice?.lang || 'en-US';
      utterance.voice = selectedNarrationVoice;

      utterance.onstart = () => {
        console.log('TTS started:', text.substring(0, 60));
        updateVoiceStatus('Speaking with Lorenzo…', 'speaking');
      };
      utterance.onend = () => {
        updateVoiceStatus('Voice ready: Lorenzo', 'ready');
        resolve();
      };
      utterance.onerror = (event) => {
        // 'interrupted' / 'canceled' are expected when the demo is skipped — not real errors.
        if (event.error === 'interrupted' || event.error === 'canceled') { resolve(); return; }
        console.error('TTS error:', event.error);
        updateVoiceStatus(`Voice error: ${event.error}. Try Test Voice.`, 'error');
        resolve(); // always resolve so the demo doesn't hang
      };

      try {
        speechSynthesis.speak(utterance);
      } catch (e) {
        console.error('speak() threw:', e);
        resolve();
      }
    };

    // On macOS Chrome a back-to-back cancel→speak in the same tick is silently
    // dropped. A 120 ms gap lets the engine settle.
    if (wasPlaying) {
      setTimeout(doSpeak, 120);
    } else {
      doSpeak();
    }
  });
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

function deriveLiveEdges(items) {
  const edgeMap = new Map();
  const nodeIds = new Set(
    items.map((item, index) => item.serviceId || item.serviceName || `service-${index}`)
  );

  const pushEdge = (source, target, weight = 0.6) => {
    if (!source || !target || source === target) return;
    if (!nodeIds.has(source) || !nodeIds.has(target)) return;
    const id = `${source}-${target}`;
    if (!edgeMap.has(id)) {
      edgeMap.set(id, { source, target, weight: Math.max(0.35, Math.min(1, Number(weight) || 0.6)) });
    }
  };

  items.forEach((item, index) => {
    const source = item.serviceId || item.serviceName || `service-${index}`;
    const links = [
      ...(Array.isArray(item.dependencies) ? item.dependencies : []),
      ...(Array.isArray(item.downstream) ? item.downstream : []),
      ...(Array.isArray(item.connectedTo) ? item.connectedTo : []),
    ];

    links.forEach((target) => {
      if (typeof target === 'string') {
        pushEdge(source, target, item.dependencyWeight || item.weight || 0.62);
      } else if (target && typeof target === 'object') {
        pushEdge(source, target.serviceId || target.serviceName || target.id, target.weight || item.weight || 0.62);
      }
    });
  });

  return [...edgeMap.values()];
}

async function fetchLiveData(isBackgroundRefresh = false) {
  const baseUrl = document.getElementById('apiBaseUrl').value.trim();
  if (!baseUrl) {
    setModeStatus('Mode: Demo data (no base URL configured)');
    stopLiveAutoRefresh();
    return;
  }

  try {
    if (!isBackgroundRefresh) persistLiveConfig();
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
    const graphItems = graphPayload.items || [];

    dependencyNodes = graphItems.map((item, index) => ({
      id: item.serviceId || item.serviceName || `service-${index}`,
      service: item.serviceName || item.serviceId || `service-${index}`,
      health: item.healthStatus || 'unknown',
      load: Number(item.requestRate || item.load || 0),
      region: item.region || 'us-east-1',
      role: item.role || 'service',
    }));

    const liveEdges = deriveLiveEdges(graphItems);
    runtimeDependencyEdges = liveEdges.length ? liveEdges : [...dependencyEdges];

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
    setModeStatus(`Mode: Live data connected · updated ${new Date().toLocaleTimeString()}`);
    startLiveAutoRefresh();
  } catch (error) {
    stopLiveAutoRefresh();
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

function startMapAnimationLoop() {
  if (mapAnimationTimer) return;
  mapAnimationTimer = setInterval(() => {
    if (document.body.classList.contains('reduced-motion')) return;
    mapRoutePhase = (mapRoutePhase + 1) % 1200;

    if (simulationState.active || currentMapView === 'flat' || currentMapView === 'globe') {
      renderLeafletMap('riskMapPreview');
      renderLeafletMap('flatMapContainer');
    }
  }, 85);
}

function triggerSimulationVisualBurst(mode = 'surge') {
  simulationShockUntil = Date.now() + (mode === 'mitigation' ? 1600 : 2200);
  const globeContainer = document.getElementById('globeContainer');
  const flatMapContainer = document.getElementById('flatMapContainer');
  const previewContainer = document.getElementById('riskMapPreview');
  const cls = mode === 'mitigation' ? 'mitigation-surge' : 'simulation-surge';

  [globeContainer, flatMapContainer, previewContainer].forEach((el) => {
    if (!el) return;
    el.classList.remove('simulation-surge', 'mitigation-surge');
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), mode === 'mitigation' ? 1700 : 2400);
  });
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
  triggerSimulationVisualBurst('surge');
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
  triggerSimulationVisualBurst('mitigation');
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

function ensureWorldFlatVideoOverlay(map, containerId) {
  if (typeof L === 'undefined') return;

  const bounds = [[-85, -180], [85, 180]];
  const url = './assets/worldFlat.mp4';

  let overlay = containerId === 'riskMapPreview' ? previewVideoOverlay : flatVideoOverlay;
  if (overlay) {
    map.removeLayer(overlay);
  }

  overlay = L.videoOverlay(url, bounds, {
    autoplay: true,
    loop: true,
    muted: true,
    interactive: false,
    opacity: 0.93,
    className: 'world-flat-video-overlay',
  }).addTo(map);

  const videoEl = overlay.getElement?.();
  if (videoEl) {
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');
    const playback = videoEl.play();
    if (playback?.catch) playback.catch(() => {});
  }

  if (containerId === 'riskMapPreview') {
    previewVideoOverlay = overlay;
  } else {
    flatVideoOverlay = overlay;
  }
}

function ensureMap(containerId) {
  if (typeof L === 'undefined') return null;
  const worldBounds = [[-60, -170], [82, 170]];

  if (containerId === 'riskMapPreview' && !previewMap) {
    previewMap = L.map(containerId, {
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
      minZoom: 1,
      maxZoom: 6,
    }).setView([12, 0], 1.6);
    previewMap.fitBounds(worldBounds, { padding: [8, 8], animate: false });
    ensureWorldFlatVideoOverlay(previewMap, 'riskMapPreview');
  } else if (containerId === 'riskMapPreview' && previewMap) {
    if (previewTileLayer) {
      previewMap.removeLayer(previewTileLayer);
      previewTileLayer = null;
    }
    previewMap.fitBounds(worldBounds, { padding: [8, 8], animate: false });
    ensureWorldFlatVideoOverlay(previewMap, 'riskMapPreview');
  }

  if (containerId === 'flatMapContainer' && !flatMap) {
    flatMap = L.map(containerId, {
      zoomControl: true,
      attributionControl: false,
      worldCopyJump: true,
      minZoom: 1,
      maxZoom: 6,
    }).setView([12, 0], 1.6);
    flatMap.fitBounds(worldBounds, { padding: [20, 14], animate: false });
    ensureWorldFlatVideoOverlay(flatMap, 'flatMapContainer');
  } else if (containerId === 'flatMapContainer' && flatMap) {
    if (flatTileLayer) {
      flatMap.removeLayer(flatTileLayer);
      flatTileLayer = null;
    }
    flatMap.fitBounds(worldBounds, { padding: [20, 14], animate: false });
    ensureWorldFlatVideoOverlay(flatMap, 'flatMapContainer');
  }

  return containerId === 'riskMapPreview' ? previewMap : flatMap;
}

function renderLeafletMap(containerId) {
  const map = ensureMap(containerId);
  if (!map) return;

  if (containerId === 'riskMapPreview') {
    map.fitBounds([[-60, -170], [82, 170]], { padding: [6, 6], animate: false });
  } else if (containerId === 'flatMapContainer') {
    // Fit the full world view for better readability
    map.fitBounds([[-85, -180], [85, 180]], { padding: [20, 20], animate: false });
  }

  const layers = containerId === 'riskMapPreview' ? previewLayers : flatLayers;
  clearLayers(layers);
  const phase = (mapRoutePhase % 240) / 240;
  const pulse = simulationState.active ? (0.7 + Math.sin((mapRoutePhase / 24) * Math.PI * 2) * 0.3) : 0.32;
  const shockBoost = Date.now() < simulationShockUntil ? 1.35 : 1;

  getMapPoints().forEach((point) => {
    const glow = L.circleMarker([point.lat, point.lng], {
      radius: (containerId === 'riskMapPreview' ? 14 : 24) * (simulationState.active ? 1 + pulse * 0.18 : 1) * shockBoost,
      color: point.color,
      fillColor: point.color,
      fillOpacity: containerId === 'riskMapPreview' ? 0.11 + pulse * 0.14 : 0.14 + pulse * 0.18,
      opacity: 0.24 + pulse * 0.35,
      weight: 1,
    }).addTo(map);
    layers.push(glow);

    const marker = L.circleMarker([point.lat, point.lng], {
      radius: (containerId === 'riskMapPreview' ? 8 : 14) * (simulationState.active ? 1 + pulse * 0.12 : 1),
      color: point.color,
      fillColor: point.color,
      fillOpacity: simulationState.active ? 0.95 : 0.88,
      weight: simulationState.active ? 2.6 : 2.2,
    }).addTo(map);
    marker.bindPopup(`<strong>${point.label}</strong><br/><span class="muted">Region: ${point.region}</span>`);
    layers.push(marker);

    const core = L.circleMarker([point.lat, point.lng], {
      radius: containerId === 'riskMapPreview' ? 3 : 5,
      color: '#fff7d8',
      fillColor: '#fff7d8',
      fillOpacity: 0.95,
      weight: 0,
    }).addTo(map);
    layers.push(core);

    // Add readable location label for flat map view
    if (containerId === 'flatMapContainer') {
      const label = L.marker([point.lat + 4.5, point.lng], {
        icon: L.divIcon({
          className: 'region-label-marker',
          html: `<div class="region-label-text" style="color: ${point.color}; border-color: ${point.color};">
            <strong>${point.region}</strong>
            <div class="label-status">${point.label.split(' · ')[1] || 'stable'}</div>
          </div>`,
          iconSize: [120, 50],
          iconAnchor: [60, 0],
        }),
      }).addTo(map);
      layers.push(label);
    }
  });

  getMapRoutes().forEach((route) => {
    const glow = L.polyline([[route.startLat, route.startLng], [route.endLat, route.endLng]], {
      color: route.color,
      weight: (containerId === 'riskMapPreview' ? 7 : 13) * (simulationState.active ? 1.15 : 1) * shockBoost,
      opacity: simulationState.mitigated ? 0.22 : 0.34 + pulse * 0.2,
      lineCap: 'round',
    }).addTo(map);
    layers.push(glow);

    const polyline = L.polyline([[route.startLat, route.startLng], [route.endLat, route.endLng]], {
      color: route.color,
      weight: containerId === 'riskMapPreview' ? 3.5 : 6,
      opacity: simulationState.mitigated ? 0.85 : 0.98,
      dashArray: simulationState.mitigated ? '10 6' : '12 10',
      dashOffset: `${Math.floor(phase * 160)}`,
      lineCap: 'round',
    }).addTo(map);
    layers.push(polyline);
  });
}


function renderGlobe() {
  const container = document.getElementById('globeContainer');
  if (!container) return;

  if (!techGlobeCanvas || techGlobeCanvas.parentElement !== container) {
    container.innerHTML = '';
    techGlobeCanvas = document.createElement('canvas');
    techGlobeCanvas.className = 'tech-globe-canvas';
    container.appendChild(techGlobeCanvas);
  }

  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (techGlobeCanvas.width !== Math.floor(width * dpr) || techGlobeCanvas.height !== Math.floor(height * dpr)) {
    techGlobeCanvas.width = Math.floor(width * dpr);
    techGlobeCanvas.height = Math.floor(height * dpr);
    techGlobeCanvas.style.width = `${width}px`;
    techGlobeCanvas.style.height = `${height}px`;
  }

  const ctx = techGlobeCanvas.getContext('2d');
  if (!ctx) return;

  // Refined world regions with proper positioning for readability
  const worldRegions = [
    { name: 'North America', lat: 45, lng: -100, status: 'healthy', services: 3 },
    { name: 'South America', lat: -15, lng: -60, status: 'healthy', services: 1 },
    { name: 'Europe', lat: 50, lng: 12, status: 'healthy', services: 2 },
    { name: 'Africa', lat: 0, lng: 22, status: 'healthy', services: 1 },
    { name: 'Middle East', lat: 25, lng: 50, status: 'healthy', services: 1 },
    { name: 'Asia Pacific', lat: 35, lng: 110, status: 'healthy', services: 3 },
  ];

  // Update region statuses based on simulation state
  if (simulationState.active) {
    const affectedRegions = simulationState.region ? [simulationState.region] : [];
    worldRegions.forEach((region) => {
      if (affectedRegions.includes(region.name.split(' ')[0].toLowerCase()) || 
          affectedRegions.some(r => region.name.toLowerCase().includes(r))) {
        region.status = 'critical';
      } else {
        region.status = simulationState.mitigated ? 'protected' : 'warning';
      }
    });
  }

  const drawFrame = () => {
    const reducedMotion = document.body.classList.contains('reduced-motion');
    const pulse = simulationState.active ? (0.65 + Math.sin((mapRoutePhase / 20) * Math.PI * 2) * 0.35) : 0.3;
    const shockBoost = Date.now() < simulationShockUntil ? 1.4 : 1;
    const w = techGlobeCanvas.width / dpr;
    const h = techGlobeCanvas.height / dpr;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const radius = Math.min(w, h) * 0.32;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Atmospheric outer glow
    const atmosphereGlow = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 1.9);
    atmosphereGlow.addColorStop(0, `rgba(57, 255, 20, ${0.06 + pulse * 0.08})`);
    atmosphereGlow.addColorStop(0.6, `rgba(0, 212, 255, ${0.04 + pulse * 0.06})`);
    atmosphereGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = atmosphereGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // Main sphere with subtle gradient
    const sphereGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.15, cx, cy, radius * 1.05);
    sphereGrad.addColorStop(0, 'rgba(210, 250, 255, 0.85)');
    sphereGrad.addColorStop(0.35, 'rgba(100, 210, 255, 0.52)');
    sphereGrad.addColorStop(0.75, 'rgba(40, 100, 180, 0.35)');
    sphereGrad.addColorStop(1, 'rgba(15, 35, 70, 0.88)');
    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    const project = (latDeg, lngDeg) => {
      const lat = (latDeg * Math.PI) / 180;
      const lng = ((lngDeg + techGlobeRotation) * Math.PI) / 180;
      const x = Math.cos(lat) * Math.sin(lng);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(lng);
      return { x: cx + x * radius * 0.95, y: cy - y * radius * 0.95, z };
    };

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Subtle continental grid
    ctx.strokeStyle = 'rgba(150, 220, 255, 0.16)';
    ctx.lineWidth = 0.8;
    
    // Latitude lines
    for (let lat = -60; lat <= 60; lat += 20) {
      ctx.beginPath();
      let started = false;
      for (let lng = -180; lng <= 180; lng += 5) {
        const p = project(lat, lng);
        if (p.z <= 0.1) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }

    // Longitude lines
    for (let lng = -180; lng <= 180; lng += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -75; lat <= 75; lat += 4) {
        const p = project(lat, lng);
        if (p.z <= 0.1) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }

    // Render world regions with status indicators
    worldRegions.forEach((region) => {
      const p = project(region.lat, region.lng);
      if (p.z <= 0.1) return;

      // Status color mapping
      let regionColor = 'rgba(57, 255, 20, 0.8)'; // healthy - neon green
      let glowColor = 'rgba(57, 255, 20, 0.3)';
      let textColor = '#e8f5ff';

      if (region.status === 'critical') {
        regionColor = 'rgba(255, 45, 74, 0.85)'; // critical - red
        glowColor = 'rgba(255, 45, 74, 0.4)';
      } else if (region.status === 'warning') {
        regionColor = 'rgba(255, 184, 0, 0.85)'; // warning - amber
        glowColor = 'rgba(255, 184, 0, 0.35)';
      } else if (region.status === 'protected') {
        regionColor = 'rgba(57, 255, 20, 0.9)'; // protected - enhanced green
        glowColor = 'rgba(57, 255, 20, 0.4)';
      }

      const baseSize = 6 + region.services * 2;
      const pulseSize = simulationState.active ? 1 + pulse * 0.35 : 1;
      const finalSize = baseSize * pulseSize * shockBoost;

      // Outer glow halo
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, finalSize * 2.5);
      halo.addColorStop(0, glowColor);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.globalAlpha = 0.6 * (simulationState.active ? pulse : 0.5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, finalSize * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Main indicator dot
      ctx.globalAlpha = 1;
      ctx.fillStyle = regionColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, finalSize, 0, Math.PI * 2);
      ctx.fill();

      // Protective border for mitigated regions
      if (region.status === 'protected') {
        ctx.strokeStyle = 'rgba(57, 255, 20, 0.6)';
        ctx.lineWidth = 1.5 * shockBoost;
        ctx.beginPath();
        ctx.arc(p.x, p.y, finalSize + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Render cascade routes
    const routes = getMapRoutes();
    routes.forEach((route) => {
      const start = project(route.startLat, route.startLng);
      const end = project(route.endLat, route.endLng);
      if (start.z <= 0.1 || end.z <= 0.1) return;

      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2 - radius * 0.15;

      ctx.strokeStyle = route.color;
      ctx.lineWidth = 1.8 * shockBoost;
      ctx.globalAlpha = 0.55 + pulse * 0.25;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(midX, midY, end.x, end.y);
      ctx.stroke();

      // Animated energy pulse along route
      const routePhase = (mapRoutePhase + routes.indexOf(route) * 25) % 300;
      const t = routePhase / 300;
      const energyX = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * midX + t * t * end.x;
      const energyY = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * midY + t * t * end.y;

      const energyGlow = ctx.createRadialGradient(energyX, energyY, 0, energyX, energyY, 8 * shockBoost);
      energyGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      energyGlow.addColorStop(0.7, route.color);
      energyGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = energyGlow;
      ctx.globalAlpha = 0.8 + pulse * 0.2;
      ctx.beginPath();
      ctx.arc(energyX, energyY, 6 * shockBoost, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.restore();

    // Protective outer ring border
    ctx.strokeStyle = `rgba(57, 255, 20, ${0.35 + pulse * 0.2})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.02, 0, Math.PI * 2);
    ctx.stroke();

    if (!reducedMotion) techGlobeRotation += 0.15;
    if (techGlobeRotation > 360) techGlobeRotation -= 360;
    techGlobeAnimationId = requestAnimationFrame(drawFrame);
  };

  if (!techGlobeAnimationId) {
    techGlobeAnimationId = requestAnimationFrame(drawFrame);
  }
}


function stopTechGlobeAnimation() {
  if (techGlobeAnimationId) {
    cancelAnimationFrame(techGlobeAnimationId);
    techGlobeAnimationId = null;
  }
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
    stopTechGlobeAnimation();
    renderLeafletMap('flatMapContainer');
    setTimeout(() => {
      flatMap?.invalidateSize();
      flatMap?.fitBounds([[-60, -170], [82, 170]], { padding: [20, 14], animate: false });
    }, 80);
  } else {
    stopTechGlobeAnimation();
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
    if (!narrationEnabled) stopActiveNarration();
  });
  document.getElementById('voiceRate').addEventListener('input', (event) => {
    narrationRate = Number(event.target.value);
    localStorage.setItem('cascade-voice-rate', String(narrationRate));
  });
  document.getElementById('demoPresetSelector').addEventListener('change', (event) => {
    selectedDemoPreset = event.target.value === 'full' ? 'full' : 'full';
    localStorage.setItem('cascade-demo-preset', selectedDemoPreset);
  });

  document.getElementById('testVoiceBtn').addEventListener('click', async () => {
    const ready = await ensureNarrationReady();
    if (ready) {
      await speakNarration('Cascade Prevention Engine is online. Predict the cascade, cut the blast radius, and keep customers protected.', 'test');
    }
  });

  document.getElementById('runDemoBtn').addEventListener('click', runAutoplayDemo);

  // ── AI Chat interactions ───────────────────────────────────────────────────
  document.getElementById('aiChatSendBtn')?.addEventListener('click', sendChatMessage);
  document.getElementById('aiChatClearBtn')?.addEventListener('click', clearChat);
  document.getElementById('aiChatInput')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  });
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
  if (demoRunning) return;
  demoRunning = true;
  const demoBtn = document.getElementById('runDemoBtn');
  const preset = getDemoPreset();
  const { script, timings } = preset;
  if (demoBtn) demoBtn.disabled = true;
  try {
    // Warm up the voice engine before the demo begins (required user-gesture priming)
    const ready = await ensureNarrationReady();
    if (!ready) {
      updateVoiceStatus('Voice files not ready. Click Test Voice and try again.', 'error');
      return;
    }

    // ── Step 1: Navigate to Simulator, configure scenario, narrate ──────────
    navigateTo('simulator');
    setDemoBanner('Step 1 of 7 &mdash; Configuring a Queue Saturation Cascade at maximum company-wide scope...');
    await sleep(260);

    document.getElementById('scenarioSelector').value = 'queue-saturation';
    document.getElementById('regionSelector').value = 'us-east-1';
    document.getElementById('scopeSelector').value = 'company';
    document.getElementById('intensitySlider').value = '4';
    document.getElementById('intensityValue').textContent = '4 / 5';

    await speakNarration(script.step1, 'step1');
    await sleep(timings.transition);

    // ── Step 2: Fire the simulation, narrate ────────────────────────────────
    setDemoBanner('Step 2 of 7 &mdash; Simulating cascade event &mdash; AI is projecting blast radius...');
    simulateScenario();
    await sleep(220);
    await speakNarration(script.step2, 'step2');
    await sleep(timings.transition);

    // ── Step 3: Dependency graph ─────────────────────────────────────────────
    navigateTo('dependency-graph');
    setDemoBanner('Step 3 of 7 &mdash; Examining live service topology &mdash; red paths mark the cascade spread...');
    await sleep(300);
    await speakNarration(script.step3, 'step3');
    await sleep(timings.transition);

    // ── Step 4: Risk map — globe → flat → list ───────────────────────────────
    navigateTo('risk-map');
    setRiskView('globe');
    setDemoBanner('Step 4 of 7 &mdash; Reviewing global cascade footprint across globe, flat map, and region list views...');
    await sleep(250);
    await speakNarration(script.globe, 'globe');
    await sleep(timings.transition);

    setRiskView('flat');
    setDemoBanner('Step 4 of 7 &mdash; Flat map view exposes tactical regional spread and translucent route overlays...');
    await sleep(220);
    await speakNarration(script.flat, 'flat');
    await sleep(timings.transition);

    setRiskView('list');
    setDemoBanner('Step 4 of 7 &mdash; Region list ranks affected areas for quick mitigation prioritization...');
    await sleep(220);
    await speakNarration(script.list, 'list');
    await sleep(timings.transition);

    // ── Step 5: Remediation plan review ─────────────────────────────────────
    navigateTo('remediation');
    selectedPlan = remediationPlans[0];
    renderPlans();
    renderPlanDetail();
    setDemoBanner('Step 5 of 7 &mdash; AI-generated remediation plan ready for operator review...');
    await sleep(260);
    await speakNarration(script.step5, 'step5');
    await sleep(timings.transition);

    // ── Step 6: Approve the plan ─────────────────────────────────────────────
    document.getElementById('roleSelector').value = 'admin';
    renderPlanDetail();
    setDemoBanner('Step 6 of 7 &mdash; Approving AI mitigation plan...');
    await sleep(200);
    await speakNarration(script.step6, 'step6');
    await sleep(timings.transition);
    await submitApproval(true);
    await sleep(timings.transition);

    // ── Step 7: Overview — guarded state ────────────────────────────────────
    navigateTo('overview');
    setDemoBanner('Step 7 of 7 &mdash; Cascade contained. System returned to Guarded state. Customer impact avoided.');
    await sleep(260);
    await speakNarration(script.step7, 'step7');
    await sleep(timings.overviewHold);
  } finally {
    // ── Cleanup ──────────────────────────────────────────────────────────────
    setDemoBanner(null);
    stopActiveNarration();
    if (demoBtn) demoBtn.disabled = false;
    demoRunning = false;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// AI COPILOT CHAT FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

function initializeChat() {
  chatSessionId = `chat-${Date.now()}`;
  chatMessages = [];
  renderChatMessages();
  const input = document.getElementById('aiChatInput');
  if (input) input.value = '';
  const status = document.getElementById('aiChatStatus');
  if (status) status.textContent = '';
}

function renderChatMessages() {
  const container = document.getElementById('aiChatMessages');
  if (!container) return;

  container.innerHTML = chatMessages
    .map((msg) => {
      const isUser = msg.role === 'user';
      const isSystem = msg.role === 'system';
      return `
        <div class="chat-message ${msg.role}">
          ${!isUser && !isSystem ? '<div class="chat-avatar">AI</div>' : ''}
          <div class="chat-bubble">${escapeHtml(msg.content)}</div>
        </div>
      `;
    })
    .join('');

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function setChatStatus(message, type = '') {
  const status = document.getElementById('aiChatStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `chat-status ${type}`;
}

function addChatMessage(role, content) {
  chatMessages.push({ role, content });
  renderChatMessages();
}

async function sendChatMessage() {
  const input = document.getElementById('aiChatInput');
  if (!input || chatLoading) return;

  const message = input.value.trim();
  if (!message) {
    setChatStatus('Enter a message to continue', 'error');
    return;
  }

  // Add user message
  addChatMessage('user', message);
  input.value = '';

  // Check if live API is configured
  const baseUrl = document.getElementById('apiBaseUrl').value.trim();
  if (!baseUrl) {
    addChatMessage('system', 'Live API not configured. Chat requires API connection.');
    setChatStatus('Configure Live API Base URL in settings to use chat', 'error');
    return;
  }

  // Send to backend
  chatLoading = true;
  setChatStatus('AI thinking…', 'loading');

  try {
    const headers = buildHeaders();
    const response = await fetch(`${baseUrl}${CHAT_API_PATH}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        sessionId: chatSessionId,
        context: {
          dependencyGraph: dependencyNodes,
          signatures,
          remediationPlans,
          simulationState,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    addChatMessage('assistant', data.response);
    setChatStatus('', '');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    addChatMessage('system', `Error: ${errorMsg}`);
    setChatStatus(`Failed: ${errorMsg}`, 'error');
  } finally {
    chatLoading = false;
    document.getElementById('aiChatInput')?.focus();
  }
}

function clearChat() {
  initializeChat();
  setChatStatus('', '');
}

// ── Dashboard bootstrap ───────────────────────────────────────────────────────
function bootstrapDashboard() {
  initializePreferences();
  cacheNarrationVoices();
  startMapAnimationLoop();
  initializeChat();
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
