import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getRepairJobAccessWhere } from "../utils/accessControl.js";
import {
    average,
    buildRepairJobReportWhere,
    daysBetween,
    parsePagination,
    parseReportFilters,
    roundMoney,
    toNumber,
} from "../utils/reportQuery.js";
import prisma from "../db/prisma.js";

const OPEN_STATUSES = ["CREATED", "RECEIVED", "IN_PROGRESS", "WAITING_PARTS"];

const sourceFromRequest = (req) => ({
    ...(req.query || {}),
    ...(req.body || {}),
});

const baseFilterSource = (filters) => ({
    organizationId: filters.organizationId,
    customerId: filters.customerId,
});

const mapCounts = (groups, key) => groups.reduce((result, row) => {
    result[row[key]] = row._count._all;
    return result;
}, {});

const bucketKey = (date, period) => {
    const value = new Date(date);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return period === "month" ? `${year}-${month}` : `${year}-${month}-${day}`;
};

const getSummaryReport = asyncHandler(async (req, res) => {
    const filters = parseReportFilters(sourceFromRequest(req), { defaultDays: 30 });
    const accessWhere = await getRepairJobAccessWhere(req);
    const dateScopedWhere = buildRepairJobReportWhere(accessWhere, filters);
    const baseWhere = buildRepairJobReportWhere(accessWhere, baseFilterSource(filters));
    const completedWhere = buildRepairJobReportWhere(accessWhere, {
        ...baseFilterSource(filters),
        startDate: filters.startDate,
        endDate: filters.endDate,
    }, "completionDate");

    const [
        statusGroups,
        resolutionGroups,
        openCount,
        overdueCount,
        completedJobs,
        costingTotals,
        warrantyCount,
        doaCount,
    ] = await Promise.all([
        prisma.repairJob.groupBy({
            by: ["jobStatus"],
            where: dateScopedWhere,
            _count: { _all: true },
        }),
        prisma.repairJob.groupBy({
            by: ["resolutionType"],
            where: {
                AND: [
                    dateScopedWhere,
                    { resolutionType: { not: null } },
                ],
            },
            _count: { _all: true },
        }),
        prisma.repairJob.count({
            where: {
                AND: [
                    baseWhere,
                    { jobStatus: { in: OPEN_STATUSES } },
                ],
            },
        }),
        prisma.repairJob.count({
            where: {
                AND: [
                    baseWhere,
                    {
                        jobStatus: { in: OPEN_STATUSES },
                        dueDate: { lt: new Date() },
                    },
                ],
            },
        }),
        prisma.repairJob.findMany({
            where: {
                AND: [
                    completedWhere,
                    { jobStatus: "COMPLETED", completionDate: { not: null } },
                ],
            },
            select: {
                createdDate: true,
                completionDate: true,
            },
        }),
        prisma.repairJobCosting.aggregate({
            where: {
                repairJob: { is: dateScopedWhere },
            },
            _sum: {
                totalCost: true,
                customerCharge: true,
            },
        }),
        prisma.repairJob.count({
            where: {
                AND: [
                    dateScopedWhere,
                    { isProductUnderWarranty: true },
                ],
            },
        }),
        prisma.repairJob.count({
            where: {
                AND: [
                    dateScopedWhere,
                    { isDoa: true },
                ],
            },
        }),
    ]);

    const totalCost = toNumber(costingTotals._sum.totalCost);
    const totalCharge = toNumber(costingTotals._sum.customerCharge);

    return res.status(200).json(new ApiResponse(200, {
        dateRange: {
            startDate: filters.startDate,
            endDate: filters.endDate,
        },
        jobsByStatus: mapCounts(statusGroups, "jobStatus"),
        jobsByResolution: mapCounts(resolutionGroups, "resolutionType"),
        openJobs: openCount,
        overdueJobs: overdueCount,
        completedJobs: completedJobs.length,
        averageCycleDays: roundMoney(average(
            completedJobs.map((job) => daysBetween(job.createdDate, job.completionDate))
        )),
        warrantyJobs: warrantyCount,
        doaJobs: doaCount,
        costs: {
            totalCost: roundMoney(totalCost),
            customerCharge: roundMoney(totalCharge),
            grossMargin: roundMoney(totalCharge - totalCost),
        },
    }, "Business summary report."));
});

const getBacklogReport = asyncHandler(async (req, res) => {
    const source = sourceFromRequest(req);
    const pagination = parsePagination(source);
    const filters = parseReportFilters(source, { defaultDays: 90 });
    const accessWhere = await getRepairJobAccessWhere(req);
    const baseWhere = buildRepairJobReportWhere(accessWhere, baseFilterSource(filters));
    const where = {
        AND: [
            baseWhere,
            { jobStatus: { in: OPEN_STATUSES } },
        ],
    };

    const [jobs, total, statusGroups] = await Promise.all([
        prisma.repairJob.findMany({
            where,
            skip: pagination.skip,
            take: pagination.limit,
            orderBy: [
                { dueDate: "asc" },
                { createdDate: "asc" },
            ],
            select: {
                id: true,
                raJobId: true,
                organizationId: true,
                customerId: true,
                sku: true,
                productName: true,
                serialNumber: true,
                isDoa: true,
                isProductUnderWarranty: true,
                productFault: true,
                jobStatus: true,
                receivedDate: true,
                dueDate: true,
                createdDate: true,
                customer: {
                    select: {
                        companyName: true,
                        customerCode: true,
                    },
                },
            },
        }),
        prisma.repairJob.count({ where }),
        prisma.repairJob.groupBy({
            by: ["jobStatus"],
            where,
            _count: { _all: true },
        }),
    ]);

    const today = new Date();
    const backlog = jobs.map((job) => ({
        ...job,
        ageDays: daysBetween(job.receivedDate || job.createdDate, today),
        overdueDays: job.dueDate && job.dueDate < today ? daysBetween(job.dueDate, today) : 0,
    }));

    return res.status(200).json(new ApiResponse(200, {
        backlog,
        summary: {
            total,
            byStatus: mapCounts(statusGroups, "jobStatus"),
        },
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
    }, "Open repair backlog report."));
});

const getThroughputReport = asyncHandler(async (req, res) => {
    const source = sourceFromRequest(req);
    const period = source.period === "month" ? "month" : "day";
    const filters = parseReportFilters(source, { defaultDays: 30 });
    const accessWhere = await getRepairJobAccessWhere(req);
    const createdWhere = buildRepairJobReportWhere(accessWhere, filters);
    const completedWhere = buildRepairJobReportWhere(accessWhere, {
        ...baseFilterSource(filters),
        startDate: filters.startDate,
        endDate: filters.endDate,
    }, "completionDate");

    const [createdJobs, completedJobs] = await Promise.all([
        prisma.repairJob.findMany({
            where: createdWhere,
            select: { createdDate: true },
        }),
        prisma.repairJob.findMany({
            where: {
                AND: [
                    completedWhere,
                    { jobStatus: "COMPLETED", completionDate: { not: null } },
                ],
            },
            select: {
                createdDate: true,
                completionDate: true,
            },
        }),
    ]);

    const buckets = {};

    for (const job of createdJobs) {
        const key = bucketKey(job.createdDate, period);
        buckets[key] = buckets[key] || { period: key, created: 0, completed: 0, averageCycleDays: 0, cycleDays: [] };
        buckets[key].created += 1;
    }

    for (const job of completedJobs) {
        const key = bucketKey(job.completionDate, period);
        buckets[key] = buckets[key] || { period: key, created: 0, completed: 0, averageCycleDays: 0, cycleDays: [] };
        buckets[key].completed += 1;
        buckets[key].cycleDays.push(daysBetween(job.createdDate, job.completionDate));
    }

    const throughput = Object.values(buckets)
        .sort((left, right) => left.period.localeCompare(right.period))
        .map((bucket) => ({
            period: bucket.period,
            created: bucket.created,
            completed: bucket.completed,
            averageCycleDays: roundMoney(average(bucket.cycleDays)),
        }));

    return res.status(200).json(new ApiResponse(200, {
        period,
        dateRange: {
            startDate: filters.startDate,
            endDate: filters.endDate,
        },
        throughput,
    }, "Repair throughput report."));
});

const getCostReport = asyncHandler(async (req, res) => {
    const source = sourceFromRequest(req);
    const pagination = parsePagination(source, { defaultLimit: 10, maxLimit: 50 });
    const filters = parseReportFilters(source, { defaultDays: 30 });
    const accessWhere = await getRepairJobAccessWhere(req);
    const jobWhere = buildRepairJobReportWhere(accessWhere, filters);
    const costingWhere = {
        repairJob: { is: jobWhere },
    };

    const [costGroups, billableGroups, totalCosts, topCostedJobs] = await Promise.all([
        prisma.repairJobCosting.groupBy({
            by: ["costType"],
            where: costingWhere,
            _sum: {
                totalCost: true,
                customerCharge: true,
            },
            _count: { _all: true },
        }),
        prisma.repairJobCosting.groupBy({
            by: ["billableToCustomer"],
            where: costingWhere,
            _sum: {
                totalCost: true,
                customerCharge: true,
            },
            _count: { _all: true },
        }),
        prisma.repairJobCosting.aggregate({
            where: costingWhere,
            _sum: {
                totalCost: true,
                customerCharge: true,
            },
        }),
        prisma.repairJobCosting.groupBy({
            by: ["repairJobId"],
            where: costingWhere,
            _sum: {
                totalCost: true,
                customerCharge: true,
            },
            _count: { _all: true },
            orderBy: {
                _sum: {
                    totalCost: "desc",
                },
            },
            take: pagination.limit,
        }),
    ]);

    const jobIds = topCostedJobs.map((row) => row.repairJobId);
    const jobs = jobIds.length
        ? await prisma.repairJob.findMany({
            where: { id: { in: jobIds } },
            select: {
                id: true,
                raJobId: true,
                customerId: true,
                sku: true,
                productName: true,
                serialNumber: true,
                jobStatus: true,
                customer: {
                    select: {
                        companyName: true,
                        customerCode: true,
                    },
                },
            },
        })
        : [];
    const jobById = new Map(jobs.map((job) => [job.id, job]));
    const totalCost = toNumber(totalCosts._sum.totalCost);
    const customerCharge = toNumber(totalCosts._sum.customerCharge);

    return res.status(200).json(new ApiResponse(200, {
        totals: {
            totalCost: roundMoney(totalCost),
            customerCharge: roundMoney(customerCharge),
            grossMargin: roundMoney(customerCharge - totalCost),
        },
        byCostType: costGroups.map((row) => ({
            costType: row.costType,
            entries: row._count._all,
            totalCost: roundMoney(toNumber(row._sum.totalCost)),
            customerCharge: roundMoney(toNumber(row._sum.customerCharge)),
            grossMargin: roundMoney(toNumber(row._sum.customerCharge) - toNumber(row._sum.totalCost)),
        })),
        billableBreakdown: billableGroups.map((row) => ({
            billableToCustomer: row.billableToCustomer,
            entries: row._count._all,
            totalCost: roundMoney(toNumber(row._sum.totalCost)),
            customerCharge: roundMoney(toNumber(row._sum.customerCharge)),
        })),
        topCostedJobs: topCostedJobs.map((row) => ({
            repairJob: jobById.get(row.repairJobId) || { id: row.repairJobId },
            entries: row._count._all,
            totalCost: roundMoney(toNumber(row._sum.totalCost)),
            customerCharge: roundMoney(toNumber(row._sum.customerCharge)),
        })),
    }, "Repair costing report."));
});

const getProductReport = asyncHandler(async (req, res) => {
    const source = sourceFromRequest(req);
    const pagination = parsePagination(source, { defaultLimit: 20, maxLimit: 50 });
    const filters = parseReportFilters(source, { defaultDays: 90 });
    const accessWhere = await getRepairJobAccessWhere(req);
    const where = buildRepairJobReportWhere(accessWhere, filters);

    const productGroups = await prisma.repairJob.groupBy({
        by: ["sku", "productName"],
        where,
        _count: { _all: true },
        orderBy: {
            _count: {
                sku: "desc",
            },
        },
        take: pagination.limit,
    });

    const productReports = await Promise.all(productGroups.map(async (row) => {
        const productWhere = {
            AND: [
                where,
                {
                    sku: row.sku,
                    productName: row.productName,
                },
            ],
        };

        const [statusGroups, warrantyCount, doaCount, completedJobs] = await Promise.all([
            prisma.repairJob.groupBy({
                by: ["jobStatus"],
                where: productWhere,
                _count: { _all: true },
            }),
            prisma.repairJob.count({
                where: {
                    AND: [
                        productWhere,
                        { isProductUnderWarranty: true },
                    ],
                },
            }),
            prisma.repairJob.count({
                where: {
                    AND: [
                        productWhere,
                        { isDoa: true },
                    ],
                },
            }),
            prisma.repairJob.findMany({
                where: {
                    AND: [
                        productWhere,
                        { jobStatus: "COMPLETED", completionDate: { not: null } },
                    ],
                },
                select: {
                    createdDate: true,
                    completionDate: true,
                },
            }),
        ]);

        return {
            sku: row.sku,
            productName: row.productName,
            repairJobs: row._count._all,
            warrantyJobs: warrantyCount,
            doaJobs: doaCount,
            byStatus: mapCounts(statusGroups, "jobStatus"),
            averageCycleDays: roundMoney(average(
                completedJobs.map((job) => daysBetween(job.createdDate, job.completionDate))
            )),
        };
    }));

    return res.status(200).json(new ApiResponse(200, {
        products: productReports,
        limit: pagination.limit,
    }, "Product failure report."));
});

const getCustomerReport = asyncHandler(async (req, res) => {
    const source = sourceFromRequest(req);
    const pagination = parsePagination(source, { defaultLimit: 20, maxLimit: 50 });
    const filters = parseReportFilters(source, { defaultDays: 90 });
    const accessWhere = await getRepairJobAccessWhere(req);
    const where = buildRepairJobReportWhere(accessWhere, filters);

    const customerGroups = await prisma.repairJob.groupBy({
        by: ["customerId"],
        where,
        _count: { _all: true },
        orderBy: {
            _count: {
                customerId: "desc",
            },
        },
        take: pagination.limit,
    });

    const customerIds = customerGroups.map((row) => row.customerId);
    const customers = customerIds.length
        ? await prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: {
                id: true,
                companyName: true,
                customerCode: true,
                email: true,
                salesPerson: true,
                warrantyMonths: true,
                doaWarrantyDays: true,
                creditLimit: true,
                paymentTerms: true,
            },
        })
        : [];
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));

    const reports = await Promise.all(customerGroups.map(async (row) => {
        const customerWhere = {
            AND: [
                where,
                { customerId: row.customerId },
            ],
        };

        const [statusGroups, costTotals, openCount, overdueCount] = await Promise.all([
            prisma.repairJob.groupBy({
                by: ["jobStatus"],
                where: customerWhere,
                _count: { _all: true },
            }),
            prisma.repairJobCosting.aggregate({
                where: {
                    repairJob: { is: customerWhere },
                },
                _sum: {
                    totalCost: true,
                    customerCharge: true,
                },
            }),
            prisma.repairJob.count({
                where: {
                    AND: [
                        customerWhere,
                        { jobStatus: { in: OPEN_STATUSES } },
                    ],
                },
            }),
            prisma.repairJob.count({
                where: {
                    AND: [
                        customerWhere,
                        {
                            jobStatus: { in: OPEN_STATUSES },
                            dueDate: { lt: new Date() },
                        },
                    ],
                },
            }),
        ]);

        const totalCost = toNumber(costTotals._sum.totalCost);
        const customerCharge = toNumber(costTotals._sum.customerCharge);

        return {
            customer: customerById.get(row.customerId) || { id: row.customerId },
            repairJobs: row._count._all,
            openJobs: openCount,
            overdueJobs: overdueCount,
            byStatus: mapCounts(statusGroups, "jobStatus"),
            totalCost: roundMoney(totalCost),
            customerCharge: roundMoney(customerCharge),
            grossMargin: roundMoney(customerCharge - totalCost),
        };
    }));

    return res.status(200).json(new ApiResponse(200, {
        customers: reports,
        limit: pagination.limit,
    }, "Customer performance report."));
});

export {
    getBacklogReport,
    getCostReport,
    getCustomerReport,
    getProductReport,
    getSummaryReport,
    getThroughputReport,
};
