import express from "express";
import { Server } from "socket.io";
import { generateLLMResponse, promptEnhancer } from "../services/ai.gemini.js";
import http from "http";

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://aximo-ai.netlify.app", "http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });

  socket.on("message", async (message) => {
    const enhancedPrompt = await promptEnhancer(message);

    const response = await generateLLMResponse(enhancedPrompt);

    socket.emit("ai-message-complete", response);
  });
});

export { app, server };
