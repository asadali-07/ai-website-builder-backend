import express from "express";
import { Server } from "socket.io";
import { generateLLMResponse, promptEnhancer } from "../services/ai.gemini.js";
import http from "http";

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://aximo-ai.netlify.app",
    methods: ["GET", "POST"],
  },
});

const chatHistory = [];

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });

  socket.on("message", async (message) => {
    const enhancedPrompt = await promptEnhancer(message);

    chatHistory.push({
      role: "user",
      parts: [{ text: enhancedPrompt }],
    });

    const response = await generateLLMResponse(chatHistory, socket);

    chatHistory.push({
      role: "model",
      parts: [{ text: response }],
    });
  });
});

export { app, server };
