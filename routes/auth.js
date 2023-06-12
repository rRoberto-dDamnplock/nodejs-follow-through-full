const express = require("express");

const authController = require("../controllers/auth");
const isAuth = require("../middleware/is-auth");
const { check, body } = require("express-validator");
const User = require("../models/user");

const router = express.Router();

router.get("/login", authController.getLogin);

router.get("/signup", authController.getSignup);

router.post(
  "/login",
  [
    check("email")
      .isEmail()
      .withMessage("Please make sure email is valid")
      .custom((value, { req }) => {
        return User.findOne({ email: value }).then((user) => {
          if (!user) {
            console.log("NO USER");
            return Promise.reject(
              "We have not find matching users with this email, please signup"
            );
          }
          //   return true;
        });
      }).normalizeEmail(),
    body(
      "password",
      "Invalid password, incorrect password or too short."
    ).isLength({ min: 5 }).trim(),
  ],
  authController.postLogin
);

router.post(
  "/signup",
  [
    check("email")
      .isEmail()
      .withMessage("Please enter a valid email")
      .custom((value, { req }) => {
        // if (value === "test@test.com") {
        //   throw new Error("This email address is forbidden");
        // }
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            // User with the provided email already exists, redirect to the signup page
            return Promise.reject(
              "Email already exists, please pick another one or signup"
            );
          }
        });
      }).normalizeEmail(),
    body("password", "Please enter a valid password")
      .isLength({ min: 5 })
      .isAlphanumeric().trim(),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords have to match");
      }
      return true;
    }),
  ],
  authController.postSignup
);

router.post("/logout", isAuth, authController.postLogout);

router.get("/reset", authController.getReset);

router.post("/reset", authController.postReset);

router.get("/reset/:token", authController.getNewPassword);

router.post("/new-password", authController.postNewPassword);

module.exports = router;
