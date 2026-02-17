const version = process.env.TnC_VERSION_ID || "v1.0";

const html = `
<div class="mb-2">
  1. The Customer/Seller confirms that they are the rightful owner of the Gadget/Device and
  assume full responsibility for any liabilities related to its ownership.
</div>
<div class="mb-2">
  2. The Customer/Seller affirms that all personal data has been completely removed from the
  device, and the Company shall not be held responsible for any data-related issues.
</div>
<div class="mb-2">
  3. The Customer/Seller agrees to indemnify and hold the Company harmless against any third-
  party claims arising from the ownership, data, condition of the device, or any criminal matters
  related to the device.
</div>
<div class="mb-2">
  4. Payment will be processed as per the agreed terms.
  Any discrepancies must be reported
  within 2 hours of the transaction, Return and refund requests, if applicable, must comply with the
  Company's return policy.
</div>
<div class="mb-2">
  5. Any disputes or disagreements between the Customer/Seller and Purchaser shall be
  exclusively resolved under the jurisdiction of the courts located in Gurugram, Haryana only.
</div>
`;

export const tncContent = {
  version,
  html,
};
