// Import required modules
const path = require("path");
const dotenv = require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");

const flash = require('connect-flash')

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

// Middleware and session configuration
app.use(bodyParser.urlencoded({ extended: false }));
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
app.use(flash())

// Set user data in request if available in session
app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch((err) => console.log(err));
});

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Register routes
app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

// Handle 404 errors
app.use(errorController.get404);

// Connect to MongoDB and start the server
mongoose
  .connect(MONGODB_URI)
  .then((result) => {
    app.listen(3000);
  })
  .catch((err) => {
    console.log(err);
  });
