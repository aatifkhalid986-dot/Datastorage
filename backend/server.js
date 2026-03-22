require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

// ================= DATABASE =================
mongoose.connect(process.env.MONGO_URL);

const User = mongoose.model("User", {
  email: String,
  password: String,
  isAdmin: { type: Boolean, default: false },
  earnings: { type: Number, default: 0 }
});

const File = mongoose.model("File", {
  userId: String,
  name: String,
  url: String,
  link: String
});

// ================= AWS =================
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION
});

// ================= AUTH =================
function auth(req, res, next) {
  try {
    req.user = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).send("Unauthorized");
  }
}

// ================= MULTER S3 =================
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET,
    acl: "public-read",
    key: function (req, file, cb) {
      cb(null, Date.now() + "-" + file.originalname);
    }
  })
});

// ================= REGISTER =================
app.post("/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);

  const user = await User.create({
    email: req.body.email,
    password: hash
  });

  res.json(user);
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) return res.status(400).send("User not found");

  const valid = await bcrypt.compare(req.body.password, user.password);
  if (!valid) return res.status(400).send("Wrong password");

  const token = jwt.sign(
    { id: user._id, isAdmin: user.isAdmin },
    process.env.JWT_SECRET
  );

  res.json({ token });
});

// ================= UPLOAD =================
app.post("/upload", auth, upload.single("file"), async (req, res) => {
  const link = uuidv4();

  await File.create({
    userId: req.user.id,
    name: req.file.originalname,
    url: req.file.location,
    link
  });

  res.json({
    url: `https://your-backend.onrender.com/file/${link}`
  });
});

// ================= FILE PAGE (AD + TIMER) =================
app.get("/file/:link", async (req, res) => {
  const file = await File.findOne({ link: req.params.link });

  if (!file) return res.send("File not found");

  res.send(`
  <html>
  <head>
    <title>${file.name}</title>
  </head>

  <body style="text-align:center;font-family:sans-serif;background:#0f172a;color:white">

    <h2>${file.name}</h2>

    <!-- Adsterra Ad -->
    <div style="margin:20px;">
      <script type="text/javascript">
        atOptions = {
          'key' : 'f922c7efba5ee0219441cd2d13d3611a',
          'format' : 'iframe',
          'height' : 250,
          'width' : 300
        };
      </script>
      <script src="//www.topcreativeformat.com/f922c7efba5ee0219441cd2d13d3611a/invoke.js"></script>
    </div>

    <p id="timer">Please wait 8 seconds...</p>

    <button id="downloadBtn" style="display:none;padding:12px 20px;background:#22c55e;border:none;border-radius:10px">
      Download File
    </button>

    <script>
      let time = 8;
      const timer = document.getElementById("timer");
      const btn = document.getElementById("downloadBtn");

      let interval = setInterval(() => {
        time--;
        timer.innerText = "Please wait " + time + " seconds...";

        if(time <= 0){
          clearInterval(interval);
          timer.style.display = "none";
          btn.style.display = "inline-block";
        }
      }, 1000);

      btn.onclick = () => {
        window.location.href = "/download/${file.link}";
      };
    </script>

  </body>
  </html>
  `);
});

// ================= DOWNLOAD =================
app.get("/download/:link", async (req, res) => {
  const file = await File.findOne({ link: req.params.link });

  if (!file) return res.send("File not found");

  res.redirect(file.url);
});

// ================= ADMIN =================
app.get("/admin/users", auth, async (req, res) => {
  res.json(await User.find());
});

app.get("/admin/files", auth, async (req, res) => {
  res.json(await File.find());
});

// ================= START =================
app.listen(5000, () => console.log("Server running on port 5000"));
