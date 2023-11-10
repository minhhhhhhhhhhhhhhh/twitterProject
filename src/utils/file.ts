import formidable, { File } from 'formidable'
import fs from 'fs' //thư viện giúp handle các đường dẫn
import path from 'path'
import { Request } from 'express'
import { UPLOAD_TEMP_DIR } from '~/constants/dir'

export const initFolder = () => {
  //nếu không có đường dẫn 'TwitterProject/uploads' thì tạo ra
  const uploadsFolderPath = path.resolve('uploads')
  if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
    fs.mkdirSync(UPLOAD_TEMP_DIR, {
      recursive: true //cho phép tạo folder nested vào nhau
      //uploads/image/bla bla bla
    }) //mkdirSync: giúp tạo thư mục
  }
}

//viết thêm hàm khi nhận filename : abv.png thì chỉ lấy abv để sau này ta gán thêm đuôi .jpeg
export const getNameFromFullname = (filename: string) => {
  const nameArr = filename.split('.')
  nameArr.pop() //xóa phần tử cuối cùng, tức là xóa đuôi .png
  return nameArr.join('') //nối lại thành chuỗi
}

//hàm xử lí file mà client đã gửi lên
export const handleUploadImage = async (req: Request) => {
  const form = formidable({
    uploadDir: path.resolve(UPLOAD_TEMP_DIR), //lưu ở đâu
    maxFiles: 4, //tối đa bao nhiêu
    keepExtensions: true, //có lấy đuôi mở rộng không .png, .jpg
    maxFileSize: 300 * 1024 * 4, //tối đa bao nhiêu byte, 300kb
    //xài option filter để kiểm tra file có phải là image không
    filter: function ({ name, originalFilename, mimetype }) {
      //name: name|key truyền vào của <input name = bla bla>
      //originalFilename: tên file gốc
      //mimetype: kiểu file vd: image/png
      //   console.log(name, originalFilename, mimetype) //log để xem, nhớ comment

      const valid = name === 'image' && Boolean(mimetype?.includes('image/'))
      //mimetype? nếu là string thì check, k thì thôi
      //ép Boolean luôn, nếu k thì valid sẽ là boolean | undefined

      //nếu sai valid thì dùng form.emit để gữi lỗi
      if (!valid) {
        form.emit('error' as any, new Error('File type is not valid') as any)
        //as any vì bug này formidable chưa fix, khi nào hết thì bỏ as any
      }
      //nếu đúng thì return valid
      return valid
    }
  })
  //form.parse về thành promise
  //files là object có dạng giống hình test code cuối cùng
  return new Promise<File[]>((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err) //để ý dòng này
      if (!files.image) {
        return reject(new Error('Image is empty'))
      }
      return resolve(files.image as File[])
    })
  })
}
