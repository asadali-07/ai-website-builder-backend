import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const History = [];

// Check if API key exists
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
if (!GOOGLE_AI_API_KEY) {
  console.error("❌ GOOGLE_AI_API_KEY is not set in environment variables");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use environment variables in production
const NETLIFY_AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN;
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID;

// Check required environment variables
if (!NETLIFY_AUTH_TOKEN || !NETLIFY_SITE_ID) {
  console.error("❌ Missing required environment variables: NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID");
}

// POST /publish endpoint
app.post("/publish", async (req, res) => {
  try {
    const { html, css, js } = req.body;

    if (!html && !css && !js) {
      return res.status(400).json({ error: "No code provided" });
    }

    // Construct HTML template
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Published Website</title>
  <style>${css || ""}</style>
</head>
<body>
  ${html || "<h1>Hello World!</h1>"}
  <script>
    try {
      ${js || ""}
    } catch (err) {
      console.error("Script Error:", err);
    }
  </script>
</body>
</html>`;

    // Create files object with SHA1 hashes (required by Netlify)
    const indexContent = htmlTemplate;
    const redirectsContent = '/*    /index.html   200';
    
    const indexSha = crypto.createHash('sha1').update(indexContent).digest('hex');
    const redirectsSha = crypto.createHash('sha1').update(redirectsContent).digest('hex');

    const files = {
      'index.html': indexSha,
      '_redirects': redirectsSha
    };

    const functions = {};

    // Step 1: Create deploy with file hashes
    const deployResponse = await axios.post(
      `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/deploys`,
      {
        files,
        functions,
        draft: false
      },
      {
        headers: {
          Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const deployId = deployResponse.data.id;
    const requiredFiles = deployResponse.data.required || [];

    console.log("📦 Deploy created:", deployId);
    console.log("📋 Required files:", requiredFiles);

    // Step 2: Upload required files using SHA1 hash URLs
    const fileMap = {
      [indexSha]: indexContent,
      [redirectsSha]: redirectsContent
    };

    for (const sha1Hash of requiredFiles) {
      const fileContent = fileMap[sha1Hash];
      
      if (fileContent) {
        await axios.put(
          `https://api.netlify.com/api/v1/deploys/${deployId}/files/${sha1Hash}`,
          fileContent,
          {
            headers: {
              Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
              'Content-Type': 'application/octet-stream',
            },
          }
        );
        console.log(`✅ Uploaded file with hash: ${sha1Hash}`);
      }
    }

    // Step 3: Wait for deployment to complete
    let deployStatus = 'uploading';
    let attempts = 0;
    const maxAttempts = 30;

    while ((deployStatus === 'uploading' || deployStatus === 'building') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await axios.get(
        `https://api.netlify.com/api/v1/deploys/${deployId}`,
        {
          headers: {
            Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
          },
        }
      );
      
      deployStatus = statusResponse.data.state;
      attempts++;
      console.log(`🔄 Deploy status: ${deployStatus} (${attempts}/${maxAttempts})`);
    }

    if (deployStatus === 'ready') {
      const finalResponse = await axios.get(
        `https://api.netlify.com/api/v1/deploys/${deployId}`,
        {
          headers: {
            Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
          },
        }
      );

      const url = finalResponse.data.ssl_url || finalResponse.data.url;
      console.log("✅ Site deployed successfully:", url);

      res.json({
        url,
        message: "✅ Website published successfully!",
        deployId: deployId,
        status: deployStatus
      });
    } else {
      const currentResponse = await axios.get(
        `https://api.netlify.com/api/v1/deploys/${deployId}`,
        {
          headers: {
            Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
          },
        }
      );

      const url = currentResponse.data.ssl_url || currentResponse.data.url;
      console.log("⚠️ Site deployment in progress:", url);

      res.json({
        url,
        message: "🔄 Website deployment started! It may take a few moments to be fully available.",
        deployId: deployId,
        status: deployStatus
      });
    }

  } catch (err) {
    console.error("❌ Deployment failed:", err);
    
    if (err.response) {
      console.error("Response data:", err.response.data);
      console.error("Response status:", err.response.status);
    }
    
    res.status(500).json({
      error: "Deployment failed",
      details: err.response?.data?.message || err.message || "Unknown error occurred",
      statusCode: err.response?.status,
    });
  }
});

// Get deployment status endpoint
app.get("/deploy-status/:deployId", async (req, res) => {
  try {
    const { deployId } = req.params;
    
    const response = await axios.get(
      `https://api.netlify.com/api/v1/deploys/${deployId}`,
      {
        headers: {
          Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
        },
      }
    );

    res.json({
      status: response.data.state,
      url: response.data.ssl_url || response.data.url,
      deployId: response.data.id,
      createdAt: response.data.created_at,
      updatedAt: response.data.updated_at
    });

  } catch (err) {
    console.error("❌ Failed to get deploy status:", err);
    res.status(500).json({
      error: "Failed to get deployment status",
      details: err.response?.data?.message || err.message
    });
  }
});

// Complete chat endpoint
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!GOOGLE_AI_API_KEY) {
    return res.status(500).json({ 
      error: "Google AI API key not configured" 
    });
  }

  try {
    const response = await generateLLMResponse(message);
    res.json({ response });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ 
      error: "Failed to process chat message",
      details: error.message 
    });
  }
});

async function generateLLMResponse(message) {
  try {
    // Add user message to history
    History.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Get the generative model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `
You are an expert frontend development AI assistant specializing in creating beautiful, functional websites. Your role is to generate clean, production-ready code based on user requests.

🎯 CORE MISSION:
Transform user ideas into complete, working websites with HTML, CSS, and JavaScript.

📋 RESPONSE FORMAT:
Always respond with code blocks in this exact order:

1. **HTML Block**
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Website Title</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
  <!-- Your semantic HTML structure here -->
</body>
</html>
\`\`\`

2. **CSS Block**
\`\`\`css
/* Modern, responsive styles here */
\`\`\`

3. **JavaScript Block** (if needed)
\`\`\`javascript
// Interactive functionality here
\`\`\`

4. **Summary** (brief explanation)
Summary: [Brief description of what was created, key features, and main functionality]

🎨 DESIGN PRINCIPLES:
- Modern, clean aesthetics with proper spacing and typography
- Fully responsive design (mobile-first approach)
- Accessible HTML5 semantic structure
- Smooth animations and micro-interactions
- Professional color schemes and gradients

🔧 TECHNICAL REQUIREMENTS:
- Use CSS Grid and Flexbox for layouts
- Include hover effects and transitions
- Add loading states and animations where appropriate
- Ensure cross-browser compatibility
- Include Font Awesome icons and Google Fonts
- Add some JavaScript for interactivity (if applicable)

Remember: Every response should be immediately usable in a browser. Focus on creating beautiful, functional websites that users will love. If someone questions which is not related to frontend development, politely suggest they ask a different question.
`,
    });

    const result = await model.generateContent({
      contents: History,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 8192,
      },
    });

    const responseText = result.response.text();
    History.push({
      role: "model",
      parts: [{ text: responseText }],
    });

    return responseText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(`Google AI API Error: ${error.message}`);
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    apiKeys: {
      googleAI: !!GOOGLE_AI_API_KEY,
      netlify: !!NETLIFY_AUTH_TOKEN,
    },
    netlify: {
      siteId: NETLIFY_SITE_ID,
      configured: !!NETLIFY_AUTH_TOKEN && !!NETLIFY_SITE_ID,
    },
    endpoints: {
      chat: "/chat",
      publish: "/publish",
      deployStatus: "/deploy-status/:deployId",
    },
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 Google AI API: ${GOOGLE_AI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`🔑 Netlify API: ${NETLIFY_AUTH_TOKEN ? '✅ Configured' : '❌ Missing'}`);
});