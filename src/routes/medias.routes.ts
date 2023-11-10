import { Router } from 'express'
import { uploadImageController } from '~/controllers/medias.controllers'
import { accessTokenValidator, verifiedUserValidator } from '~/middlewares/users.middewares'
import { wrapAsync } from '~/utils/handlers'
const mediasRouter = Router()

mediasRouter.post('/upload-image', accessTokenValidator, verifiedUserValidator, wrapAsync(uploadImageController))
//thêm middlewares  accessTokenValidator, verifiedUserValidator để đảm bảo rằng, phải đăng nhập mới đc đăng ảnh

export default mediasRouter

//uploadSingleImageController chưa làm
