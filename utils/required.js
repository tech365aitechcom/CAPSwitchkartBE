import Joi from "joi"
const storeValidation = (data) => {
    const schema = Joi.object({
        storeName: Joi.string(),
        region: Joi.string(),
        email: Joi.string(),
        uniqueId: Joi.string(),
        contactNumber: Joi.string(),
        address: Joi.string(),
        createdBy: Joi.string(),
    }).unknown(true);
    return schema.validate(data);
};

const companyValidation = (data) => {
    const schema = Joi.object({
        companyName: Joi.string(),
        companyCode: Joi.string(),
        uniqueId: Joi.string(),
        contactNumber: Joi.string(),
        address: Joi.string(),
        gstNumber: Joi.string(),
        panNumber: Joi.string(),
        remarks: Joi.string(),
        createdBy: Joi.string(),
    }).unknown(true);
    return schema.validate(data);
};


export default { storeValidation, companyValidation }
