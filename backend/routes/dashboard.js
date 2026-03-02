import express from "express";
import mysql from "mysql2/promise";
import cookieParser from "cookie-parser";
import Session from "express-session";

const Dashboardrouter = express.Router();

Dashboardrouter.use(Session({
secret:'fissk',
resave:false,
saveUninitialized:false
}));

Dashboardrouter.get('/', async (req, res) => {
    const sessionUser=req.session.user;
    res.json({ 
        text:"worked",
        userData: req.session
    });
    
    console.log('Session:',req.session);
    console.log('Session:',req.session.user);
});


export default Dashboardrouter;