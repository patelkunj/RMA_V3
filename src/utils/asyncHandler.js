const asyncHandler = (handler) => {
    return (req, res, next) => {
        try {
            Promise.resolve(handler(req,res,next)).catch((error) => next(error))
        } catch (error) {
            if (!res.headersSent) {
                return next(error); // Only forward the error if no response was sent
            } else {
                console.error("Unhandled error after response was sent:", error);
            }
        }
    };
};

export {asyncHandler}


//==================== Old Code ==================================
// const asyncHandler = (requesthandeler)=>{
//     return(req,res,next) =>{
//         Promise.resolve(requesthandeler(req,res,next)).catch((error) => next(error))
//     }
// }
