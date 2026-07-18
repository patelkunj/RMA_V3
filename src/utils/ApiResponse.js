class ApiResponse{

    constructor(statusCode, data = null, message = "Success"){
        this.statusCode = statusCode
        this.data = data === undefined ? null : data
        this.message = String(message)
        this.success = statusCode < 400
    }

}

export {ApiResponse}
