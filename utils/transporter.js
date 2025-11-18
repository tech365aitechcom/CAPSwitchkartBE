import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false, // must be false for STARTTLS
    auth: {
        user: process.env.MAIL,
        pass: process.env.MAIL_PASS,
    },
});

export default transporter;
