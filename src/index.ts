import AgentAPI from "apminsight";
AgentAPI.config()

import express from "express";
import Subjetsrouter from "./routes/subject.js";
import ClassesRouter from "./routes/classes.js";
import usersRouter from "./routes/users.js";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/node";
import securityMiddleware from "./middleware/security.js";

const app = express();
const port = 8000;

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173" ,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));

app.all('/api/auth/{*any}', toNodeHandler(auth));

app.use(express.json());

app.use(securityMiddleware);

app.use('/api/subjects', Subjetsrouter);
app.use('/api/classes', ClassesRouter);
app.use('/api/users',usersRouter);

app.get("/", (_request, response) => {
    response.send("Classroom backend is running.");
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
