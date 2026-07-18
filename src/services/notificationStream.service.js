import prisma from "../db/prisma.js";

const stream = async (req, res) => {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write("retry: 5000\n\n");

    const recipientType = req.customer ? "CUSTOMER" : "USER";
    const recipientId = req.customer?.id || req.user.id;
    let lastId = Number(req.headers["last-event-id"] || req.query.afterId || 0);
    let closed = false;

    const publish = async () => {
        if (closed) return;
        const notifications = await prisma.notification.findMany({
            where: {
                recipientType,
                recipientId,
                id: { gt: lastId },
                ...(req.customer ? { organizationId: req.customer.organizationId } : {}),
            },
            orderBy: { id: "asc" },
            take: 100,
        });
        for (const notification of notifications) {
            lastId = notification.id;
            res.write(`id: ${notification.id}\nevent: notification\ndata: ${JSON.stringify(notification)}\n\n`);
        }
    };

    await publish();
    const poll = setInterval(() => publish().catch(() => res.write("event: error\ndata: {}\n\n")), 5000);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20000);
    req.on("close", () => {
        closed = true;
        clearInterval(poll);
        clearInterval(heartbeat);
    });
};

export { stream };
