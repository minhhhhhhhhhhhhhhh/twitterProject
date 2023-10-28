import express from 'express'
import { body, validationResult, ValidationChain } from 'express-validator'
import { RunnableValidationChains } from 'express-validator/src/middlewares/schema'
import HTTP_STATUS from '~/constants/httpStatus'
import { EntityError, ErrorWithStatus } from '~/models/Errors'

// sequential processing, stops running validations chain if the previous one fails.
export const validate = (validation: RunnableValidationChains<ValidationChain>) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    await validation.run(req)
    const errors = validationResult(req)
    if (errors.isEmpty()) {
      return next()
    }

    const errorObject = errors.mapped() //hàm này giúp ta lấy lỗi ra dưới dạng object
    const entityError = new EntityError({ errors: {} }) //tạo ra 1 lỗi có status 422

    //xử lý object lỗi
    for (const key in errorObject) {
      //phân rã msg của 1 cái lỗi ra
      const { msg } = errorObject[key]
      //"msg instanceof ErrorWithStatus " vừa giúp mình biết rằng có lỗi k, mà vừa định nghĩa cho msg
      //và khi tường minh thì msg có  thể .status được
      //nếu có lỗi của ErrorWithStatus thì mình return và next(msg): ném lỗi cho default error handler xử lý
      //thay vì để nó chạy xuống và res.status(422).....
      //nhờ vậy mà nếu có lỗi gì khác error do validator tạo ra thì nó sẽ k vào lỗi 422
      //nếu lỗi đặc biệt do mình tạo ra khác 422 thì next cho default error handler xử lý
      if (msg instanceof ErrorWithStatus && msg.status !== HTTP_STATUS.UNPROCESSABLE_ENTITY) {
        return next(msg)
      }
      //nếu không phải lỗi đặc biệt thì chắc chắn là lỗi 422
      //thì mình lưu vào entityError
      entityError.errors[key] = msg
    }

    //sau khi duyệt xong thì ném cho default error handler xử lý
    next(entityError)
  }
}
