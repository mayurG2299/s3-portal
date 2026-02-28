---
name: Stitch UI Generator
description: A custom skill that describes how to effectively prompt and use the Stitch MCP.
---

# Stitch UI Generator Skill

This skill extends your capabilities by outlining best practices and detailed information on how to construct effective prompts for the Stitch MCP.

## Core Capabilities
- **Create Project (`mcp_stitch_create_project`)**: Initializes a new text-to-UI project workspace.
- **Generate Screen (`mcp_stitch_generate_screen_from_text`)**: Translates a text prompt into a UI design inside a specific project.
- **Edit Screen (`mcp_stitch_edit_screens`)**: Edits existing UI screens based on a text prompt.
- **Generate Variants (`mcp_stitch_generate_variants`)**: Automatically creates variations of a selected screen.

## Best Practices for Prompting

When constructing a prompt for `mcp_stitch_generate_screen_from_text` or `mcp_stitch_edit_screens`, ensure that you:
1. **Specify the Purpose**: Clearly state what the screen is for (e.g., "A modern dashboard for an e-commerce admin panel").
2. **Define Layout & Structure**: Describe the sections, such as a sidebar, top navigation, main content area, user profile widget, etc.
3. **Detail Aesthetics**: Provide clear instructions on the mood, theme (light/dark), and color palette (e.g., "Use a sleek dark theme with neon purple accents").
4. **List Interactive Elements**: Call out specific buttons, inputs, dropdowns, and their expected states (default, hover, active).
5. **Add Contextual Constraints**: Mention the `deviceType` requirement (Desktop, Mobile, Tablet).

## Example Prompt Pattern

> "Create a [Device Type] screen for a [Purpose]. The layout should feature a [Section 1] on the [Position], a [Section 2] on the [Position]. Use a [Theme/Colors] color scheme with [Typography Style] typography. Ensure the following elements are present: [Element 1], [Element 2], [Element 3]. The overall aesthetic should be [Adjective]."

## When to use this skill
- When the user asks you to "design a UI", "prototype a screen", or "use stitch to make a page."
- When iterating on a design based on user feedback.
