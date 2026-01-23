# AGENT PHILOSOPHY & ARCHITECTURAL STANDARDS

## 1. Deep Modules (Ousterhout)
- Interface must be simpler than implementation
- Pull complexity down—hide DB queries, race conditions, caching inside modules
- Ban pass-throughs: no Controller→Service→Repository if Service adds nothing

## 2. Linearity & Cognitive Locality
- Prefer linear 50-line functions over 5 fragmented helpers (unless reusable)
- Guard clauses: `if (!valid) return;` not nested `if (valid) { if (auth) {`
- `const`/`readonly` by default; destructure early
- Names: `userHasPendingOrders` not `checkStatus`
- Comments: WHY not HOW

## 3. Failure Domains & Idempotency
- Bugs → crash loudly (`throw`/`panic`/`assert`)
- I/O errors → handle explicitly (Result types)
- Assume functions may retry; writes need transactions/optimistic locking
- CQS: Get functions never modify state

# Delegation
For multi-file features with simple subtasks (types, utils, config, tests), invoke `/delegate` skill.
