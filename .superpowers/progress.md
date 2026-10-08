# SDD ledger — plan: docs/superpowers/plans/2026-10-07-repo-avengers-v1.md
Setup: no git/worktree (user declined git init); checkpoints = full test suite. Backup: ../rg-repo-explainer-0.7.1-backup
Pre-flight: Task2 produces check-onboarding env hooks + prompt scan, Task3 files must pass it, Task4 agent must pass it; Task5/6 consume report JSON from Task4. No conflicts found.
Task 1: complete (no commits; tests: node --test "tests/*.test.mjs" → 28/28 pass)
Task 1: Ruling: plan said 29 tests, actual is 28 (edge-input check is one test with two asserts) — count only, no behaviour change — cost if wrong: none
Task 2: complete (no commits; tests: node --test "tests/*.test.mjs" → 38/38 pass)
Task 3: complete (no commits; tests: node --test "tests/*.test.mjs" → 41/41 pass)
Task 4: complete (no commits; tests: node --test "tests/*.test.mjs" → 45/45 pass; real plugin passes preflight end to end)
Task 5: complete (no commits; tests: node --test "tests/*.test.mjs" → 53/53 pass)
Task 6: complete (no commits; tests: node --test "tests/*.test.mjs" → 55/55 pass)
Task 7: complete (no commits; tests: node --test "tests/*.test.mjs" → 58/58 pass)
Task 8: complete (no commits; tests: node --test "tests/*.test.mjs" → 63/63 pass)
Task 8: Ruling: CHANGELOG.md uses CRLF, so the plan test regex for "# Changelog

## 1.0.0" could not match — normalise line endings in the test, content unchanged — cost if wrong: none
Task 9: steps 1-2 complete (suite 63/63; stale-name sweep clean). Steps 3-4 (reinstall, real-repo runs) need the user.
Final: git absent, so review-package script unusable; reviewer pointed at files + ../rg-repo-explainer-0.7.1-backup for diff
Final: reviewer (opus; fable was not allowed for this team) found 0 Critical, 4 Important, 6 Minor
Final: fixed question run by shell (backticks/$()) - detect-route stdin test + SKILL heredoc test RED->GREEN, suite 68/68
Final: fixed shadow-agent check by file name only - helper.md with name: repo-avengers test RED->GREEN, suite 68/68
Final: fixed only first tools: line checked - second-tools-line test RED->GREEN, suite 68/68
Final: fixed dev answers lost "Things worth flagging" - agent+dev.md test RED->GREEN, suite 68/68
Final: minor (deferred): env overrides AVENGERS_AGENT_PATH/AVENGERS_ASK_DIR work in real runs and preflight does not say when set
Final: minor (deferred): lens text scan misses "ignore the safety rules..." and case-sensitively flags "Write the answer"
Final: minor (deferred): router misroutes "error handling middleware" to support, "For QA environment" to qa, "...work for the PM" gets no audience
Final: minor (deferred): build-report drops extra table cells / string rows / missing columns silently
Final: minor (deferred): SKILL step 9.3 overwrites unknown type/audience before build-report can warn
Final: minor (deferred): build-index writes type unescaped (safe only because value is whitelisted); architecture/impact/support reports still show empty dev-only Steps/Rules sections
Done: workspace kept (no git, so the ledger is the only record)
