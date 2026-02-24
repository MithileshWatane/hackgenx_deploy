import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import icuRoutes from "./routes/icuRoutes.js";
import schedulerRoutes from "./routes/schedulerRoutes.js";
import helmet from "helmet";
import appointmentRoutes from "./routes/appointments.js";
import chatbotRoutes from "./routes/chatBot.js";
import smsRoutes from "./routes/sms.js";
import telegramRoutes from "./routes/telegramRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import telegramBotManager from "./services/telegramBotManager.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use("/icu", icuRoutes);
app.use("/api/schedule", schedulerRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/sms", smsRoutes);
app.use("/api/hospitals", hospitalRoutes);

// error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Initialize Telegram bot
telegramBotManager.initializeBot().then(success => {
  if (success) {
    console.log('🚀 Telegram bot is ready to receive messages');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
