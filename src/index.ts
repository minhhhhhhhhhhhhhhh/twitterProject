import express from 'express'
import usersRouter from './routes/users.routes'
import databaseService from './services/database.services'
import { defaultErrorHandler } from './middlewares/error.middlewares'
import mediasRouter from './routes/medias.routes'
import { initFolder } from './utils/file'
import { config } from 'dotenv'
import { UPLOAD_DIR } from './constants/dir'
import staticRouter from './routes/static.routes'
config()
const PORT = process.env.PORT || 4000
initFolder()
const app = express()
app.use(express.json())
databaseService.connect()
app.get('/', (req, res) => {
  res.send('hello world')
})

app.use('/users', usersRouter)
app.use('/medias', mediasRouter)
app.use('/static', staticRouter)

//app sử dụng 1 cái error handler tổng
app.use(defaultErrorHandler)

app.listen(PORT, () => {
  console.log(`Project twitter này đang chạy trên post ${PORT}`)
})
