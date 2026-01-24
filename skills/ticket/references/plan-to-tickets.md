# Plan to Tickets Workflow

The complete workflow for converting plans into executable tickets.

## Workflow Overview

```
Plan Mode → Approval → Ticket Decomposition → Execute → Track Status
```

### 1. Planning Phase

When entering plan mode for an implementation task:
- Research codebase thoroughly
- Design the approach
- Identify logical work units
- Write plan to plan file

### 2. Plan Approval & Ticket Decomposition

After plan approval, **always ask**: "Would you like me to break this plan into tickets for tracking?"

If approved, decompose the plan:

```bash
# Create epic from the plan
tk create "Epic: [Feature/Project Name]" -t epic \
  -d "See plan: [plan file path]"

# Create tasks for each logical unit
tk create "[Task 1 title]" -t task --parent <epic-id> \
  -d "[Implementation details]" \
  --acceptance "[How to verify]"

# Set dependencies for execution order
tk dep <task-2-id> <task-1-id>
```

### 3. Execution Phase

For each piece of work:

```bash
# Before starting
tk start <id>           # Mark in_progress

# Do the work...

# After completing
tk close <id>           # Mark completed
```

### 4. Status Tracking

Keep statuses current:
- Only ONE ticket should be `in_progress` at a time (focus)
- Close tickets immediately when work is merged/complete
- Add notes for context: `tk add-note <id> "Discovered edge case..."`

## Ticket Decomposition Guidelines

### Granularity

Break work into tickets that are:
- **Atomic**: Can be completed in one focused session
- **Testable**: Has clear acceptance criteria
- **Independent**: Minimal coupling (use dependencies for sequencing)

### What Makes a Good Task Ticket

Each task ticket should answer:
1. **What** - Clear objective
2. **Where** - Files/modules involved
3. **How** - Approach outline (not full code)
4. **Done** - Acceptance criteria

### Example Decomposition

**Plan**: "Add user authentication with OAuth2"

**Tickets**:
```bash
# Epic
tk create "Epic: OAuth2 Authentication" -t epic

# Tasks (with epic as parent)
tk create "Add OAuth2 provider configuration" -t task \
  --parent <epic> \
  -d "Create OAuthConfig type and env loading in src/config/
      Add providers: Google, GitHub
      Validate required env vars on startup" \
  --acceptance "Config loads and validates on app start"

tk create "Implement OAuth callback handler" -t task \
  --parent <epic> \
  -d "Route: /auth/callback/:provider
      Exchange code for tokens using provider SDK
      Create/update user record with provider data" \
  --acceptance "Can complete OAuth flow and receive tokens"

tk create "Add session management" -t task \
  --parent <epic> \
  -d "JWT session tokens with 24h expiry
      Middleware for protected routes
      Refresh token rotation" \
  --acceptance "Protected routes reject unauthorized requests"

# Dependencies
tk dep <callback-id> <config-id>
tk dep <session-id> <callback-id>
```

## Commands Quick Reference

```bash
# After planning
tk create "Epic: X" -t epic -d "Plan: path/to/plan.md"

# Decompose
tk create "Task" -t task --parent <epic> -d "..." --acceptance "..."
tk dep <later> <earlier>

# Execute
tk start <id>           # Begin work
tk close <id>           # Complete work
tk add-note <id> "..."  # Add context

# Monitor
tk ready                # What's unblocked
tk blocked              # What's waiting
tk dep tree <epic>      # Visualize progress
```
