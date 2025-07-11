import express from "express";
import { GoogleGenAI } from "@google/genai";
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

const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

// Allow specific origin with credentials (optional)
app.use(cors({
  origin: 'https://aximo-ai.netlify.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

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

    // Step 3: Wait for deployment to complete with improved timeout handling
    const maxAttempts = process.env.NETLIFY_MAX_POLLING_ATTEMPTS || 15;
    const pollingInterval = process.env.NETLIFY_POLLING_INTERVAL || 2000;
    const maxWaitTime = process.env.NETLIFY_MAX_WAIT_TIME || 60000; // 1 minute max wait
    
    let deployStatus = 'uploading';
    let attempts = 0;
    const startTime = Date.now();
    let statusResponse;
    let url = null;

    try {
      while (attempts < maxAttempts && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
        
        statusResponse = await axios.get(
          `https://api.netlify.com/api/v1/deploys/${deployId}`,
          {
            headers: {
              Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
            },
          }
        );
        
        deployStatus = statusResponse.data.state;
        url = statusResponse.data.ssl_url || statusResponse.data.url;
        attempts++;
        
        console.log(`🔄 Deploy status: ${deployStatus} (${attempts}/${maxAttempts})`);
        
        if (deployStatus === 'ready') {
          break;
        }
      }

      // Even if not ready, get the latest URL
      if (!url && statusResponse) {
        url = statusResponse.data.ssl_url || statusResponse.data.url;
      }

      // If URL is still not available, make one more attempt to get it
      if (!url) {
        const finalCheck = await axios.get(
          `https://api.netlify.com/api/v1/deploys/${deployId}`,
          {
            headers: {
              Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
            },
          }
        );
        url = finalCheck.data.ssl_url || finalCheck.data.url;
      }

      // Check if site's publish URL is available through the site API if needed
      if (!url) {
        const siteInfo = await axios.get(
          `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}`,
          {
            headers: {
              Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
            },
          }
        );
        url = siteInfo.data.ssl_url || siteInfo.data.url;
      }

      if (deployStatus === 'ready') {
        console.log("✅ Site deployed successfully:", url);

        res.json({
          url,
          message: "✅ Website published successfully!",
          deployId: deployId,
          status: deployStatus
        });
      } else {
        console.log("⚠️ Site deployment in progress:", url);

        // Treat as success but with a warning
        res.json({
          url,
          message: "🔄 Website is being deployed! Your site will be available at this URL shortly.",
          deployId: deployId,
          status: "in_progress",
          details: "Deployment initiated successfully but still processing on Netlify's servers."
        });
      }
    } catch (pollingErr) {
      console.error("❌ Error while polling deploy status:", pollingErr);
      
      // Still return success with the deployId if we have a URL
      if (url) {
        res.json({
          url,
          message: "🔄 Website deployment initiated! It may take a few moments to be fully available.",
          deployId: deployId,
          status: "unknown",
          details: "Status checking failed, but deployment was started successfully."
        });
      } else {
        throw pollingErr; // Re-throw to be caught by the outer catch
      }
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

    const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: History,
    config: {
      systemInstruction: `
    You are an expert frontend development AI assistant specializing in creating beautiful, functional websites. Your role is to generate clean, production-ready code based on user requests.
    
    🎯 CORE MISSION:
    Transform user ideas into complete, working websites with HTML, CSS, and JavaScript.
    
    📋 MANDATORY RESPONSE FORMAT:
    You MUST ALWAYS respond with code blocks in this EXACT order. Do not provide explanations before the code blocks:
    
    1. **HTML Block** (REQUIRED)
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
    
    2. **CSS Block** (REQUIRED)
    \`\`\`css
    /* Modern, responsive styles here */
    \`\`\`
    
    3. **JavaScript Block** (OPTIONAL - only if needed)
    \`\`\`javascript
    // Interactive functionality here
    \`\`\`
    
    4. **Summary** (REQUIRED - brief explanation after code blocks)
    Summary: [Brief description of what was created, key features, and main functionality]
    
    🚨 CRITICAL RULES:
    - NEVER provide explanations or descriptions before the code blocks
    - ALWAYS start your response with the HTML code block
    - ALWAYS include all three code blocks (HTML, CSS, JS if needed)
    - ALWAYS end with a summary
    - NO other text or formatting outside of this structure
    
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
    - Add JavaScript for interactivity when applicable
    
    Remember: Every response should be immediately usable in a browser. Focus on creating beautiful, functional websites that users will love.
    `,
    },
    generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 8192,
      },
  });
    const responseText = response.text;
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