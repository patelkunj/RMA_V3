import jwt from "jsonwebtoken"

const requiredEnv = (name) => {
    const value = process.env[name];

    if (!value) {
        throw new Error(`${name} environment variable is required.`);
    }

    return value;
};

const generateAccessToken = (user) => {
   return jwt.sign(
      {
          id:user.id,
          email:user.email,
          username:user.firstName
      },
      requiredEnv("ACCESS_TOKEN_SECRET"),
      {
          expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m"
      }
    )
  }

  const generateRefreshToken = (user)=> {

    return jwt.sign(
        {
            id:user.id
        },
        requiredEnv("REFRESH_TOKEN_SECRET"),
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d"
        }
    )
  }

  const isJwtExpired = (token) => {
    try {
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
        const now = Math.floor(Date.now() / 1000);
        if (typeof payload.exp !== "number") {
            return true;
        }
        return payload.exp < now;
    } catch {
        return true;
    }
}


  export{
    generateAccessToken,
    generateRefreshToken,
    isJwtExpired
  }
