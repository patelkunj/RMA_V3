class ApiError extends Error{
    constructor(
            statusCode,
            message= "Something went wrong",
            errors = [],
            stack =""
    ){
        super(typeof message === "string" && message.trim() ? message : "Something went wrong")
        this.statusCode = Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 500
        this.data = null
        this.success = false;
        this.errors = Array.isArray(errors) ? errors : []

        if(stack){
            this.stack = stack
        }else{
            Error.captureStackTrace(this, this.constructor)
        }
    }

    toJSON(){
        return {
            statusCode: this.statusCode,
            data: null,
            message: this.message,
            success: false,
            errors: this.errors,
        }
    }
}

export {ApiError}
