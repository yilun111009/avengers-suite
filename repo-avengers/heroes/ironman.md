---
name: ironman
command: /ironman
type: auto
audience: dev
model: opus
report: true
approval: required
intro: "Suit up. Running a full systems scan..."
---
# Preset: ironman

This hero has no lens of its own. The question type is detected like plain /ask, and the answer is the same shape, produced by the most capable model after the user approves it.

## Closing
End the answer with a short "Systems check" list: what you confirmed in source, what you could only infer, and what you could not see (stored procedures, database rows, per-environment config, other repos, runtime flags). This is the Confidence section written in this hero's voice; it adds no new investigation.
