---
name: agent-setup
description: Give a project a team of specialist subagents fitted to its real stack — code-reviewer, debugger, security-reviewer, frontend/mobile/backend engineer, database-specialist, test-engineer, devops-engineer — generated into .claude/agents/ when the project has none, and create ONE new specialist when a task needs expertise no existing agent covers. TRIGGER on "setup agents", "tạo agent", "sinh agent theo chuyên môn", "generate subagents", "chưa có agent", from project-setup PHASE 1.7, and whenever a delegated task needs a specialist that does not exist yet.
---

# Agent setup

A project with no `.claude/agents/` makes one context do every job: the code is reviewed by the context
that wrote it, the migration question is answered from frontend context, and a failed debugging
hypothesis stays in the main context forever. A specialist with a short brief — this project's stack,
its own check commands, which rule files to open — fixes that cheaply.

**Detect → Plan → Confirm → Generate → Commit.** The script decides from evidence in the repo; it never
invents a stack the repo does not show.

```bash
RULES=".claude/tlm-plugin"; [ -d "$RULES" ] || RULES="${CLAUDE_PLUGIN_ROOT}"
node "$RULES/skills/agent-setup/agents.mjs" detect          # facts + existing agents; no writes
node "$RULES/skills/agent-setup/agents.mjs" plan            # which specialists, and the evidence for each
node "$RULES/skills/agent-setup/agents.mjs" generate --dry-run
node "$RULES/skills/agent-setup/agents.mjs" generate        # writes .claude/agents/<name>.md
```

Announce each command before running it.

---

## MODE A — the project has no agents (the default case)

1. Run `detect` and `plan`, show the user the plan (name + the evidence line).
2. On their go-ahead run `generate`. It writes **only** when `.claude/agents/` has no agents, and never
   overwrites a file.
3. Read one generated file back to the user and remind them to **commit `.claude/agents/`** — an
   uncommitted agent exists for one person only.

Catalog and the evidence each needs: `code-reviewer`, `debugger` (always) · `security-reviewer` (any
stack) · `frontend-engineer` (Next.js / web SPA) · `mobile-engineer` (Expo / RN) · `backend-engineer`
(NestJS / Express / Next.js API routes) · `database-specialist` (Prisma / TypeORM / Drizzle / SQL) ·
`test-engineer` (a test runner in deps) · `devops-engineer` (Docker / CI / Vercel / EAS).

## MODE B — the project already has agents

`generate` writes nothing and lists the **gaps**. Offer them; the user picks. Then
`generate --only a,b` (exactly these) or `generate --fill-gaps` (all missing ones). Never `--force` over a
team's agent without them asking — it may hold edits made on purpose.

## MODE C — a task needs expertise no agent covers

When you are about to delegate (or the user asks for a specialist) and no existing agent fits — payments,
maps, i18n, realtime, a specific SDK — create one, don't stretch a generic agent:

1. Check `.claude/agents/` (and the plugin's agents) first; reuse a fitting one.
2. `node "$RULES/skills/agent-setup/agents.mjs" new <kebab-name> --role "<what it knows + when to use it>"`
   (`--tools`, `--model` optional; default read-only tools + `Bash`, `sonnet`). Give it `Edit, Write` only
   if it must implement, not just advise.
3. **Fill the TODO sections from the repo** — real folders, real libraries and their config, real
   pitfalls with the failure each prevents. Read the code; do not write domain knowledge from memory.
   An agent with a vague brief is worse than none.
4. Show it to the user, then commit it.

The `description` is what makes Claude delegate to it: say *what* it does and *when* ("Use PROACTIVELY
when …"). A description that could fit any agent never gets picked.

---

## Rules

- Writes only into `<project>/.claude/agents/`. Never into `${CLAUDE_PLUGIN_ROOT}`, never into a sibling repo.
- Agents point at the **rules root** (`.claude/tlm-plugin/` when installed); a project rule still wins
  over a house rule.
- Generated files are a starting point the team owns — edit them freely; re-running never clobbers them.
- The plugin's own `fe-reviewer` agent stays available regardless; the generated `code-reviewer` is the
  project-tuned one.
