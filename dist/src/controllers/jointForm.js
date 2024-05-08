"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jointApplicationForm = void 0;
const uuid_1 = require("uuid");
const client_s3_1 = require("@aws-sdk/client-s3");
const db_1 = __importDefault(require("../dbConfig/db"));
const unique_1 = require("../utils/unique");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
const jointApplicationForm = async (req, res) => {
    try {
        const userId = req.user?.id;
        console.log(userId);
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const { applicants, landDetails, payments, documents } = req.body;
        if (!Array.isArray(applicants) || !applicants.length) {
            throw new Error('Applicants data should be a non-empty array');
        }
        if (!landDetails || typeof landDetails !== 'object') {
            throw new Error('Land details should be provided as an object');
        }
        if (!Array.isArray(documents)) {
            throw new Error('Documents should be an array');
        }
        const uploadedDocumentUrls = await Promise.all(documents.map(async (document) => {
            const key = `organization/${userId}/${(0, uuid_1.v4)()}-${document.image.split('/').pop()}`;
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: key,
                Body: document.data,
                ContentType: document.mimetype,
                ContentLength: document.size
            };
            await s3Client.send(new client_s3_1.PutObjectCommand(params));
            return {
                type: document.type,
                image: `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${key}`
            };
        }));
        const uniqueFormID = (0, unique_1.generateUniqueFormID)();
        const applicantNames = applicants.map(applicant => applicant.applicantName);
        const applicantDOBs = applicants.map(applicant => applicant.applicantDOB);
        const application = await db_1.default.application.create({
            data: {
                uniqueFormID,
                applicantName: applicantNames.join(' & '),
                applicantDOB: applicantDOBs,
                mailingAddress: applicants.map(applicant => applicant.mailingAddress).join(' & '),
                contactNumber: applicants.map(applicant => applicant.contactNumber).join(' & '),
                emailAddress: applicants.map(applicant => applicant.emailAddress).join(' & '),
                placeOfResidence: applicants.map(applicant => applicant.placeOfResidence).join(' & '),
                hometown: applicants.map(applicant => applicant.hometown).join(' & '),
                nextOfKin: applicants.map(applicant => applicant.nextOfKin).join(' & '),
                maritalStatus: applicants.map(applicant => applicant.maritalStatus).join(' & '),
                ...landDetails,
                type: "joint",
                documents: {
                    createMany: {
                        data: uploadedDocumentUrls
                    }
                },
                formStatus: 'FILLED',
                status: 'PENDING',
                User: { connect: { id: userId } }
            },
            include: {
                documents: true
            }
        });
        res.status(201).json({ message: 'Application submitted successfully', application });
    }
    catch (error) {
        console.error('Error occurred in jointApplicationForm:', error);
        res.status(500).json({ error: error.message || 'An error occurred while processing your request' });
    }
};
exports.jointApplicationForm = jointApplicationForm;