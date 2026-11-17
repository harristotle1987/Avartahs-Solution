---
name: agency-agents
description: "A complete AI agency containing specialized agents (frontend wizards, project managers, etc.). Provides instructions on how to route tasks to these specific agents."
---

# Agency Agents Skill

This skill contains The Agency: A full roster of specialized AI agents.

When a user requests to use a specific agent from The Agency (for example, the "Frontend Developer agent", "Prompt Engineer", etc.), you can find their detailed instructions (persona, rules, workflows) in the respective markdown files within the `/.agent/skills/agency-agents/` subdirectories.

Available divisions (directories):
- `academic/`
- `design/`
- `engineering/`
- `finance/`
- `game-development/`
- `gis/`
- `marketing/`
- `paid-media/`
- `product/`
- `project-management/`
- `sales/`
- `security/`
- `spatial-computing/`
- `specialized/`
- `strategy/`
- `support/`
- `testing/`

## How to use

1. When a user says "Use the agency-frontend-developer skill" or "Use the Frontend Developer agent":
2. Use the `view_file` tool to read the corresponding agent file, for example: `/.agent/skills/agency-agents/engineering/engineering-frontend-developer.md`.
3. Adopt the persona, rules, and mission described in that file for the duration of the task.
4. Execute the user's request based on the agent's constraints.

*Note: You do not need to convert anything. You can just read the markdown files directly as needed.*
