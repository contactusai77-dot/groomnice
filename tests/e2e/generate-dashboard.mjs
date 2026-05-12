import { readFileSync, writeFileSync } from "fs";

const results = JSON.parse(readFileSync("test-results.json", "utf8"));

const WORKFLOW_MAP = {
  "Client booking page — /book": "Client Workflow",
  "Client booking — groomer side effects": "Client Workflow",
  "Client pet profile page — /profile/:token": "Client Workflow",
  "Client vaccine upload page — /vaccine/:token": "Client Workflow",
  "Groomer Today tab — core workflow": "Groomer Workflow",
  "Groomer booking drawer": "Groomer Workflow",
  "Groomer Settings — Working Hours": "Groomer Workflow",
  "Today tab — groomer dashboard": "Groomer Dashboard (existing)",
  "Clients tab": "Clients (existing)",
  "Reports tab": "Reports (existing)",
  "Pet profile page": "Customer Intake (existing)",
  "Vaccine upload page": "Customer Intake (existing)",
};

function statusIcon(status) {
  if (status === "passed") return "✅";
  if (status === "failed") return "❌";
  if (status === "skipped") return "⏭️";
  if (status === "timedOut") return "⏱️";
  return "❓";
}

function statusClass(status) {
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  if (status === "skipped") return "skipped";
  return "other";
}

// Group tests by workflow then suite
const groups = {};
for (const suite of results.suites ?? []) {
  for (const child of suite.suites ?? []) {
    const suiteName = child.title;
    const group = WORKFLOW_MAP[suiteName] ?? "Other";
    if (!groups[group]) groups[group] = {};
    if (!groups[group][suiteName]) groups[group][suiteName] = [];

    for (const spec of child.specs ?? []) {
      const result = spec.tests?.[0]?.results?.[0];
      const status = result?.status === "passed" && spec.tests?.[0]?.expectedStatus === "failed"
        ? "passed" // xfail that passed
        : spec.tests?.[0]?.ok ? "passed" : (result?.status ?? "unknown");
      const isExpectedFail = spec.tests?.[0]?.expectedStatus === "failed";
      groups[group][suiteName].push({
        title: spec.title,
        status: isExpectedFail && status === "failed" ? "xfail" : status,
        duration: result?.duration ?? 0,
        error: result?.error?.message ?? null,
        isExpectedFail,
      });
    }
  }
}

// Totals
let totalPass = 0, totalFail = 0, totalSkip = 0, totalXfail = 0;
for (const group of Object.values(groups)) {
  for (const tests of Object.values(group)) {
    for (const t of tests) {
      if (t.status === "passed") totalPass++;
      else if (t.status === "failed") totalFail++;
      else if (t.status === "skipped") totalSkip++;
      else if (t.status === "xfail") totalXfail++;
    }
  }
}

const runDate = new Date(results.stats?.startTime ?? Date.now()).toLocaleString("en-US");

let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Groomnice Test Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #1e293b; }
  header { background: #7c3aed; color: white; padding: 24px 32px; }
  header h1 { font-size: 22px; font-weight: 700; }
  header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }
  .summary { display: flex; gap: 16px; padding: 20px 32px; background: white; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; }
  .stat { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 10px; font-size: 14px; font-weight: 600; }
  .stat.pass { background: #f0fdf4; color: #166534; }
  .stat.fail { background: #fef2f2; color: #991b1b; }
  .stat.skip { background: #fefce8; color: #854d0e; }
  .stat.xfail { background: #eff6ff; color: #1e40af; }
  .content { padding: 24px 32px; max-width: 1100px; }
  .group { margin-bottom: 32px; }
  .group-title { font-size: 16px; font-weight: 700; color: #7c3aed; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #e9d5ff; }
  .suite { margin-bottom: 16px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
  .suite-title { padding: 10px 16px; background: #f8fafc; font-size: 13px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
  .test-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #f1f5f9; }
  .test-row:last-child { border-bottom: none; }
  .test-row.failed { background: #fff5f5; }
  .test-row.xfail { background: #eff6ff; }
  .test-row.skipped { opacity: 0.6; }
  .icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .test-info { flex: 1; min-width: 0; }
  .test-title { font-size: 13px; color: #1e293b; }
  .test-meta { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .xfail-tag { font-size: 10px; background: #dbeafe; color: #1e40af; padding: 1px 6px; border-radius: 4px; margin-left: 6px; font-weight: 600; }
  .error-msg { font-size: 11px; color: #dc2626; margin-top: 4px; font-family: monospace; background: #fef2f2; padding: 4px 8px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; }
  .duration { font-size: 11px; color: #94a3b8; flex-shrink: 0; }
</style>
</head>
<body>
<header>
  <h1>Groomnice — Test Dashboard</h1>
  <p>Run: ${runDate} &nbsp;·&nbsp; ${results.stats?.duration ? (results.stats.duration / 1000).toFixed(1) + "s total" : ""}</p>
</header>
<div class="summary">
  <div class="stat pass">✅ ${totalPass} Passed</div>
  <div class="stat fail">❌ ${totalFail} Failed</div>
  <div class="stat xfail">🔵 ${totalXfail} Expected Fail (known gaps)</div>
  <div class="stat skip">⏭️ ${totalSkip} Skipped</div>
</div>
<div class="content">
`;

for (const [groupName, suites] of Object.entries(groups)) {
  html += `<div class="group"><div class="group-title">${groupName}</div>`;
  for (const [suiteName, tests] of Object.entries(suites)) {
    const pass = tests.filter(t => t.status === "passed").length;
    const fail = tests.filter(t => t.status === "failed").length;
    const xfail = tests.filter(t => t.status === "xfail").length;
    html += `<div class="suite">
      <div class="suite-title">${suiteName} &nbsp;<span style="font-weight:400;color:#94a3b8">${pass}/${tests.length} passed${fail ? ` · ${fail} failed` : ""}${xfail ? ` · ${xfail} known gaps` : ""}</span></div>`;
    for (const t of tests) {
      const icon = t.status === "xfail" ? "🔵" : statusIcon(t.status);
      const rowClass = t.status === "xfail" ? "xfail" : statusClass(t.status);
      const durationStr = t.duration > 0 ? `${(t.duration / 1000).toFixed(2)}s` : "";
      html += `<div class="test-row ${rowClass}">
        <span class="icon">${icon}</span>
        <div class="test-info">
          <div class="test-title">${t.title}${t.isExpectedFail ? '<span class="xfail-tag">known gap</span>' : ""}</div>
          ${t.error ? `<div class="error-msg">${t.error.replace(/</g, "&lt;").replace(/>/g, "&gt;").split("\n").slice(0, 3).join("\n")}</div>` : ""}
        </div>
        <span class="duration">${durationStr}</span>
      </div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
}

html += `</div></body></html>`;

writeFileSync("dashboard.html", html);
console.log(`Dashboard written to dashboard.html`);
console.log(`  ✅ ${totalPass} passed  ❌ ${totalFail} failed  🔵 ${totalXfail} expected-fail  ⏭️ ${totalSkip} skipped`);
