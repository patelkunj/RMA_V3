import jwt from "jsonwebtoken"

const generateAccessToken = (user) => {
   return jwt.sign(
      {
          id:user.id,
          email:user.email,
          username:user.emp_user_id
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
          expiresIn: process.env.ACCESS_TOKEN_EXPIRY
      }
    )
  }

  const generateRefreshToken = (user)=> {

    return jwt.sign(
        {
            id:user.id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
  }

  const isJwtExpired = (token) => {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
    } catch {
        return false; // malformed token
    }
}


  export{
    generateAccessToken,
    generateRefreshToken,
    isJwtExpired
  }