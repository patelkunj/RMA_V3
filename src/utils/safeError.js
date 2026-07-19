import { ApiError } from "./ApiError.js";
import { logger } from "./logger.js";

const safeServiceError = (error, operation, publicMessage = "Unable to complete the request.") => {
    if (error instanceof ApiError) return error;
    logger.error("service_operation_failed", { operation, error });
    return new ApiError(500, publicMessage);
};

const respondWithSafeError = (res, error, operation, publicMessage) => {
    const safeError = safeServiceError(error, operation, publicMessage);
    return res.status(safeError.statusCode).json(safeError);
};

export { respondWithSafeError, safeServiceError };
