const dgram = require('dgram')

const MY_SEVER = '1.2.3.4'
/**
 * 通过 dns 协议内容解析出访问的域名
 * @param { Buffer } msg
 * @returns
 */
exports.parseHost = (msg) => {
  let num = msg.readUInt8(0)
  let offset = 1
  let host = ''
  while (num !== 0) {
    host += msg.subarray(offset, offset + num).toString()
    offset += num

    num = msg.readUInt8(offset)
    offset += 1

    if (num !== 0) {
      host += '.'
    }
  }
  return host
}

/**
 * 转发到公共 dns 服务
 * @param { Buffer } msg
 * @param {*} rinfo
 */
exports.forward = (msg, rinfo) => {
  const client = dgram.createSocket('udp4')

  client.on('error', (err) => {
    console.log(`client error: ${err.stack}`)
  })

  client.on('message', (fbMsg, fbRinfo) => {
    const server = require('./index')
    server.send(fbMsg, rinfo.port, rinfo.address, (err) => {
      err && console.log(err)
    })
    client.close()
  })

  client.send(msg, 53, '8.8.8.8', (err) => {
    console.log('发送成功', err)
    if (err) {
      console.log(`client send error:${err.stack}`)
      client.close()
    }
  })
}

function copyBuffer(src, offset, dst) {
  for (let i = 0; i < src.length; ++i) {
    dst.writeUInt8(src.readUInt8(i), offset + i)
  }
}

exports.resolve = (msg, rinfo) => {
  const queryInfo = msg.subarray(12)
  const response = Buffer.alloc(28 + queryInfo.length)
  let offset = 0

  // Transaction ID
  const id = msg.subarray(0, 2)
  copyBuffer(id, 0, response)
  offset += id.length

  // flags
  response.writeUInt16BE(0x8180, offset) // 0x8180 报文中的标志字段
  offset += 2 // 每个大小都是 2 字节

  // Questions
  response.writeUint16BE(1, offset)
  offset += 2

  // Answer
  response.writeUInt16BE(1, offset)
  offset += 2

  // Authority RRs & Additional RRs
  response.writeUInt32BE(0, offset)
  offset += 4
  copyBuffer(queryInfo, offset, response)
  offset += queryInfo.length

  // offset to domain name
  response.writeUInt16BE(0xC00C, offset) //  DNS协议消息压缩技术（c0 开头），使用偏移指针代重复的字符（和代码映射文件的 map 思路类似）
  offset += 2
  const typeAndClass = msg.subarray(msg.length - 4)
  copyBuffer(typeAndClass, offset, response)
  offset += typeAndClass.length

  // TTL
  response.writeInt32BE(600, offset)
  offset += 4

  // Ip length
  response.writeUInt16BE(4, offset)
  offset += 2
  MY_SEVER.split('.').forEach((value) => {
    response.writeUInt8(parseInt(value), offset)
    offset += 1
  })

  // resolve
  const server = require('./index')
  server.send(response, rinfo.port, rinfo.address, (err) => {
    if (err) {
      console.log(err)
      server.close()
    }
  })
}
