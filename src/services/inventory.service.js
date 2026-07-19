import { ApiError } from "../utils/ApiError.js";
import { ensureRepairJobAccess, ensureUserCanAccessOrganization, getAssignedOrganizationIds, isSuperAdmin } from "../utils/accessControl.js";
import prisma from "../db/prisma.js";
import { money } from "../utils/money.js";
import { paginatedData } from "../utils/pagination.js";

const MOVEMENT_TYPES = new Set(["RECEIVE", "RESERVE", "RELEASE", "CONSUME", "ADJUST", "RETURN"]);

const listInventory = async (req, filters = {}) => {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
    const organizationIds = isSuperAdmin(req.user) ? [] : await getAssignedOrganizationIds(req.user);
    const where = {
        ...(filters.organizationId
            ? { organizationId: Number(filters.organizationId) }
            : isSuperAdmin(req.user) ? {} : { organizationId: { in: organizationIds } }),
        ...(filters.search ? {
            OR: [
                { sku: { contains: String(filters.search), mode: "insensitive" } },
                { name: { contains: String(filters.search), mode: "insensitive" } },
            ],
        } : {}),
        isActive: filters.includeInactive === "true" ? undefined : true,
    };
    if (filters.organizationId) await ensureUserCanAccessOrganization(req.user, filters.organizationId);
    const [items, total] = await Promise.all([
        prisma.inventoryItem.findMany({ where, include: { supplier: true }, orderBy: { name: "asc" }, skip: (page - 1) * limit, take: limit }),
        prisma.inventoryItem.count({ where }),
    ]);
    return paginatedData(items, { total, page, limit });
};

const createInventoryItem = async (req, payload) => {
    const organizationId = Number(payload.organizationId);
    await ensureUserCanAccessOrganization(req.user, organizationId);
    if (![organizationId, payload.sku, payload.name].every(Boolean)) throw new ApiError(400, "organizationId, sku, and name are required.");
    const quantityOnHand = Number(payload.quantityOnHand || 0);
    const reorderPoint = Number(payload.reorderPoint || 0);
    if (![quantityOnHand, reorderPoint].every(Number.isInteger) || quantityOnHand < 0 || reorderPoint < 0) {
        throw new ApiError(400, "Inventory quantities must be non-negative integers.");
    }
    return prisma.inventoryItem.create({
        data: {
            organizationId,
            supplierId: payload.supplierId ? Number(payload.supplierId) : null,
            sku: String(payload.sku).trim(),
            name: String(payload.name).trim(),
            quantityOnHand,
            reorderPoint,
            unitCost: money(payload.unitCost ?? 0, "unitCost"),
        },
    });
};

const recordMovement = async (req, itemId, payload) => {
    const type = String(payload.type || "").toUpperCase();
    if (!MOVEMENT_TYPES.has(type)) throw new ApiError(400, "Invalid inventory movement type.");
    const quantity = Number(payload.quantity);
    if (!Number.isInteger(quantity) || quantity === 0 || (type !== "ADJUST" && quantity < 0)) {
        throw new ApiError(400, "quantity must be a non-zero integer and positive for this movement type.");
    }
    if (!String(payload.reason || "").trim()) throw new ApiError(400, "reason is required.");

    return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`SELECT * FROM "InventoryItem" WHERE "id" = ${Number(itemId)} FOR UPDATE`;
        const item = rows[0];
        if (!item) throw new ApiError(404, "Inventory item not found.");
        await ensureUserCanAccessOrganization(req.user, item.organizationId);
        if (payload.repairJobId) await ensureRepairJobAccess(req, payload.repairJobId);

        let onHand = item.quantityOnHand;
        let reserved = item.quantityReserved;
        if (type === "RECEIVE" || type === "RETURN") onHand += quantity;
        if (type === "ADJUST") onHand += quantity;
        if (type === "RESERVE") reserved += quantity;
        if (type === "RELEASE") reserved -= quantity;
        if (type === "CONSUME") {
            onHand -= quantity;
            if (payload.repairJobId) reserved -= quantity;
        }
        if (onHand < 0 || reserved < 0 || reserved > onHand) throw new ApiError(409, "Inventory movement would create an invalid stock balance.");

        const [updated, movement] = await Promise.all([
            tx.inventoryItem.update({ where: { id: item.id }, data: { quantityOnHand: onHand, quantityReserved: reserved } }),
            tx.inventoryMovement.create({
                data: {
                    inventoryItemId: item.id,
                    repairJobId: payload.repairJobId ? Number(payload.repairJobId) : null,
                    type,
                    quantity,
                    reason: String(payload.reason).trim(),
                    performedBy: req.user.id,
                },
            }),
        ]);
        return { item: updated, movement, needsReorder: onHand - reserved <= item.reorderPoint };
    });
};

export { createInventoryItem, listInventory, recordMovement };
