import express from "express";


import {
    createUser,
    getUser,
    googleLogin,
    loginUser
} from "../controllers/userController.js";


const userRouter = express.Router();



// ========================================
// REGISTER USER
// ========================================

userRouter.post(
    "/",
    createUser
);



// ========================================
// NORMAL LOGIN
// ========================================

userRouter.post(
    "/login",
    loginUser
);



// ========================================
// GOOGLE LOGIN
// ========================================

userRouter.post(
    "/google-login",
    googleLogin
);



// ========================================
// GET CURRENT USER
// ========================================

userRouter.get(
    "/me",
    getUser
);



export default userRouter;