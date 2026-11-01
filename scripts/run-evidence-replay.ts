import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { buildEvidenceReport, EvidenceScenario } from '../src/evidence/replay';

type ScenarioFile = {
  schemaVersion: string;
  scenarios: EvidenceScenario[];
};

const repositoryRoot = resolve(__dirname, '..');
const scenarioPath = resolve(repositoryRoot, 'evidence/scenarios.json');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outputDirectory = resolve(repositoryRoot, 'evidence/runs', runId);
const scenarioFile = JSON.parse(readFileSync(scenarioPath, 'utf8')) as ScenarioFile;
const report = buildEvidenceReport(scenarioFile.scenarios);

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resolve(outputDirectory, 'scenarios.json'), JSON.stringify(scenarioFile, null, 2) + '\n');
writeFileSync(resolve(outputDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(resolve(outputDirectory, 'manifest.json'), JSON.stringify({
  runId,
  evidenceType: report.evidenceType,
  scenarioSchemaVersion: scenarioFile.schemaVersion,
  generatedAt: report.generatedAt,
  sourceScenarioFile: 'evidence/scenarios.json',
  limitation: report.limitation,
}, null, 2) + '\n');

console.log(JSON.stringify({ outputDirectory, summary: report.summary }, null, 2));

if (report.summary.failedCount > 0) {
  process.exitCode = 1;
}