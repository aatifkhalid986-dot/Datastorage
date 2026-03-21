// ===============================
// DATASTORAGE BACKEND (CLEAN MVP)
// ===============================

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// DATABASE
// ===============================
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
  link: String,
  size: Number
});

const Withdraw = mongoose.model("Withdraw", {
  userId: String,
  amount: Number,
  status: { type: String, default: "pending" }
});

// ===============================
// AUTH MIDDLEWARE
// ===============================
function auth(req, res, next) {
  try {
    req.user = jwt.verify(req.headers.authorization, "secret123");
    next();
  } catch {
    res.status(401).send("Unauthorized");
  }
}

// ===============================
// REGISTER
// ===============================
app.post("/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);

  const user = await User.create({
    email: req.body.email,
    password: hash
  });

  res.json(user);
});

// ===============================
// LOGIN
// ===============================
app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(400).send("User not found");

  const valid = await bcrypt.compare(req.body.password, user.password);
  if (!valid) return res.status(400).send("Wrong password");

  const token = jwt.sign(
    { id: user._id, isAdmin: user.isAdmin },
    "secret123"
  );

  res.json({ token });
});

// ===============================
// FILE UPLOAD (SIMULATED)
// ===============================
const upload = multer({ storage: multer.memoryStorage() });

app.post("/upload", auth, upload.single("file"), async (req, res) => {
  const link = uuidv4();

  await File.create({
    userId: req.user.id,
    name: req.file.originalname,
    link,
    size: req.file.size
  });

  res.json({
    url: `https://your-frontend.netlify.app/file/${link}`
  });
});

// ===============================
// FILE DOWNLOAD PAGE
// ===============================
app.get("/file/:link", async (req, res) => {
  res.send(`
    <html>
      <body style="text-align:center;font-family:sans-serif;background:#0f172a;color:white">

        <h2>File Ready</h2>

        <p id="timer">Wait 5 seconds...</p>

        <a id="download" style="display:none" href="/download/${req.params.link}">
          Download
        </a>

        <script>
          let t = 5;
          const timer = document.getElementById("timer");
          const link = document.getElementById("download");

          let interval = setInterval(()=>{
            t--;
            timer.innerText = "Wait " + t + " seconds...";

            if(t <= 0){
              clearInterval(interval);
              timer.style.display = "none";
              link.style.display = "block";
            }
          },1000);
        </script>

      </body>
    </html>
  `);
});

// ===============================
// DOWNLOAD FILE (SIMPLIFIED)
// ===============================
app.get("/download/:link", async (req, res) => {
  const file = await File.findOne({ link: req.params.link });
  res.json(file);
});

// ===============================
// ADMIN APIs
// ===============================
app.get("/admin/users", auth, async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.get("/admin/files", auth, async (req, res) => {
  const files = await File.find();
  res.json(files);
});

// ===============================
// EARNINGS
// ===============================
app.get("/earnings", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ earnings: user.earnings });
});

// ===============================
// WITHDRAW
// ===============================
app.post("/withdraw", auth, async (req, res) => {
  await Withdraw.create({
    userId: req.user.id,
    amount: req.body.amount
  });

  res.send("Withdraw request sent");
});

// ===============================
// ADMIN APPROVE WITHDRAW
// ===============================
app.post("/admin/approve-withdraw/:id", auth, async (req, res) => {
  const withdraw = await Withdraw.findById(req.params.id);
  const user = await User.findById(withdraw.userId);

  withdraw.status = "approved";
  user.earnings -= withdraw.amount;

  await withdraw.save();
  await user.save();

  res.send("Approved");
});

// ===============================
// START SERVER
// ===============================
app.listen(5000, () => console.log("Server running on port 5000"));
