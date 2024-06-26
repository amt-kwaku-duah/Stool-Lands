"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTicketResponse = exports.createReport = exports.createTicket = exports.statusForm = exports.getFormsCreatedByUser = exports.fillApplicationForm = void 0;
const uuid_1 = require("uuid");
const client_s3_1 = require("@aws-sdk/client-s3");
const dotenv_1 = require("dotenv");
const multer_1 = __importDefault(require("multer"));
const db_1 = __importDefault(require("../dbConfig/db"));
(0, dotenv_1.config)();
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
const upload = (0, multer_1.default)();
const fillApplicationForm = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const { applicantName, applicantDOB, mailingAddress, contactNumber, emailAddress, placeOfResidence, hometown, maritalStatus, nextOfKin, landLocality, siteName, plotNumbers, totalLandSize, streetName, landTransferor, dateOfOriginalTransfer, purposeOfLand, contactOfTransferor } = req.body;
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return res.status(400).json({ error: 'No documents uploaded' });
        }
        const uploadedDocumentUrls = await Promise.all(Object.values(req.files).map(async (file) => {
            const key = `${userId}/${(0, uuid_1.v4)()}-${file.originalname}`;
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype
            };
            await s3Client.send(new client_s3_1.PutObjectCommand(params));
            return {
                url: `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${key}`
            };
        }));
        const endpoint = req.originalUrl;
        console.log(endpoint);
        const type = endpoint.includes('org-apply') ? 'organization' :
            endpoint.includes('joint-apply') ? 'joint' : 'individual';
        const stateForms = await db_1.default.stateForm.findMany({
            where: { userId, status: 'UNUSED' },
            select: {
                id: true,
                clientReference: true,
                token: true,
            }
        });
        let validForm = null;
        for (const stateForm of stateForms) {
            const transaction = await db_1.default.transaction.findFirst({
                where: {
                    clientReference: stateForm.clientReference,
                    serviceId: type
                },
                select: {
                    serviceId: true,
                }
            });
            if (transaction?.serviceId === type) {
                validForm = stateForm;
                // Update the status of the state form to 'USED'
                await db_1.default.stateForm.update({
                    where: { id: stateForm.id },
                    data: { status: 'USED' }
                });
                break;
            }
        }
        if (!validForm) {
            return res.status(404).json({ message: 'No valid forms found for the specified type' });
        }
        const uniqueFormID = validForm.token;
        const application = await db_1.default.application.create({
            data: {
                uniqueFormID,
                applicantName,
                applicantDOB,
                mailingAddress,
                contactNumber,
                emailAddress,
                placeOfResidence,
                hometown,
                maritalStatus,
                nextOfKin,
                landLocality,
                siteName,
                plotNumbers,
                totalLandSize,
                streetName,
                landTransferor,
                dateOfOriginalTransfer,
                purposeOfLand,
                contactOfTransferor,
                type,
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
        console.error('Error occurred in fillApplicationForm:', error);
        res.status(500).json({ error: error.message || 'An error occurred while processing your request' });
    }
};
exports.fillApplicationForm = fillApplicationForm;
const getFormsCreatedByUser = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        const applicationForms = await db_1.default.application.findMany({
            where: {
                userId: userId
            },
            include: {
                documents: true
            }
        });
        const organizationForms = await db_1.default.organizationForm.findMany({
            where: {
                userId: userId
            },
            include: {
                documents: true
            }
        });
        const stateForms = await db_1.default.stateForm.findMany({
            where: {
                userId: userId,
                status: 'UNUSED'
            }
        });
        const formsWithServiceId = await Promise.all(stateForms.map(async (stateForm) => {
            const transaction = await db_1.default.transaction.findFirst({
                where: {
                    clientReference: stateForm.clientReference
                },
                select: {
                    serviceId: true
                }
            });
            const serviceId = transaction?.serviceId;
            return {
                ...stateForm,
                serviceId: serviceId
            };
        }));
        const forms = [...applicationForms, ...organizationForms];
        if (!stateForms || stateForms.length === 0) {
            return res.status(200).json({ success: false, message: 'No unused forms found for the user ', forms: [...formsWithServiceId, ...forms] });
        }
        res.status(200).json({ success: true, forms: [...formsWithServiceId, ...forms] });
    }
    catch (error) {
        console.error('Error occurred while fetching forms:', error);
        res.status(500).json({ success: false, error: 'An error occurred while processing your request' });
    }
};
exports.getFormsCreatedByUser = getFormsCreatedByUser;
// approve or deny
const statusForm = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const user = await db_1.default.user.findUnique({
            where: { id: userId },
            select: { email: true }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userEmail = user.email;
        const inspector = await db_1.default.inspector.findUnique({
            where: { email: userEmail },
            select: { inspectorId: true }
        });
        if (!inspector) {
            return res.status(404).json({ message: 'Inspector not found' });
        }
        const InspectorId = inspector.inspectorId;
        const { uniqueFormID, state, reject } = req.body;
        const validStates = ['APPROVED', 'DENIED'];
        if (!validStates.includes(state)) {
            return res.status(400).json({ message: 'Invalid state' });
        }
        let formExists = true;
        let updateResult;
        const formInApplication = await db_1.default.application.findUnique({
            where: { uniqueFormID }
        });
        if (!formInApplication) {
            const formInOrganizationForm = await db_1.default.organizationForm.findUnique({
                where: { uniqueFormID }
            });
            if (!formInOrganizationForm) {
                formExists = false;
            }
            else {
                updateResult = await db_1.default.organizationForm.update({
                    where: { uniqueFormID },
                    data: { status: state }
                });
            }
        }
        else {
            updateResult = await db_1.default.application.update({
                where: { uniqueFormID },
                data: { status: state }
            });
        }
        if (!formExists) {
            return res.status(404).json({ message: 'Form not found' });
        }
        await db_1.default.reason.create({
            data: {
                uniqueFormID,
                InspectorId,
                reject: reject ? reject : null
            }
        });
        return res.status(200).json({ message: 'Status updated successfully' });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
exports.statusForm = statusForm;
const createTicket = async (req, res) => {
    try {
        const { name, email, issue, appNumber, priority, description } = req.body;
        if (!email || !issue || !priority || !description) {
            return res.status(400).json({ message: 'All these fields fields are required' });
        }
        const ticket = await db_1.default.ticket.create({
            data: {
                name: name ? name : null,
                email,
                issue,
                appNumber,
                priority,
                description
            }
        });
        res.status(201).json({ message: 'Your issue has been successfully raised', ticket });
    }
    catch (error) {
        console.error('Error occurred while creating ticket:', error);
        res.status(500).json({ error: 'An error occurred while processing your request' });
    }
};
exports.createTicket = createTicket;
const createReport = async (req, res) => {
    try {
        const { firstName, lastName, email, phoneNumber, description } = req.body;
        if (!email || !firstName || !lastName || !phoneNumber || !description) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const report = await db_1.default.report.create({
            data: {
                firstName,
                lastName,
                email,
                phoneNumber,
                description
            }
        });
        res.status(201).json({ message: 'Report created successfully', report });
    }
    catch (error) {
        console.error('Error occurred while creating report:', error);
        res.status(500).json({ error: 'An error occurred while processing your request' });
    }
};
exports.createReport = createReport;
const handleTicketResponse = async (req, res) => {
    try {
        const { name, appNumber, description } = req.body;
        let ticketId;
        if (appNumber) {
            const ticket = await db_1.default.ticket.findFirst({
                where: { appNumber },
                select: { id: true },
            });
            if (!ticket) {
                return res.status(404).json({ message: 'Ticket not found' });
            }
            ticketId = ticket.id;
        }
        else {
            const ticketByName = await db_1.default.ticket.findFirst({
                where: { name },
                select: { id: true },
            });
            if (!ticketByName) {
                return res.status(404).json({ message: 'Ticket not found' });
            }
            ticketId = ticketByName.id;
        }
        await db_1.default.ticket.update({
            where: { id: ticketId },
            data: { status: 'ADDRESSED' },
        });
        await db_1.default.ticketReply.create({
            data: {
                response: description,
                ticketId,
            },
        });
        res.status(200).json({ message: 'Ticket responded to successfully' });
    }
    catch (error) {
        console.error('Error occurred while handling ticket response:', error);
        res.status(500).json({ error: 'An error occurred while processing your request' });
    }
};
exports.handleTicketResponse = handleTicketResponse;
