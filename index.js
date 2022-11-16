const dgram = require('dgram')
const server = dgram.createSocket('udp4') // ipv4
const { parseHost, forward, resolve } = require('./utils')

/**
 * @params { Buffer } msg Uint8Array
 */
server.on('message', (msg, rinfo) => {
  const host = parseHost(msg.subarray(12))
  console.log(`query: ${host}`)
  if (/custom1Domain/.test(host)) {
    resolve(msg, rinfo) // 仿造 dns 响应数据
  } else {
    forward(msg ,rinfo) // 交给公共 dns 服务处理
  }
})

server.on('error', (err) => {
  console.log(`server error: ${err.stack}`)
})

server.on('listening', () => {
  const address = server.address()
  console.log(`server listening ${address.address}:${address.port}`)
})

// 监听 dns 服务端口
server.bind(53)

module.exports = server