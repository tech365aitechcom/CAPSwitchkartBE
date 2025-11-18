// htmlToPdf.js
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

let _browser;

export async function getBrowser() {
    if (!_browser) {
        _browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });
    }
    return _browser;
}


export async function htmlToPdfBuffer(htmlContent) {
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
    });

    await page.close();
    return pdfBuffer;
}
