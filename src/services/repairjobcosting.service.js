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

const parseCostValues = ({ quantity, unit_cost, is_billable }, existing = {}) => {
    const parsedQuantity = quantity !== undefined && quantity !== null && quantity !== ""
        ? Number(quantity)
        : existing.quantity ?? 1;
    const parsedUnitCost = money(
        unit_cost !== undefined && unit_cost !== null && unit_cost !== "" ? unit_cost : existing.unitCost ?? 0,
        "unit_cost",
    );

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
        throw new ApiError(400, "quantity must be a positive integer.");
    }

    const billable = parseBillable(is_billable, existing.billableToCustomer ?? false);
    const totalCost = multiplyMoney(parsedUnitCost, parsedQuantity);

    return {
        quantity: parsedQuantity,
        unitCost: parsedUnitCost,
        totalCost,
        billableToCustomer: billable,
        customerCharge: billable ? totalCost : money(0),
    };
};

const listRepairJobCosts = async (req, { repair_job_id, repairJobId }) => {
    repair_job_id = repair_job_id || repairJobId;
    if (!repair_job_id) {
        throw new ApiError(400, "repair_job_id is empty");
    }

    await ensureRepairJobAccess(req, repair_job_id);

    const costs = await prisma.repairJobCosting.findMany({
        where: { repairJobId: Number(repair_job_id) },
        orderBy: { id: "desc" },
        take: 500,
    });

    if (!costs.length) {
        throw new ApiError(400, "no data found.");
    }

    return costs;
};

const addRepairJobCost = async (req, payload) => {
    const {
        repair_job_id,
        cost_type,
        description,
    } = payload;

    if ([repair_job_id, cost_type, description].some((field) => String(field ?? "").trim() === "")) {
        throw new ApiError(400, "All field are required");
    }

    const costType = normalizeCostType(cost_type);
    const costValues = parseCostValues(payload);
    await ensureRepairJobAccess(req, repair_job_id);

    return prisma.$transaction(async (tx) => {
        const repairCost = await tx.repairJobCosting.create({
            data: {
                repairJobId: Number(repair_job_id),
                costType,
                ...costValues,
            },
        });

        await tx.repairJobAuditLog.create({
            data: {
                repairJobId: Number(repair_job_id),
                actionType: "CREATE",
                description: `Repair cost is added. ${description}`,
                performedBy: Number(req.user.id),
            },
        });

        return repairCost;
    });
};

const updateRepairJobCost = async (req, payload) => {
    const {
        id,
        cost_type,
        description,
    } = payload;

    if ([id, cost_type, description].some((field) => String(field ?? "").trim() === "")) {
        throw new ApiError(400, "data is empty");
    }

    const costType = normalizeCostType(cost_type);
    const existing = await prisma.repairJobCosting.findUnique({
        where: { id: Number(id) },
    });

    if (!existing) {
        throw new ApiError(400, "repair cost not found.");
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
