import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { moveUploadedFiles } from "../utils/fileUpload.js";
import { generateRandomString } from "../utils/common.js";

const getDocumentType = (fileName) => {
    const extension = fileName.toLowerCase();

    if (
        extension.endsWith(".jpg") ||
        extension.endsWith(".jpeg") ||
        extension.endsWith(".png") ||
        extension.endsWith(".webp")
    ) {
        return "IMAGE";
    }

    if (extension.endsWith(".pdf")) {
        return "PDF";
    }

    if (extension.endsWith(".doc") || extension.endsWith(".docx")) {
        return "DOC";
    }

    return "OTHER";
};

const insertChat = asyncHandler(async (req, res) => {
    try {

        const { repair_job_id, message } = req.body;

        if (!repair_job_id) {
            throw new ApiError(400, "Repair job id is required.");
        }

        if (!message?.trim() && !req.files?.length) {
            throw new ApiError(400, "Message or attachment is required.");
        }

        const senderId = req.user?.id || req.customer?.id;
        const senderRole = req.user?.id ? "USER" : "CUSTOMER";

        if (!senderId) {
            throw new ApiError(401, "Unauthorized sender.");
        }

        const repairJob = await prisma.repairJob.findUnique({
            where: { id: Number(repair_job_id) },
            select: { id: true },
        });

        if (!repairJob) {
            throw new ApiError(404, "Repair job not found.");
        }

        let chat = null;

        if (message?.trim()) {

            chat = await prisma.chat.create({
                data: {
                    repairJobId: Number(repair_job_id),
                    senderId,
                    senderRole,
                    message: message.trim()
                }
            });

            if (!chat) {
                throw new ApiError(400, "Chat couldn't be inserted.");
            }
        }

        if (req.files?.length > 0) {

            const uploadFiles = await moveUploadedFiles(req.files, repair_job_id, "chat");

            for (const file of uploadFiles) {
                await prisma.document.create({
                    data: {
                        repairJobId: Number(repair_job_id),
                        relatedType: "chat",
                        relatedId: chat?.id || 0,
                        documentName: file,
                        documentUrl: `/uploads/${repair_job_id}/chat/${file}`,
                        documentType: getDocumentType(file),
                        uploadedBy: senderId,
                        uploadedRole: req.user?.role || req.customer?.role,
                        fileHash: generateRandomString(15)
                    }
                });
            }
        }

        return res
            .status(200)
            .json(new ApiResponse(200, chat, "Chat sent successfully."));

    } catch (error) {
        throw new ApiError(
            400,
            `Error while inserting chat. ${error?.message}`
        );
    }
});

const listChat = asyncHandler(async (req, res) => {
    try {

        const { id } = req.body;

        if (!id) {
            throw new ApiError(400, "Job id is required.");
        }

        // const chat = await prisma.chat.findMany({
        //     where: {
        //         repairJobId: Number(id)
        //     },
        //     orderBy: {
        //         createdDate: "asc"
        //     }
        // });

        const chats = await prisma.chat.findMany({
            where: {
                repairJobId: Number(id)
            },
            orderBy: {
                createdDate: "asc"
            }
        });

        const chatWithSender = await Promise.all(
            chats.map(async (chat) => {

                let sender = null;

                if (chat.senderRole === "USER") {
                    sender = await prisma.user.findUnique({
                        where: { id: chat.senderId },
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    });
                } else {
                    sender = await prisma.customer.findUnique({
                        where: { id: chat.senderId },
                        select: {
                            id: true,
                            companyName: true,
                            contactPersonName: true
                        }
                    });
                }

                return {
                    ...chat,
                    sender
                };
            })
        );


        if (!chatWithSender.length) {
            return res
                .status(200)
                .json(new ApiResponse(200, null, "No chat found."));
        }

        return res
            .status(200)
            .json(new ApiResponse(200, chatWithSender, "List of chat messages."));

    } catch (error) {
        return res
            .status(400)
            .json(
                new ApiError(
                    400,
                    `Error while fetching chats. ${error?.message}`
                )
            );
    }
});

const toggleRead = asyncHandler(async (req, res) => {
    try {

        const { id } = req.body;

        if (!id) {
            throw new ApiError(400, "Job id is required.");
        }

        const readData = await prisma.chat.updateMany({
            where: {
                repairJobId: Number(id),
                isRead: false
            },
            data: {
                isRead: true
            }
        });

        if (readData.count === 0) {
            return res
                .status(200)
                .json(
                    new ApiResponse(
                        200,
                        null,
                        "All messages are already read."
                    )
                );
        }

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    readData,
                    `${readData.count} messages marked as read.`
                )
            );

    } catch (error) {
        return res
            .status(400)
            .json(
                new ApiError(
                    400,
                    `Error while updating read status. ${error?.message}`
                )
            );
    }
});

const unreadCount = asyncHandler(async (req, res) => {
    try {

        const { repair_job_id } = req.body;

        if (!repair_job_id) {
            return res
                .status(400)
                .json(
                    new ApiError(
                        400,
                        "Repair job id is required."
                    )
                );
        }

        const countUnread = await prisma.chat.count({
            where: {
                repairJobId: Number(repair_job_id),
                isRead: false
            }
        });

        if (countUnread === 0) {
            return res
                .status(200)
                .json(
                    new ApiResponse(
                        200,
                        0,
                        "No unread messages."
                    )
                );
        }

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    countUnread,
                    `${countUnread} unread message(s).`
                )
            );

    } catch (error) {
        return res
            .status(400)
            .json(
                new ApiError(
                    400,
                    `Couldn't get unread count. ${error?.message}`
                )
            );
    }
});

export{
    insertChat,
    listChat,
    toggleRead,
    unreadCount
}



















// import {asyncHandler} from "../utils/asyncHandler.js"
// import {ApiError} from "../utils/ApiError.js"
// import {ApiResponse} from "../utils/ApiResponse.js"
// import { ChatModel } from "../models/chat.model.js"
// import { DocumentModel } from "../models/document.model.js"
// import {createFolder, moveFile} from "../utils/fileUpload.js"
// import { generateRandomString } from "../utils/common.js"
// import moment from "moment";


// const Chat = new ChatModel();
// const Document = new DocumentModel();

// const insertChat= asyncHandler( async( req, res)=>{
//     try {
//         const {repair_job_id, message} = req.body

//         if([repair_job_id].some((field)=> field?.trim() === "")){
//             throw new ApiError(400, " All fields are required.")
//         }
//         let chat = null;

//         if(message !="" && message != undefined){
//             chat = await Chat.create({
//                 repair_job_id,
//                 sender_id: req.user?.id || req.customer?.id,
//                 sender_role: (req.user?.id) ? "user" : "customer",
//                 message:message.trim()
//             })
//             if(!chat){
//                 throw new ApiError(400,`chat isn't insert properly.`)
//             }
//         }

       
//         if(req.files.length > 0 ){
//             // create the folder if it's not exists.
//             createFolder(repair_job_id,"chat")      
//             // Move all the file  from temp to upload folder
//             const uploadfiles = await moveFile(repair_job_id,"chat")
//             let type='file';
//             for(let j=0; j< uploadfiles.length; j++){

//                 if(uploadfiles[j].toString().includes("jpg") || uploadfiles[j].toString().includes("jpeg") || uploadfiles[j].toString().includes("png") || uploadfiles[j].toString().includes("webp")){
//                     type = 'image'
//                 }

//                 await Document.create({
//                         repair_job_id,
//                         related_type:"chat",
//                         related_id: chat,
//                         document_name:uploadfiles[j].toString(),
//                         document_url:`/uploads/${repair_job_id}/chat/${uploadfiles[j].toString()}`, 
//                         document_type: type||"file",
//                         uploaded_by: req.user?.id || req.customer?.id,
//                         uploaded_role: req.user?.role || req.customer?.role,
//                         file_hash:generateRandomString(15), 
//                 })
                
//             }
//         }
//         res.status(200).json(new ApiResponse(200,chat," chat sent."))

//     } catch (error) {
//         throw new ApiError(400, `Error while inserting chat.${ error?.message}`)
//     }
// })

// const listChat = asyncHandler(async (req,res) => {
//     try {
//         const {id} = req.body
//         if (!id) {
//             throw new ApiError(400, "job id is not empty.")
//         }
//         const chat = await Chat.find({'repair_job_id':id}).execute();
//         if (!chat) {
//             res.status(200).json( new ApiResponse(200,null, " No chat found."))
//         }
//         res.status(200).json( new ApiResponse(200,chat, " list of chat."))

//     } catch (error) {
//         res.status(400).json( new ApiError(400," Error while add the chat. ", error?.message))
//     }
// })


// const toggleRead = asyncHandler( async(req,res)=>{
//     try {
//         const {id} = req.body
//         if (!id) {
//             throw new ApiError(400, "job id is not empty.")
//         }
//         const readData = await Chat.update({'repair_job_id':id}, {
//             is_read:1
//         })

//         if(!readData){
//             return res.status(200).json(new ApiResponse(200, null," All the message is already read."))
//         }

//         return res.status(200).json(new ApiResponse(200, readData," the message is read."))
//     } catch (error) {
//         return res.status(400).json(new ApiError(400,' Error while changing message read status.'))
//     }
// })


// const unreadCount = asyncHandler(async(req,res)=>{
//     try {
//         const {repair_job_id} = req.body
//         if(!repair_job_id){
//             return res.status(400).json(new ApiResponse(400," repair job id is empty."))
//         }

//         const countUnread = await Chat.count({'repair_job_id':repair_job_id , 'is_read':0})

//         if(!countUnread){
//             return res.status(200).json(new ApiResponse(200, null, " No messages are unread."))
//         }

//         return res.status(200).json(new ApiResponse(200,countUnread,`${countUnread} message is unread.`))


//     } catch (error) {
//         return res.status(400).json(new ApiError(400,"coudn't get the count of chat."))
//     }
// }) 
