# PLAN-tftacademy-assessment.md - Assessment of Multimedia Research Capabilities

## Overview
We have successfully implemented the **Metadata pass** and **Autonomous Loop**. The test results show that the AI is now able to "read" champions and items on TFT Academy by extracting data from attributes (aria-label/alt).

## Current Assessment (Test Results Analysis)

| Feature | Status | Observation |
|:---|:---|:---|
| **Metadata Extraction** | ✅ SUCCESS | AI identified specific units (Heimerdinger, Ekko) and items (Blue Buff, Archangel) which were previously invisible. |
| **Agentic Research Loop** | ✅ SUCCESS | AI autonomously triggered `Deeper Research` and fetched content without user intervention. |
| **CoT Reasoning** | ✅ SUCCESS | AI correctly identified that there is no single "S-Tier" in Patch 16.4 and prioritized A-Tier consistently. |
| **Figure Detection** | ⚠️ PENDING | The logic is in place, but we need to verify it on a page with actual diagrams (e.g., GitOps Docs). |

## Proposed Next Phase: Vision Integration

### 1. Vision-Payload (Alpha)
- Already implemented the framework in `llm-client.js`.
- **Next Step**: Update `ui-controller.js` to convert identified `figures` into `base64` strings automatically if the user's query references them.

### 2. Multi-Source Correlation
- Improve the AI's ability to cross-reference icons with technical text.
- **Example**: If an icon is labeled `[Zac]` and the text says `Tank`, the AI should explicitly link them.

## Socratic Gate (Phase 0 Questions)
1. **Vision Costs**: Sending images (Base64) to LLMs consumes significantly more tokens. Should we limit this to only "High-Value Figures" (e.g., diagrams vs small icons)?
2. **Display Preference**: When AI finds a "Figure" (like an ArgoCD workflow), do you want the AI to **embed the image** in the chat, or just provide a link/description?
3. **Domain Scope**: Should we broad-enable this for all sites, or use a "High-Sensitivity Mode" that the user toggles when on gaming/technical sites?

## Task Breakdown

#### [ANALYSIS] Evaluate Figure Detection on Technical Docs <!-- id: 51 -->
- **Agent**: `project-planner`
- **Goal**: Open a GitOps documentation page (e.g., ArgoCD) and verify if the `extractFigures` logic identifies the architecture diagram.
- **Verify**: `contextData.figures` contains the correct URL and caption.

#### [IMPLEMENTATION] Image Preview in Chat UI <!-- id: 52 -->
- **Agent**: `frontend-specialist`
- **Goal**: Update `shadow-root.js`/`ui-controller.js` to render a small image preview if a message contains an image URL.
- **Verify**: User sees a thumbnail of the figure the AI is talking about.
