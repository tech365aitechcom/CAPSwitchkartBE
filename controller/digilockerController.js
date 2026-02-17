import axios from 'axios'

const DIGIO_BASE_URI = process.env.DIGIO_BASE_URI
const DIGIO_CLIENT_ID = process.env.DIGIO_CLIENT_ID
const DIGIO_CLIENT_SECRET = process.env.DIGIO_CLIENT_SECRET

export const createDigilockerKYCRequest = async (req, res) => {
  try {
    const {
      customer_identifier,
      customer_name,
      template_name,
      notify_customer,
      expire_in_days,
      generate_access_token,
      reference_id,
      transaction_id,
    } = req.body

    // Validate required fields
    if (!customer_identifier || !customer_name || !template_name) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: customer_identifier, customer_name, template_name',
      })
    }

    // Make request to Digilocker API
    const response = await axios.post(
      `${DIGIO_BASE_URI}/client/kyc/v2/request/with_template`,
      {
        customer_identifier,
        customer_name,
        template_name,
        notify_customer:
          notify_customer !== undefined ? notify_customer : false,
        expire_in_days: expire_in_days || 10,
        generate_access_token:
          generate_access_token !== undefined ? generate_access_token : true,
        reference_id,
        transaction_id,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        auth: {
          username: DIGIO_CLIENT_ID,
          password: DIGIO_CLIENT_SECRET,
        },
      }
    )

    return res.status(200).json({
      success: true,
      data: response.data,
    })
  } catch (error) {
    console.error(
      'Digilocker KYC request failed:',
      error.response?.data || error.message
    )

    return res.status(error.response?.status || 500).json({
      success: false,
      message:
        error.response?.data?.message ||
        'Failed to create Digilocker KYC request',
      error: error.response?.data || error.message,
    })
  }
}
