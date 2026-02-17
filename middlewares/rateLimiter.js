import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for login attempts
 * Limits: 5 requests per 15 minutes per email
 * Prevents brute-force password attacks
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each email to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests
  skipFailedRequests: false,
  keyGenerator: (req) => {
    // Use email as the key for rate limiting instead of IP
    const email = req.body.email || req.body.username || '';
    return `login-${email.toLowerCase()}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts for this account. Please try again after 15 minutes.',
    });
  },
});

/**
 * Rate limiter for OTP verification attempts
 * Limits: 5 requests per 5 minutes per IP
 * Prevents OTP brute-force attacks
 */
export const otpVerificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 OTP verification attempts per windowMs
  message: {
    success: false,
    message: 'Too many OTP verification attempts. Please try again after 5 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    // Use phone number as the key for rate limiting
    const phone = req.body.phone || req.body.phoneNumber || '';
    return `otp-verify-${phone}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many OTP verification attempts. Please wait 5 minutes before trying again.',
    });
  },
});

/**
 * Rate limiter for OTP sending (request OTP)
 * Limits: 3 requests per 10 minutes per phone number
 * Prevents OTP spam
 */
export const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // Limit each phone number to 3 OTP requests per windowMs
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again after 10 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use phone number or email as the key
    const phone = req.body.phone || req.body.phoneNumber || req.body.email || '';
    return `otp-request-${phone}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many OTP requests for this number. Please wait 10 minutes before requesting again.',
    });
  },
});

/**
 * Rate limiter for password reset attempts
 * Limits: 3 requests per 15 minutes per email
 * Prevents password reset abuse
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each email to 3 password reset requests per windowMs
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body.email || '';
    return `password-reset-${email}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many password reset requests. Please wait 15 minutes before trying again.',
    });
  },
});

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 * Prevents general API abuse
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP address. Please slow down.',
    });
  },
});

export default {
  loginLimiter,
  otpVerificationLimiter,
  otpRequestLimiter,
  passwordResetLimiter,
  generalLimiter,
};
