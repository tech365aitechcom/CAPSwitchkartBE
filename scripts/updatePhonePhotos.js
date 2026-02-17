import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import AWS from 'aws-sdk'

dotenv.config()

const fileName = fileURLToPath(import.meta.url)
const dirName = path.dirname(fileName)

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION,
})

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('MongoDB connected successfully')
  } catch (error) {
    console.error('MongoDB connection error:', error)
    process.exit(1)
  }
}

// Upload image to S3
const uploadToS3 = async (filePath, file) => {
  try {
    const fileContent = fs.readFileSync(filePath)
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${process.env.S3_FOLDER}/models/${file}`,
      Body: fileContent,
      ContentType: 'image/png',
    }

    const data = await s3.upload(params).promise()
    console.log(`Uploaded: ${file} -> ${data.Location}`)
    return data.Location
  } catch (error) {
    console.error(`Error uploading ${file}:`, error.message)
    return null
  }
}

// Main function
const updatePhonePhotos = async () => {
  try {
    await connectDB()

    const phoneImagesDir = path.join(dirName, '..', 'phoneimages')
    const imageFiles = fs.readdirSync(phoneImagesDir)

    console.log(`Found ${imageFiles.length} images in phoneimages folder`)

    const modelsCollection = mongoose.connection.collection('models')

    let updatedCount = 0
    let uploadedCount = 0
    let notFoundCount = 0

    const imageModelMapping = {
      // iPhone 11 Series
      // 'iphone11.png': '68caa6c1b70013d3595f697e',
      // 'iphone11pro.png': '68caa6c1b70013d3595f6991',
      // 'iphone11promax.png': '68caa6c2b70013d3595f69a4',

      // iPhone 12 Series
      // 'iphone12.png': '68caa6c3b70013d3595f69ca',
      // 'iphone12mini.png': '68caa6c3b70013d3595f69b7',
      // 'iphone12pro.png': '68caa6c4b70013d3595f69dd',
      // 'iphone12promax.png': '68caa6c5b70013d3595f69f0',

      // iPhone 13 Series
      // 'iphone13.png': '68caa6c6b70013d3595f6a16',
      // 'iphone13mini.png': '68caa6c5b70013d3595f6a03',
      // 'iphone13pro.png': '68caa6c6b70013d3595f6a29',
      // 'iphone13promax.png': '68caa6c7b70013d3595f6a44',

      // iPhone 14 Series
      // 'iphone14.png': '68caa6c8b70013d3595f6a5f',
      // 'iphone14pro.png': '68caa6c9b70013d3595f6a85',
      // 'iphone14promax.png': '68caa6cab70013d3595f6aa0',
      // 'iphone14proplus.png': '68caa6c9b70013d3595f6a72',

      // iPhone 15 Series
      // 'iphone15.png': '68caa6d1b70013d3595f6b72',
      // 'iphone15plus.png': '68caa6d2b70013d3595f6b85',
      // 'iphone15pro.png': '68caa6d3b70013d3595f6b98',
      // 'iphone15promax.png': '68caa6d3b70013d3595f6bb3',

      // iPhone 16 Series
      // 'iphone16.png': '68caa6d4b70013d3595f6bc6',
      // 'iphone16plus.png': '68caa6d5b70013d3595f6bd9',
      // 'iphone16pro.png': '68caa6d6b70013d3595f6bec',
      // 'iphone16promax.png': '68caa6d6b70013d3595f6c07',
      // 'iphone16e.png': '68caa6d7b70013d3595f6c1a',

      // iPhone 17 Series
      // 'iphone17.png': '690c61f9c6c28c9a0ec55451',
      // 'iphoneair.png': '690c61f9c6c28c9a0ec5545d',
      // 'iphone17pro.png': '690c61fac6c28c9a0ec55470',
      // 'iphone17promax.png': '690c61fbc6c28c9a0ec55483',

      // iPhone X Series
      // 'iphonex.png': '68caa6ceb70013d3595f6b1a',
      // 'iphonexr.png': '68caa6cfb70013d3595f6b26',
      // 'iphonexs.png': '68caa6cfb70013d3595f6b39',
      // 'iphonexsmax.png': '68caa6d0b70013d3595f6b4c',

      // iPhone 7 Series
      // 'iphone7.png': '68caa6cbb70013d3595f6abb',
      // 'iphone7plus.png': '68caa6ccb70013d3595f6ace',

      // iPhone 8 Series
      // 'iphone8plus.jpg': '68caa6cdb70013d3595f6af4',

      // iPhone SE Series
      // 'iphonese2020.png': '68caa6ceb70013d3595f6b07',
      // 'iphonese2022.png': '68caa6d1b70013d3595f6b5f',
      // 'iphonese2016.png': '68ccbded886eb5c1915dd936',

      // iPhone 6 Series
      'iphone6.png': '68ccbdd1886eb5c1915dd4c2',
      // 'iphone6plus.png': '68ccbdd1886eb5c1915dd4dd',
      // 'iphone6s.png': '68ccbdd2886eb5c1915dd4f8',
      // 'iphone6splus.png': '68ccbdd3886eb5c1915dd513',
    }

    for (const imageFile of imageFiles) {
      const modelId = imageModelMapping[imageFile]

      if (!modelId) {
        console.log(`⚠ No mapping found for image: ${imageFile}`)
        notFoundCount++
        continue
      }

      console.log(`\nProcessing: ${imageFile} -> Model ID: ${modelId}`)

      const imagePath = path.join(phoneImagesDir, imageFile)
      const s3Url = await uploadToS3(imagePath, imageFile)

      if (s3Url) {
        const result = await modelsCollection.updateOne(
          { _id: new mongoose.Types.ObjectId(modelId) },
          { $set: { 'phonePhotos.front': s3Url } }
        )

        if (result.modifiedCount > 0) {
          console.log(`✓ Updated phonePhotos.front`)
          updatedCount++
          uploadedCount++
        } else if (result.matchedCount > 0) {
          console.log(`⚠ Model found but no changes made`)
          uploadedCount++
        } else {
          console.log(`✗ Model ID not found in database`)
        }
      }
    }

    console.log(`\n=== Update Summary ===`)
    console.log(`Total images processed: ${imageFiles.length}`)
    console.log(`Images uploaded to S3: ${uploadedCount}`)
    console.log(`Models updated: ${updatedCount}`)
    console.log(`Images without mapping: ${notFoundCount}`)

    await mongoose.connection.close()
    console.log('\nDatabase connection closed')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

updatePhonePhotos()
