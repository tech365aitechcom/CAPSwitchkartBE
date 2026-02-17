import conditions from '../models/phoneConditon.js'
import csv from '../controller/questionnaireController.js'

const insertMany = async (req, res) => {
  const cs = csv.convertCsvToJson(req.file)
  try {
    const data = await conditions.insertMany(cs)
    return res
      .status(200)
      .json({ data, message: 'questionnaires created successfully.' })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ message: error.message })
  }
}

// --- Helper: map CSV headers to DB fields
const mapCondition = (condition) => ({
  warrentyCode: condition['Warranty'] || condition['warrentyCode'],
  coreCode: condition['Core'] || condition['coreCode'],
  displayCode: condition['Display'] || condition['displayCode'],
  functionalMajorCode:
    condition['FUNCTIONAL major'] || condition['functionalMajorCode'],
  functionalMinorCode:
    condition['FUNCTIONAL Minor'] || condition['functionalMinorCode'],
  cosmeticsCode: condition['COSMETICS'] || condition['cosmeticsCode'],
  accessoriesCode: condition['Accessory'] || condition['accessoriesCode'],
  grade: condition['New grades'] || condition['grade'],
})

// --- Helper: validate required fields
const validateCondition = (mappedCondition, rowIndex, condition) => {
  const requiredFields = [
    'warrentyCode',
    'coreCode',
    'displayCode',
    'functionalMajorCode',
    'functionalMinorCode',
    'cosmeticsCode',
    'accessoriesCode',
    'grade',
  ]

  const missingFields = requiredFields.filter(
    (field) => !mappedCondition[field] && mappedCondition[field] !== ''
  )

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Row ${
        rowIndex + 1
      }: Missing required fields: ${missingFields.join(
        ', '
      )}. Available fields: ${Object.keys(condition).join(', ')}`,
    }
  }

  return { valid: true }
}

// --- Helper: update DB record
const updateCondition = async (mappedCondition, rowIndex) => {
  const query = {
    warrentyCode: mappedCondition.warrentyCode,
    coreCode: mappedCondition.coreCode,
    displayCode: mappedCondition.displayCode,
    functionalMajorCode: mappedCondition.functionalMajorCode,
    functionalMinorCode: mappedCondition.functionalMinorCode,
    cosmeticsCode: mappedCondition.cosmeticsCode,
    accessoriesCode: mappedCondition.accessoriesCode,
  }

  console.log(`Row ${rowIndex + 1}: Attempting to update with query:`, query)
  console.log(`Row ${rowIndex + 1}: Setting grade to:`, mappedCondition.grade)

  const result = await conditions.updateOne(
    query,
    {
      $set: { grade: mappedCondition.grade, updatedAt: new Date() },
    },
    { upsert: true }
  )

  console.log(`Row ${rowIndex + 1}: Update result:`, {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    upsertedCount: result.upsertedCount,
  })

  if (result.matchedCount > 0) {
    return { updated: 1, inserted: 0 }
  }
  if (result.upsertedCount > 0) {
    return { updated: 0, inserted: 1 }
  }
  return { updated: 0, inserted: 0 }
}

const updateGrades = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const cs = csv.convertCsvToJson(req.file)

    if (!cs || cs.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty or invalid' })
    }

    let updatedCount = 0
    let insertedCount = 0
    let errorCount = 0
    const errors = []

    console.log(`Processing ${cs.length} records for grade updates...`)

    for (let i = 0; i < cs.length; i++) {
      const condition = cs[i]
      const mappedCondition = mapCondition(condition)

      // validate
      const validation = validateCondition(mappedCondition, i, condition)
      if (!validation.valid) {
        errorCount++
        errors.push(validation.error)
        continue
      }

      // update DB
      try {
        const { updated, inserted } = await updateCondition(mappedCondition, i)
        updatedCount += updated
        insertedCount += inserted
      } catch (updateError) {
        errorCount++
        console.error(`Row ${i + 1}: Error updating condition:`, updateError)
        errors.push(`Row ${i + 1}: ${updateError.message}`)
      }
    }

    const response = {
      message: 'Grade update process completed.',
      updatedCount,
      insertedCount,
      errorCount,
      totalProcessed: cs.length,
      success: errorCount === 0,
    }

    if (errors.length > 0) {
      response.errors = errors.slice(0, 10)
      if (errors.length > 10) {
        response.additionalErrorsCount = errors.length - 10
      }
    }

    console.log('Final update summary:', response)
    return res.status(200).json(response)
  } catch (error) {
    console.error('Error in updateGrades:', error)
    return res.status(500).json({
      message: 'Internal server error while updating grades',
      error: error.message,
    })
  }
}

export default {
  insertMany,
  updateGrades,
}
