#!/usr/bin/env node

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

const CONFIG_PATH = join(homedir(), ".agent-pomodoro.json");
const DEFAULT_URL = "https://efficient-wolf-51.eu-west-1.convex.site";

// ── Config ──────────────────────────────────────────────────────────

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

function getApiKey() {
  const envKey = process.env.APOM_API_KEY;
  if (envKey) return envKey;
  const config = loadConfig();
  return config.apiKey || null;
}

function getBaseUrl() {
  const envUrl = process.env.APOM_URL;
  if (envUrl) return envUrl;
  const config = loadConfig();
  return config.url || DEFAULT_URL;
}

// ── API Client ──────────────────────────────────────────────────────

function requireApiKey() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("Error: No API key configured.");
    console.error("Run: agent-pomodoro config set-key <your-api-key>");
    console.error("Or set APOM_API_KEY environment variable.");
    process.exit(1);
  }
  return apiKey;
}

async function apiFetch(path, options = {}) {
  const apiKey = requireApiKey();
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const headers = { Authorization: `Bearer ${apiKey}` };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: options.body ? "POST" : "GET",
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      console.error(`Error ${res.status}: ${json.error || text}`);
    } catch {
      console.error(`Error ${res.status}: ${text}`);
    }
    process.exit(1);
  }

  return res.json();
}

function apiCall(path) {
  return apiFetch(path);
}

function apiPost(path, data) {
  return apiFetch(path, { body: data });
}

// ── Commands ────────────────────────────────────────────────────────

async function cmdMe(args) {
  const data = await apiCall("/api/me");
  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`User ID: ${data.userId}`);
    console.log(`Key ID: ${data.keyId}`);
  }
}

async function cmdStatus(args) {
  const data = await apiCall("/api/status");
  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data.status);
  }
}

async function cmdStats(args) {
  const daysArg = args.find((a) => /^\d+d?$/.test(a));
  const days = daysArg ? parseInt(daysArg) : 7;
  const data = await apiCall(`/api/stats?days=${days}`);

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`Period: ${data.period}`);
    console.log(`Sessions: ${data.completedSessions}/${data.totalWorkSessions} (${data.completionRate}% completion)`);
    console.log(`Focus: ${data.totalFocusHours}h (${data.totalFocusMinutes}min)`);
    console.log(`Streak: ${data.currentStreak} days`);
    console.log(`Avg/day: ${data.avgSessionsPerDay}`);
    if (data.hoursSinceLastSession !== null) {
      console.log(`Last session: ${data.hoursSinceLastSession}h ago`);
    }
  }
}

async function cmdSessions(args) {
  const subCmd = args[0];

  if (subCmd === "today") {
    const data = await apiCall("/api/sessions/today");
    if (args.includes("--json")) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      if (data.sessions.length === 0) {
        console.log("No sessions today.");
      } else {
        for (const s of data.sessions) {
          const time = new Date(s.startedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
          const status = s.completed ? "done" : s.interrupted ? "interrupted" : "active";
          const tags = s.tags?.length ? ` [${s.tags.join(", ")}]` : "";
          console.log(`${time} ${s.durationMinutes}min ${s.type} (${status})${tags}`);
        }
      }
    }
  } else {
    const limitArg = args.find((a) => /^\d+$/.test(a));
    const limit = limitArg ? parseInt(limitArg) : 20;
    const data = await apiCall(`/api/sessions?limit=${limit}`);

    if (args.includes("--json")) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      if (data.sessions.length === 0) {
        console.log("No sessions found.");
      } else {
        for (const s of data.sessions) {
          const date = new Date(s.startedAt).toLocaleDateString("pl-PL");
          const time = new Date(s.startedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
          const status = s.completed ? "done" : s.interrupted ? "interrupted" : "active";
          const tags = s.tags?.length ? ` [${s.tags.join(", ")}]` : "";
          console.log(`${date} ${time} ${s.durationMinutes}min ${s.type} (${status})${tags}`);
        }
      }
    }
  }
}

async function cmdActive(args) {
  const data = await apiCall("/api/sessions/active");
  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else if (data.session) {
    const s = data.session;
    const elapsed = Math.round((Date.now() - s.startedAt) / 60000);
    const remaining = Math.max(0, s.durationMinutes - elapsed);
    console.log(`Active: ${s.type} session (${s.durationMinutes}min)`);
    console.log(`Elapsed: ${elapsed}min, Remaining: ${remaining}min`);
    if (s.currentTask) {
      console.log(`Task: ${s.currentTask}`);
    }
  } else {
    console.log("No active session.");
  }
}

async function cmdStart(args) {
  const type = args[0] || "work";
  if (!["work", "break", "longBreak"].includes(type)) {
    console.error("Usage: agent-pomodoro start [work|break|longBreak] [minutes] [--task \"...\"] [--tags \"a,b\"]");
    process.exit(1);
  }

  const durationArg = args.find((a) => /^\d+$/.test(a));
  const durationMinutes = durationArg
    ? parseInt(durationArg)
    : type === "work" ? 25 : type === "break" ? 5 : 15;

  const taskIdx = args.indexOf("--task");
  const currentTask = taskIdx >= 0 ? args[taskIdx + 1] : undefined;

  const tagsIdx = args.indexOf("--tags");
  const tagsArg = tagsIdx >= 0 ? args[tagsIdx + 1] : undefined;
  const tags = tagsArg
    ? tagsArg.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

  const body = { type, durationMinutes };
  if (currentTask) body.currentTask = currentTask;
  if (tags) body.tags = tags;

  const data = await apiPost("/api/sessions/start", body);

  // Track active session locally
  const config = loadConfig();
  config.activeSession = {
    sessionId: data.sessionId,
    type,
    durationMinutes,
    startedAt: Date.now(),
    ...(tags ? { tags } : {}),
  };
  saveConfig(config);

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`Started ${type} session (${durationMinutes}min)`);
    if (currentTask) console.log(`Task: ${currentTask}`);
    if (tags) console.log(`Tags: ${tags.join(", ")}`);
    console.log(`Session: ${data.sessionId}`);
  }
}

async function cmdTask(args) {
  const subCmd = args[0];
  if (subCmd !== "set" || !args[1]) {
    console.error("Usage: agent-pomodoro task set \"description\"");
    process.exit(1);
  }

  const currentTask = args.slice(1).filter((a) => a !== "--json").join(" ");
  const data = await apiPost("/api/sessions/task", { currentTask });

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(`Task set: ${currentTask}`);
    console.log(`Session: ${data.sessionId}`);
  }
}

async function cmdStop(args) {
  const config = loadConfig();
  const active = config.activeSession;

  if (!active) {
    console.error("No active session. Start one with: agent-pomodoro start");
    process.exit(1);
  }

  const notesIdx = args.indexOf("--notes");
  const notes = notesIdx >= 0 ? args[notesIdx + 1] : undefined;

  const tagsIdx = args.indexOf("--tags");
  const tagsArg = tagsIdx >= 0 ? args[tagsIdx + 1] : undefined;
  const tags = tagsArg
    ? tagsArg.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

  await apiPost("/api/sessions/complete", {
    sessionId: active.sessionId,
    notes,
    tags,
  });

  const elapsed = Math.round((Date.now() - active.startedAt) / 60000);
  delete config.activeSession;
  saveConfig(config);

  if (args.includes("--json")) {
    console.log(JSON.stringify({ ok: true, type: active.type, elapsed }));
  } else {
    console.log(`Completed ${active.type} session (${elapsed}min elapsed)`);
  }
}

async function cmdInterrupt(args) {
  const config = loadConfig();
  const active = config.activeSession;

  if (!active) {
    console.error("No active session to interrupt.");
    process.exit(1);
  }

  const reasonIdx = args.indexOf("--reason");
  const reason = reasonIdx >= 0 ? args[reasonIdx + 1] : undefined;

  const body = { sessionId: active.sessionId };
  if (reason) body.reason = reason;

  await apiPost("/api/sessions/interrupt", body);

  delete config.activeSession;
  saveConfig(config);

  if (args.includes("--json")) {
    console.log(JSON.stringify({ ok: true, interrupted: active.type, ...(reason ? { reason } : {}) }));
  } else {
    console.log(`Interrupted ${active.type} session.${reason ? ` Reason: ${reason}` : ""}`);
  }
}

async function cmdHeartbeat(args) {
  const sourceIdx = args.indexOf("--source");
  const source = sourceIdx >= 0 ? args[sourceIdx + 1] : "apom-cli";
  const daemon = args.includes("--daemon");

  const sendHeartbeat = async () => {
    try {
      await apiPost("/api/activity/heartbeat", { source });
    } catch {
      // fire-and-forget — silent on failure
    }
  };

  if (daemon) {
    // Daemon mode: send heartbeat every 30 seconds
    await sendHeartbeat();
    setInterval(sendHeartbeat, 30_000);
    // Keep process alive
    process.on("SIGINT", () => process.exit(0));
    process.on("SIGTERM", () => process.exit(0));
  } else {
    await sendHeartbeat();
  }
}

async function cmdAccountability(args) {
  const daysIdx = args.indexOf("--days");
  const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1]) : 7;
  const showShame = args.includes("--shame");

  const data = await apiCall(`/api/activity/accountability?days=${days}`);

  if (args.includes("--json")) {
    if (showShame) {
      const shame = await apiCall(`/api/activity/shame?days=${days}`);
      console.log(JSON.stringify({ ...data, shame }, null, 2));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
    return;
  }

  console.log(`Accountability Score: ${data.score}%`);
  console.log(`Verdict: ${data.verdict}`);
  console.log(`Period: ${data.period || days + "d"}`);
  console.log(`Protected windows: ${data.protectedWindows ?? 0}`);
  console.log(`Unprotected windows: ${data.unprotectedWindows ?? 0}`);

  if (data.totalWindows !== undefined) {
    console.log(`Total windows: ${data.totalWindows}`);
  }

  if (showShame) {
    const shame = await apiCall(`/api/activity/shame?days=${days}`);
    if (shame.shameWindows && shame.shameWindows.length > 0) {
      console.log(`\nShame log (${shame.shameWindows.length} unprotected windows):`);
      for (const w of shame.shameWindows) {
        const start = new Date(w.startedAt).toLocaleString("pl-PL");
        const end = new Date(w.endedAt).toLocaleString("pl-PL");
        console.log(`  ${start} — ${end} (${w.durationMinutes}min)`);
      }
    } else {
      console.log("\nNo shame windows. Good job.");
    }
  }
}

async function cmdNudges(args) {
  const data = await apiCall("/api/nudges");

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    if (data.nudges.length === 0) {
      console.log("No pending nudges. You're good.");
    } else {
      for (const n of data.nudges) {
        const time = new Date(n.createdAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
        console.log(`[${time}] (${n.type}) ${n.message}`);
      }
    }
  }
}

async function cmdDailySummary(args) {
  const dateIdx = args.indexOf("--date");
  const dateParam = dateIdx >= 0 ? args[dateIdx + 1] : undefined;
  const path = dateParam
    ? `/api/daily-summary?date=${dateParam}`
    : "/api/daily-summary";

  const outputIdx = args.indexOf("--output");
  const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;
  const obsidianMode = args.includes("--obsidian");

  const data = await apiCall(path);

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const s = data.summary;
  const lines = [];

  // YAML frontmatter
  lines.push("---");
  lines.push(`date: ${data.date}`);
  lines.push(`pomodoros: ${s.completedSessions}`);
  lines.push(`focus_hours: ${s.totalFocusHours}`);
  lines.push("---");
  lines.push("");

  // Header
  if (obsidianMode) {
    lines.push("## Pomodoro");
  } else {
    lines.push(`# Daily Summary: ${data.date}`);
  }
  lines.push("");

  // Stats
  lines.push("### Stats");
  lines.push(`- Sessions: ${s.completedSessions}/${s.totalSessions} completed (${s.completionRate}%)`);
  if (s.interruptedSessions > 0) {
    lines.push(`- Interrupted: ${s.interruptedSessions}`);
  }
  lines.push(`- Focus time: ${s.totalFocusHours}h (${s.totalFocusMinutes}min)`);
  if (s.accountabilityScore !== undefined) {
    lines.push(`- Accountability: ${s.accountabilityScore}% (${s.accountabilityVerdict})`);
  }

  // Sessions table
  if (data.sessions.length > 0) {
    lines.push("");
    lines.push("### Sessions");
    lines.push("");
    lines.push("| Time | Duration | Type | Status | Tags | Notes |");
    lines.push("|------|----------|------|--------|------|-------|");
    for (const sess of data.sessions) {
      const time = new Date(sess.startedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      const status = sess.completed ? "done" : sess.interrupted ? "interrupted" : "active";
      const tags = sess.tags.length ? sess.tags.join(", ") : "-";
      const notes = sess.currentTask || sess.notes || "-";
      lines.push(`| ${time} | ${sess.durationMinutes}min | ${sess.type} | ${status} | ${tags} | ${notes} |`);
    }
  }

  // Tag breakdown
  const tagEntries = Object.entries(s.tags);
  if (tagEntries.length > 0) {
    lines.push("");
    lines.push("### Tags");
    for (const [tag, count] of tagEntries.sort((a, b) => b[1] - a[1])) {
      lines.push(`- **${tag}**: ${count}`);
    }
  }

  const output = lines.join("\n") + "\n";

  if (outputPath) {
    try {
      mkdirSync(dirname(outputPath), { recursive: true });
      appendFileSync(outputPath, output, "utf-8");
      console.log(`Written to ${outputPath}`);
    } catch (e) {
      console.error(`Failed to write to ${outputPath}: ${e.message}`);
      process.exit(1);
    }
  } else {
    process.stdout.write(output);
  }
}

async function cmdGoals(args) {
  const subCmd = args[0];

  if (subCmd === "set") {
    const body = {};
    const dailyIdx = args.indexOf("--daily");
    if (dailyIdx >= 0) {
      const v = parseInt(args[dailyIdx + 1]);
      if (Number.isFinite(v)) body.dailyPomodoros = v;
    }
    const weeklyIdx = args.indexOf("--weekly");
    if (weeklyIdx >= 0) {
      const v = parseInt(args[weeklyIdx + 1]);
      if (Number.isFinite(v)) body.weeklyFocusHours = v;
    }

    if (body.dailyPomodoros === undefined && body.weeklyFocusHours === undefined) {
      console.error("Usage: agent-pomodoro goals set --daily 8 --weekly 25");
      process.exit(1);
    }

    await apiPost("/api/goals", body);

    if (args.includes("--json")) {
      console.log(JSON.stringify({ ok: true, ...body }));
    } else {
      if (body.dailyPomodoros) console.log(`Daily target: ${body.dailyPomodoros} pomodoros`);
      if (body.weeklyFocusHours) console.log(`Weekly target: ${body.weeklyFocusHours}h focus`);
      console.log("Goals updated.");
    }
  } else {
    const data = await apiCall("/api/goals");

    if (args.includes("--json")) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`Goals:`);
      console.log(`  Daily: ${data.progress.todayPomodoros}/${data.goals.dailyPomodoros} pomodoros`);
      console.log(`  Weekly: ${data.progress.weeklyFocusHours}/${data.goals.weeklyFocusHours}h focus`);
    }
  }
}

async function cmdTags(args) {
  const daysArg = args.find((a) => /^\d+d?$/.test(a));
  const days = daysArg ? parseInt(daysArg) : 30;
  const data = await apiCall(`/api/stats/tags?days=${days}`);

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    if (data.tags.length === 0) {
      console.log(`No tags found in the last ${days} days.`);
    } else {
      console.log(`Tag breakdown (${data.period}):\n`);
      for (const t of data.tags) {
        const hours = Math.round((t.totalMinutes / 60) * 10) / 10;
        console.log(`  ${t.tag.padEnd(20)} ${String(t.count).padStart(3)} sessions  ${String(hours).padStart(5)}h`);
      }
    }
  }
}

async function cmdLinkCommits(args) {
  const sessionIdx = args.indexOf("--session");
  let sessionId = sessionIdx >= 0 ? args[sessionIdx + 1] : undefined;
  let sessionStartedAt = null;

  if (!sessionId) {
    // Try active session first
    const activeData = await apiCall("/api/sessions/active");
    if (activeData.session) {
      sessionId = activeData.session._id;
      sessionStartedAt = activeData.session.startedAt;
    } else {
      // Fall back to last completed session
      const sessionsData = await apiCall("/api/sessions?limit=1");
      if (sessionsData.sessions && sessionsData.sessions.length > 0) {
        sessionId = sessionsData.sessions[0]._id;
        sessionStartedAt = sessionsData.sessions[0].startedAt;
      }
    }
  }

  if (!sessionId) {
    console.error("No session found. Start one first or specify --session <id>");
    process.exit(1);
  }

  // If we don't have startedAt yet (user provided --session), fetch it
  if (!sessionStartedAt) {
    const sessionsData = await apiCall("/api/sessions?limit=50");
    const found = sessionsData.sessions?.find((s) => s._id === sessionId);
    if (found) {
      sessionStartedAt = found.startedAt;
    }
  }

  // Build git log command
  const sinceArg = args.indexOf("--since");
  let sinceDate;
  if (sinceArg >= 0) {
    sinceDate = args[sinceArg + 1];
  } else if (sessionStartedAt) {
    sinceDate = new Date(sessionStartedAt).toISOString();
  }

  let gitCmd = "git log --format=%H|%s|%n --numstat";
  if (sinceDate) {
    gitCmd += ` --since="${sinceDate}"`;
  }

  let gitOutput;
  try {
    gitOutput = execSync(gitCmd, { encoding: "utf-8", timeout: 10000 });
  } catch (e) {
    console.error("Failed to run git log. Are you in a git repository?");
    if (e.stderr) console.error(e.stderr);
    process.exit(1);
  }

  if (!gitOutput.trim()) {
    console.log("No commits found in the time window.");
    process.exit(0);
  }

  // Parse git log output: lines alternate between "hash|subject|" and numstat lines
  const commits = [];
  const lines = gitOutput.trim().split("\n");
  let currentCommit = null;

  for (const line of lines) {
    if (line.includes("|")) {
      const parts = line.split("|");
      if (parts[0] && parts[0].length === 40) {
        // Save previous commit
        if (currentCommit) {
          commits.push(currentCommit);
        }
        currentCommit = {
          hash: parts[0],
          message: parts.slice(1, -1).join("|").trim(),
          filesChanged: 0,
        };
        continue;
      }
    }
    // numstat line: "added\tremoved\tfilename"
    if (currentCommit && line.match(/^\d+\t\d+\t/)) {
      currentCommit.filesChanged++;
    }
  }
  // Don't forget last commit
  if (currentCommit) {
    commits.push(currentCommit);
  }

  if (commits.length === 0) {
    console.log("No commits parsed from git log output.");
    process.exit(0);
  }

  // Send to API
  const data = await apiPost("/api/sessions/commits", {
    sessionId,
    commits,
  });

  if (args.includes("--json")) {
    console.log(JSON.stringify({ ok: true, sessionId, linked: data.linked, commits }, null, 2));
  } else {
    console.log(`Linked ${data.linked} commit${data.linked !== 1 ? "s" : ""} to session ${sessionId}`);
    for (const c of commits) {
      console.log(`  ${c.hash.slice(0, 7)} ${c.message} (${c.filesChanged} files)`);
    }
  }
}

async function cmdRhythm(args) {
  const daysArg = args.find((a) => /^\d+d?$/.test(a));
  const days = daysArg ? parseInt(daysArg) : 30;
  const data = await apiCall(`/api/stats/rhythm?days=${days}`);

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(`Focus Rhythm (${data.period}, ${data.totalSessions} sessions)\n`);

  // Best/worst summary
  if (data.bestHour !== null) {
    console.log(`Best hour:  ${String(data.bestHour).padStart(2, "0")}:00 (${data.byHour[data.bestHour].completionRate}% completion, ${data.byHour[data.bestHour].total} sessions)`);
  }
  if (data.worstHour !== null) {
    console.log(`Worst hour: ${String(data.worstHour).padStart(2, "0")}:00 (${data.byHour[data.worstHour].completionRate}% completion, ${data.byHour[data.worstHour].total} sessions)`);
  }
  if (data.bestDayName) {
    console.log(`Best day:   ${data.bestDayName} (${data.byDayOfWeek[data.bestDay].completionRate}% completion)`);
  }
  if (data.worstDayName) {
    console.log(`Worst day:  ${data.worstDayName} (${data.byDayOfWeek[data.worstDay].completionRate}% completion)`);
  }

  // Hour heatmap (6:00-22:00)
  console.log("\nHourly heatmap (6:00-22:00):");
  const maxTotal = Math.max(...data.byHour.filter((_, i) => i >= 6 && i <= 22).map((h) => h.total), 1);
  for (let h = 6; h <= 22; h++) {
    const b = data.byHour[h];
    const barLen = Math.round((b.total / maxTotal) * 20);
    const bar = "\u2588".repeat(barLen) + "\u2591".repeat(20 - barLen);
    const rate = b.total > 0 ? `${b.completionRate}%` : "  -";
    console.log(`  ${String(h).padStart(2, "0")}:00  ${bar}  ${String(b.total).padStart(3)} sessions  ${rate.padStart(4)}`);
  }

  // Day of week breakdown
  console.log("\nDay of week:");
  for (const d of data.byDayOfWeek) {
    const barLen = d.total > 0 ? Math.max(1, Math.round((d.total / maxTotal) * 15)) : 0;
    const bar = "\u2588".repeat(barLen);
    const rate = d.total > 0 ? `${d.completionRate}%` : "-";
    console.log(`  ${d.dayName.padEnd(10)} ${String(d.total).padStart(3)} sessions  ${rate.padStart(4)}  ${bar}`);
  }
}

async function cmdRetro(args) {
  const data = await apiCall("/api/retro");

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const lines = [];

  // Header
  lines.push("# Weekly Retrospective");
  lines.push("");

  // Summary comparison
  const tw = data.thisWeek;
  const pw = data.previousWeek;
  const d = data.deltas;

  lines.push("## This Week vs Previous");
  lines.push("");
  lines.push("| Metric | This week | Previous | Delta |");
  lines.push("|--------|-----------|----------|-------|");
  lines.push(`| Sessions | ${tw.completed}/${tw.sessions} | ${pw.completed}/${pw.sessions} | ${d.sessions >= 0 ? "+" : ""}${d.sessions} |`);
  lines.push(`| Completion | ${tw.completionRate}% | ${pw.completionRate}% | ${d.completionRate >= 0 ? "+" : ""}${d.completionRate}pp |`);
  lines.push(`| Focus | ${tw.focusHours}h | ${pw.focusHours}h | ${d.focusHours >= 0 ? "+" : ""}${d.focusHours}h |`);
  lines.push(`| Avg/day | ${tw.avgSessionsPerDay} | ${pw.avgSessionsPerDay} | - |`);
  if (tw.interrupted > 0) {
    lines.push(`| Interrupted | ${tw.interrupted} | ${pw.interrupted} | ${tw.interrupted - pw.interrupted >= 0 ? "+" : ""}${tw.interrupted - pw.interrupted} |`);
  }
  lines.push("");

  // Per-day table
  lines.push("## Daily Breakdown");
  lines.push("");
  lines.push("| Date | Done | Interrupted | Focus | Tags |");
  lines.push("|------|------|-------------|-------|------|");
  for (const day of data.perDay) {
    const tags = day.tags.length > 0 ? day.tags.join(", ") : "-";
    const focusH = Math.round((day.focusMinutes / 60) * 10) / 10;
    lines.push(`| ${day.date} | ${day.completed}/${day.sessions} | ${day.interrupted} | ${focusH}h | ${tags} |`);
  }
  lines.push("");

  // Top tags
  if (data.topTags.length > 0) {
    lines.push("## Top Tags");
    lines.push("");
    for (const t of data.topTags) {
      lines.push(`- **${t.tag}**: ${t.count} sessions`);
    }
    lines.push("");
  }

  // Trend indicators
  lines.push("## Trends");
  lines.push("");
  if (d.completionRate > 5) {
    lines.push(`- Completion rate IMPROVING (+${d.completionRate}pp)`);
  } else if (d.completionRate < -5) {
    lines.push(`- Completion rate DECLINING (${d.completionRate}pp)`);
  } else {
    lines.push("- Completion rate STABLE");
  }
  if (d.focusHours > 0) {
    lines.push(`- Focus time UP (+${d.focusHours}h)`);
  } else if (d.focusHours < 0) {
    lines.push(`- Focus time DOWN (${d.focusHours}h)`);
  }

  console.log(lines.join("\n"));
}

async function cmdDebt(args) {
  const data = await apiCall("/api/stats/debt");

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(`Daily target: ${data.dailyTarget} pomodoros`);
  console.log(`Today: ${data.todayCompleted}/${data.todayTarget} (${data.dailyTarget} base${data.debtCarried > 0 ? ` + ${data.debtCarried} debt` : ""})`);
  if (data.todayRemaining > 0) {
    console.log(`Remaining today: ${data.todayRemaining}`);
  } else {
    console.log("Today's target met!");
  }

  if (data.debtCarried > 0) {
    console.log(`\nDebt carried from past 6 days: ${data.debtCarried} pomodoros`);
  }

  console.log("\nWeek history:");
  for (const day of data.weekHistory) {
    const marker = day.delta >= 0 ? "+" : "";
    const status = day.delta >= 0 ? "OK" : "DEFICIT";
    console.log(`  ${day.date}  ${day.completed}/${day.target}  (${marker}${day.delta})  ${status}`);
  }
}

async function cmdTrends(args) {
  const data = await apiCall("/api/stats/trends");

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const cur = data.current7d;
  const prev = data.previous7d;
  const d = data.deltas;

  function trend(delta, suffix = "") {
    if (delta > 0) return `IMPROVING (+${delta}${suffix})`;
    if (delta < 0) return `DECLINING (${delta}${suffix})`;
    return "STABLE";
  }

  console.log("7-Day Trends (current vs previous)\n");
  console.log(`Completion:   ${prev.completionRate}% -> ${cur.completionRate}%  ${trend(d.completionRate, "pp")}`);
  console.log(`Sessions/day: ${prev.avgSessionsPerDay} -> ${cur.avgSessionsPerDay}  ${trend(d.avgSessionsPerDay)}`);
  console.log(`Focus hours:  ${prev.totalFocusHours}h -> ${cur.totalFocusHours}h  ${trend(d.totalFocusHours, "h")}`);
  console.log(`Total:        ${prev.totalSessions} -> ${cur.totalSessions} sessions  ${trend(d.totalSessions)}`);

  if (data.regression) {
    console.log("\n*** REGRESSION DETECTED ***");
    console.log("Performance has significantly declined compared to previous week.");
  }
}

function cmdConfig(args) {
  const subCmd = args[0];

  if (subCmd === "set-key") {
    const key = args[1];
    if (!key) {
      console.error("Usage: agent-pomodoro config set-key <api-key>");
      process.exit(1);
    }
    const config = loadConfig();
    config.apiKey = key;
    saveConfig(config);
    console.log(`API key saved to ${CONFIG_PATH}`);
  } else if (subCmd === "set-url") {
    const url = args[1];
    if (!url) {
      console.error("Usage: agent-pomodoro config set-url <convex-site-url>");
      process.exit(1);
    }
    const config = loadConfig();
    config.url = url;
    saveConfig(config);
    console.log(`URL saved to ${CONFIG_PATH}`);
  } else if (subCmd === "show") {
    const config = loadConfig();
    const apiKey = getApiKey();
    console.log(`Config: ${CONFIG_PATH}`);
    console.log(`URL: ${getBaseUrl()}`);
    console.log(`API Key: ${apiKey ? apiKey.slice(0, 12) + "..." : "(not set)"}`);
  } else {
    console.log("Usage:");
    console.log("  agent-pomodoro config set-key <api-key>  Set API key");
    console.log("  agent-pomodoro config set-url <url>      Set Convex site URL");
    console.log("  agent-pomodoro config show               Show current config");
  }
}

function cmdHelpLlm() {
  const schema = {
    name: "agent-pomodoro",
    version: "0.6.0",
    description: "CLI for AI agents to query and control Agent Pomodoro focus sessions",
    base_url: getBaseUrl(),
    auth: {
      type: "bearer",
      header: "Authorization: Bearer <apom_api_key>",
      setup: "agent-pomodoro config set-key <key>",
      env_var: "APOM_API_KEY",
    },
    commands: [
      {
        name: "me",
        description: "Show authenticated user ID and API key ID. Use instead of activeUserId.",
        usage: "agent-pomodoro me [--json]",
        endpoint: "GET /api/me",
        response_example: { userId: "user_abc123", keyId: "k1234567890" },
      },
      {
        name: "status",
        description: "Quick summary: today's pomodoros, week stats, streak, last session",
        usage: "agent-pomodoro status [--json]",
        endpoint: "GET /api/status",
        response_example: {
          status: "Today: 3 pomodoros completed\nWeek: 12/15 sessions (80% completion), 5.0h focus\nStreak: 3 days\nLast session: 1.2h ago",
        },
      },
      {
        name: "stats",
        description: "Detailed statistics for a period",
        usage: "agent-pomodoro stats [days] [--json]",
        endpoint: "GET /api/stats?days=N",
        parameters: { days: { type: "integer", default: 7, max: 3650 } },
        response_example: {
          period: "7d",
          totalWorkSessions: 15,
          completedSessions: 12,
          interruptedSessions: 3,
          completionRate: 80,
          totalFocusMinutes: 300,
          totalFocusHours: 5.0,
          currentStreak: 3,
          lastSessionAt: 1710500000000,
          hoursSinceLastSession: 1.2,
          avgSessionsPerDay: 2.1,
        },
      },
      {
        name: "sessions today",
        description: "List today's pomodoro sessions",
        usage: "agent-pomodoro sessions today [--json]",
        endpoint: "GET /api/sessions/today",
      },
      {
        name: "sessions",
        description: "List recent sessions",
        usage: "agent-pomodoro sessions [limit] [--json]",
        endpoint: "GET /api/sessions?limit=N",
        parameters: { limit: { type: "integer", default: 20, max: 200 } },
      },
      {
        name: "active",
        description: "Show currently active (running) session with elapsed/remaining time",
        usage: "agent-pomodoro active [--json]",
        endpoint: "GET /api/sessions/active",
        response_example: {
          session: { _id: "abc123", type: "work", durationMinutes: 25, startedAt: 1710500000000, completed: false, interrupted: false },
        },
      },
      {
        name: "start",
        description: "Start a new pomodoro session (creates it on server, tracks locally). Idempotent: returns existing session if same type is already active. Returns 409 if different type is active.",
        usage: "agent-pomodoro start [work|break|longBreak] [minutes] [--task \"description\"] [--tags \"a,b\"] [--json]",
        endpoint: "POST /api/sessions/start",
        parameters: {
          type: { type: "string", default: "work", enum: ["work", "break", "longBreak"] },
          durationMinutes: { type: "integer", default: 25 },
          currentTask: { type: "string", optional: true, description: "What the user is working on (max 200 chars)" },
          tags: { type: "array", items: "string", optional: true, description: "Pre-tag session at start (e.g. code, deep-work)" },
        },
        response_example: { sessionId: "abc123", type: "work", durationMinutes: 25, currentTask: "building feature X", tags: ["code"] },
      },
      {
        name: "task set",
        description: "Set or update the current task description on the active session",
        usage: "agent-pomodoro task set \"description\" [--json]",
        endpoint: "POST /api/sessions/task",
        parameters: {
          currentTask: { type: "string", required: true, description: "Task description (max 200 chars)" },
        },
        response_example: { ok: true, sessionId: "abc123", currentTask: "building feature X" },
      },
      {
        name: "stop",
        description: "Complete the active session with optional notes and tags",
        usage: "agent-pomodoro stop [--notes 'text'] [--tags 'code,deep-work'] [--json]",
        endpoint: "POST /api/sessions/complete",
      },
      {
        name: "interrupt",
        description: "Interrupt (cancel) the active session with optional reason",
        usage: "agent-pomodoro interrupt [--reason \"...\"] [--json]",
        endpoint: "POST /api/sessions/interrupt",
        parameters: {
          reason: { type: "string", optional: true, description: "Why the session was interrupted (distraction, emergency, meeting, wrong task, other)" },
        },
      },
      {
        name: "goals",
        description: "Show current goals and progress toward daily pomodoro and weekly focus hour targets",
        usage: "agent-pomodoro goals [--json]",
        endpoint: "GET /api/goals",
        response_example: {
          goals: { dailyPomodoros: 6, weeklyFocusHours: 20 },
          progress: { todayPomodoros: 3, weeklyFocusHours: 8.5 },
        },
      },
      {
        name: "goals set",
        description: "Set daily pomodoro and/or weekly focus hour targets",
        usage: "agent-pomodoro goals set --daily 8 --weekly 25 [--json]",
        endpoint: "POST /api/goals",
        parameters: {
          dailyPomodoros: { type: "integer", optional: true, description: "Daily pomodoro target (1-50)" },
          weeklyFocusHours: { type: "integer", optional: true, description: "Weekly focus hours target (1-100)" },
        },
      },
      {
        name: "heartbeat",
        description: "Send activity heartbeat to track work presence. Silent on success.",
        usage: "agent-pomodoro heartbeat [--daemon] [--source <name>]",
        endpoint: "POST /api/activity/heartbeat",
        parameters: {
          source: { type: "string", default: "apom-cli", description: "Heartbeat source identifier" },
          daemon: { type: "boolean", default: false, description: "Run in loop, sending every 30s" },
        },
      },
      {
        name: "accountability",
        description: "Get accountability score — how much work time was protected by pomodoros",
        usage: "agent-pomodoro accountability [--days N] [--shame] [--json]",
        endpoint: "GET /api/activity/accountability",
        parameters: {
          days: { type: "integer", default: 7, max: 90 },
          shame: { type: "boolean", default: false, description: "Include shame log of unprotected windows" },
        },
        response_example: {
          score: 73,
          verdict: "inconsistent",
          protectedWindows: 61,
          unprotectedWindows: 23,
          totalWindows: 84,
          period: "7d",
        },
      },
      {
        name: "nudges",
        description: "Fetch pending server-side nudges. Nudges are generated by cron every 30 minutes during work hours (9-18). Types: idle_warning, no_session_today. Fetching marks them as delivered.",
        usage: "agent-pomodoro nudges [--json]",
        endpoint: "GET /api/nudges",
        response_example: {
          nudges: [
            { type: "idle_warning", message: "No pomodoro for 150 minutes. Get back to work.", createdAt: 1710500000000 },
          ],
        },
      },
      {
        name: "daily-summary",
        description: "Markdown-formatted daily summary with YAML frontmatter, sessions table, focus time, tags, accountability. Suitable for Obsidian daily notes.",
        usage: "agent-pomodoro daily-summary [--date YYYY-MM-DD] [--obsidian] [--output /path/note.md] [--json]",
        endpoint: "GET /api/daily-summary?date=YYYY-MM-DD",
        parameters: {
          date: { type: "string", format: "YYYY-MM-DD", default: "today", description: "Date to summarize" },
          obsidian: { type: "boolean", default: false, description: "Format for Obsidian daily note (## Pomodoro header instead of # Daily Summary)" },
          output: { type: "string", optional: true, description: "File path to append output to (creates dirs if needed)" },
        },
        response_example: {
          date: "2025-01-15",
          sessions: [],
          summary: {
            totalSessions: 5,
            completedSessions: 4,
            interruptedSessions: 1,
            totalFocusMinutes: 100,
            totalFocusHours: 1.7,
            completionRate: 80,
            tags: { code: 3, writing: 1 },
            accountabilityScore: 85,
            accountabilityVerdict: "disciplined",
          },
        },
      },
      {
        name: "link-commits",
        description: "Link git commits to a pomodoro session. Auto-detects commits from session time window using local git log.",
        usage: "agent-pomodoro link-commits [--session <id>] [--since <ISO-date>] [--json]",
        endpoint: "POST /api/sessions/commits",
        parameters: {
          session: { type: "string", optional: true, description: "Session ID (defaults to active or last completed)" },
          since: { type: "string", optional: true, description: "Override git log --since (ISO date)" },
        },
        response_example: { ok: true, linked: 3 },
      },
      {
        name: "tags",
        description: "Tag breakdown: count and total focus time per tag for completed work sessions",
        usage: "agent-pomodoro tags [days] [--json]",
        endpoint: "GET /api/stats/tags?days=N",
        parameters: { days: { type: "integer", default: 30, max: 365 } },
        response_example: {
          tags: [
            { tag: "code", count: 12, totalMinutes: 300 },
            { tag: "writing", count: 5, totalMinutes: 125 },
          ],
          period: "30d",
        },
      },
      {
        name: "rhythm",
        description: "Focus rhythm analysis: sessions bucketed by hour-of-day and day-of-week with completion rates. Shows best/worst hours and days, text heatmap.",
        usage: "agent-pomodoro rhythm [days] [--json]",
        endpoint: "GET /api/stats/rhythm?days=N",
        parameters: { days: { type: "integer", default: 30, max: 365 } },
        response_example: {
          period: "30d",
          totalSessions: 45,
          byHour: [{ hour: 9, total: 8, completed: 7, interrupted: 1, completionRate: 88 }],
          byDayOfWeek: [{ day: 1, dayName: "Monday", total: 10, completed: 8, interrupted: 2, completionRate: 80 }],
          bestHour: 9,
          worstHour: 16,
          bestDay: 1,
          worstDay: 5,
          bestDayName: "Monday",
          worstDayName: "Friday",
        },
      },
      {
        name: "retro",
        description: "Weekly retrospective: per-day breakdown, tag summary, comparison with previous week. Markdown output suitable for Obsidian.",
        usage: "agent-pomodoro retro [--json]",
        endpoint: "GET /api/retro",
        response_example: {
          thisWeek: { sessions: 20, completed: 16, interrupted: 4, completionRate: 80, focusMinutes: 400, focusHours: 6.7, avgSessionsPerDay: 2.9 },
          previousWeek: { sessions: 15, completed: 12, interrupted: 3, completionRate: 80, focusMinutes: 300, focusHours: 5.0, avgSessionsPerDay: 2.1 },
          deltas: { sessions: 5, completed: 4, completionRate: 0, focusMinutes: 100, focusHours: 1.7 },
          perDay: [{ date: "2026-03-10", sessions: 3, completed: 2, interrupted: 1, focusMinutes: 50, tags: ["code"] }],
          topTags: [{ tag: "code", count: 10 }],
        },
      },
      {
        name: "debt",
        description: "Pomodoro debt tracker: daily target vs completed, accumulated deficit from past days carried forward. Today's effective target = base + debt (capped at 2x).",
        usage: "agent-pomodoro debt [--json]",
        endpoint: "GET /api/stats/debt",
        response_example: {
          dailyTarget: 6,
          todayCompleted: 3,
          todayTarget: 9,
          debtCarried: 3,
          todayRemaining: 6,
          weekHistory: [{ date: "2026-03-10", target: 6, completed: 4, delta: -2 }],
        },
      },
      {
        name: "trends",
        description: "7-day trend comparison: current week vs previous week. Detects regression (>10pp completion drop or >30% session drop).",
        usage: "agent-pomodoro trends [--json]",
        endpoint: "GET /api/stats/trends",
        response_example: {
          current7d: { completionRate: 61, avgSessionsPerDay: 3.1, totalFocusHours: 6.5, totalSessions: 22, completedSessions: 13, accountabilityScore: 61 },
          previous7d: { completionRate: 82, avgSessionsPerDay: 5.2, totalFocusHours: 10.8, totalSessions: 36, completedSessions: 30, accountabilityScore: 82 },
          deltas: { completionRate: -21, avgSessionsPerDay: -2.1, totalFocusHours: -4.3, totalSessions: -14 },
          regression: true,
        },
      },
      {
        name: "config",
        description: "Manage CLI configuration",
        subcommands: [
          { name: "set-key", usage: "agent-pomodoro config set-key <api-key>" },
          { name: "set-url", usage: "agent-pomodoro config set-url <convex-site-url>" },
          { name: "show", usage: "agent-pomodoro config show" },
        ],
      },
    ],
    tips: [
      "Use --json flag for machine-readable output on any command",
      "Set APOM_API_KEY env var instead of config file for CI/agents",
      "Default period for stats is 7 days",
      "Start + stop workflow: agent-pomodoro start work 25, then agent-pomodoro stop --notes 'done'",
      "Active session ID is stored in ~/.agent-pomodoro.json",
      "Check nudges regularly — server generates them every 30min during work hours",
      "Use daily-summary for Obsidian: agent-pomodoro daily-summary --obsidian --output ~/notes/daily.md",
      "Pre-tag sessions at start: agent-pomodoro start work --tags 'code,deep-work'",
      "accountability --days 7 now includes dailyScores with per-day score breakdown",
      "rhythm: discover your best focus hours and days — use to plan deep work windows",
      "retro: weekly retrospective with Markdown output — pipe to Obsidian notes",
      "debt: pomodoro debt carries forward missed targets (capped at 2x daily target)",
      "trends: detects regression when completion drops >10pp or sessions/day drops >30%",
    ],
  };

  console.log(JSON.stringify(schema, null, 2));
}

function cmdHelp() {
  console.log(`agent-pomodoro — Agent Pomodoro CLI

Usage:
  agent-pomodoro me                  Show authenticated user info
  agent-pomodoro status              Quick summary (today, week, streak)
  agent-pomodoro stats [days]        Detailed stats (default: 7 days)
  agent-pomodoro sessions today      Today's sessions
  agent-pomodoro sessions [limit]    Recent sessions (default: 20)
  agent-pomodoro active              Show currently active session
  agent-pomodoro start [type] [min]  Start a session (default: work 25)
  agent-pomodoro start work 25 --task "desc"  Start with task description
  agent-pomodoro start work --tags "code,deep-work"  Start with tags
  agent-pomodoro task set "desc"     Set task on active session
  agent-pomodoro stop [--notes ...]  Complete active session
  agent-pomodoro interrupt [--reason "..."]  Interrupt active session
  agent-pomodoro goals               Show goals + progress
  agent-pomodoro goals set --daily 8 --weekly 25  Set goals
  agent-pomodoro heartbeat           Send activity heartbeat
  agent-pomodoro heartbeat --daemon  Heartbeat every 30s (background)
  agent-pomodoro accountability      Accountability score (default: 7d)
  agent-pomodoro accountability --shame  Include shame log
  agent-pomodoro nudges              Fetch pending server nudges
  agent-pomodoro link-commits        Link git commits to active/last session
  agent-pomodoro link-commits --session <id>  Link to specific session
  agent-pomodoro tags [days]         Tag breakdown (default: 30 days)
  agent-pomodoro rhythm [days]       Focus rhythm analysis (default: 30d)
  agent-pomodoro retro               Weekly retrospective (Markdown)
  agent-pomodoro debt                Pomodoro debt (target vs completed)
  agent-pomodoro trends              7-day trend comparison + regression
  agent-pomodoro daily-summary       Today's summary (Markdown)
  agent-pomodoro daily-summary --date 2025-01-15  Specific date
  agent-pomodoro daily-summary --obsidian  Obsidian daily note format
  agent-pomodoro daily-summary --output /path/note.md  Append to file
  agent-pomodoro config set-key <k>  Set API key
  agent-pomodoro config set-url <u>  Set server URL
  agent-pomodoro config show         Show config
  agent-pomodoro --help-llm          JSON schema for AI agents
  agent-pomodoro --help              This help

Flags:
  --json                Machine-readable JSON output
  --task "text"         Task description for start command
  --tags "a,b,c"        Tags for start/stop command (comma-separated)
  --notes "text"        Notes for stop command
  --source "name"       Heartbeat source (default: apom-cli)
  --days N              Period for accountability (default: 7)
  --shame               Include shame log in accountability
  --reason "text"       Interruption reason (for interrupt command)
  --daily N             Daily pomodoro target (for goals set)
  --weekly N            Weekly focus hours target (for goals set)
  --daemon              Run heartbeat in loop (every 30s)
  --obsidian            Format daily-summary for Obsidian daily note
  --output <path>       Write daily-summary to file (append mode)
  --date YYYY-MM-DD     Date for daily-summary (default: today)

Env vars:
  APOM_API_KEY    API key (overrides config file)
  APOM_URL        Server URL (overrides config file)

Config: ~/.agent-pomodoro.json`);
}

// ── Main ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === "--help" || cmd === "-h") {
  cmdHelp();
} else if (cmd === "--help-llm") {
  cmdHelpLlm();
} else if (cmd === "me") {
  await cmdMe(args.slice(1));
} else if (cmd === "status") {
  await cmdStatus(args.slice(1));
} else if (cmd === "stats") {
  await cmdStats(args.slice(1));
} else if (cmd === "sessions") {
  await cmdSessions(args.slice(1));
} else if (cmd === "active") {
  await cmdActive(args.slice(1));
} else if (cmd === "start") {
  await cmdStart(args.slice(1));
} else if (cmd === "task") {
  await cmdTask(args.slice(1));
} else if (cmd === "stop" || cmd === "complete") {
  await cmdStop(args.slice(1));
} else if (cmd === "interrupt" || cmd === "cancel") {
  await cmdInterrupt(args.slice(1));
} else if (cmd === "heartbeat") {
  await cmdHeartbeat(args.slice(1));
} else if (cmd === "accountability") {
  await cmdAccountability(args.slice(1));
} else if (cmd === "nudges") {
  await cmdNudges(args.slice(1));
} else if (cmd === "daily-summary") {
  await cmdDailySummary(args.slice(1));
} else if (cmd === "tags") {
  await cmdTags(args.slice(1));
} else if (cmd === "goals") {
  await cmdGoals(args.slice(1));
} else if (cmd === "link-commits") {
  await cmdLinkCommits(args.slice(1));
} else if (cmd === "rhythm") {
  await cmdRhythm(args.slice(1));
} else if (cmd === "retro") {
  await cmdRetro(args.slice(1));
} else if (cmd === "debt") {
  await cmdDebt(args.slice(1));
} else if (cmd === "trends") {
  await cmdTrends(args.slice(1));
} else if (cmd === "config") {
  cmdConfig(args.slice(1));
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error("Run: agent-pomodoro --help");
  process.exit(1);
}
