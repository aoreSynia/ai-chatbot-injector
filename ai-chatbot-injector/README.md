# AI Chatbot Injector

A browser extension that injects a smart AI chatbot into any webpage, allowing you to chat with the page content using your own API keys (OpenAI / Gemini).

## Features
- 🚀 **Universal Injection**: Chat with any article, documentation, or post.
- 🔒 **Privacy Focused**: Your API keys are stored locally.
- 🎨 **Isolated UI**: Uses Shadow DOM to prevent style conflicts with websites.
- 🤖 **Multi-Provider**: Supports OpenAI (GPT-4o) and Google Gemini.
- 🧩 **Markdown Support**: Renders code blocks and lists in chat.

## Installation

### Chrome / Edge / Brave
1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the `ai-chatbot-injector` folder.

### Firefox
1. Open `about:debugging`.
2. Click **This Firefox**.
3. Click **Load Temporary Add-on...**.
4. Select `manifest.json` inside the `ai-chatbot-injector` folder.

## Usage
1. Click the extension icon in the toolbar.
2. Enter your **API Key** (e.g., OpenAI `sk-...` or Gemini API Key).
3. Select your provider and click **Save Settings**.
4. Navigate to any webpage you want to chat with.
5. Open the extension popup and click **🚀 Launch Chat** (or right-click the page -> "💬 Chat with AI...").
6. The chat bubble will appear in the bottom right corner.
