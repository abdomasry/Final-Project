const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();
connectDB();

const app = express();
const NextPort = "http://localhost:3000";
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(
  cors({
    origin: NextPort || "http://localhost:3000",
  }),
);

app.get("/", (req, res) => {
    res.json({ message: "Server is running" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});