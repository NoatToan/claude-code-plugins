# tlm-claude-plugins

A Claude Code plugin that makes Claude **write frontend code in one house style** and **run the work
around it** (tickets, Figma, releases) the same way in every repo.

Stacks: Next.js (Page Router · App Router · API + Prisma) and React Native (Expo · CLI).

## The problems it solves

| Without the plugin | With it |
|---|---|
| Every session invents its own structure: logic in page files, raw `<div>`s, `router.push` everywhere, `as any`, hardcoded hex. | One architecture (`_modules/`, Basic → Base → Common → Domain → Screen), applied automatically. A lint hook checks every edit and Claude fixes it in the same turn. |
| You correct Claude, and next week you make the same correction. | `rule-capture` turns a correction into a written rule, so the fix sticks. |
| Claude guesses the API shape owned by another repo. It looks right and breaks at runtime. | Sibling repos are registered once. Claude opens the real DTO or route there instead of inventing one. |
| UI gets "approximated" from a frame name or a screenshot. | `figma-to-code` reads the real design through the Figma MCP, or **stops**. |
| Every teammate sets up the tracker, statuses and branches differently. | `/project-setup` asks once. The lead hands an **init doc** to the next teammate. |

## What's inside

| Skill | What it does |
|---|---|
| **fe-coding** | The entry point for all frontend work. Detects the stack, applies the shared rules, then that stack's hard rules. |
| **rule-capture** | Correction → classify → persist as a rule → review the diff → PR it upstream. |
| **project-setup** | One form for config, plus the rules copy in your repo and a map of the system's other repos. |
| **figma-to-code** | Figma link → screen. Hard-stops without the design. |
| **ticket-workflow** | Ticket → branch → plan → implement → sync status back. |
| **deployment-checklist** | Release check: tickets, services, migrations. |
| **mobile-release-notes** | Commit range → plain-language notes → Slack draft. |
| **pm-monthly-report** | ClickUp → monthly or sprint PM report (trend, highlights, quality, risks, forecast) → Markdown + Gmail draft. Per-user profiles, one per project. |
| **presale-estimation** | Scope/sitemap/screen spec → detailed WBS estimate (≤1 MD per item, AI %) on the team's estimation template, with parallel estimate agents and an audit round. |
| **spec-driven** | Runs OpenSpec (propose → apply → archive). Offered per ticket, opt-in. |

The workflow skills work with any of these trackers: ClickUp, Jira, Linear, Azure DevOps and GitHub Issues.

Under the skills:

- **`ai/`** is the knowledge base, read on demand: each rule with its reason and wrong/right examples. It covers cross-stack FE rules, per-stack hard rules, and language-agnostic BE rules (N+1, dead code, naming, complex queries).
- **`hooks/`** holds the advisory checks:
  - a config check at session start;
  - a lint pass on every edit;
  - a watcher on the rules copy.

  They run on Node only, on Windows, macOS and Linux.
- **`setup/`** holds the config contract: the `tlm` schema and the setup walkthrough.

## Install

```bash
/plugin marketplace add <git-url-or-local-path>
/plugin install tlm-claude-plugins@tlm-claude-plugins
/plugin marketplace update tlm-claude-plugins   # to update later
```

You need **Node.js** (≥ 20.19 for `spec-driven`) and **git**.

## Setup

**Coding needs no setup.** Open a frontend repo and ask. The workflow skills need a one-time setup per repo:

1. Open Claude Code in the project and run `/project-setup`.
2. Answer the gating questions in one round: which tracker, Figma on or off, Slack on or off. The stack is auto-detected.
3. Fill in the one form it shows. Each row says where to get the value, for example the Figma token or a ticket URL.
4. Connect the OAuth connectors it asks for (ClickUp, GitHub, Slack) at claude.ai → Connectors.

Config is saved to `.claude/settings.local.json`, which is gitignored, and is remembered from then on.

A teammate joining a project that is already set up doesn't answer the questions again:

```bash
# lead — exports the current answers, without secrets
node .claude/tlm-plugin/skills/project-setup/init.mjs template --from-current --out ~/tlm-init.json
```

The teammate saves that file as `.claude/tlm-init.json` and runs `/project-setup init`. They only supply their own tokens.

## What to say to trigger each skill

| Skill | Example prompt |
|---|---|
| **fe-coding** | *"Create a product list screen with search and paging"* · *"Add an edit form for the user profile"* |
| **fe-coding** (cross-repo) | *"Add the vehicle list, the data comes from the fleet API"* |
| **figma-to-code** | *"Build this screen: https://www.figma.com/design/…?node-id=12-345"* |
| **ticket-workflow** | *"Work on TLM-1234"* · *"Start this task: https://app.clickup.com/t/abc123"* |
| **rule-capture** | Correct Claude with a reason: *"Use `router.navigate`, not `push`. `push` duplicates the screen on a double tap."* |
| **project-setup** | `/project-setup` · *"Add repo ~/Projects/api as the backend"* |
| **deployment-checklist** | *"Release check for v1.4.0"* · *"Deployment checklist from develop to main"* |
| **mobile-release-notes** | *"Write release notes from v1.3.0 to HEAD"* |
| **pm-monthly-report** | *"/pm-monthly-report setup"* · *"/pm-monthly-report telemax-portal sprint:30"* · *"Báo cáo tháng 9 cho portal"* |
| **presale-estimation** | *"/presale-estimation"* · *"Estimate WBS từ scope-and-sitemap.md"* |
| **spec-driven** | *"Use OpenSpec for this feature"*. In a repo with `openspec/`, Claude asks per ticket, so you just answer yes or no. |

## Learn more

- [`setup/SETUP-CHECKLIST.md`](setup/SETUP-CHECKLIST.md): configuration, tokens, connectors, troubleshooting.
- [`CLAUDE.md`](CLAUDE.md): how the plugin is built. It covers the four layers, the project's live rules copy and the rule-PR flow, the ecosystem map, and the init doc.
- [`skills/fe-coding/SKILL.md`](skills/fe-coding/SKILL.md): the full set of coding rules.
- [`tests/`](tests/README.md): one generated project per stack, built from one shared spec.
