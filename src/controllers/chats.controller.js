import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { ChatModel } from "../models/chat.model.js"
import { DocumentModel } from "../models/document.model.js"
import {createFolder, moveFile} from "../utils/fileUpload.js"
import { generateRandomString } from "../utils/common.js"
import moment from "moment";


const Chat = new ChatModel();
const Document = new DocumentModel();

const insertChat= asyncHandler( async( req, res)=>{
    try {
        const {repair_job_id, message} = req.body

        if([repair_job_id].some((field)=> field?.trim() === "")){
            throw new ApiError(400, " All fields are required.")
        }
        let chat = null;

        if(message !="" && message != undefined){
            chat = await Chat.create({
                repair_job_id,
                sender_id: req.user?.id || req.customer?.id,
                sender_role: (req.user?.id) ? "user" : "customer",
                message:message.trim()
            })
            if(!chat){
                throw new ApiError(400,`chat isn't insert properly.`)
            }
        }

       
        if(req.files.length > 0 ){
            // create the folder if it's not exists.
            createFolder(repair_job_id,"chat")      
            // Move all the file  from temp to upload folder
            const uploadfiles = await moveFile(repair_job_id,"chat")
            let type='file';
            for(let j=0; j< uploadfiles.length; j++){

                if(uploadfiles[j].toString().includes("jpg") || uploadfiles[j].toString().includes("jpeg") || uploadfiles[j].toString().includes("png") || uploadfiles[j].toString().includes("webp")){
                    type = 'image'
                }

                await Document.create({
                        repair_job_id,
                        related_type:"chat",
                        related_id: chat,
                        document_name:uploadfiles[j].toString(),
                        document_url:`/uploads/${repair_job_id}/chat/${uploadfiles[j].toString()}`, 
                        document_type: type||"file",
                        uploaded_by: req.user?.id || req.customer?.id,
                        uploaded_role: req.user?.role || req.customer?.role,
                        file_hash:generateRandomString(15), 
                })
                
            }
        }
        res.status(200).json(new ApiResponse(200,chat," chat sent."))

    } catch (error) {
        throw new ApiError(400, `Error while inserting chat.${ error?.message}`)
    }
})

const listChat = asyncHandler(async (req,res) => {
    try {
        const {id} = req.body
        if (!id) {
            throw new ApiError(400, "job id is not empty.")
        }
        const chat = await Chat.find({'repair_job_id':id}).execute();
        if (!chat) {
            res.status(200).json( new ApiResponse(200,null, " No chat found."))
        }
        res.status(200).json( new ApiResponse(200,chat, " list of chat."))

    } catch (error) {
        res.status(400).json( new ApiError(400," Error while add the chat. ", error?.message))
    }
})


const toggleRead = asyncHandler( async(req,res)=>{
    try {
        const {id} = req.body
        if (!id) {
            throw new ApiError(400, "job id is not empty.")
        }
        const readData = await Chat.update({'repair_job_id':id}, {
            is_read:1
        })

        if(!readData){
            return res.status(200).json(new ApiResponse(200, null," All the message is already read."))
        }

        return res.status(200).json(new ApiResponse(200, readData," the message is read."))
    } catch (error) {
        return res.status(400).json(new ApiError(400,' Error while changing message read status.'))
    }
})


const unreadCount = asyncHandler(async(req,res)=>{
    try {
        const {repair_job_id} = req.body
        if(!repair_job_id){
            return res.status(400).json(new ApiResponse(400," repair job id is empty."))
        }

        const countUnread = await Chat.count({'repair_job_id':repair_job_id , 'is_read':0})

        if(!countUnread){
            return res.status(200).json(new ApiResponse(200, null, " No messages are unread."))
        }

        return res.status(200).json(new ApiResponse(200,countUnread,`${countUnread} message is unread.`))


    } catch (error) {
        return res.status(400).json(new ApiError(400,"coudn't get the count of chat."))
    }
}) 

export{
    insertChat,
    listChat,
    toggleRead,
    unreadCount
}