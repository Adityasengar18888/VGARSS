# Workflow 2 — Skill Discovery & Verification

## Objective
Verify that Antigravity discovers and accurately loads all project-level and workspace skills from `.agents/skills/`.

## Step-by-Step Procedure
1. Inspect `.agents/skills/` directory structure:
   - Each skill directory must contain a valid `SKILL.md`.
2. Verify YAML frontmatter syntax:
   - Must contain `name:` (lowercase, hyphenated) and `description:` (in third-person, specifying what and when to activate).
3. Validate that no duplicate skill names conflict across workspace and global scopes.
4. Verify skill recognition by checking IDE skill indexing.
