import { ApiError } from "../utils/ApiError.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import { enqueueOutbox } from "./outbox.service.js";
import prisma from "../db/prisma.js";

const SHIPMENT_STATUSES = new Set(["PENDING", "LABEL_CREATED", "IN_TRANSIT", "DELIVERED", "EXCEPTION", "CANCELLED"]);

const createShipment = async (req, repairJobId, payload) => {
    const job = await ensureRepairJobAccess(req, repairJobId);
    const direction = String(payload.direction || "").toUpperCase();
    if (!["INBOUND", "OUTBOUND"].includes(direction) || !String(payload.carrier || "").trim()) {
        throw new ApiError(400, "direction and carrier are required.");
    }
    return prisma.$transaction(async (tx) => {
        const shipment = await tx.shipment.create({
            data: {
                repairJobId: job.id,
                direction,
                carrier: String(payload.carrier).trim(),
                service: String(payload.service || "").trim() || null,
                trackingNumber: String(payload.trackingNumber || "").trim() || null,
                labelUrl: String(payload.labelUrl || "").trim() || null,
                createdBy: req.user.id,
            },
        });
        await tx.shipmentEvent.create({ data: { shipmentId: shipment.id, status: "PENDING", occurredAt: new Date() } });
        await enqueueOutbox(tx, {
            organizationId: job.organizationId,
            eventType: "shipment.created",
            aggregateType: "Shipment",
            aggregateId: shipment.id,
            payload: { shipmentId: shipment.id, repairJobId: job.id, direction },
        });
        return shipment;
    });
};

const updateShipmentStatus = async (req, shipmentId, payload) => {
    const shipment = await prisma.shipment.findUnique({ where: { id: Number(shipmentId) }, include: { repairJob: true } });
    if (!shipment) throw new ApiError(404, "Shipment not found.");
    await ensureRepairJobAccess(req, shipment.repairJobId);
    const status = String(payload.status || "").toUpperCase();
    if (!SHIPMENT_STATUSES.has(status)) throw new ApiError(400, "Invalid shipment status.");
    return prisma.$transaction(async (tx) => {
        const updated = await tx.shipment.update({
            where: { id: shipment.id },
            data: {
                status,
                trackingNumber: payload.trackingNumber || undefined,
                ...(status === "IN_TRANSIT" && !shipment.shippedAt ? { shippedAt: new Date() } : {}),
                ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
            },
        });
        await tx.shipmentEvent.create({
            data: {
                shipmentId: shipment.id,
                status,
                description: String(payload.description || "").trim() || null,
                location: String(payload.location || "").trim() || null,
                occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
            },
        });
        await enqueueOutbox(tx, {
            organizationId: shipment.repairJob.organizationId,
            eventType: "shipment.status_changed",
            aggregateType: "Shipment",
            aggregateId: shipment.id,
            payload: { shipmentId: shipment.id, repairJobId: shipment.repairJobId, status },
        });
        return updated;
    });
};

export { createShipment, updateShipmentStatus };
