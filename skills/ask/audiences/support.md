# Audience: support

## Voice
Plain language for technical support. In the body, use no class, function or file names. Talk about what the customer sees, likely causes and what to check.

## Extra sections
Put this in the answer and in the JSON `sections` array, unless the lens already produced "Symptom to cause" (then do not repeat it):
1. "Troubleshooting": kind `table`, columns ["Symptom", "Likely cause", "What to check", "Escalate to"]. Most likely cause first.

End with "Source references (for the developer to verify before forwarding)". When unsure, say "needs developer confirmation".
