# Working language — conversation vs. artifacts

Two languages, two scopes. Never mix them up.

## The rule

**1. Conversation language — Claude ↔ user, inside the session.**
Talk to the user in the language they use. When the user **explicitly asks** for a language
("nói tiếng Việt với tôi", "trả lời bằng tiếng Việt", "reply in English from now on"), that is a
**durable preference**, not a one-off: persist it to Claude's memory as the user's default
conversation language and honor it in every later session — don't re-ask. Until they ask for one,
mirror whatever language they are currently writing in.

**2. Artifact language — anything that leaves the session.** Default **English**, independent of
the conversation language. This covers everything a person other than the requester reads:

- Ticket titles, descriptions and comments → `tlm.tickets.commentLanguage` (default `en`).
- Text, labels and captions on **images/screenshots posted to a tracker or chat**.
- PR titles and bodies, branch names, commit messages.
- Release notes / changelog / Slack release posts → English always.
- Code — identifiers, comments, docstrings — and any **committed file content** (config, docs, README).
- Deployment-checklist output and anything else posted to a shared channel.

## Why

The conversation is between Claude and **one** developer — their language makes the exchange faster
and clearer, so honor it. An artifact is read by the **whole team**, external stakeholders and future
contributors who may not share that language. A Vietnamese ticket comment, commit message or code
comment strands every English reader of the shared record and can't be un-written after it ships.
Keeping the conversation local and the record English (or the team's declared `commentLanguage`) is
what lets a Vietnamese-speaking dev work fast *and* leave a legible trail.

## Persisting the preference (memory, not project config)

The conversation language is a **per-user** preference, so it lives in **Claude's memory**, never in
the project's `tlm` config — a project setting would wrongly force one person's language on the whole
team. On an explicit request, write or update a `user`-type memory ("default conversation language =
X") and move on; one request is enough.

The **artifact** language is the opposite: it is a team decision and lives in project config
(`tlm.tickets.commentLanguage`), so it is the same for everyone regardless of who typed the request.

## Examples

❌ User writes in Vietnamese, so the ticket comment and commit message go out in Vietnamese.
✅ Reply to the user in Vietnamese; the ticket comment, PR body and commit message are English.

❌ Screenshot annotated with Vietnamese labels attached to a tracker task.
✅ Chat in Vietnamese; the screenshot posted to the task is labelled in English.

❌ `// kiểm tra người dùng đã đăng nhập chưa` left in committed code.
✅ `// verify the user is authenticated` in the code; explain it in Vietnamese in chat if asked.

## Exceptions

- **A non-English team.** `tlm.tickets.commentLanguage` set to a non-English value wins for plan files
  and tracker comments — a deliberate, per-project team decision, still applied uniformly.
- **User-facing product copy** is governed by i18n (`t()`), not this rule — never hardcode display
  strings in any language. See `03-component-patterns.md` and §9 in `07-ai-workflow-integration.md`.
- **Verbatim quotes.** When an artifact must quote the user's original words (a repro step they wrote
  in their language), keep the quote as-is and add an English gloss around it.
