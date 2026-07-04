//import { v2 as fileUpload } from "cloudinary";  // upload file on server 
import fs from "fs"; //filesystem
import { fileURLToPath } from 'url';
import path from 'path';
import { ApiError } from "./ApiError.js";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
function createFolder(jobId, foldername){
    const folderName = path.join(__dirname,`../../public/uploads/${jobId}/${foldername}`);

    try {

        const folder  = fs.existsSync(folderName)
        if(!folder){
            fs.mkdirSync(folderName,{recursive:true});
            logger.info(`Folder "${folderName}" created successfully.`);
        }
    } catch (err) {
        logger.error(`Error creating folder "${folderName}":`, err);
    }
}



// Move this funciton to Utility. 
// Move file from temp to upload folder. 
async function moveFile(jobId,foldername){
    try {
        
        const tempDir = path.join(__dirname,`../../public/temp`);
        const uploadDir = path.join(__dirname,`../../public/uploads/${jobId}/${foldername}`);

        // Ensure the uploadDir exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const files = fs.readdirSync(tempDir);
        const filesName = [];
    
        files.forEach(file => {
            const oldPath = path.join(tempDir, file);
            const newPath = path.join(uploadDir, file);
            filesName.push(file);
    
            try {
                fs.renameSync(oldPath, newPath);
            } catch (err) {
                logger.error(`Error moving file: ${file}`, err);
            }
        });
    
        return filesName; // If you need to return the moved file names

    } catch (error) {
        throw new ApiError(400, "Error while moveing files", error?.message)
    }    
}

async function moveUploadedFiles(files = [], jobId, foldername){
    try {
        const uploadDir = path.join(__dirname,`../../public/uploads/${jobId}/${foldername}`);
        fs.mkdirSync(uploadDir, { recursive: true });

        const movedFiles = [];

        for (const file of files) {
            if (!file?.path || !file?.filename) {
                continue;
            }

            const newPath = path.join(uploadDir, file.filename);
            fs.renameSync(file.path, newPath);
            movedFiles.push(file.filename);
        }

        return movedFiles;
    } catch (error) {
        throw new ApiError(400, "Error while moving uploaded files", error?.message)
    }
}


export {
    createFolder, 
    moveFile,
    moveUploadedFiles
}
