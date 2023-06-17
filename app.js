// Import required modules
const path = require("path");
const dotenv = require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");
const multer = require("multer");

const flash = require("connect-flash");

// Import controllers and models
const errorController = require("./controllers/error");
const User = require("./models/user");

// Set up MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI;

// Create express app
const app = express();

// Set up session store
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: "sessions",
});

const csrfProtection = csrf();

// Configure view engine and views directory
app.set("view engine", "ejs");
app.set("views", "views");

// Import routes
const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString() + "_" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimeType === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ){
    cb(null, true);
  } else {

    cb(null, false);
  }

};

// Middleware and session configuration
app.use(bodyParser.urlencoded({ extended: false }));
app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single("image"));

app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "my secret",
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Set user data in request if available in session
app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then((user) => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch((err) => {
      throw new Error(err);
    });
});

// Register routes
app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

// app.use((error, req, res, next) => {
//   res.status(500).json({ error: error.message, stack: error.stack });
// });

app.get("/500", errorController.get500);
// Handle 404 errors
app.use(errorController.get404);

app.use((error, req, res, next) => {
  res.redirect("/500");
});

// Connect to MongoDB and start the server
mongoose
  .connect(MONGODB_URI)
  .then((result) => {
    app.listen(3000);
  })
  .catch((err) => {
    console.log(err);
  });
