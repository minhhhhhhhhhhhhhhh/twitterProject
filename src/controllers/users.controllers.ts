import { NextFunction, Request, Response } from 'express'
import usersService from '~/services/users.services'
import { ParamsDictionary } from 'express-serve-static-core'
import { RegisterReqBody } from '~/models/requests/User.request'
export const loginController = async (req: Request, res: Response, next: NextFunction) => {
  //vào req lấy user ra và lấy _id của user đó
  const { user }: any = req
  const user_id = user._id
  //dùng _id để tạo token
  const result = await usersService.login(user_id)
  //nếu không bug gì thì sẽ trả về result
  return res.json({ message: 'Login success', result: result })
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
    message: 'Register success',
    result: result
  })
}
