---
description: How to design and generate UI screens using the Stitch MCP
---
# Stitch UI Generation Workflow

This workflow guides you on the best practices for leveraging the Stitch MCP integration to generate and iterate on UI screens.

## Workflow Steps

1. **Understand Requirements:** Thoroughly understand the user's UI requirements, the desired aesthetics (e.g., modern, clean, dark mode), and the specific components needed.
2. **Select or Create a Project:**
    - Use `mcp_stitch_list_projects` to check if an appropriate project exists.
    - If starting fresh, use `mcp_stitch_create_project` to initialize a new workspace.
3. **Generate Initial Screen:**
    - Call `mcp_stitch_generate_screen_from_text` with a highly detailed prompt.
    - Include specifics about the layout, color palette, typography, and content.
    - Specify the `deviceType` (e.g., MOBILE, DESKTOP) if applicable.
4. **Iterate and Refine (if needed):**
    - If the user has an existing screen that needs modification, retrieve it using `mcp_stitch_get_screen`.
    - Use `mcp_stitch_edit_screens` to refine the screen based on new requirements (e.g., "Change the submit button to primary blue and round its corners").
5. **Explore Options (Optional):**
    - If the user wants to see different layout ideas or themes, use `mcp_stitch_generate_variants` to explore multiple design paths.
6. **Review:** Present the generated screens (via their IDs or output links) to the user for feedback.

## Tips for Stitch Prompts
- Be specific about dimensions and relative positioning.
- Use explicit color names, hex codes, or themes (e.g., "vibrant gradient", "monochrome").
- Clearly define the state of the UI (e.g., "loading state", "error dialog", "dashboard homepage").
- If applicable, reference common UI libraries material design or Apple HIG for structural guidance.
