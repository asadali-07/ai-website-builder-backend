# 🌐 AI Website Builder Server

This is the backend server for an **AI-powered website builder**. It allows users to chat with an AI assistant to generate complete HTML/CSS/JS websites and deploy them live on Netlify using the Netlify API.

---

## 🚀 Features

- **Chat with Google Gemini AI (via `@google/genai`)**
- **Generate full frontend code** (HTML, CSS, JS) using AI
- **Deploy websites automatically to Netlify**
- **Check deployment status via API**
- Built with **Express**, **Axios**, and **dotenv**
- Ready for production with environment variable configuration

---

## 🛠️ Tech Stack

- **Node.js** with **Express.js**
- **Google Gemini AI (via @google/genai)**
- **Netlify Deploy API**
- **CORS**, **dotenv**, **axios**
- **ESM (type: module)** support

---

## 📦 Installation

```bash
git clone https://github.com/YOUR_USERNAME/website-builder-server.git
cd website-builder-server
npm install

Create a .env file in the root directory:

env
GOOGLE_AI_API_KEY=your_google_gemini_api_key
NETLIFY_AUTH_TOKEN=your_netlify_token
NETLIFY_SITE_ID=your_netlify_site_id
PORT=5000

🧪 Running the Server
Development mode (with nodemon):
npm run dev

🔌 API Endpoints
POST /chat
Send a message to the AI and receive full frontend code.

Request:
json
{
  "message": "Create a landing page for a SaaS product"
}

Response:

HTML, CSS, and JS code blocks

Summary of the website

POST /publish
Publish the provided HTML/CSS/JS to Netlify.

Request:

json
Copy
Edit
{
  "html": "<h1>Hello World</h1>",
  "css": "body { background: #000; }",
  "js": "console.log('Hello')"
}
Response:

json
Copy
Edit
{
  "url": "https://your-deployed-site.netlify.app",
  "message": "✅ Website published successfully!",
  "status": "ready"
}
GET /deploy-status/:deployId
Check deployment status for a given Netlify deploy ID.

Response:

json
Copy
Edit
{
  "status": "ready",
  "url": "https://your-deployed-site.netlify.app",
  "deployId": "abc123",
  "createdAt": "...",
  "updatedAt": "..."
}
GET /health
Simple health check and environment diagnostics.

📁 Project Structure
├── index.js               # Main Express server
├── .env                   # Environment variables
├── package.json           # Dependencies and scripts

📄 License : MIT License
🙋‍♂️ Author
Made with ❤️ by Asad Ali
