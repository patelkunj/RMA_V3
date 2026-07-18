import multer from "multer";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ApiError } from "../utils/ApiError.js";

const tempDir = "./public/temp";
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      fs.mkdirSync(tempDir, { recursive: true });
      cb(null, tempDir)
    },
    filename: function (req, file, cb) {
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${randomUUID()}${extension}`)
    }
  })

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new ApiError(415, "Unsupported file type."));
  }
  cb(null, true);
};

const generalUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
});

const normalizeMulterError = (error) => {
  if (error instanceof ApiError) return error;
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === "LIMIT_FILE_SIZE") return new ApiError(413, "Each upload must not exceed 10 MB.");
  if (error.code === "LIMIT_FILE_COUNT") return new ApiError(400, "A request may contain at most 10 files.");
  if (error.code === "LIMIT_UNEXPECTED_FILE") return new ApiError(400, "The upload field is invalid or contains too many files.");
  return new ApiError(400, "The multipart upload is invalid.");
};

const handleMulter = (middleware) => (req, res, next) => {
  middleware(req, res, (error) => error ? next(normalizeMulterError(error)) : next());
};

export const upload = {
  any: () => handleMulter(generalUpload.any()),
  single: (fieldName) => handleMulter(generalUpload.single(fieldName)),
};

const logoUploadMiddleware = multer({
  storage,
  fileFilter(req, file, cb) {
    if (!["image/jpeg", "image/png"].includes(file.mimetype)) {
      return cb(new ApiError(415, "Organization logos must be PNG or JPEG images."));
    }
    return cb(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
}).single("logo");

const uploadOrganizationLogo = (req, res, next) => {
  logoUploadMiddleware(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(413, "Organization logo must not exceed 2 MB."));
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_UNEXPECTED_FILE") {
      return next(new ApiError(400, "Upload one logo using the 'logo' form field."));
    }
    return next(error);
  });
};

export { uploadOrganizationLogo };


  
