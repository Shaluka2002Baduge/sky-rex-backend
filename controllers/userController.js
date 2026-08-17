import User from "../models/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";
import { randomBytes } from "crypto";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import OTP from "../models/otpModel.js";


dotenv.config();


// ========================================
// EMAIL TRANSPORTER
// ========================================

const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.APP_PASSWORD,
    },
});



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


        const normalizedEmail =
            email.trim().toLowerCase();


        const existingUser = await User.findOne({
            email: normalizedEmail
        });


        if (existingUser) {

            return res.status(409).json({
                message: "Email already registered"
            });

        }


        const hashedPassword =
            bcrypt.hashSync(
                password,
                10
            );


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


        if (!email || !password) {

            return res.status(400).json({
                message: "Email and password are required"
            });

        }


        const normalizedEmail =
            email.trim().toLowerCase();


        const user = await User.findOne({
            email: normalizedEmail
        });


        if (user == null) {

            return res.status(404).json({
                message: "User not found"
            });

        }


        if (user.isBlock === true) {

            return res.status(403).json({
                message: "Your account has been blocked"
            });

        }


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

                image:
                    user.image

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

        const token =
            req.body.token;


        if (!token) {

            return res.status(400).json({
                message: "Google token is required"
            });

        }


        const googleResponse =
            await axios.get(
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


        if (!googleUser.email) {

            return res.status(400).json({
                message:
                    "Google account email was not received"
            });

        }


        if (
            googleUser.email_verified === false
        ) {

            return res.status(401).json({
                message:
                    "Google email is not verified"
            });

        }


        const normalizedEmail =
            googleUser.email
                .trim()
                .toLowerCase();


        let user =
            await User.findOne({
                email: normalizedEmail
            });


        if (user == null) {


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


            await user.save();


            console.log(
                "New Google user created:",
                user.email
            );


        } else {


            if (user.isBlock === true) {

                return res.status(403).json({
                    message:
                        "Your account has been blocked"
                });

            }


            let shouldUpdateUser =
                false;


            if (
                googleUser.email_verified === true &&
                user.isEmailVerified !== true
            ) {

                user.isEmailVerified =
                    true;

                shouldUpdateUser =
                    true;

            }


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

                shouldUpdateUser =
                    true;

            }


            if (shouldUpdateUser) {

                await user.save();

            }

        }


        const appToken =
            jwt.sign(
                {
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
                },

                process.env.JWT_SECRET
            );


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


        if (
            error.response?.status === 401 ||
            error.response?.status === 403
        ) {

            return res.status(401).json({

                message:
                    "Invalid or expired Google token"

            });

        }


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

            message:
                "Unauthorized"

        });

    }


    return res.json(
        req.user
    );

}



// ========================================
// GET ALL USERS
// ========================================

export async function getAllUsers(req, res) {

    if (!isAdmin(req)) {

        res.status(403).json({
            message: "Forbidden"
        });

        return;
    }


    try {

        const users =
            await User.find();


        res.json(
            users
        );


    } catch (err) {

        res.status(500).json({
            message:
                "Failed to get users"
        });

    }

}



// ========================================
// BLOCK / UNBLOCK USER
// ========================================

export async function blockOrUnblockUser(req, res) {

    if (!isAdmin(req)) {

        res.status(403).json({
            message: "Forbidden"
        });

        return;
    }


    if (
        req.user.email ==
        req.params.email
    ) {

        res.status(400).json({
            message:
                "You cannot block yourself"
        });

        return;
    }


    try {

        await User.updateOne(
            {
                email:
                    req.params.email
            },
            {
                isBlock:
                    req.body.isBlock
            }
        );


        res.status(200).json({

            message:
                req.body.isBlock
                    ? "User blocked successfully"
                    : "User unblocked successfully"

        });


    } catch (err) {

        console.log(err);


        res.status(500).json({
            message:
                "Failed to block/unblock user"
        });

    }

}



// ========================================
// SEND PASSWORD RESET OTP
// ========================================

export async function sendOTP(req, res) {

    const email =
        req.params.email;


    if (
        email == null ||
        email.trim() == ""
    ) {

        return res.status(400).json({
            message:
                "Email is required"
        });

    }


    const normalizedEmail =
        email
            .trim()
            .toLowerCase();


    try {


        // ========================================
        // CHECK WHETHER USER EXISTS
        // ========================================

        const user =
            await User.findOne({
                email:
                    normalizedEmail
            });


        if (user == null) {

            return res.status(404).json({
                message:
                    "User not found"
            });

        }


        // ========================================
        // DELETE PREVIOUS OTP
        // ========================================

        await OTP.deleteMany({
            email:
                normalizedEmail
        });


        // ========================================
        // GENERATE 6 DIGIT OTP
        // ========================================

        const otp =
            Math.floor(
                100000 +
                Math.random() *
                900000
            ).toString();


        // ========================================
        // SAVE OTP
        // ========================================

        const newOTP =
            new OTP({

                email:
                    normalizedEmail,

                otp:
                    otp

            });


        await newOTP.save();


        // ========================================
        // SEND CRYSTAL BEAUTY PASSWORD RESET EMAIL
        // ========================================

        await transporter.sendMail({

            from: {
                name: "Crystal Beauty",
                address: process.env.EMAIL_USER
            },

            to:
                normalizedEmail,

            subject:
                "Reset Your Crystal Beauty Password",

            // ========================================
            // PLAIN TEXT FALLBACK
            // ========================================

            text:
                `Hello ${user.firstName || "there"},\n\n` +
                `We received a request to reset your Crystal Beauty account password.\n\n` +
                `Your verification code is: ${otp}\n\n` +
                `Please do not share this verification code with anyone.\n\n` +
                `If you did not request a password reset, you can safely ignore this email.\n\n` +
                `Regards,\n` +
                `Your Crystal Beauty Team`,


            // ========================================
            // HTML EMAIL
            // ========================================

            html: `
                <!DOCTYPE html>

                <html lang="en">

                <head>

                    <meta charset="UTF-8">

                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1.0"
                    >

                    <meta
                        name="color-scheme"
                        content="light"
                    >

                    <meta
                        name="supported-color-schemes"
                        content="light"
                    >

                    <title>
                        Crystal Beauty Password Reset
                    </title>

                </head>


                <body
                    style="
                        margin: 0;
                        padding: 0;
                        background-color: #FEF3E2;
                        font-family: Arial, Helvetica, sans-serif;
                        color: #393e46;
                    "
                >


                    <!-- EMAIL BACKGROUND -->

                    <table
                        width="100%"
                        border="0"
                        cellspacing="0"
                        cellpadding="0"
                        role="presentation"
                        style="
                            width: 100%;
                            margin: 0;
                            padding: 0;
                            background-color: #FEF3E2;
                        "
                    >

                        <tr>

                            <td
                                align="center"
                                style="
                                    padding: 50px 16px;
                                "
                            >


                                <!-- MAIN EMAIL CARD -->

                                <table
                                    width="600"
                                    border="0"
                                    cellspacing="0"
                                    cellpadding="0"
                                    role="presentation"
                                    style="
                                        width: 100%;
                                        max-width: 600px;
                                        background-color: #ffffff;
                                        border-radius: 20px;
                                        overflow: hidden;
                                        box-shadow:
                                            0 10px 35px
                                            rgba(57, 62, 70, 0.12);
                                    "
                                >


                                    <!-- TOP ACCENT LINE -->

                                    <tr>

                                        <td
                                            style="
                                                height: 6px;
                                                background-color: #FA812F;
                                                font-size: 0;
                                                line-height: 0;
                                            "
                                        >
                                            &nbsp;
                                        </td>

                                    </tr>


                                    <!-- ========================================
                                         HEADER
                                    ======================================== -->

                                    <tr>

                                        <td
                                            align="center"
                                            style="
                                                background-color: #393e46;
                                                padding: 38px 35px 35px;
                                            "
                                        >


                                            <!-- BRAND ICON -->

                                            <table
                                                border="0"
                                                cellspacing="0"
                                                cellpadding="0"
                                                role="presentation"
                                            >

                                                <tr>

                                                    <td
                                                        align="center"
                                                        valign="middle"
                                                        width="58"
                                                        height="58"
                                                        style="
                                                            width: 58px;
                                                            height: 58px;
                                                            background-color: #FA812F;
                                                            border-radius: 16px;
                                                            color: #ffffff;
                                                            font-size: 28px;
                                                            font-weight: bold;
                                                            line-height: 58px;
                                                        "
                                                    >
                                                        &#10003;
                                                    </td>

                                                </tr>

                                            </table>


                                            <!-- BUSINESS NAME -->

                                            <p
                                                style="
                                                    margin: 18px 0 7px;
                                                    padding: 0;
                                                    color: #FA812F;
                                                    font-size: 12px;
                                                    line-height: 18px;
                                                    font-weight: 700;
                                                    text-transform: uppercase;
                                                    letter-spacing: 2px;
                                                "
                                            >
                                                Crystal Beauty
                                            </p>


                                            <h1
                                                style="
                                                    margin: 0 0 8px;
                                                    padding: 0;
                                                    color: #ffffff;
                                                    font-size: 25px;
                                                    line-height: 32px;
                                                    font-weight: 700;
                                                    letter-spacing: -0.4px;
                                                "
                                            >
                                                Password Reset
                                            </h1>


                                            <p
                                                style="
                                                    margin: 0;
                                                    padding: 0;
                                                    color: #d7d9dc;
                                                    font-size: 14px;
                                                    line-height: 22px;
                                                "
                                            >
                                                Secure account verification
                                            </p>


                                        </td>

                                    </tr>


                                    <!-- ========================================
                                         EMAIL BODY
                                    ======================================== -->

                                    <tr>

                                        <td
                                            style="
                                                padding:
                                                    42px
                                                    42px
                                                    20px;
                                            "
                                        >


                                            <!-- GREETING -->

                                            <p
                                                style="
                                                    margin:
                                                        0
                                                        0
                                                        18px;
                                                    padding: 0;
                                                    color: #393e46;
                                                    font-size: 17px;
                                                    line-height: 26px;
                                                    font-weight: 600;
                                                "
                                            >
                                                Hello ${
                                                    user.firstName ||
                                                    "there"
                                                },
                                            </p>


                                            <!-- INTRODUCTION -->

                                            <p
                                                style="
                                                    margin:
                                                        0
                                                        0
                                                        28px;
                                                    padding: 0;
                                                    color: #696d74;
                                                    font-size: 15px;
                                                    line-height: 25px;
                                                "
                                            >
                                                We received a request to reset
                                                the password associated with your
                                                Crystal Beauty account. Use the
                                                verification code below to
                                                continue securely.
                                            </p>


                                            <!-- ========================================
                                                 OTP CARD
                                            ======================================== -->

                                            <table
                                                width="100%"
                                                border="0"
                                                cellspacing="0"
                                                cellpadding="0"
                                                role="presentation"
                                                style="
                                                    width: 100%;
                                                    background-color: #FEF3E2;
                                                    border:
                                                        1px solid
                                                        #F9D6B8;
                                                    border-radius: 16px;
                                                "
                                            >

                                                <tr>

                                                    <td
                                                        align="center"
                                                        style="
                                                            padding:
                                                                30px
                                                                20px;
                                                        "
                                                    >


                                                        <p
                                                            style="
                                                                margin:
                                                                    0
                                                                    0
                                                                    12px;
                                                                padding: 0;
                                                                color: #777b82;
                                                                font-size: 12px;
                                                                line-height: 18px;
                                                                font-weight: 700;
                                                                text-transform: uppercase;
                                                                letter-spacing: 1.5px;
                                                            "
                                                        >
                                                            Your Verification Code
                                                        </p>


                                                        <!-- OTP -->

                                                        <p
                                                            style="
                                                                margin: 0;
                                                                padding: 0;
                                                                color: #FA812F;
                                                                font-size: 38px;
                                                                line-height: 48px;
                                                                font-weight: 800;
                                                                letter-spacing: 9px;
                                                            "
                                                        >
                                                            ${otp}
                                                        </p>


                                                    </td>

                                                </tr>

                                            </table>


                                            <!-- OTP INSTRUCTION -->

                                            <p
                                                style="
                                                    margin:
                                                        18px
                                                        0
                                                        30px;
                                                    padding: 0;
                                                    text-align: center;
                                                    color: #888b90;
                                                    font-size: 12px;
                                                    line-height: 19px;
                                                "
                                            >
                                                Enter this code on the
                                                Crystal Beauty password reset
                                                page to continue.
                                            </p>


                                            <!-- ========================================
                                                 SECURITY NOTICE
                                            ======================================== -->

                                            <table
                                                width="100%"
                                                border="0"
                                                cellspacing="0"
                                                cellpadding="0"
                                                role="presentation"
                                                style="
                                                    width: 100%;
                                                    background-color: #f7f7f7;
                                                    border-left:
                                                        4px solid
                                                        #FA812F;
                                                    border-radius: 8px;
                                                "
                                            >

                                                <tr>

                                                    <td
                                                        style="
                                                            padding:
                                                                18px
                                                                20px;
                                                        "
                                                    >

                                                        <p
                                                            style="
                                                                margin:
                                                                    0
                                                                    0
                                                                    5px;
                                                                padding: 0;
                                                                color: #393e46;
                                                                font-size: 13px;
                                                                line-height: 20px;
                                                                font-weight: 700;
                                                            "
                                                        >
                                                            Security Notice
                                                        </p>


                                                        <p
                                                            style="
                                                                margin: 0;
                                                                padding: 0;
                                                                color: #696d74;
                                                                font-size: 13px;
                                                                line-height: 21px;
                                                            "
                                                        >
                                                            Never share this
                                                            verification code
                                                            with anyone.
                                                            Crystal Beauty will
                                                            never ask you for
                                                            your OTP or password.
                                                        </p>

                                                    </td>

                                                </tr>

                                            </table>


                                            <!-- IGNORE NOTICE -->

                                            <p
                                                style="
                                                    margin:
                                                        28px
                                                        0
                                                        0;
                                                    padding: 0;
                                                    color: #7b7f85;
                                                    font-size: 14px;
                                                    line-height: 23px;
                                                "
                                            >
                                                If you did not request this
                                                password reset, no action is
                                                required. You can safely ignore
                                                this email and your account will
                                                remain secure.
                                            </p>


                                        </td>

                                    </tr>


                                    <!-- ========================================
                                         SIGNATURE
                                    ======================================== -->

                                    <tr>

                                        <td
                                            style="
                                                padding:
                                                    14px
                                                    42px
                                                    38px;
                                            "
                                        >

                                            <p
                                                style="
                                                    margin: 0;
                                                    padding: 0;
                                                    color: #393e46;
                                                    font-size: 14px;
                                                    line-height: 23px;
                                                "
                                            >
                                                Regards,
                                                <br>

                                                <strong
                                                    style="
                                                        color: #FA812F;
                                                    "
                                                >
                                                    Your Crystal Beauty Team
                                                </strong>

                                            </p>

                                        </td>

                                    </tr>


                                    <!-- ========================================
                                         FOOTER
                                    ======================================== -->

                                    <tr>

                                        <td
                                            align="center"
                                            style="
                                                background-color: #393e46;
                                                padding:
                                                    25px
                                                    30px;
                                            "
                                        >

                                            <p
                                                style="
                                                    margin:
                                                        0
                                                        0
                                                        8px;
                                                    padding: 0;
                                                    color: #d3d5d8;
                                                    font-size: 12px;
                                                    line-height: 19px;
                                                "
                                            >
                                                This is an automated security
                                                email from Crystal Beauty.
                                                Please do not reply to this
                                                message.
                                            </p>


                                            <p
                                                style="
                                                    margin: 0;
                                                    padding: 0;
                                                    color: #aeb1b5;
                                                    font-size: 11px;
                                                    line-height: 18px;
                                                "
                                            >
                                                &copy;
                                                ${new Date().getFullYear()}
                                                Crystal Beauty.
                                                All rights reserved.
                                            </p>

                                        </td>

                                    </tr>


                                </table>


                                <!-- OUTSIDE FOOTER -->

                                <table
                                    width="600"
                                    border="0"
                                    cellspacing="0"
                                    cellpadding="0"
                                    role="presentation"
                                    style="
                                        width: 100%;
                                        max-width: 600px;
                                    "
                                >

                                    <tr>

                                        <td
                                            align="center"
                                            style="
                                                padding:
                                                    20px
                                                    20px
                                                    0;
                                            "
                                        >

                                            <p
                                                style="
                                                    margin: 0;
                                                    padding: 0;
                                                    color: #96999e;
                                                    font-size: 11px;
                                                    line-height: 18px;
                                                "
                                            >
                                                You received this email
                                                because a password reset was
                                                requested for
                                                ${normalizedEmail}.
                                            </p>

                                        </td>

                                    </tr>

                                </table>


                            </td>

                        </tr>

                    </table>


                </body>

                </html>
            `

        });


        return res.status(200).json({

            message:
                "OTP sent to your email"

        });


    } catch (err) {


        console.error(
            "SEND OTP ERROR:",
            err
        );


        return res.status(500).json({

            message:
                "Failed to send OTP"

        });

    }

}



// ========================================
// CHANGE PASSWORD USING OTP
// ========================================

export async function changePasswordViaOTP(req, res) {

    const email =
        req.body.email;

    const otp =
        req.body.otp;

    const newPassword =
        req.body.newPassword;


    // Validate email
    if (
        email == null ||
        email.trim() == ""
    ) {

        return res.status(400).json({

            message:
                "Email is required"

        });

    }


    // Validate OTP
    if (
        otp == null ||
        otp
            .toString()
            .trim() == ""
    ) {

        return res.status(400).json({

            message:
                "OTP is required"

        });

    }


    // Validate password
    if (
        newPassword == null ||
        newPassword == ""
    ) {

        return res.status(400).json({

            message:
                "New password is required"

        });

    }


    const normalizedEmail =
        email
            .trim()
            .toLowerCase();


    const normalizedOTP =
        otp
            .toString()
            .trim();


    try {


        // ========================================
        // FIND MATCHING OTP
        // ========================================

        const otpRecord =
            await OTP.findOne({

                email:
                    normalizedEmail,

                otp:
                    normalizedOTP

            });


        console.log(
            "RESET EMAIL:",
            normalizedEmail
        );


        console.log(
            "ENTERED OTP:",
            normalizedOTP
        );


        console.log(
            "OTP RECORD:",
            otpRecord
        );


        if (
            otpRecord == null
        ) {

            return res.status(400).json({

                message:
                    "Invalid OTP"

            });

        }


        // ========================================
        // MAKE SURE USER STILL EXISTS
        // ========================================

        const user =
            await User.findOne({

                email:
                    normalizedEmail

            });


        if (
            user == null
        ) {

            return res.status(404).json({

                message:
                    "User not found"

            });

        }


        // ========================================
        // HASH NEW PASSWORD
        // ========================================

        const hashedPassword =
            bcrypt.hashSync(
                newPassword,
                10
            );


        // ========================================
        // UPDATE PASSWORD
        // ========================================

        await User.updateOne(

            {
                email:
                    normalizedEmail
            },

            {
                password:
                    hashedPassword
            }

        );


        // ========================================
        // OTP CAN ONLY BE USED ONCE
        // ========================================

        await OTP.deleteMany({

            email:
                normalizedEmail

        });


        return res.status(200).json({

            message:
                "Password changed successfully"

        });


    } catch (err) {


        console.error(
            "CHANGE PASSWORD ERROR:",
            err
        );


        return res.status(500).json({

            message:
                "Failed to change password"

        });

    }

}