---
name: magic-mcp
description: "AI UI Builder by 21st.dev. Provides tools for creating, refining, and fetching UI components, and searching logos."
---

# Magic MCP Skill

This skill contains the `magic-mcp` repository for creating UI components from 21st.dev. Since we are in the Build agent environment without native MCP support, you can either reference its code or integrate it manually. If you need to use it, you can parse the logic from `/src/tools` in `.agent/skills/magic-mcp/`.

Available tools in the repo:
- `create-ui`: Create UI components by natural language 
- `fetch-ui`: Fetches an existing component
- `logo-search`: Search for professional brand assets
- `refine-ui`: Enhance existing components
