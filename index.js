import express from "express";
import cors from "cors";
import { app, server } from './lib/socket.js';
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

app.use(express.json());

app.use(cors({
  origin: ["https://aximo-ai.netlify.app", "http://localhost:5173"],
  methods: ["GET", "POST"],
}));

app.post("/publish", async (req, res) => {
  const { htmlContent } = req.body;

  try {
    // 1️⃣ Create site
    const siteRes = await fetch(
      "https://api.netlify.com/api/v1/sites",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), 
      }
    );

    const site = await siteRes.json();

    // 2️⃣ Deploy files
    const fileContent = htmlContent;
    const hash = crypto
      .createHash("sha1")
      .update(fileContent)
      .digest("hex");

    const deployRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${site.id}/deploys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: {
            "index.html": hash,
          },
        }),
      }
    );

    const deploy = await deployRes.json();
    
    // 3️⃣ Upload file content
    await fetch(
      `https://api.netlify.com/api/v1/deploys/${deploy.id}/files/index.html`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}`,
          "Content-Type": "text/html",
        },
        body: fileContent,
      }
    );
    res.json({
      siteUrl: site.url,
      deployId: deploy.id,
      state: "published",
    });


  } catch (err) {
    console.error("Netlify Publish Error:", err);
    res.status(500).json({ error: "Failed to publish site" });
  }
});



server.listen(3000, () => {
  console.log(`🚀 Server running on port 3000`);
});