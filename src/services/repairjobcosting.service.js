import { ApiError } from "../utils/ApiError.js";
import prisma from "../db/prisma.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import { money, multiplyMoney } from "../utils/money.js";

const COST_TYPES = new Set([
    "PART",
    "LABOR",
    "SHIPPING",
    "REPLACEMENT",
    "CREDIT_NOTE",
    "REPAIR"
]);

const normalizeCostType = (value) => {
    const costType = String(value || "").trim().toUpperCase();

    if (!COST_TYPES.has(costType)) {
        throw new ApiError(400, "Invalid cost type.");
    }

    return costType;
};

const parseBillable = (value, fallback = false) => {
    if (value === undefined) return fallback;
    return value === true || value === "true";
};

const parseCostValues = (payload, existing = {}) => {
    const quantity = payload.quantity;
    const unitCost = payload.unitCost ?? payload.unit_cost;
    const isBillable = payload.isBillable ?? payload.billableToCustomer ?? payload.is_billable;
    const parsedQuantity = quantity !== undefined && quantity !== null && quantity !== ""
        ? Number(quantity)
        : existing.quantity ?? 1;
    const parsedUnitCost = money(
        unitCost !== undefined && unitCost !== null && unitCost !== "" ? unitCost : existing.unitCost ?? 0,
        "unitCost",
    );

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
        throw new ApiError(400, "quantity must be a positive integer.");
    }

    const billable = parseBillable(isBillable, existing.billableToCustomer ?? false);
    const totalCost = multiplyMoney(parsedUnitCost, parsedQuantity);

    return {
        quantity: parsedQuantity,
        unitCost: parsedUnitCost,
        totalCost,
        billableToCustomer: billable,
        customerCharge: billable ? totalCost : money(0),
    };
};

const listRepairJobCosts = async (req, payload) => {
    const repairJobId = payload.repairJobId ?? payload.repair_job_id;
    if (!repairJobId) {
        throw new ApiError(400, "repairJobId is required.");
    }

    await ensureRepairJobAccess(req, repairJobId);

    const costs = await prisma.repairJobCosting.findMany({
        where: { repairJobId: Number(repairJobId) },
        orderBy: { id: "desc" },
        take: 500,
    });

    return costs;
};

const addRepairJobCost = async (req, payload) => {
    const repairJobId = payload.repairJobId ?? payload.repair_job_id;
    const costTypeInput = payload.costType ?? payload.cost_type;
    const { description } = payload;

    if ([repairJobId, costTypeInput, description].some((field) => String(field ?? "").trim() === "")) {
        throw new ApiError(400, "repairJobId, costType, and description are required.");
    }

    const costType = normalizeCostType(costTypeInput);
    const costValues = parseCostValues(payload);
    await ensureRepairJobAccess(req, repairJobId);

    return prisma.$transaction(async (tx) => {
        const repairCost = await tx.repairJobCosting.create({
            data: {
                repairJobId: Number(repairJobId),
                costType,
                ...costValues,
            },
        });

        await tx.repairJobAuditLog.create({
            data: {
                repairJobId: Number(repairJobId),
                actionType: "CREATE",
                description: `Repair cost is added. ${description}`,
                performedBy: Number(req.user.id),
            },
        });

        return repairCost;
    });
};

const updateRepairJobCost = async (req, payload) => {
    const id = payload.id;
    const costTypeInput = payload.costType ?? payload.cost_type;
    const { description } = payload;

    if ([id, costTypeInput, description].some((field) => String(field ?? "").trim() === "")) {
        throw new ApiError(400, "id, costType, and description are required.");
    }

    const costType = normalizeCostType(costTypeInput);
    const existing = await prisma.repairJobCosting.findUnique({
        where: { id: Number(id) },
    });

    if (!existing) {
        throw new ApiError(404, "Repair cost not found.");
    }

    await ensureRepairJobAccess(req, existing.repairJobId);

    const costValues = parseCostValues(payload, existing);

    return prisma.$transaction(async (tx) => {
        const repairCost = await tx.repairJobCosting.update({
            where: { id: Number(id) },
            data: {
                costType,
                ...costValues,
            },
        });

        await tx.repairJobAuditLog.create({
            data: {
                repairJobId: existing.repairJobId,
                actionType: "UPDATE",
                description: `Repair cost is updated. ${description}`,
                performedBy: Number(req.user.id),
            },
        });

        return repairCost;
    });
};

export {
    addRepairJobCost,
    listRepairJobCosts,
    updateRepairJobCost,
};
