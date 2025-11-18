import https from "https";
import smsModel from "../models/smsModel.js";
const AUTH_KEY = process.env.MSG91_AUTHKEY;
const TEMPLATE_ID = process.env.MSG91_FLOW_TEMPLATE_ID; // Flow template ID from MSG91
const OTP_EXPIRY_MINUTES = 5;

// Helper: HTTPS request to MSG91
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];

      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        try {
          const json = JSON.parse(body);
          json.type === "success" ? resolve(json) : reject(new Error(json.message));
        } catch (err) {
          reject(new Error("Invalid JSON response from MSG91"));
        }
      });
    });

    req.on("error", reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// POST /api/otp/send
export const sendOTP = async (req, res) => {
  const { mobileNumber } = req.body;
  if (!mobileNumber) {
    return res.status(400).json({ error: "Mobile number is required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const options = {
    method: "POST",
    hostname: "control.msg91.com",
    path: "/api/v5/flow",
    headers: {
      authkey: AUTH_KEY,
      "Content-Type": "application/json",
    },
  };

  const body = {
    flow_id: TEMPLATE_ID,
    recipients: [{ mobiles: `91${mobileNumber}`, var1: otp }],
  };

  try {
    await smsModel.findOneAndUpdate(
      { mobileNumber },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    const response = await makeRequest(options, body);
    return res.status(200).json({ success: true, msg91Response: response });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/otp/verify
export const verifyOTP = async (req, res) => {
  const { mobileNumber, otp } = req.body;
  if (!mobileNumber || !otp) {
    return res.status(400).json({ error: "Mobile number and OTP are required" });
  }

  try {
    const record = await smsModel.findOne({ mobileNumber });
    if (!record) {
      return res.status(400).json({ error: "OTP not found" });
    }

    const isExpired = (Date.now() - new Date(record.createdAt).getTime()) / 60000 > OTP_EXPIRY_MINUTES;
    if (isExpired) {
      return res.status(400).json({ error: "OTP expired" });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // OTP is valid
    await smsModel.deleteOne({ mobileNumber }); // Optional: remove OTP after verification
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
