# PLAN-auto-update.md - Implementation of Automatic Updates

## Goal
Enable the extension to check for new versions and update itself automatically without manual intervention (like reloading from chrome://extensions).

## Strategy 1: Chrome Web Store (Recommended for Production)
This is the native way. Once published, Chrome handles checking and downloading updates every few hours.

## Strategy 2: Self-Hosting (GitHub Pages)
This allows free auto-updates without the $5 fee.

### 1. Update Manifest
Add the `update_url` to `manifest.json`. GitHub Pages uses the pattern `https://<username>.github.io/<repo>/updates.xml`.
```json
{
  "name": "AI Chatbot Injector",
  "version": "2.2",
  "update_url": "https://username.github.io/repo-name/updates.xml",
  ...
}
```

### 2. Create `updates.xml` (In your repo root)
```xml
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='[YOUR_EXTENSION_ID]'>
    <updatecheck codebase='https://username.github.io/repo-name/extension.crx' version='2.2' />
  </app>
</gupdate>
```

### 3. Deployment Workflow
1. **Zip files**: Select all files inside `ai-chatbot-injector` and zip them.
2. **Pack Extension**: Go to `chrome://extensions`, enable **Developer mode**, and click **Pack extension**.
3. **Save Key**: The first time you pack, Chrome generates a `.pem` file. **Keep this file safe**; you need it for all future updates to keep the same Extension ID.
4. **Publish**: Upload `extension.crx` and `updates.xml` to your GitHub repository.
5. **Enable Pages**: Go to Repo Settings -> Pages -> Deploy from branch.


## Enhancement: Developer "Hot-Reload"
For development specifically, we can add a script that listens for file changes and reloads the extension automatically.

### Proposed Developer Workflow (Hot-Reload)
- **Background Script**: Listen for a special "reload" signal from a local server.
- **Content Script**: Auto-refresh the page if the background reloads.

## Socratic Gate (Phase 0)
1. **Hosting**: Do you have a server (like GitHub Pages, Vercel, or a personal VPS) to host the `.crx` and `.xml` files?
2. **Audience**: Is this extension just for you, or for a team? (Self-hosting is better for teams, manual is fine for solo dev).
3. **Store Intent**: Do you plan to publish this to the official Chrome Web Store eventually? (If yes, we should focus on Store-compliant packaging).

## Task Breakdown

#### [NEW] Create Auto-Update Manifest Template <!-- id: 61 -->
- **Agent**: `devops-engineer`
- **Goal**: Create a template `updates.xml` and instructions on how to calculate the Extension ID.
- **Verify**: File exists and XML is valid.

#### [IMPLEMENTATION] Manifest `update_url` Configuration <!-- id: 62 -->
- **Agent**: `orchestrator`
- **Goal**: Add the field to `manifest.json` (commented out until URL is provided).
- **Verify**: Manifest remains valid.
命中"
