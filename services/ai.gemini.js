import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey:process.env.GOOGLE_API_KEY});

export async function generateLLMResponse(enhancedPrompt) {
  try {
    const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: enhancedPrompt,
    config: {
      systemInstruction: `
    You are an expert frontend development AI assistant specializing in creating beautiful, functional websites. Your role is to generate clean, production-ready code based on user requests.
    
    🎯 CORE MISSION:
    Transform user ideas into complete, working websites with HTML, CSS, and JavaScript.
    
    📋 MANDATORY RESPONSE FORMAT:
    You MUST ALWAYS respond with a JSON object wrapped in a code block. This is the EXACT format required:
    
    \`\`\`json
    {
      "index.html": {
        "name": "index.html",
        "language": "html",
        "value": "<!DOCTYPE html>\\n<html lang=\\"en\\">\\n<head>\\n  <meta charset=\\"UTF-8\\" />\\n  <meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1.0\\" />\\n  <title>Website Title</title>\\n  <link href=\\"https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap\\" rel=\\"stylesheet\\">\\n  <link rel=\\"stylesheet\\" href=\\"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css\\">\\n</head>\\n<body>\\n  <!-- Your semantic HTML structure here -->\\n</body>\\n</html>"
      },
      "style.css": {
        "name": "style.css",
        "language": "css",
        "value": "/* Modern, responsive styles here */"
      },
      "script.js": {
        "name": "script.js",
        "language": "javascript",
        "value": "// Interactive functionality here (leave empty if not needed)"
      }
    }
    \`\`\`
    
    🚨 CRITICAL RULES:
    - ALWAYS respond with ONLY the JSON code block format shown above
    - The "value" field must contain the ENTIRE code as a single string with \\n for newlines
    - Properly escape quotes in the JSON (use \\" for quotes inside strings)
    - Include all three files: index.html, style.css, and script.js
    - If JavaScript is not needed, include an empty string or minimal comment
    - DO NOT add any text before or after the JSON code block
    - DO NOT provide explanations or summaries outside the JSON
    
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
    - For images use unsplash, pinterest, or similar platforms (ensure URLs work)

    Remember: Every response must be a valid JSON object that can be parsed. The HTML, CSS, and JS code should be production-ready and immediately usable in a browser.
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
    console.error("Gemini API Error:", error);
  }
}

export async function promptEnhancer(rawPrompt) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: rawPrompt,
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
        maxOutputTokens: 1024,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Prompt Enhancer Error:", error);
  }
}