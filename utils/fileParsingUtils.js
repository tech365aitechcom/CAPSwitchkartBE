import { Readable } from 'stream'
import xlsx from 'xlsx'
import csv from 'csv-parser'

const CSV_MIMETYPES = ['text/csv']
const XLSX_MIMETYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

/**
 * Parse uploaded file (CSV or XLSX) into JSON array
 * @param {Object} file - Multer file object with buffer and mimetype
 * @returns {Promise<Array>} Parsed rows as array of objects
 */
const parseFile = async (file) => {
  if (CSV_MIMETYPES.includes(file.mimetype)) {
    return new Promise((resolve, reject) => {
      const results = []
      Readable.from(file.buffer)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject)
    })
  } else if (XLSX_MIMETYPES.includes(file.mimetype)) {
    const workbook = xlsx.read(file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName])
  } else {
    throw new Error('Unsupported file type')
  }
}

export { parseFile, CSV_MIMETYPES, XLSX_MIMETYPES }
