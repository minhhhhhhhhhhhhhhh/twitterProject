import { Router } from 'express'
import { serveImageController, serveVideoStreamController } from '~/controllers/medias.controllers'

const staticRouter = Router()
staticRouter.get('/image/:namefile', serveImageController)
//vậy route sẽ là localhost:4000/static/image/:namefile

staticRouter.get('/video-stream/:namefile', serveVideoStreamController)

export default staticRouter
