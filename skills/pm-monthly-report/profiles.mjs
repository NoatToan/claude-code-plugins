#!/usr/bin/env node
// pm-monthly-report — the per-user profile store and the deterministic bits of a run.
//
// Where profiles live, first hit wins:
//   1. TLM_PM_REPORTS_FILE                              explicit override
//   2. <project>/.claude/tlm-pm-reports.json            project store (committed with the project);
//                                                       project = TLM_PROJECT_DIR or cwd. Used when it
//                                                       exists, or created by `save --project`.
//   3. ~/.claude/tlm-pm-reports.json                    per-user store — for Claude Desktop with no repo
// A relative output.outputDir resolves against the project root of a project store.
// Schema: setup/tlm-config.reference.json → "pmReports". No secrets are stored here — tracker and
// Gmail auth come from their connectors.
//
// Usage:
//   node profiles.mjs path                         where the store is (and whether it exists)
//   node profiles.mjs list                         one line per profile
//   node profiles.mjs show <id>                    the profile as JSON
//   node profiles.mjs save [--file <f>|-] [--project]  upsert one profile (JSON on stdin or file), validated;
//                                                  --project creates the project store if none exists
//   node profiles.mjs remove <id>                  delete a profile
//   node profiles.mjs validate [<id>]              check one / all profiles, exit 1 on errors
//   node profiles.mjs period <id> [YYYY-MM|sprint:N|sprint:N-M] report window in the profile's timezone
//                                                  (default: the month / calendar sprint that last
//                                                  ended). Sprints that live in the tracker (folder,
//                                                  field, tag) come back as needsTracker:true.
//                                                  report.range "sinceLastReport": the first sprint not
//                                                  yet covered by a saved report (or report.firstSprint)
//                                                  up to the last ended one.
//   node profiles.mjs output <id> <periodKey>      resolved report path for that period
//   node profiles.mjs history <id> [n]             metrics blocks of the last n saved reports
//                                                  (oldest first) — the trend / MoM / forecast input
//
// Every command prints JSON except `list`. Only `save` and `remove` write, and only the store file.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT_DIR = path.resolve(process.env.TLM_PROJECT_DIR || process.cwd());
const PROJECT_STORE = path.join(PROJECT_DIR, '.claude', 'tlm-pm-reports.json');
const USER_STORE = path.join(os.homedir(), '.claude', 'tlm-pm-reports.json');
const RAW = process.argv.slice(2);
const STORE = process.env.TLM_PM_REPORTS_FILE
  || (fs.existsSync(PROJECT_STORE) || (RAW[0] === 'save' && RAW.includes('--project')) ? PROJECT_STORE : USER_STORE);
const SCOPE = STORE === PROJECT_STORE ? 'project' : STORE === USER_STORE ? 'user' : 'override';

const SECTIONS = [
  'tldr', 'summary', 'goals', 'highlights', 'workstreams', 'inProgress', 'quality', 'risks', 'asks',
  'workload', 'teamFocus', 'time', 'forecast', 'nextPeriod', 'notes',
];
const CADENCES = ['month', 'sprint'];
const SPRINT_MODES = ['folder', 'customField', 'tag', 'calendar'];
const BUG_BY = ['tag', 'taskType', 'list', 'customField'];
const AUDIENCES = ['client', 'management', 'internal'];
const RANGES = ['single', 'sinceLastReport'];
const GOAL_PROGRESS = ['linkedTasks', 'subtasks'];
const GOAL_PICK = ['each-run', 'all', 'with-due-date'];
const SYSTEMS = ['clickup', 'jira', 'linear', 'azure-devops', 'github'];
const IMPLEMENTED = ['clickup'];
const GROUP_BY = /^(none|list|folder|tag|assignee|customField:.+)$/;
const METRICS_RE = /<!--\s*tlm-pm-metrics\s+(\{[\s\S]*?\})\s*-->/;

const die = (msg, code = 1) => { process.stderr.write(`pm-monthly-report: ${msg}\n`); process.exit(code); };
const out = (v) => process.stdout.write(`${JSON.stringify(v, null, 2)}\n`);

function load() {
  if (!fs.existsSync(STORE)) return { version: 1, defaults: {}, profiles: [] };
  try {
    const data = JSON.parse(fs.readFileSync(STORE, 'utf8'));
    data.profiles ??= [];
    data.defaults ??= {};
    return data;
  } catch (e) {
    die(`${STORE} is not valid JSON (${e.message}) — fix or move it; nothing was changed.`);
  }
}

function write(data) {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  const tmp = `${STORE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmp, STORE);
}

function find(data, id) {
  const p = data.profiles.find((x) => x.id === id);
  if (!p) die(`no profile "${id}". Known: ${data.profiles.map((x) => x.id).join(', ') || '(none — run setup)'}`);
  return p;
}

// ~ → home; relative → the project root when the store is a project store (else cwd).
const expandHome = (p) => {
  if (!p) return p;
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  if (path.isAbsolute(p)) return p;
  return path.resolve(SCOPE === 'project' ? PROJECT_DIR : process.cwd(), p);
};

function validate(p) {
  const errors = [];
  const warnings = [];
  if (!p || typeof p !== 'object') return { errors: ['profile is not an object'], warnings };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(p.id ?? '')) errors.push('id must be kebab-case (a-z, 0-9, -)');
  if (!p.name) errors.push('name is required');

  const t = p.tracker ?? {};
  if (!SYSTEMS.includes(t.system)) errors.push(`tracker.system must be one of ${SYSTEMS.join('|')}`);
  else if (!IMPLEMENTED.includes(t.system)) warnings.push(`tracker.system "${t.system}" has no adapter yet — runs will stop at PHASE 1`);
  if (!t.workspaceId) errors.push('tracker.workspaceId is required');
  const s = t.scope ?? {};
  const located = ['spaceIds', 'folderIds', 'listIds'].some((k) => Array.isArray(s[k]) && s[k].length);
  if (!located) errors.push('tracker.scope needs at least one of spaceIds / folderIds / listIds');
  for (const f of t.filters?.customFields ?? []) {
    if (!f.fieldId || !f.operator) errors.push('every tracker.filters.customFields entry needs fieldId + operator');
  }
  if (!t.statuses?.done?.length) errors.push('tracker.statuses.done is required (the status names that mean delivered)');
  for (const k of ['devDone', 'excluded']) {
    if (t.statuses?.[k] && !Array.isArray(t.statuses[k])) errors.push(`tracker.statuses.${k} must be an array of status names`);
  }
  if (t.groupBy && !GROUP_BY.test(t.groupBy)) errors.push('tracker.groupBy must be none | list | folder | tag | assignee | customField:<id>');

  const sp = t.sprints;
  if (sp) {
    if (!SPRINT_MODES.includes(sp.mode)) errors.push(`tracker.sprints.mode must be ${SPRINT_MODES.join(' | ')}`);
    if (sp.mode === 'folder' && !sp.folderId) errors.push('tracker.sprints.folderId is required for mode folder');
    if (sp.mode === 'customField' && !sp.fieldId) errors.push('tracker.sprints.fieldId is required for mode customField');
    if (sp.mode === 'tag' && !sp.tagPattern) errors.push('tracker.sprints.tagPattern is required for mode tag (e.g. "sprint {N}")');
    if (sp.mode === 'calendar') {
      const c = sp.calendar ?? {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(c.anchorStart ?? '') || !Number.isInteger(c.anchorNumber) || !(c.lengthDays > 0)) {
        errors.push('tracker.sprints.calendar needs anchorStart (YYYY-MM-DD), anchorNumber (int), lengthDays (>0)');
      }
    }
    const ct = sp.counting;
    if (ct) {
      if (ct.completedBy && !['statusType', 'statuses'].includes(ct.completedBy)) errors.push('tracker.sprints.counting.completedBy must be statusType | statuses');
      if (ct.completedBy === 'statusType' && !(Array.isArray(ct.completedStatusTypes) && ct.completedStatusTypes.length)) {
        errors.push('tracker.sprints.counting.completedStatusTypes (e.g. ["closed"]) is required with completedBy statusType');
      }
    }
  }
  const g = t.goals;
  if (g) {
    if (!g.listId) errors.push('tracker.goals.listId is required (the list that holds the goal tasks)');
    if (!GOAL_PROGRESS.includes(g.progressBy)) errors.push(`tracker.goals.progressBy must be ${GOAL_PROGRESS.join(' | ')}`);
    if (g.pick && !GOAL_PICK.includes(g.pick)) errors.push(`tracker.goals.pick must be ${GOAL_PICK.join(' | ')}`);
  }
  const b = t.bugs;
  if (b && (!BUG_BY.includes(b.by) || !b.value)) errors.push(`tracker.bugs needs by (${BUG_BY.join(' | ')}) + value`);

  const r = p.report ?? {};
  if (!CADENCES.includes(r.cadence)) errors.push('report.cadence must be month | sprint');
  if (r.rules !== undefined && !(Array.isArray(r.rules) && r.rules.every((x) => typeof x === 'string'))) errors.push('report.rules must be an array of strings');
  if (r.cadence === 'sprint' && !sp) errors.push('report.cadence sprint needs tracker.sprints (how sprints are kept)');
  if (r.sections?.includes('goals') && !g) errors.push('section "goals" needs tracker.goals (where goals live, how progress is measured)');
  if (r.range && !RANGES.includes(r.range)) errors.push(`report.range must be ${RANGES.join(' | ')}`);
  if (r.range === 'sinceLastReport') {
    if (r.cadence !== 'sprint') errors.push('report.range sinceLastReport needs report.cadence sprint');
    if (!Number.isInteger(r.firstSprint)) errors.push('report.range sinceLastReport needs report.firstSprint (int) — where the first report starts when none is saved yet');
  }
  if (r.sections?.includes('quality') && !b) errors.push('section "quality" needs tracker.bugs (how a bug is recognised)');
  if (r.sections?.includes('workstreams') && !p.workstreams?.length) errors.push('section "workstreams" needs at least one entry in workstreams[]');
  for (const w of p.workstreams ?? []) {
    if (!w.name || !['long', 'short'].includes(w.horizon)) errors.push('every workstream needs name + horizon (long | short)');
  }
  if (r.sections?.includes('forecast') && !(p.team?.size > 0 || p.team?.size === 'auto')) warnings.push('section "forecast" works best with team.size set (per-member rate)');
  if (!Array.isArray(r.sections) || !r.sections.length) errors.push('report.sections must list at least one section');
  else for (const x of r.sections) if (!SECTIONS.includes(x)) errors.push(`unknown section "${x}" (known: ${SECTIONS.join(', ')})`);
  if (!['en', 'vi'].includes(r.language)) errors.push('report.language must be en | vi');
  if (!AUDIENCES.includes(r.audience)) errors.push(`report.audience must be ${AUDIENCES.join(' | ')}`);
  if (!r.timezone) errors.push('report.timezone is required (IANA, e.g. Australia/Melbourne)');
  else {
    try { new Intl.DateTimeFormat('en', { timeZone: r.timezone }); } catch { errors.push(`report.timezone "${r.timezone}" is not a valid IANA zone`); }
  }
  if (r.sections?.includes('time') && t.system === 'clickup' && !t.timeTracking) {
    warnings.push('section "time" is on but tracker.timeTracking is not true — confirm the space tracks time');
  }

  const o = p.output ?? {};
  if (!o.outputDir) errors.push('output.outputDir is required');

  const e = p.email ?? {};
  if (!['gmail-draft', 'text', 'off'].includes(e.mode)) errors.push('email.mode must be gmail-draft | text | off');
  if (e.mode === 'gmail-draft' && !e.to?.length) errors.push('email.to needs at least one recipient for gmail-draft');
  return { errors, warnings };
}

// Calendar month [from, to] as YYYY-MM-DD, in the profile's timezone.
function period(tz, month) {
  let y;
  let m;
  if (month) {
    const hit = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!hit) die(`month must be YYYY-MM, got "${month}"`);
    y = Number(hit[1]);
    m = Number(hit[2]);
  } else {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    y = Number(parts.year);
    m = Number(parts.month) - 1; // the month that last ended
    if (m === 0) { m = 12; y -= 1; }
  }
  const pad = (n) => String(n).padStart(2, '0');
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const nextLast = new Date(Date.UTC(Number(next.slice(0, 4)), Number(next.slice(5)), 0)).getUTCDate();
  return {
    month: `${y}-${pad(m)}`,
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(last)}`,
    timezone: tz,
    label: { en: new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }), vi: `Tháng ${m}/${y}` },
    previousMonth: prev,
    nextMonth: { month: next, from: `${next}-01`, to: `${next}-${pad(nextLast)}` },
  };
}

const DAY = 86_400_000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const todayIn = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()); // YYYY-MM-DD

// Fixed-length sprints counted from one known sprint. Only mode "calendar" is computable offline;
// folder / customField / tag sprints carry their own dates in the tracker.
function sprintPeriod(p, key) {
  const sp = p.tracker?.sprints;
  const tz = p.report?.timezone || 'UTC';
  if (!sp) die(`profile "${p.id}" has no tracker.sprints`);
  if (sp.mode !== 'calendar') {
    return { cadence: 'sprint', needsTracker: true, mode: sp.mode, requested: key ?? 'last-ended', timezone: tz };
  }
  const { anchorStart, anchorNumber, lengthDays } = sp.calendar;
  const anchor = Date.parse(`${anchorStart}T00:00:00Z`);
  let n;
  if (key) {
    const hit = /^sprint:(\d+)$/.exec(key);
    if (!hit) die(`calendar sprint period must be sprint:N, got "${key}"`);
    n = Number(hit[1]);
  } else {
    const today = Date.parse(`${todayIn(tz)}T00:00:00Z`);
    n = anchorNumber + Math.floor((today - anchor) / (lengthDays * DAY)) - 1; // the sprint that last ended
  }
  const at = (k) => {
    const start = anchor + (k - anchorNumber) * lengthDays * DAY;
    return { number: k, key: `sprint:${k}`, from: isoDay(start), to: isoDay(start + (lengthDays - 1) * DAY) };
  };
  const cur = at(n);
  const name = (sp.namePattern || 'Sprint {N}').replaceAll('{N}', String(n));
  return {
    cadence: 'sprint', ...cur, timezone: tz, label: { en: name, vi: name },
    previous: at(n - 1).key, next: at(n + 1),
  };
}

// Several sprints in one report: from the first sprint no saved report covers yet up to the last
// ended one. The end is resolved from the tracker (or the calendar); the start comes from history.
function rangePeriod(p, key) {
  const tz = p.report?.timezone || 'UTC';
  let fromSprint;
  let toSprint = null;
  if (key) {
    const hit = /^sprint:(\d+)(?:-(\d+))?$/.exec(key);
    if (!hit) die(`sprint range must be sprint:N or sprint:N-M, got "${key}"`);
    fromSprint = Number(hit[1]);
    toSprint = hit[2] ? Number(hit[2]) : null;
  } else {
    const last = savedReports(p).map((x) => x.metrics.period?.lastSprint).filter(Number.isInteger).pop();
    fromSprint = last ? last + 1 : p.report.firstSprint;
  }
  const res = {
    cadence: 'sprint', range: 'sinceLastReport', fromSprint, toSprint: toSprint ?? 'last-ended',
    forecastCurrent: p.report.forecastCurrent !== false, timezone: tz, today: todayIn(tz),
  };
  if (p.tracker.sprints.mode !== 'calendar') return { ...res, needsTracker: true, mode: p.tracker.sprints.mode };
  const end = toSprint ?? sprintPeriod(p).number;
  const first = sprintPeriod(p, `sprint:${fromSprint}`);
  const lastP = sprintPeriod(p, `sprint:${end}`);
  return { ...res, toSprint: end, key: `sprint:${fromSprint}-${end}`, from: first.from, to: lastP.to, current: lastP.next };
}

function periodFor(p, key) {
  if (p.report?.cadence === 'sprint' && p.report?.range === 'sinceLastReport') return rangePeriod(p, key);
  if (p.report?.cadence === 'sprint') return sprintPeriod(p, key);
  const m = period(p.report?.timezone || 'UTC', key);
  return { cadence: 'month', key: m.month, ...m, previous: m.previousMonth, next: m.nextMonth };
}

function reportPath(p, key) {
  const sprint = /^sprint:(\d+(?:-\d+)?)$/.exec(key);
  const fallback = p.report?.cadence === 'sprint' ? 'sprint-{N}.md' : '{YYYY-MM}.md';
  const name = (p.output.fileName || fallback)
    .replaceAll('{YYYY-MM}', key)
    .replaceAll('{N}', sprint ? sprint[1] : key)
    .replaceAll('{id}', p.id);
  return path.join(expandHome(p.output.outputDir), name);
}

function savedReports(p) {
  const dir = expandHome(p.output?.outputDir || '');
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ file: path.join(dir, f), metrics: readMetrics(path.join(dir, f)) }))
    .filter((x) => x.metrics?.profile === p.id && x.metrics?.period?.from)
    .sort((a, b) => a.metrics.period.from.localeCompare(b.metrics.period.from));
}

function readMetrics(file) {
  const hit = METRICS_RE.exec(fs.readFileSync(file, 'utf8'));
  if (!hit) return null;
  try { return JSON.parse(hit[1]); } catch { return null; }
}

const [cmd, ...args] = RAW.filter((a) => a !== '--project');
const data = load();

switch (cmd) {
  case 'path':
    out({ store: STORE, scope: SCOPE, exists: fs.existsSync(STORE), profiles: data.profiles.length });
    break;

  case 'list':
    if (!data.profiles.length) console.log(`(no profiles in ${STORE} — run /pm-monthly-report setup)`);
    for (const p of data.profiles) {
      const { errors } = validate(p);
      console.log(`${p.id.padEnd(24)} ${p.name} · ${p.tracker?.system ?? '?'} · ${p.report?.cadence ?? '?'} · ${p.report?.language ?? '?'}/${p.report?.audience ?? '?'} · email:${p.email?.mode ?? '?'}${errors.length ? `  ⚠ ${errors.length} error(s)` : ''}`);
    }
    break;

  case 'show':
    out(find(data, args[0]));
    break;

  case 'save': {
    const src = args[0] === '--file' ? args[1] : '-';
    let p;
    try { p = JSON.parse(fs.readFileSync(src === '-' ? 0 : src, 'utf8')); } catch (e) { die(`profile JSON unreadable: ${e.message}`); }
    const { errors, warnings } = validate(p);
    if (errors.length) { out({ saved: false, errors, warnings }); process.exit(1); }
    p.updatedAt = new Date().toISOString();
    const i = data.profiles.findIndex((x) => x.id === p.id);
    if (i >= 0) data.profiles[i] = p; else data.profiles.push(p);
    write(data);
    out({ saved: true, store: STORE, scope: SCOPE, id: p.id, created: i < 0, warnings });
    break;
  }

  case 'remove': {
    find(data, args[0]);
    data.profiles = data.profiles.filter((x) => x.id !== args[0]);
    write(data);
    out({ removed: args[0], store: STORE });
    break;
  }

  case 'validate': {
    const targets = args[0] ? [find(data, args[0])] : data.profiles;
    const results = targets.map((p) => ({ id: p.id, ...validate(p) }));
    out(results);
    if (results.some((r) => r.errors.length)) process.exit(1);
    break;
  }

  case 'period': {
    out(periodFor(find(data, args[0]), args[1]));
    break;
  }

  case 'output': {
    const p = find(data, args[0]);
    if (!args[1]) die('usage: output <id> <YYYY-MM | sprint:N | sprint:N-M>');
    const file = reportPath(p, args[1]);
    out({ file, exists: fs.existsSync(file), outputDirExists: fs.existsSync(path.dirname(file)) });
    break;
  }

  case 'history': {
    const p = find(data, args[0]);
    const n = Number(args[1] || 6);
    const rows = savedReports(p).slice(-n);
    out({ outputDir: expandHome(p.output?.outputDir || ''), count: rows.length, reports: rows });
    break;
  }

  default:
    die('usage: profiles.mjs path | list | show <id> | save [--file f|-] | remove <id> | validate [id] | period <id> [YYYY-MM|sprint:N|sprint:N-M] | output <id> <YYYY-MM|sprint:N|sprint:N-M> | history <id> [n]', 2);
}
