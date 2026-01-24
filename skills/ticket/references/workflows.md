# Ticket Workflows

Common patterns for solo developer and AI agent workflows.

## RFC/Plan → Tickets

The primary workflow: convert completed RFCs or plans into actionable tickets.

### From RFC to Epic

```bash
# 1. Create epic linking to the RFC
tk create "Auth Redesign" -t epic -d "See RFC: docs/rfcs/auth-redesign.md"

# 2. Break into tasks (use returned epic ID)
tk create "Add OAuth2 provider" -t task --parent <epic-id>
tk create "Update session handling" -t task --parent <epic-id>
tk create "Migrate existing users" -t task --parent <epic-id>

# 3. Set execution order via dependencies
tk dep <session-id> <oauth-id>      # Session after OAuth
tk dep <migrate-id> <session-id>    # Migrate after session
```

### View the Plan

```bash
tk dep tree <epic-id>    # Visualize execution order
tk ready                 # What's unblocked now
```

## Deciding What to Work On

```bash
# Quick check
tk ready                 # Unblocked and ready
tk ls -p 0-1             # High priority items

# More detail
tk blocked               # What's waiting on dependencies
tk ls --status=open      # Full backlog
```

## Epic & Feature Decomposition

### Structure Large Work

```bash
tk create "User Dashboard" -t epic \
  --acceptance "Dashboard live with all widgets"

tk create "Dashboard layout" -t feature --parent <epic-id>
tk create "Activity widget" -t feature --parent <epic-id>
tk create "Stats widget" -t feature --parent <epic-id>

# Set dependencies
tk dep <activity-id> <layout-id>
tk dep <stats-id> <layout-id>
```

### Track Progress

```bash
tk dep tree <epic-id>
tk query '.[] | select(.parent == "<epic-id>")'
```

## Dependency Patterns

### Sequential Work

```bash
# Design → Implement → Test
tk create "Design API" -t task
tk create "Implement API" -t task
tk create "Test API" -t task

tk dep <implement> <design>
tk dep <test> <implement>
```

### Parallel Work with Shared Blocker

```bash
# Multiple features need shared infrastructure
tk create "Set up Redis" -t chore
tk create "Feature A (needs cache)" -t feature
tk create "Feature B (needs cache)" -t feature

tk dep <feature-a> <redis>
tk dep <feature-b> <redis>

# `tk blocked` shows both features
# `tk ready` shows Redis as the unblocking work
```

### Breaking Cycles

If `tk dep tree` shows cycles:
1. Identify the artificial dependency
2. Remove with `tk undep`
3. Use `tk link` for related-but-not-blocking relationships

## Quick Status

```bash
# Counts
tk ready | wc -l
tk blocked | wc -l

# By priority
tk query '.[] | select(.status != "closed") | .priority' | sort | uniq -c
```
