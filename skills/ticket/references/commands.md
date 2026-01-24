# Ticket Command Reference

Complete documentation for all `tk` commands.

## Ticket Creation

```bash
tk create [title] [options]
```

### Options

| Flag | Description |
|------|-------------|
| `-d, --description` | Body content/description |
| `--design` | Design specifications |
| `--acceptance` | Acceptance criteria |
| `-t, --type` | `bug\|feature\|task\|epic\|chore` (default: task) |
| `-p, --priority` | 0-4, where 0=highest (default: 2) |
| `-a, --assignee` | Person responsible (default: git user.name) |
| `--external-ref` | External reference (gh-123, JIRA-456) |
| `--parent` | Parent ticket ID for hierarchy |

### Examples

```bash
# Simple task
tk create "Update docs"

# Bug with priority and description
tk create "Login button unresponsive" -t bug -p 1 -d "Button doesn't respond on mobile Safari"

# Feature under an epic
tk create "Add OAuth support" -t feature --parent abc-123 --acceptance "Users can login via Google"

# Linked to external tracker
tk create "Port fix from upstream" --external-ref gh-456
```

## Status Management

| Command | Effect |
|---------|--------|
| `tk start <id>` | Set status to `in_progress` |
| `tk close <id>` | Set status to `closed` |
| `tk reopen <id>` | Set status back to `open` |
| `tk status <id> <status>` | Set explicit status: `open\|in_progress\|closed` |

## Listing & Filtering

```bash
tk ls                      # All tickets
tk ls --status=open        # Filter by status
tk ls --status=in_progress
tk ls --status=closed

tk ready                   # Open/in_progress with all deps resolved
tk blocked                 # Open/in_progress with unresolved deps
tk closed --limit=N        # Recently closed (default: 20)
```

## Viewing & Editing

```bash
tk show <id>               # Display full ticket (partial ID supported)
tk edit <id>               # Open in $EDITOR
tk add-note <id> [text]    # Append timestamped note
echo "note" | tk add-note <id>  # Pipe note from stdin
```

## Dependencies

```bash
tk dep <id> <dep-id>       # id depends on (is blocked by) dep-id
tk undep <id> <dep-id>     # Remove dependency
tk dep tree <id>           # Show dependency hierarchy
tk dep tree --full <id>    # Full tree (no deduplication)
```

**Dependency direction**: `tk dep A B` means "A is blocked by B" (B must close before A can proceed).

## Linking

```bash
tk link <id1> <id2> [id3...]  # Create symmetric links (related tickets)
tk unlink <id> <target-id>    # Remove link
```

Links are bidirectional relationships for related (not blocking) tickets.

## Querying (JSON)

```bash
tk query                   # Export all tickets as JSON
tk query '.[]'             # Stream tickets
tk query '.[] | select(.priority == 0)'  # Filter critical
tk query '.[] | select(.type == "bug")'  # Filter bugs
tk query '.[] | select(.status == "open") | .title'  # Open titles
```

Requires `jq` installed.

## Migration

```bash
tk migrate-beads           # Import from .beads/issues.jsonl
```

## File Format

Tickets stored as `.tickets/<id>` with markdown + YAML frontmatter:

```yaml
---
title: "Ticket title"
status: open
type: task
priority: 2
assignee: username
dependencies: [dep-id-1, dep-id-2]
links: [related-id]
external_ref: gh-123
parent: epic-id
created: 2024-01-15T10:30:00Z
---

Description and notes here in markdown.

## Notes

- 2024-01-15 10:45: Initial triage complete
```
