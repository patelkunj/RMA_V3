//import { v2 as fileUpload } from "cloudinary";  // upload file on server 
import fs from "fs";
import path from "path";
import { ApiError } from "./ApiError.js";
import { logger } from "./logger.js";
import { deletePrivateObject, putPrivateObject } from "../services/objectStorage.service.js";

// fileupload on server 
// fileUpload.config({ 
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
//     api_key: process.env.CLOUDINARY_API_KEY, 
//     api_secret:  process.env.CLOUDINARY_API_SECRET 
// });

// const uploadOnCloudinary = async(localFilePath)=>{
//     try{
//         if(!localFilePath) return null
//         //upload the file on cloudinary
//          const response = await fileUpload.uploader.upload(localFilePath,{
//             resource_type: "auto"
//         })
//         // file has been uploaded successfully
//         console.log(`File upload on Cloudinary${response}`);
//         fs.unlinkSync(localFilePath)
//         return response
//     }catch(error){
//         fs.unlinkSync(localFilePath) // remove the locally saved file as the upload opraton got failed.
//         return null
//     }
// }


// Move this funciton to Utility. 
// creat folder with job id. 
const safeSegment = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "_");

async function storeUploadedFiles(files = [], jobId, foldername){
    const storedFiles = [];
    try {
        for (const file of files) {
            if (!file?.path || !file?.filename) {
                continue;
            }
            const name = path.basename(file.filename);
            const key = `repair-jobs/${safeSegment(jobId)}/${safeSegment(foldername)}/${name}`;
            const stored = await putPrivateObject({ key, filePath: file.path, contentType: file.mimetype });
            storedFiles.push({ ...stored, name, mimeType: file.mimetype });
        }
        return storedFiles;
    } catch (error) {
        await Promise.all(storedFiles.map((file) => deletePrivateObject(file.key).catch(() => {})));
        for (const file of files) {
            if (file?.path) await fs.promises.unlink(file.path).catch(() => {});
        }
        logger.error("private_upload_store_failed", { storedCount: storedFiles.length, error });
        if (error instanceof ApiError) throw error;
        throw new ApiError(503, "Unable to store uploaded files.");
    }
}

const removeStoredFiles = async (files = []) => {
    await Promise.all(files.map((file) => file?.key ? deletePrivateObject(file.key).catch(() => {}) : undefined));
};

export {
    storeUploadedFiles,
    removeStoredFiles,
}
