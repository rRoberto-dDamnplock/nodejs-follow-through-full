const User = require("../models/user");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const sendgridTransport = require("nodemailer-sendgrid-transport");

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key:
        "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",
    },
  })
);

// Render the login page
exports.getLogin = (req, res, next) => {
  res.render("auth/login", {
    path: "/login",
    pageTitle: "Login",
    isAuthenticated: false,
    errorMessage: req.flash("error"),
  });
};

// Render the signup page
exports.getSignup = (req, res, next) => {
  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Signup",
    isAuthenticated: false,
    errorMessage: req.flash("error"),
  });
};

// Handle the login form submission
exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  // Find the user in the database based on the provided email
  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        // User not found, redirect to the login page
        req.flash("error", "Invalid email or password");
        return res.redirect("/login");
      }

      // Compare the provided password with the hashed password stored in the database
      bcrypt
        .compare(password, user.password)
        .then((doMatch) => {
          if (doMatch) {
            // Passwords match, set user session and redirect to the homepage
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save((err) => {
              console.log(err);
              res.redirect("/");
            });
          }

          // Passwords don't match, redirect to the login page
          res.redirect("/login");
        })
        .catch((err) => {
          // Error occurred during password comparison, redirect to the login page
          res.redirect("/login");
        });
    })
    .catch((err) => console.log(err));
};

// Handle the signup form submission
exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;

  // Find if the user with the provided email already exists in the database
  User.findOne({ email: email })
    .then((userDoc) => {
      if (userDoc) {
        // User with the provided email already exists, redirect to the signup page
        req.flash("error", "E-Mail already exists, would youlike to signup?");
        return res.redirect("/signup");
      }

      // Hash the password and create a new user
      return bcrypt
        .hash(password, 12)
        .then((hashedPassword) => {
          const user = new User({
            email: email,
            password: hashedPassword,
            cart: { items: [] },
          });
          return user.save();
        })
        .then((result) => {
          // User created successfully, redirect to the login page
          res.redirect("/login");
          return transporter.sendMail({
            to: email,
            from: "robertogasy@gmail.com",
            subject: "Signup complete",
            html: "<h1>Successful signup</h1>",
          });
        })
        .catch((err) => {
          console.log(err);
        });
    })
    .catch((err) => console.log(err));
};

// Handle the logout
exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    console.log(err);
    res.redirect("/");
  });
};

exports.getReset = (req, res, next) => {
  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "reset password",
    isAuthenticated: false,
    errorMessage: req.flash("error"),
  });
};

exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect("/reset");
    }
    const token = buffer.toString("hex");
    User.findOne({ email: req.body.email })
      .then((user) => {
        if (!user) {
          req.flash("error", "No account wth that email");
          return res.redirect("/reset");
        }
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        console.log(user);
        return user.save();
      })
      .then((result) => {
        res.redirect("/");
        transporter.sendMail({
          to: req.body.email,
          from: "robertogasy@gmail.com",
          subject: "Password reset",
          html: `<p>You requested a password reset</p>
    <p>Click  <a href='http://localhost:3000/reset/${token}'>this link</a> to set a new password</p>`,
        });
      })
      .catch((err) => {
        console.log(err);
      });
  });
};

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })
    .then((user) => {
      res.render("auth/new-password", {
        path: "/new-password",
        pageTitle: "New Password",
        isAuthenticated: false,
        passwordToken: token,

        errorMessage: req.flash("error"),
        userId: user._id.toString(),
      });
    })
    .catch((err) => {
      console.log("hello");
    });
};

exports.postNewPassword = (req, res, next) => {
  const newPassword = req.body.password;
  const userId = req.body.userId;
  const passwordToken = req.body.passwordToken;
let resetUser; 

  User.findOne({
    resetToken: passwordToken,
    resetToken: { $gt: Date.now() },
    _id: userId,
  })
    .then((user) => {
      resetUser = user;
      return bcrypt.hash(newPassword, 12);
    })
    .then((hashedPassword) => {
      resetUser.password = hashedPassword; 
      resetUser.resetToken = null; 
      resetUser.resetTokenExpiration = undefined; 
      return resetUser.save()
    }).then(result => {
      res.redirect('/login');
    })
    .catch((err) => console.log(err));
};
