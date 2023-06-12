const User = require("../models/user");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const { validationResult } = require("express-validator");

// Create a transporter for sending emails using SendGrid
const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: process.env.SENDGRID_API,
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
    oldInput: {
      email: '', 
      password: '', 
    }, 
    validationErrors: [],
  });
};

// Render the signup page
exports.getSignup = (req, res, next) => {
  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Signup",
    isAuthenticated: false,
    errorMessage: req.flash("error"),
    oldInput: {
      email: '',
      password: '',
      confirmPassword: '',
    },
    validationErrors: [],
  });
};

// Handle the login form submission
exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render("auth/login", {
      path: "/signup",
      pageTitle: "Signup",
      isAuthenticated: false,
      errorMessage:'Invalid email or password',
      oldInput: {
        email: email, 
        password: password,
      }, 
      validationErrors: [{param: 'email'}]
    });
  }

  // Find the user in the database based on the provided email
  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        // User not found, redirect to the login page
        req.flash("error", "Invalid email or password");
        return res.status(422).render("auth/login", {
          path: "/signup",
          pageTitle: "Signup",
          isAuthenticated: false,
          errorMessage:'Invalid email or password',
          oldInput: {
            email: email, 
            password: password,
          }, 
          validationErrors: [{param: 'email'}]
        });
        console.log('how did we reach HERE!!')

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

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render("auth/signup", {
      path: "/signup",
      pageTitle: "Signup",
      isAuthenticated: false,
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
        confirmPassword: req.body.confirmPassword,
      },
      validationErrors: errors.array()
    });
  }
  // Find if the user with the provided email already exists in the database

  // User.findOne({ email: email })
  //   .then((userDoc) => {
  //     if (userDoc) {
  //       // User with the provided email already exists, redirect to the signup page
  //       req.flash("error", "E-Mail already exists, would you like to signup?");
  //       return res.redirect("/signup");
  //     }

  // Hash the password and create a new user
  bcrypt
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
    .catch((err) => console.log(err));
};

// Handle the logout
exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    console.log(err);
    res.redirect("/");
  });
};

// Render the reset password page
exports.getReset = (req, res, next) => {
  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "Reset Password",
    isAuthenticated: false,
    errorMessage: req.flash("error"),
  });
};

// Handle the reset password form submission
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
          req.flash("error", "No account with that email");
          return res.redirect("/reset");
        }
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        console.log(user);
        return user
          .save()
          .then((result) => {
            transporter.sendMail({
              to: req.body.email,
              from: "robertogasy@gmail.com",
              subject: "Password reset",
              html: `<p>You requested a password reset</p>
  <p>Click  <a href='http://localhost:3000/reset/${token}'>this link</a> to set a new password</p>`,
            });
          })
          .then(() => {
            res.redirect("/");
          });
      })
      .catch((err) => {
        console.log(err);
      });
  });
};

// Render the new password page
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
      console.log("Error: ", err);
    });
};

// Handle the new password form submission
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
      return resetUser.save();
    })
    .then((result) => {
      res.redirect("/login");
    })
    .catch((err) => console.log(err));
};
