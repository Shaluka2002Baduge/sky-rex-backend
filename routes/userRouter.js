import express from "express";

import {
    blockOrUnblockUser,
    changePasswordViaOTP,
    createUser,
    getAllUsers,
    getUser,
    googleLogin,
    loginUser,
    sendOTP
} from "../controllers/userController.js";


const userRouter = express.Router();


// Register
userRouter.post("/", createUser);


// Login
userRouter.post("/login", loginUser);


// Google Login
userRouter.post("/google-login", googleLogin);


// Current User
userRouter.get("/me", getUser);


// All Users
userRouter.get("/all-users", getAllUsers);


// Block / Unblock
userRouter.put("/block/:email", blockOrUnblockUser);


// Send OTP
userRouter.get("/send-otp/:email", sendOTP);


// Change Password
userRouter.post("/change-password", changePasswordViaOTP);


export default userRouter;