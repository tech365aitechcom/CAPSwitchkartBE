/**
 * Validation utilities for company registration and data validation
 */

/**
 * Validate GST Number format
 * Format: 2 digits (state code) + 10 chars (PAN) + 1 char (entity number) + Z + 1 check digit
 * Example: 29ABCDE1234F1Z5
 */
export const validateGSTNumber = (gstNumber) => {
  if (!gstNumber || typeof gstNumber !== 'string') {
    return { valid: false, message: 'GST number is required' }
  }

  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

  if (!gstRegex.test(gstNumber.trim().toUpperCase())) {
    return {
      valid: false,
      message: 'Invalid GST number format. Expected format: 29ABCDE1234F1Z5',
    }
  }

  return { valid: true, message: 'Valid GST number' }
}

/**
 * Validate PAN Number format
 * Format: 5 chars (letters) + 4 digits + 1 char (letter)
 * Example: ABCDE1234F
 */
export const validatePANNumber = (panNumber) => {
  if (!panNumber || typeof panNumber !== 'string') {
    return { valid: false, message: 'PAN number is required' }
  }

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

  if (!panRegex.test(panNumber.trim().toUpperCase())) {
    return {
      valid: false,
      message: 'Invalid PAN number format. Expected format: ABCDE1234F',
    }
  }

  return { valid: true, message: 'Valid PAN number' }
}

/**
 * Validate contact number format
 * Supports: Indian mobile numbers with optional country code
 */
export const validateContactNumber = (contactNumber) => {
  if (!contactNumber || typeof contactNumber !== 'string') {
    return { valid: false, message: 'Contact number is required' }
  }

  // Remove spaces, hyphens, and parentheses
  const cleaned = contactNumber.replace(/[\s\-\(\)]/g, '')

  // Indian mobile: 10 digits starting with 6-9, or with +91 prefix
  const mobileRegex = /^(\+91)?[6-9]\d{9}$/

  if (!mobileRegex.test(cleaned)) {
    return {
      valid: false,
      message: 'Invalid contact number. Must be a valid Indian mobile number',
    }
  }

  return { valid: true, message: 'Valid contact number' }
}

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Email is required' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(email.trim().toLowerCase())) {
    return { valid: false, message: 'Invalid email format' }
  }

  return { valid: true, message: 'Valid email' }
}

/**
 * Validate file upload
 * Checks file type and size
 */
export const validateFileUpload = (file, maxSizeInMB = 5) => {
  if (!file) {
    return { valid: false, message: 'File is required' }
  }

  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ]
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024

  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      message: 'Invalid file type. Only PDF, JPG, and PNG files are allowed',
    }
  }

  if (file.size > maxSizeInBytes) {
    return {
      valid: false,
      message: `File size exceeds ${maxSizeInMB}MB limit`,
    }
  }

  return { valid: true, message: 'Valid file' }
}

/**
 * Validate company registration data
 */
export const validateCompanyRegistration = (companyData) => {
  const errors = []

  // Required fields
  const requiredFields = [
    'name',
    'address',
    'contactNumber',
    'gstNumber',
    'panNumber',
  ]

  for (const field of requiredFields) {
    if (!companyData[field] || companyData[field].toString().trim() === '') {
      errors.push(`${field} is required`)
    }
  }

  // Validate GST
  if (companyData.gstNumber) {
    const gstValidation = validateGSTNumber(companyData.gstNumber)
    if (!gstValidation.valid) {
      errors.push(gstValidation.message)
    }
  }

  // Validate PAN
  if (companyData.panNumber) {
    const panValidation = validatePANNumber(companyData.panNumber)
    if (!panValidation.valid) {
      errors.push(panValidation.message)
    }
  }

  // Validate contact number
  if (companyData.contactNumber) {
    const contactValidation = validateContactNumber(companyData.contactNumber)
    if (!contactValidation.valid) {
      errors.push(contactValidation.message)
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  }
}

/**
 * Generate unique company code
 * Format: COMP-YYYYMMDD-XXXXX (e.g., COMP-20231208-00001)
 */
export const generateCompanyCode = async (companyModel, companyName) => {
  const abbreviation = companyName
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .join('')

  const count = await companyModel.countDocuments()
  const sequence = count + 1

  return `COMP${abbreviation}${sequence}`
}

/**
 * Generate unique store ID
 * Format: STORE-COMPCODE-XXXXX
 */
export const generateStoreId = async (storeModel, companyCode) => {
  const count = await storeModel.countDocuments({ companyCode })
  const sequence = String(count + 1).padStart(5, '0')

  return `STORE-${companyCode}-${sequence}`
}

export default {
  validateGSTNumber,
  validatePANNumber,
  validateContactNumber,
  validateEmail,
  validateFileUpload,
  validateCompanyRegistration,
  generateCompanyCode,
  generateStoreId,
}
