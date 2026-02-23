import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import icuRoutes from "./routes/icuRoutes.js";
import schedulerRoutes from "./routes/schedulerRoutes.js";
import helmet from "helmet";
import appointmentRoutes from "./routes/appointments.js";
import chatbotRoutes from "./routes/chatBot.js";
import { errorHandler } from "./middleware/errorHandler.js";

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

// error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
