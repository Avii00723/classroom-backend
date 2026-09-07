import express from "express";
import Subjetsrouter from "./routes/subject.js";
import cors from "cors";

const app = express();
const port = 8000;
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));

app.use(express.json());

app.use('/api/subjects', Subjetsrouter);

app.get("/", (_request, response) => {
    response.send("Classroom backend is running.");
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
