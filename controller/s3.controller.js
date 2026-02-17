import AWS from 'aws-sdk'
import fs from 'fs'

const s3Bucket = new AWS.S3({
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
})

// Allowed MIME types for file uploads (images and PDFs only)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']

// Blocked dangerous file types
const BLOCKED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.pif',
  '.scr',
  '.vbs',
  '.js',
  '.jar',
  '.php',
  '.asp',
  '.aspx',
  '.jsp',
  '.sh',
  '.bash',
  '.ps1',
  '.html',
  '.htm',
]

/**
 * Validates file type based on MIME type and extension
 * @param {string} fileName - The name of the file
 * @param {string} fileType - The MIME type of the file
 * @returns {object} - { valid: boolean, error: string }
 */
const validateFileType = (fileName, fileType) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(fileType.toLowerCase())) {
    return {
      valid: false,
      error:
        'Invalid file type. Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed.',
    }
  }

  // Extract file extension
  const lastDotIndex = fileName.lastIndexOf('.')
  const fileExtension =
    lastDotIndex !== -1 ? fileName.toLowerCase().substring(lastDotIndex) : ''

  // If there's an extension, validate it
  if (fileExtension) {
    // Check if extension is blocked
    if (BLOCKED_EXTENSIONS.includes(fileExtension)) {
      return {
        valid: false,
        error: 'This file type is not allowed for security reasons.',
      }
    }

    // Check if extension is in allowed list
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return {
        valid: false,
        error:
          'Invalid file extension. Only JPG, PNG, GIF, WebP, and PDF files are allowed.',
      }
    }
  }
  // If no extension, rely on MIME type validation (already passed above)

  return { valid: true }
}

// function for upload one file on s3 bucket
const acl = 'public-read'

// Helper function to upload a file buffer directly to S3
const uploadFileBuffer = async (file, customFileName = null) => {
  if (!file) {
    throw new Error('File is required')
  }

  const fileName = customFileName || `${Date.now()}_${file.originalname}`

  const s3Key = process.env.S3_FOLDER
    ? `${process.env.S3_FOLDER}/${fileName}`
    : fileName

  const validation = validateFileType(fileName, file.mimetype)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    ContentType: file.mimetype,
    Key: s3Key,
    Body: file.buffer,
  }

  const data = await s3Bucket.upload(params).promise()
  return data.Location
}

const uploadFile = async (req, res) => {
  try {
    console.log('📥 Upload request received:', {
      hasFile: !!req.file,
      fileInfo: req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : null,
      body: req.body,
      query: req.query,
    })

    if (!req.file) {
      console.error('❌ No file in request')
      return res.status(400).json({
        success: false,
        message: 'File is required',
      })
    }

    const customFileName =
      req.body?.fileName ||
      req.body?.fileName?.[0] || // Sometimes multer returns arrays
      req.query?.fileName ||
      null

    console.log('📝 File name resolution:', {
      fromBody: req.body?.fileName,
      fromQuery: req.query?.fileName,
      originalname: req.file.originalname,
      customFileName: customFileName || 'Using original name',
    })

    const finalFileName = customFileName || req.file.originalname

    const fileUrl = await uploadFileBuffer(req.file, finalFileName)

    console.log('✅ File uploaded successfully:', {
      fileName: finalFileName,
      fileUrl: fileUrl,
    })

    return res.status(200).json({
      success: true,
      message: 'Uploaded successfully',
      fileUrl,
    })
  } catch (error) {
    console.error('❌ Upload error:', {
      message: error.message,
      stack: error.stack,
    })
    return res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

// function for upload multiple files on s3 bucket
const uploadFiles = async (req, res) => {
  try {
    const files = req.files
    for (const file of files) {
      // Validate file type before upload
      const validation = validateFileType(file.originalname, file.mimetype)
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error })
      }

      const fileKey = file.originalname
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        ContentType: file.mimetype,
        Key: fileKey,
        Body: file.buffer || (await fs.readFileSync(file.path)),
        ACL: acl,
      }

      return new Promise((resolve, reject) => {
        s3Bucket.upload(params, async (err, data) => {
          if (err) {
            return reject({ err: err.message })
          }
          return resolve(data.Location)
        })
      })
    }
    return res.json({ msg: 'Data uploaded successfuly.' })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

const preSignedUrl = async (req, res) => {
  try {
    const { fileName, fileType } = req.query // Get file name and file type from query params
    if (!fileName || !fileType) {
      return res
        .status(400)
        .json({ error: 'File name and file type are required' })
    }

    // Validate file type before generating presigned URL
    const validation = validateFileType(fileName, fileType)
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error })
    }

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      ContentType: fileType,
      Expires: 60000,
      Key: `${process.env.S3_FOLDER}/${fileName}`,
    }
    const signedUrl = s3Bucket.getSignedUrl('putObject', params)
    return res.status(200).json({ url: signedUrl })
  } catch (error) {
    return res.status(500).json({ error })
  }
}

/**
 * Proxy S3 image and return as base64
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const proxyImageAsBase64 = async (req, res) => {
  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({ error: 'Image URL is required' })
    }

    // Extract the S3 key from the URL
    const bucketName = process.env.S3_BUCKET_NAME
    const urlObj = new URL(url)
    const key = decodeURIComponent(urlObj.pathname.substring(1)) // Remove leading '/'

    // Validate that the URL is from the correct S3 bucket
    if (!url.includes(bucketName)) {
      return res.status(400).json({ error: 'Invalid S3 URL' })
    }

    // Get the object from S3
    const params = {
      Bucket: bucketName,
      Key: key,
    }

    const data = await s3Bucket.getObject(params).promise()

    // Convert to base64
    const base64Image = data.Body.toString('base64')
    const contentType = data.ContentType || 'image/png'
    const dataUrl = `data:${contentType};base64,${base64Image}`

    return res.status(200).json({
      success: true,
      base64: dataUrl,
    })
  } catch (error) {
    console.error('Error proxying image:', error)
    return res.status(500).json({ error: error.message })
  }
}

export default {
  preSignedUrl,
  uploadFile,
  uploadFiles,
  uploadFileBuffer,
  proxyImageAsBase64,
}
