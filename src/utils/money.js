import { Prisma } from "@prisma/client";
import { ApiError } from "./ApiError.js";

const Decimal = Prisma.Decimal;
const ROUNDING_MODE = Decimal.ROUND_HALF_UP;
const MONEY_SCALE = 2;

const decimal = (value, fieldName = "amount") => {
    if (value === undefined || value === null || String(value).trim() === "") {
        throw new ApiError(400, `${fieldName} is required.`);
    }

    try {
        const result = new Decimal(String(value));
        if (!result.isFinite()) throw new Error("not finite");
        return result;
    } catch {
        throw new ApiError(400, `${fieldName} must be a valid decimal number.`);
    }
};

const money = (value, fieldName = "amount", { allowNegative = false } = {}) => {
    const result = decimal(value, fieldName);
    if (!allowNegative && result.isNegative()) {
        throw new ApiError(400, `${fieldName} must not be negative.`);
    }
    return result.toDecimalPlaces(MONEY_SCALE, ROUNDING_MODE);
};

const taxRate = (value, fieldName = "taxRate") => {
    const result = decimal(value, fieldName);
    if (result.isNegative() || result.greaterThan(1)) {
        throw new ApiError(400, `${fieldName} must be a fraction between 0 and 1.`);
    }
    return result;
};

const multiplyMoney = (unitAmount, quantity) => money(unitAmount).times(quantity).toDecimalPlaces(MONEY_SCALE, ROUNDING_MODE);
const sumMoney = (values) => values.reduce((sum, value) => sum.plus(value), new Decimal(0)).toDecimalPlaces(MONEY_SCALE, ROUNDING_MODE);
const calculateTax = (subtotal, rate) => money(subtotal).times(taxRate(rate)).toDecimalPlaces(MONEY_SCALE, ROUNDING_MODE);
const divideMoney = (amount, divisor) => money(amount).dividedBy(divisor).toDecimalPlaces(MONEY_SCALE, ROUNDING_MODE);

export {
    Decimal,
    calculateTax,
    decimal,
    divideMoney,
    money,
    multiplyMoney,
    sumMoney,
    taxRate,
};
