import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {CommentModel} from "../models/comment.model.js"
import {createFolder, moveFile} from "../utils/fileUpload.js"
import moment from "moment"
import {DocumentModel} from "../models/document.model.js"
import {generateRandomString} from "../utils/common.js"


const Comment = new CommentModel();
const Document = new DocumentModel();

const insertComment= asyncHandler( async( req, res)=>{
    try {
        const {repair_job_id,category,message} = req.body

        console.log("req.files->", req.files)


        if([repair_job_id].some((field)=> field?.trim() === "")){
            return res.status(400).json(new ApiError(400, " job id is required."))
        }

        let comment = null;

        if(message !="" && message != undefined){
            comment = await Comment.create({
                repair_job_id,
                user_id: req.user?.id,
                visibility: category,
                comment:message.trim()
            })
            if(!comment){
                return res.status(400).json(new ApiError(400,`comment isn't insert properly.`))
            }
        }

       
        if(req.files.length > 0 && comment ){
            // create the folder if it's not exists.
            createFolder(repair_job_id,"chat")      
            // Move all the file  from temp to upload folder
            const uploadfiles = await moveFile(repair_job_id,"comment")
            let type='file';
            for(let j=0; j< uploadfiles.length; j++){

                if(uploadfiles[j].toString().includes("jpg") || uploadfiles[j].toString().includes("jpeg") || uploadfiles[j].toString().includes("png") || uploadfiles[j].toString().includes("webp")){
                    type = 'image'
                }
                    await Document.create({
                            repair_job_id,
                            related_type:"repair_comment",
                            related_id: comment,
                            document_name:uploadfiles[j].toString(),
                            document_url:`/uploads/${repair_job_id}/comment/${uploadfiles[j].toString()}`, 
                            document_type: type,
                            uploaded_by: req.user?.id,
                            uploaded_role: req.user?.role,
                            file_hash:generateRandomString(15), 
                    })
            }
        }
        res.status(200).json(new ApiResponse(200,comment," comment sent."))

    } catch (error) {
        return res.status(400).json(new ApiError(400, `Error while inserting chat.${ error?.message}`))
    }
})

const listComment = asyncHandler(async (req,res) => {
    try {
        const {id} = req.body
        if (!id) {
            return res.status(400).json(new ApiError(400, "job id is not empty."))
        }

        //const comment = await Comment.find({'repair_job_id':id}).execute();

        const comment = await Comment.find({'repair_job_id':id}).join('users','users.id = repair_job_comments.user_id').execute();

        if (!comment) {
            return res.status(200).json( new ApiResponse(200,null, " No comment found."))
            
        }

        // Remove the comment of other user with visibility add note.
        for (let i = comment.length - 1; i >= 0; i--) {
            if (comment[i].visibility === 'add note' && comment[i].user_id !== req.user?.id) {
                comment.splice(i, 1);
            }
        }

        return res.status(200).json( new ApiResponse(200,comment, " list of comment."))

    } catch (error) {
        return res.status(400).json(new ApiError(400, ` Error while listing comment. ${error?.message}`))
    }
})

const updateComment = asyncHandler(async(req,res)=>{
    try {
        const {id,category, message } = req.body

        if([id,message].some((field) =>field?.trim() === "")){
            return res.status(400).json(new ApiError(400, " All fields are required."))
        }

        const comment = await Comment.update({'id':id},{
            user_id: req.user?.id,
            visibility:category,
            comment:message.trim(),
            is_edit: true,
        })

        if(!comment){
            return res.status(400).json(new ApiError(400, ` comment isn't found.`))
        }
        res.status(200).json(new ApiResponse(200,comment," Comment updated."))

    } catch (error) {
        res.status(400).json(new ApiError(400, " Error while updateing the comment."))
    }
})

export{
    insertComment,
    listComment,
    updateComment
}