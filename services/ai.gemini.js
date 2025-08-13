import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

// Check required environment variables
if (!GOOGLE_AI_API_KEY) {
  console.error("❌ Missing required environment variable: GOOGLE_AI_API_KEY");
}

const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });


export async function generateLLMResponse(chatHistory, socket) {
  try {
    const response = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: chatHistory,
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

    Remember: Every response should be immediately usable in a browser. Focus on creating beautiful, functional websites that users will love. For images use unsplash, pinterest, or similar platforms and image should be working properly.
    `,
    },
    generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 8192,
      },
  });
  let fullText = "";

    for await (const chunk of response) {
      const text = chunk?.text || "";
      if (text) {
        fullText += text;
        socket.emit("ai-message-chunk", text);
      }
    }
    socket.emit("ai-message-complete", fullText);
    
    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(`Google AI API Error: ${error.message}`);
  }
}

export async function promptEnhancer(rawPrompt) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: rawPrompt }] }],
      config: {
        systemInstruction: `
You are an expert prompt enhancer AI assistant.
Your role is to take a user-provided prompt and enhance it so it is clear, detailed,
and perfectly aligned for generating high-quality frontend website code in HTML → CSS → JS → Summary format.
🎯 CORE MISSION:
Transform user prompts into structured, specific, and visually descriptive instructions
that result in beautiful, functional, production-ready websites.
        `,
      },
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 2048,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Prompt Enhancer Error:", error);
    throw new Error(`Prompt Enhancer API Error: ${error.message}`);
  }
}