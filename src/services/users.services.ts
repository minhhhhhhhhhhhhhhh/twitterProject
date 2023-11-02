import User from '~/models/schemas/User.schema'
import databaseService from './database.services'
import { RegisterReqBody, UpdateMeReqBody } from '~/models/requests/User.request'
import { hashPassword } from '~/utils/crypto'
import { signToken } from '~/utils/jwt'
import { TokenType, UserVerifyStatus } from '~/constants/enums'
import RefreshToken from '~/models/schemas/RefreshToken.schema'
import { ObjectId } from 'mongodb'
import { USERS_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Errors'
import HTTP_STATUS from '~/constants/httpStatus'

class UsersService {
  private signAccessToken({ user_id, verify }: { user_id: string; verify: UserVerifyStatus }) {
    return signToken({
      payload: { user_id, token_type: TokenType.AccessToken, verify },
      privateKey: process.env.JWT_SECRET_ACCESS_TOKEN as string,
      options: { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN }
    })
  }

  private signRefreshToken({ user_id, verify }: { user_id: string; verify: UserVerifyStatus }) {
    return signToken({
      payload: { user_id, token_type: TokenType.AccessToken, verify },
      privateKey: process.env.JWT_SECRET_REFRESH_TOKEN as string,
      options: { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN }
    })
  }

  private signEmailVerifyToken({ user_id, verify }: { user_id: string; verify: UserVerifyStatus }) {
    return signToken({
      payload: { user_id, token_type: TokenType.EmailVerificationToken, verify },
      privateKey: process.env.JWT_SECRET_EMAIL_VERIFY_TOKEN as string,
      options: { expiresIn: process.env.EMAIL_VERIFY_TOKEN_EXPIRES_IN }
    })
  }

  private signAccessTokenAndRefreshToken({ user_id, verify }: { user_id: string; verify: UserVerifyStatus }) {
    return Promise.all([this.signAccessToken({ user_id, verify }), this.signRefreshToken({ user_id, verify })])
  }

  //tạo hàm signForgotPasswordToken
  private signForgotPasswordToken({ user_id, verify }: { user_id: string; verify: UserVerifyStatus }) {
    return signToken({
      payload: { user_id, token_type: TokenType.ForgotPasswordToken, verify },
      options: { expiresIn: process.env.FORGOT_PASSWORD_TOKEN_EXPIRES_IN },
      privateKey: process.env.JWT_SECRET_FORGOT_PASSWORD_TOKEN as string //thêm
    })
  }

  async register(payload: RegisterReqBody) {
    const user_id = new ObjectId()
    const email_verify_token = await this.signEmailVerifyToken({
      user_id: user_id.toString(),
      verify: UserVerifyStatus.Unverified
    })
    const result = await databaseService.users.insertOne(
      new User({
        ...payload,
        _id: user_id,
        email_verify_token,
        username: `user${user_id.toString()}`, //tạo username cho user, ví dụ user_id = 123 thì username = `user123
        date_of_birth: new Date(payload.date_of_birth),
        password: hashPassword(payload.password)
      })
    )
    const [access_token, refresh_token] = await this.signAccessTokenAndRefreshToken({
      user_id: user_id.toString(),
      verify: UserVerifyStatus.Unverified
    })
    await databaseService.refreshTokens.insertOne(
      new RefreshToken({ user_id: new ObjectId(user_id), token: refresh_token })
    )

    console.log('email_verify_token', email_verify_token) //mô phỏng send email, test xong xóa
    return { access_token, refresh_token }
    //ta sẽ return 2 cái này về cho client
    //thay vì return user_id về cho client
  }

  async checkEmailExist(email: string) {
    //vào database tìm xem có email này chưa
    const user = await databaseService.users.findOne({ email })
    return Boolean(user)
  }

  async login({ user_id, verify }: { user_id: string; verify: UserVerifyStatus }) {
    //dùng user_id để tạo access token và refresh token
    const [access_token, refresh_token] = await this.signAccessTokenAndRefreshToken({
      user_id,
      verify
    })
    // lưu refresh token vào database
    await databaseService.refreshTokens.insertOne(
      new RefreshToken({
        token: refresh_token,
        user_id: new ObjectId(user_id)
      })
    )
    //return 2 token cho controller
    return { access_token, refresh_token }
  }

  async logout(refresh_token: string) {
    //xóa refresh token trong database
    await databaseService.refreshTokens.deleteOne({ token: refresh_token })
    return { message: USERS_MESSAGES.LOGOUT_SUCCESS }
  }

  async verifyEmail(user_id: string) {
    //tạo access token và refresh token gửi cho client và lưu refresh token vào database
    //đồng thời update lại email_verify_token thành '' và verify: 1, update_at: Date.now()
    const [token] = await Promise.all([
      this.signAccessTokenAndRefreshToken({ user_id, verify: UserVerifyStatus.Verified }),
      databaseService.users.updateOne(
        { _id: new ObjectId(user_id) }, // tìm user đó bằng user_id
        [
          {
            $set: {
              email_verify_token: '',
              verify: UserVerifyStatus.Verified, //1
              updated_at: '$$NOW'
            }
          }
        ]
      )
    ])
    const [access_token, refresh_token] = token
    //lưu refresh token vào database
    await databaseService.refreshTokens.insertOne(
      new RefreshToken({ token: refresh_token, user_id: new ObjectId(user_id) })
    )
    return { access_token, refresh_token }
  }

  async resendEmailVerify(user_id: string) {
    //tạo email_verify_token mới và gữi lại email verify cho họ
    const email_verify_token = await this.signEmailVerifyToken({ user_id, verify: UserVerifyStatus.Unverified })
    //update lại email_verify_token mới
    await databaseService.users.updateOne(
      { _id: new ObjectId(user_id) }, // tìm user đó bằng user_id
      [
        {
          $set: {
            email_verify_token,
            updated_at: '$$NOW'
          }
        }
      ]
    )
    console.log('email_verify_token', email_verify_token) //mô phỏng send email, test xong xóa
    return { message: USERS_MESSAGES.RESEND_EMAIL_VERIFY_SUCCESS }
  }

  async forgotPassword({ user_id, verify }: { user_id: string; verify: UserVerifyStatus }) {
    //tạo ra forgot_password_token
    const forgot_password_token = await this.signForgotPasswordToken({ user_id, verify })
    //cập nhật vào forgot_password_token và updated_at vào database
    await databaseService.users.updateOne({ _id: new ObjectId(user_id) }, [
      {
        $set: { forgot_password_token: forgot_password_token, updated_at: '$$NOW' }
      }
    ])
    //gữi email cho người dùng đường link có cấu trúc như này
    //http://appblabla/forgot-password?token=xxxx
    //xxxx trong đó xxxx là forgot_password_token
    //sau này ta sẽ dùng aws để làm chức năng gữi email, giờ ta k có
    //ta log ra để test
    console.log('forgot_password_token: ', forgot_password_token)
    return {
      message: USERS_MESSAGES.CHECK_EMAIL_TO_RESET_PASSWORD
    }
  }
  //vào messages.ts thêm CHECK_EMAIL_TO_RESET_PASSWORD: 'Check email to reset password'

  async resetPassword({ user_id, password }: { user_id: string; password: string }) {
    //tìm user thông qua user_id và cập nhật lại password và forgot_password_token
    //tất nhiên là lưu password đã hash rồi
    //ta không cần phải kiểm tra user có tồn tại không, vì forgotPasswordValidator đã làm rồi
    await databaseService.users.updateOne({ _id: new ObjectId(user_id) }, [
      {
        $set: {
          password: hashPassword(password),
          forgot_password_token: '',
          updated_at: '$$NOW'
        }
      }
    ])
    //nếu bạn muốn ngta đổi mk xong tự động đăng nhập luôn thì trả về access_token và refresh_token
    //ở đây mình chỉ cho ngta đổi mk thôi, nên trả về message
    return {
      message: USERS_MESSAGES.RESET_PASSWORD_SUCCESS
    }
  }
  //vào messages.ts thêm RESET_PASSWORD_SUCCESS: 'Reset password success'
  async getMe(user_id: string) {
    const user = await databaseService.users.findOne(
      { _id: new ObjectId(user_id) },
      {
        projection: {
          password: 0,
          email_verify_token: 0,
          forgot_password_token: 0
        }
      }
    )
    return user // sẽ k có những thuộc tính nêu trên, tránh bị lộ thông tin
  }

  async updateMe(user_id: string, payload: UpdateMeReqBody) {
    //payload là những gì người dùng đã gữi lên ở body request
    //có vấn đề là người dùng gữi date_of_birth lên dưới dạng string iso8601
    //nhưng ta cần gữi lên mongodb dưới dạng date
    //nên
    const _payload = payload.date_of_birth ? { ...payload, date_of_birth: new Date(payload.date_of_birth) } : payload
    //mongo cho ta 2 lựa chọn update là updateOne và findOneAndUpdate
    //findOneAndUpdate thì ngoài update nó còn return về document đã update
    const user = await databaseService.users.findOneAndUpdate(
      { _id: new ObjectId(user_id) },
      [
        {
          $set: {
            ..._payload,
            updated_at: '$$NOW'
          }
        }
      ],
      {
        returnDocument: 'after', //trả về document sau khi update, nếu k thì nó trả về document cũ
        projection: {
          //chặn các property k cần thiết
          password: 0,
          email_verify_token: 0,
          forgot_password_token: 0
        }
      }
    )
    return user.value //đây là document sau khi update
  }

  async getProfile(username: string) {
    const user = await databaseService.users.findOne(
      { username: username },
      {
        projection: {
          password: 0,
          email_verify_token: 0,
          forgot_password_token: 0,
          verify: 0,
          create_at: 0,
          update_at: 0
        }
      }
    )
    if (user == null) {
      throw new ErrorWithStatus({
        message: USERS_MESSAGES.USER_NOT_FOUND,
        status: HTTP_STATUS.NOT_FOUND
      })
    }
    return user
  }
}
//trong dó projection giúp ta loại bỏ lấy về các thuộc tính như password, email_verify_token, forgot_password_token

const usersService = new UsersService()
export default usersService
