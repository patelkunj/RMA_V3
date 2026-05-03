import BaseModel from "./base-model.js";

class CommentModel extends BaseModel{
  constructor(){
    super('repair_job_comments')
  }
}

export {CommentModel}
