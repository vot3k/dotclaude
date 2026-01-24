---
name: ticket
description: |
  Git-native CLI task tracking with `tk` command. Use when creating tasks from RFCs/plans,
  managing roadmap features, or tracking work items. Designed for solo developers and AI agents.
  Use when: breaking down plans into tasks, prioritizing features, or checking what to work on next.
---

# Ticket - CLI Task Management

Git-backed issue tracker (`tk`) storing tickets as markdown+YAML in `.tickets/`. Designed for AI agents.

## Quick Reference

```bash
tk ls                    # List all tickets
tk ready                 # What can be worked on now (unblocked)
tk blocked               # What's waiting on dependencies
tk show <id>             # View ticket details (partial IDs work)
tk create "Title" [opts] # Create ticket
tk start <id>            # Mark in_progress
tk close <id>            # Mark completed
```

## Common Workflows

### From RFC/Plan to Tasks
After completing an RFC or plan, break it into actionable tickets:
```bash
tk create "Epic: Feature Name" -t epic -d "Link to RFC"
tk create "Implement X" -t task --parent <epic-id>
tk create "Implement Y" -t task --parent <epic-id>
tk dep <y-id> <x-id>     # Y depends on X
```

### What to Work On
```bash
tk ready                 # Unblocked tasks ready to start
tk ls -p 0-1             # High priority items
tk ls --status=open      # Full backlog
```

### Dependencies
```bash
tk dep <ticket> <blocker>   # ticket depends on blocker
tk dep tree <id>            # visualize dependency chain
tk undep <ticket> <blocker> # remove dependency
```

## Types & Priority

**Types:** `epic` (large initiative) | `feature` | `bug` | `task` (default) | `chore`

**Priority:** 0=critical | 1=high | 2=normal (default) | 3=low | 4=backlog

## Ticket Content Guidelines

Tickets should provide **enough detail to execute** without requiring additional context discovery:

### Required Elements
- **Clear objective**: What needs to be accomplished (not just "fix X")
- **Location hints**: Which files/modules are involved
- **Approach outline**: High-level steps or strategy
- **Acceptance criteria**: How to verify completion (use `--acceptance`)

### Implementation Detail Level
- **Include**: Key logic descriptions, algorithm outlines, interface signatures
- **Include**: Small code snippets for clarity (< 10 lines)
- **Avoid**: Full implementation code (that belongs in the PR)
- **Avoid**: Obvious boilerplate descriptions

### Example: Good Ticket
```bash
tk create "Add rate limiting to /api/users endpoint" -t task \
  -d "Implement sliding window rate limiter (100 req/min per IP).

Files: src/middleware/rateLimit.ts, src/routes/users.ts

Approach:
1. Create RateLimiter class using Redis sorted sets
2. Add middleware to users router
3. Return 429 with Retry-After header when exceeded" \
  --acceptance "100+ requests in 60s from same IP returns 429"
```

## Tips

- Reference the [workflows](reference/workflows.md) for all the ticket workflows
- **Partial IDs work**: `tk show 5c4` matches `nw-5c46`
- **Add notes**: `tk add-note <id> "context update"`
- **Query with jq**: `tk query '.[] | select(.priority == 0)'`
- **External refs**: `--external-ref gh-123` to link GitHub issues
