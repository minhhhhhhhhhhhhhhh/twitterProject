import { NextFunction, Request, Response } from 'express'
import usersService from '~/services/users.services'
import { ParamsDictionary } from 'express-serve-static-core'
import { RegisterReqBody } from '~/models/requests/User.request'
import User from '~/models/schemas/User.schema'
import { ObjectId } from 'mongodb'
import { USERS_MESSAGES } from '~/constants/messages'
export const loginController = async (req: Request, res: Response, next: NextFunction) => {
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

export const logoutController = async (req: Request, res: Response, next: NextFunction) => {
  //lấy refresh token từ req.body
  const { refresh_token } = req.body
  //xóa refresh token trong database
  const result = await usersService.logout(refresh_token)
  res.json(result)
}
