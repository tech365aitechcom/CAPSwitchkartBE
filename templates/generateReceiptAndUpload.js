{% comment %} import puppeteer from "puppeteer";
import ejs from "ejs";
import path from "path";
import AWS from "aws-sdk";
import { fileURLToPath } from "url";

// Fix __dirname in ES modules
const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Configure AWS
const s3 = new AWS.S3({
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
});

export const generateReceiptAndUpload = async (data) => {
  try {
    // Step 1: Render EJS to HTML
    const templatePath = path.join(dirname, "../templates/receiptTemplate.ejs");
    const htmlContent = await ejs.renderFile(templatePath, data);

    // Step 2: Generate PDF using Puppeteer
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    // Step 3: Upload PDF to S3
    const receiptName = `receipt-${data.uniqueCode}-${Date.now()}.pdf`;
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `receipts/${receiptName}`,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    };

    const uploadResult = await s3.upload(uploadParams).promise();
    return uploadResult.Location;
  } catch (err) {
    console.error("Error generating or uploading PDF:", err);
    throw err;
  }
}; {% endcomment %}
