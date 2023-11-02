import e, { NextFunction, Request, Response } from 'express'
import usersService from '~/services/users.services'
import { ParamsDictionary } from 'express-serve-static-core'
import {
  EmailVerifyReqBody,
  ForgotPasswordReqBody,
  LoginReqBody,
  LogoutReqBody,
  RegisterReqBody,
  TokenPayload,
  VerifyForgotPasswordReqBody
} from '~/models/requests/User.request'
import User from '~/models/schemas/User.schema'
import { ObjectId } from 'mongodb'
import { USERS_MESSAGES } from '~/constants/messages'
import HTTP_STATUS from '~/constants/httpStatus'
import databaseService from '~/services/database.services'
import { UserVerifyStatus } from '~/constants/enums'
export const loginController = async (
  req: Request<ParamsDictionary, any, LoginReqBody>,
  res: Response,
  next: NextFunction
) => {
  //vào req lấy user ra và lấy _id của user đó
  const user = req.user as User
  const user_id = user._id as ObjectId
  //dùng _id để tạo token
  const result = await usersService.login(user_id.toString())
  //nếu không bug gì thì sẽ trả về result
  return res.json({ message: USERS_MESSAGES.LOGIN_SUCCESS, result: result })
}

//route này nhận vào email, password và tạo tài khoản cho mình
//nhưng trong lúc tạo tài khoản ta dùng insertOne(là 1 promise)
//nên ta sẽ dùng async await để xử lý bất đồng bộ
export const registerController = async (
  req: Request<ParamsDictionary, any, RegisterReqBody>,
  res: Response,
  next: NextFunction
) => {
  const result = await usersService.register(req.body)
  console.log(result)
  return res.status(400).json({
    message: USERS_MESSAGES.REGISTER_SUCCESS,
    result: result
  })
}

export const logoutController = async (
  req: Request<ParamsDictionary, any, LogoutReqBody>,
  res: Response,
  next: NextFunction
) => {
  //lấy refresh token từ req.body
  const { refresh_token } = req.body
  //xóa refresh token trong database
  const result = await usersService.logout(refresh_token)
  res.json(result)
}

export const emailVerifyController = async (
  req: Request<ParamsDictionary, any, EmailVerifyReqBody>,
  res: Response,
  next: NextFunction
) => {
  //khi mà req vào được đây nghĩa là email_verify_token đã được verify
  //đồng thời trong req sẽ có decoded_email_verify_token
  const { user_id } = req.decoded_email_verify_token as TokenPayload
  //tìm xem user có tồn tại không
  const user = await databaseService.users.findOne({ _id: new ObjectId(user_id) })
  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({ message: USERS_MESSAGES.USER_NOT_FOUND })
  }
  //nếu có user đó thì mình sẽ kiểm tra xem user đó lưu email_verify_token không
  if (user.email_verify_token === '') {
    return res.json({ message: USERS_MESSAGES.EMAIL_ALREADY_VERIFIED })
  }
  //nếu xuống được đây nghĩa là user tồn tại và chưa verify email
  // verifyEmail(user_id): tìm user đó bằng user_id và update lại email_verify_token thành '' và verify: 1
  const result = await usersService.verifyEmail(user_id)
  return res.json({ result, message: USERS_MESSAGES.EMAIL_VERIFY_SUCCESS })
}

export const resendEmailVerifyController = async (req: Request, res: Response, next: NextFunction) => {
  //khi đến đây thì accesstokenValidator đã chạy rồi => access_token đã đc decode
  //và lưu vào req.user, nên trong đó sẽ có user._id để tao sử dụng
  const { user_id } = req.decoded_authorization as TokenPayload //lấy user_id từ decoded_authorization
  //từ user_id này ta sẽ tìm user trong database
  const user = await databaseService.users.findOne({
    _id: new ObjectId(user_id)
  })
  //nếu k có user thì trả về lỗi 404: not found
  if (!user) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({
      message: USERS_MESSAGES.USER_NOT_FOUND
    })
  }
  //nếu user đã verify email trước đó rồi thì trả về lỗi 400: bad request
  if (user.verify == UserVerifyStatus.Verified) {
    return res.json({
      message: USERS_MESSAGES.EMAIL_ALREADY_VERIFIED
    })
  }
  //nếu user chưa verify email thì ta sẽ gữi lại email verify cho họ
  //cập nhật email_verify_token mới và gữi lại email verify cho họ
  const result = await usersService.resendEmailVerify(user_id)
  //result chứa message nên ta chỉ cần trả  result về cho client
  return res.json(result)
}

export const forgotPasswordController = async (
  req: Request<ParamsDictionary, any, ForgotPasswordReqBody>,
  res: Response,
  next: NextFunction
) => {
  //middleware forgotPasswordValidator đã chạy rồi, nên ta có thể lấy _id từ user đã tìm đc bằng email
  const { _id } = req.user as User
  //cái _id này là objectid, nên ta phải chuyển nó về string
  //chứ không truyền trực tiếp vào hàm forgotPassword
  const result = await usersService.forgotPassword((_id as ObjectId).toString())
  return res.json(result)
}

export const verifyForgotPasswordTokenController = async (
  req: Request<ParamsDictionary, any, VerifyForgotPasswordReqBody>,
  res: Response,
  next: NextFunction
) => {
  //nếu đã đến bước này nghĩa là ta đã tìm có forgot_password_token hợp lệ
  //và đã lưu vào req.decoded_forgot_password_token
  //thông tin của user
  //ta chỉ cần thông báo rằng token hợp lệ
  return res.json({
    message: USERS_MESSAGES.VERIFY_FORGOT_PASSWORD_TOKEN_SUCCESS
  })
}
//trong messages.ts thêm   VERIFY_FORGOT_PASSWORD_TOKEN_SUCCESS: 'Verify forgot password token success'
