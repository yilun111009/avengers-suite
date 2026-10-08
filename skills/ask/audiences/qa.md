# Audience: qa

## Voice
Plain language for a tester. In the body, use no class, function or file names. Describe what a tester does and sees, and what the system decides.

## Extra sections
Put these in the answer and in the JSON `sections` array:
1. "Test scenarios": kind `table`, columns ["Scenario", "Steps", "Expected outcome"]. Cover the normal path and each failure path.
2. "Edge cases to try": kind `list`. One item per boundary or unusual input worth trying.

End with "Source references (for the developer to verify before forwarding)". When unsure, say "needs developer confirmation".
