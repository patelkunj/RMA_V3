import {ApiError}  from "../utils/ApiError.js";

// authorizeRoles.js
export const authorizeRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      const user = req.user ?? req.customer; // assuming user info is attached to req (e.g., by auth middleware)

      if (!user) {
        return res.status(401).json(new ApiError(401, "Unauthorized: No user role found"));
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json(new ApiError(403, "Forbidden: You do not have permission to access this resource"));
      }

      next(); // authorized, proceed
    } catch (err) {
      return res.status(500).json(new ApiError(500, "Server error"));
    }
  };
};


// export const authorizeRoles = function  authorization(...allowedRoles) { asyncHandler(async(req, res, next)=> {
//       try {
//         if (!req.user) {
//           //return res.status(401).json({ message: "Unauthorized: No user info" });
//           throw new ApiError(403, "Unauthorized: No user info")
//         }
  
//         if (!allowedRoles.includes(req.user.user_role)) {
//           //return res.status(403).json({ message: "Forbidden: Insufficient role" });
//           throw new ApiError(403, "Forbidden: Insufficient role")
//         }
  
//         next(); // user has the right role
//       } catch (error) {
//         console.error('Authorization error:', error);
//         //res.status(500).json({ message: "Internal Server Error" });
//         throw new ApiError(500, "Internal Server Error")
//       }
//     });
//   };
  

  
