# PLAN-multimedia-meta-scanner.md - Multimedia & Metadata Aware Scanner

## Goal
Evolve the scanner to "see" beyond plain text.
1. **Icon Intelligence**: Extract champion/item names from attributes in gaming sites.
2. **Visual Context**: Identify "Figures" (Architecture diagrams, Workflows) and provide them to the user/AI as visual references.

## Proposed Changes

### 1. Attribute-Augmented Density (Icon-Heavy Sites)
Update `scanner.js` to include a `getVisualText` pass:
- **Icons**: Detect `<img>` or `span.icon` and extract `alt`, `title`, or `aria-label`.
- **Filtering**: Use a blacklist for common icon noise (e.g., "chevron-down", "close").
- **TFT Support**: Specific logic to map article icons to champion/item names.

### 2. Figure & Diagram Identification (Documentation Sites)
Identify high-value images for GitOps/Technical guides:
- **Strategy**: Look for `<figure>`, `<figcaption>`, or images with IDs/Classes like `architecture`, `workflow`, `diagram`, `flow`.
- **Action**: Collect the `src` of these images.
- **UI Integration**: In the Chat UI, if a figure is found, show a "Visual Reference" preview or allow the AI to say: "Here is the ArgoCD workflow diagram: [Image]".

### 3. Implementation Phases

#### [MODIFY] [scanner.js](file:///home/emoi-user/Workspace/mini-app/ai-chatbot-injector/content/scanner.js)
- Add `extractMetadata(element)` to pull attributes.
- Update `scoreElement` to count meaningful attributes as "text".
- Add `figures` array to the scan result: `{ url, caption, context }`.

#### [MODIFY] [ui-controller.js](file:///home/emoi-user/Workspace/mini-app/ai-chatbot-injector/content/ui-controller.js)
- Update context sent to LLM to describe figures: `"Figure 1: ArgoCD Architecture (URL: ...)"`.
- Add a tiny "Image Gallery" or "Figure Preview" to the chat messages if the AI references an image.

## Verification Plan

### Test Cases
1. **TFT Academy**: Verify "Sera", "Zac", "Blue Buff" appear in the text context.
2. **ArgoCD Docs**: Verify that a diagram image is identified and its URL is available in the chat context.

## User Review Required
> [!IMPORTANT]
> **Image Embedding**: Browsers often block "Mixed Content" (HTTP images on HTTPS sites) or have "CSP" (Content Security Policy) restrictions. We might need to handle image display via proxying or just providing links.
> **AI Vision**: Our current LLM is text-only. It can "know" the figure exists via the caption/URL, but it can't "see" the pixels. Is this level of support enough for your GitOps workflow?
