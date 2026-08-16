import User from "../models/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";
import { randomBytes } from "crypto";


// ========================================
// CREATE USER
// ========================================

export async function createUser(req, res) {

    try {

        const {
            email,
            firstName,
            lastName,
            password
        } = req.body;


        // Check required fields
        if (
            !email ||
            !firstName ||
            !lastName ||
            !password
        ) {

            return res.status(400).json({
                message: "Please fill in all required fields"
            });

        }


        // Normalize email
        const normalizedEmail =
            email.trim().toLowerCase();


        // Check whether user already exists
        const existingUser = await User.findOne({
            email: normalizedEmail
        });


        if (existingUser) {

            return res.status(409).json({
                message: "Email already registered"
            });

        }


        // Hash password
        const hashedPassword = bcrypt.hashSync(
            password,
            10
        );


        // Create customer
        const user = new User({

            email: normalizedEmail,

            firstName: firstName.trim(),

            lastName: lastName.trim(),

            password: hashedPassword

        });


        await user.save();


        return res.status(201).json({
            message: "User created successfully"
        });


    } catch (error) {

        console.error(
            "Create user error:",
            error
        );


        // MongoDB duplicate email
        if (error.code === 11000) {

            return res.status(409).json({
                message: "Email already registered"
            });

        }


        return res.status(500).json({
            message: "Failed to create user"
        });

    }

}



// ========================================
// LOGIN USER
// ========================================

export async function loginUser(req, res) {

    try {

        const {
            email,
            password
        } = req.body;


        // Validate fields
        if (!email || !password) {

            return res.status(400).json({
                message: "Email and password are required"
            });

        }


        // Normalize email
        const normalizedEmail =
            email.trim().toLowerCase();


        // Find user
        const user = await User.findOne({
            email: normalizedEmail
        });


        // User doesn't exist
        if (user == null) {

            return res.status(404).json({
                message: "User not found"
            });

        }


        // Blocked user
        if (user.isBlock === true) {

            return res.status(403).json({
                message: "Your account has been blocked"
            });

        }


        // Check password
        const isPasswordMatching =
            bcrypt.compareSync(
                password,
                user.password
            );


        if (!isPasswordMatching) {

            return res.status(401).json({
                message: "Invalid password"
            });

        }


        // Create JWT
        const token = jwt.sign(
            {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                image: user.image
            },

            process.env.JWT_SECRET
        );


        // Send login response
        return res.status(200).json({

            message: "Login successful",

            token: token,

            user: {

                email: user.email,

                firstName: user.firstName,

                lastName: user.lastName,

                role: user.role,

                isEmailVerified:
                    user.isEmailVerified,

                image: user.image

            }

        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        return res.status(500).json({
            message: "Login failed"
        });

    }

}



// ========================================
// GOOGLE LOGIN
// ========================================

export async function googleLogin(req, res) {

    try {

        const token = req.body.token;


        // Check Google access token
        if (!token) {

            return res.status(400).json({
                message: "Google token is required"
            });

        }


        // ========================================
        // GET GOOGLE USER INFORMATION
        // ========================================

        const googleResponse = await axios.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            {
                headers: {

                    Authorization:
                        `Bearer ${token}`

                }
            }
        );


        const googleUser =
            googleResponse.data;


        console.log(
            "Google User:",
            googleUser
        );


        // ========================================
        // CHECK GOOGLE EMAIL
        // ========================================

        if (!googleUser.email) {

            return res.status(400).json({
                message:
                    "Google account email was not received"
            });

        }


        // ========================================
        // CHECK VERIFIED EMAIL
        // ========================================

        if (
            googleUser.email_verified === false
        ) {

            return res.status(401).json({
                message:
                    "Google email is not verified"
            });

        }


        // Normalize Google email
        const normalizedEmail =
            googleUser.email
                .trim()
                .toLowerCase();


        // ========================================
        // FIND EXISTING USER
        // ========================================

        let user = await User.findOne({

            email: normalizedEmail

        });


        // ========================================
        // CREATE NEW GOOGLE USER
        // ========================================

        if (user == null) {


            /*
                Your User model requires password.

                Google users don't enter a password,
                therefore create a secure random password.

                User never needs to know this password.
            */


            const randomPassword =
                randomBytes(32)
                    .toString("hex");


            const hashedPassword =
                bcrypt.hashSync(
                    randomPassword,
                    10
                );


            user = new User({

                email: normalizedEmail,


                firstName:
                    googleUser.given_name ||
                    googleUser.name ||
                    "Google",


                lastName:
                    googleUser.family_name ||
                    "User",


                password:
                    hashedPassword,


                isEmailVerified:
                    true,


                image:
                    googleUser.picture ||
                    "https://www.gravatar.com/avatar"

            });


            // Save new Google user
            await user.save();


            console.log(
                "New Google user created:",
                user.email
            );


        } else {


            // ========================================
            // EXISTING USER
            // ========================================


            // Check blocked account
            if (user.isBlock === true) {

                return res.status(403).json({
                    message:
                        "Your account has been blocked"
                });

            }


            let shouldUpdateUser = false;


            // Google email is verified
            if (
                googleUser.email_verified === true &&
                user.isEmailVerified !== true
            ) {

                user.isEmailVerified = true;

                shouldUpdateUser = true;

            }


            // Update default image with Google picture
            if (
                googleUser.picture &&
                (
                    !user.image ||
                    user.image ===
                    "https://www.gravatar.com/avatar"
                )
            ) {

                user.image =
                    googleUser.picture;

                shouldUpdateUser = true;

            }


            if (shouldUpdateUser) {

                await user.save();

            }

        }


        // ========================================
        // CREATE CBC JWT TOKEN
        // ========================================

        const appToken = jwt.sign(
            {
                email: user.email,

                firstName:
                    user.firstName,

                lastName:
                    user.lastName,

                role:
                    user.role,

                isEmailVerified:
                    user.isEmailVerified,

                image:
                    user.image
            },

            process.env.JWT_SECRET
        );


        // ========================================
        // SEND LOGIN RESPONSE
        // ========================================

        return res.status(200).json({

            message:
                "Google login successful",

            token:
                appToken,

            user: {

                email:
                    user.email,

                firstName:
                    user.firstName,

                lastName:
                    user.lastName,

                role:
                    user.role,

                isEmailVerified:
                    user.isEmailVerified,

                image:
                    user.image

            }

        });


    } catch (error) {


        console.error(
            "Google login error:",
            error.response?.data ||
            error.message ||
            error
        );


        // Invalid / expired Google access token
        if (
            error.response?.status === 401 ||
            error.response?.status === 403
        ) {

            return res.status(401).json({

                message:
                    "Invalid or expired Google token"

            });

        }


        // Duplicate email
        if (error.code === 11000) {

            return res.status(409).json({

                message:
                    "Email already registered"

            });

        }


        return res.status(500).json({

            message:
                "Failed to login with Google"

        });

    }

}



// ========================================
// CHECK ADMIN
// ========================================

export function isAdmin(req) {

    if (req.user == null) {

        return false;

    }


    if (req.user.role != "admin") {

        return false;

    }


    return true;

}



// ========================================
// CHECK CUSTOMER
// ========================================

export function isCustomer(req) {

    if (req.user == null) {

        return false;

    }


    if (req.user.role != "user") {

        return false;

    }


    return true;

}



// ========================================
// GET CURRENT USER
// ========================================

export function getUser(req, res) {

    if (req.user == null) {

        return res.status(401).json({

            message: "Unauthorized"

        });

    }


    return res.json(req.user);

}