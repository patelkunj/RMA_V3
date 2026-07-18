const startedAt = Date.now();
const counters = new Map();
let inFlight = 0;

const normalizeLabel = (value) => String(value || "unknown")
    .replace(/[^a-zA-Z0-9_:.-]/g, "_")
    .slice(0, 120);

const increment = (name, labels = {}, amount = 1) => {
    const labelText = Object.entries(labels)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${normalizeLabel(key)}="${normalizeLabel(value)}"`)
        .join(",");
    const key = labelText ? `${name}{${labelText}}` : name;
    counters.set(key, (counters.get(key) || 0) + amount);
};

const metricsMiddleware = (req, res, next) => {
    const started = process.hrtime.bigint();
    inFlight += 1;

    res.once("finish", () => {
        inFlight = Math.max(0, inFlight - 1);
        const seconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
        const route = req.route?.path || req.baseUrl || req.path || "unknown";
        const labels = { method: req.method, route, status: res.statusCode };
        increment("rma_http_requests_total", labels);
        increment("rma_http_request_duration_seconds_sum", labels, seconds);
    });

    next();
};

const renderMetrics = () => {
    const lines = [
        "# TYPE rma_process_uptime_seconds gauge",
        `rma_process_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`,
        "# TYPE rma_http_in_flight_requests gauge",
        `rma_http_in_flight_requests ${inFlight}`,
        "# TYPE rma_http_requests_total counter",
    ];

    for (const [key, value] of [...counters.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        lines.push(`${key} ${value}`);
    }
    return `${lines.join("\n")}\n`;
};

export { increment, metricsMiddleware, renderMetrics };
