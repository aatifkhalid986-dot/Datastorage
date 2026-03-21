
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- DATABASE ----------------
mongoose.connect(process.env.MONGO_URL);

const User = mongoose.model("User", {
  email: String,
  password: String,
  isAdmin: { type: Boolean, default: false },
  earnings: { type: Number, default: 0 },
  storageLimit: { type: Number, default: 15 * 1024 * 1024 * 1024 }
});

const File = mongoose.model("File", {
  userId: String,
  name: String,
  link: String
});

// ---------------- AUTH ----------------
function auth(req, res, next) {
  try {
    req.user = jwt.verify(req.headers.authorization, "secret123");
    next();
  } catch {
    res.status(401).send("Unauthorized");
  }
}

// ---------------- LOGIN ----------------
app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).send("User not found");

  const valid = await bcrypt.compare(req.body.password, user.password);
  if (!valid) return res.status(400).send("Wrong password");

  const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, "secret123");
  res.json({ token });
});

// ---------------- ADMIN ----------------
app.get("/admin/users", auth, async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.get("/admin/files", auth, async (req, res) => {
  const files = await File.find();
  res.json(files);
});

// ---------------- UPLOAD (SIMPLIFIED) ----------------
app.post("/upload", auth, async (req, res) => {
  const link = Math.random().toString(36).substring(7);

  await File.create({
    userId: req.user.id,
    name: "file",
    link
  });

  res.json({ url: `https://your-frontend.netlify.app/file/${link}` });
});

// ---------------- DOWNLOAD PAGE ----------------
app.get("/file/:link", async (req, res) => {
  res.send(`
    <html>
      <body style="text-align:center;font-family:sans-serif">
        <h2>Download Ready</h2>

        <p id="timer">Wait 5 seconds...</p>

        <script>
          let t = 5;
          let interval = setInterval(() => {
            t--;
            document.getElementById("timer").innerText = "Wait " + t + " seconds...";
            if(t <= 0){
              clearInterval(interval);
              document.getElementById("timer").innerHTML = "<a href='/download/${req.params.link}'>Download</a>";
            }
          },1000);
        </script>
      </body>
    </html>
  `);
});

// ---------------- START ----------------
app.listen(5000, () => console.log("Server running"));
