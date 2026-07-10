import { asyncHandler } from "../utils/asyncHandler.js";
import {
    invoicePdf,
    serviceReportPdf,
} from "../services/pdfreport.service.js";

const sendPdf = (res, buffer, filename) => {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.status(200).send(buffer);
};

const serviceReport = asyncHandler(async (req, res) => {
    const repairJobId = req.params.repairJobId || req.body.repairJobId || req.body.repair_job_id;
    const buffer = await serviceReportPdf(req, repairJobId);
    return sendPdf(res, buffer, `service-report-${repairJobId}.pdf`);
});

const invoice = asyncHandler(async (req, res) => {
    const repairJobId = req.params.repairJobId || req.body.repairJobId || req.body.repair_job_id;
    const buffer = await invoicePdf(req, repairJobId);
    return sendPdf(res, buffer, `invoice-${repairJobId}.pdf`);
});

export {
    invoice,
    serviceReport,
};
