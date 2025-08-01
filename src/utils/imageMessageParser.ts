/**
 * 媒体消息解析工具
 * 用于从微信消息的XML内容中提取图片和视频下载所需的参数
 */

export interface ImageMessageParams {
  aesKey?: string
  md5?: string
  dataLen?: number
  compressType?: number
  cdnThumbUrl?: string
  cdnMidUrl?: string
  cdnHdUrl?: string
  // CDN下载相关参数
  cdnFileAesKey?: string
  cdnFileNo?: string
}

export interface VideoMessageParams {
  aesKey?: string
  md5?: string
  dataLen?: number
  compressType?: number
  playLength?: number
  cdnVideoUrl?: string
  cdnThumbUrl?: string
  cdnThumbAesKey?: string
  cdnThumbLength?: number
  cdnThumbWidth?: number
  cdnThumbHeight?: number
  fromUserName?: string
  newMd5?: string
}

/**
 * 解析图片消息的XML内容，提取下载参数
 * @param originalContent 微信消息的originalContent字段（XML格式）
 * @returns 解析出的图片参数
 */
export function parseImageMessage(originalContent: string): ImageMessageParams {
  const params: ImageMessageParams = {}

  if (!originalContent) {
    return params
  }

  try {
    // 提取AES密钥
    const aesKeyMatch = originalContent.match(/aeskey\s*=\s*"([^"]+)"/)
    if (aesKeyMatch) {
      params.aesKey = aesKeyMatch[1]
    }

    // 提取MD5
    const md5Match = originalContent.match(/md5\s*=\s*"([^"]+)"/)
    if (md5Match) {
      params.md5 = md5Match[1]
    }

    // 提取数据长度 - 需要精确匹配img标签中的length属性，避免匹配到cdnthumblength
    let dataLen = 0
    // 使用更精确的正则表达式，确保匹配的是img标签中的length属性，而不是cdnthumblength
    const lengthMatch = originalContent.match(/<img[^>]*\blength\s*=\s*"([^"]+)"/)
    if (lengthMatch) {
      dataLen = parseInt(lengthMatch[1], 10)
    } else {
      // 尝试其他可能的字段名
      const dataSizeMatch = originalContent.match(/datasize\s*=\s*"([^"]+)"/)
      if (dataSizeMatch) {
        dataLen = parseInt(dataSizeMatch[1], 10)
      } else {
        const sizeMatch = originalContent.match(/size\s*=\s*"([^"]+)"/)
        if (sizeMatch) {
          dataLen = parseInt(sizeMatch[1], 10)
        }
      }
    }

    if (dataLen > 0) {
      params.dataLen = dataLen
    }

    // 提取压缩类型（如果有）
    const compressMatch = originalContent.match(/compresstype\s*=\s*"([^"]+)"/)
    if (compressMatch) {
      params.compressType = parseInt(compressMatch[1], 10)
    }

    // 提取CDN下载参数（优先使用CDN下载）
    // FileAesKey: 使用aeskey字段
    if (params.aesKey) {
      params.cdnFileAesKey = params.aesKey
    }

    // FileNo: 使用cdnthumburl字段
    const cdnThumbUrlMatch = originalContent.match(/cdnthumburl\s*=\s*"([^"]+)"/)
    if (cdnThumbUrlMatch) {
      params.cdnThumbUrl = cdnThumbUrlMatch[1]
      params.cdnFileNo = cdnThumbUrlMatch[1] // CDN下载使用的FileNo
    }

    const cdnMidUrlMatch = originalContent.match(/cdnmidimgurl\s*=\s*"([^"]+)"/)
    if (cdnMidUrlMatch) {
      params.cdnMidUrl = cdnMidUrlMatch[1]
    }

    console.log('图片消息解析结果:', {
      aesKey: params.aesKey,
      md5: params.md5,
      dataLen: params.dataLen,
      compressType: params.compressType,
      cdnThumbUrl: params.cdnThumbUrl,
      cdnMidUrl: params.cdnMidUrl,
      cdnFileAesKey: params.cdnFileAesKey,
      cdnFileNo: params.cdnFileNo
    })

  } catch (error) {
    console.error('解析图片消息XML失败:', error)
  }

  return params
}

/**
 * 验证图片下载参数是否完整
 * @param params 图片参数
 * @returns 是否包含必需的参数
 */
export function validateImageParams(params: ImageMessageParams): boolean {
  // 检查是否有必需的参数
  return !!(params.dataLen && params.dataLen > 0)
}

/**
 * 从示例数据中解析图片参数（用于测试）
 */
export function parseExampleImageMessage(): ImageMessageParams {
  const exampleXml = `<?xml version="1.0"?>
<msg>
	<img aeskey="291fcc3ac76ebb891359e6f0e9efb7e7" encryver="1" cdnthumbaeskey="291fcc3ac76ebb891359e6f0e9efb7e7" cdnthumburl="3057020100044b30490201000204bf693cc002032dcfbe0204924cf8240204688bb9cc042430623666386365312d633934652d346139392d396434322d623265323432303665323134020405150a020201000405004c511e00" cdnthumblength="2712" cdnthumbheight="432" cdnthumbwidth="244" cdnmidheight="0" cdnmidwidth="0" cdnhdheight="0" cdnhdwidth="0" cdnmidimgurl="3057020100044b30490201000204bf693cc002032dcfbe0204924cf8240204688bb9cc042430623666386365312d633934652d346139392d396434322d623265323432303665323134020405150a020201000405004c511e00" length="326223" md5="79fdaea88e2e1940702c5b58e15b6365" hevc_mid_size="29392" originsourcemd5="381affaa6d80388e3ae45eea29c7dd4b">
		<secHashInfoBase64>eyJwaGFzaCI6IjEwMTAxMDEwMDAxMDEwMDAiLCJwZHFIYXNoIjoiNzk5MzMwYjRkNzQ5OGU3YzZk
ODMyMGY2YzY2OTlhN2M2ZDgzMzBkNzg2NDhkODdkMmQ4MjUwZGM4NzY5ZDhmZSJ9
</secHashInfoBase64>
		<live>
			<duration>0</duration>
			<size>0</size>
			<md5 />
			<fileid />
			<hdsize>0</hdsize>
			<hdmd5 />
			<hdfileid />
			<stillimagetimems>0</stillimagetimems>
		</live>
	</img>
	<platform_signature />
	<imgdatahash />
	<ImgSourceInfo>
		<ImgSourceUrl />
		<BizType>0</BizType>
	</ImgSourceInfo>
</msg>`

  return parseImageMessage(exampleXml)
}

/**
 * 解析视频消息的XML内容，提取下载参数
 * @param originalContent 微信消息的originalContent字段（XML格式）
 * @returns 解析出的视频参数
 */
export function parseVideoMessage(originalContent: string): VideoMessageParams {
  const params: VideoMessageParams = {}

  if (!originalContent) {
    return params
  }

  try {
    // 提取AES密钥
    const aesKeyMatch = originalContent.match(/aeskey\s*=\s*"([^"]+)"/)
    if (aesKeyMatch) {
      params.aesKey = aesKeyMatch[1]
    }

    // 提取MD5
    const md5Match = originalContent.match(/md5\s*=\s*"([^"]+)"/)
    if (md5Match) {
      params.md5 = md5Match[1]
    }

    // 提取新MD5
    const newMd5Match = originalContent.match(/newmd5\s*=\s*"([^"]+)"/)
    if (newMd5Match) {
      params.newMd5 = newMd5Match[1]
    }

    // 提取视频数据长度
    const lengthMatch = originalContent.match(/length\s*=\s*"([^"]+)"/)
    if (lengthMatch) {
      params.dataLen = parseInt(lengthMatch[1], 10)
    }

    // 提取播放时长
    const playLengthMatch = originalContent.match(/playlength\s*=\s*"([^"]+)"/)
    if (playLengthMatch) {
      params.playLength = parseInt(playLengthMatch[1], 10)
    }

    // 提取CDN视频URL
    const cdnVideoUrlMatch = originalContent.match(/cdnvideourl\s*=\s*"([^"]+)"/)
    if (cdnVideoUrlMatch) {
      params.cdnVideoUrl = cdnVideoUrlMatch[1]
    }

    // 提取CDN缩略图URL
    const cdnThumbUrlMatch = originalContent.match(/cdnthumburl\s*=\s*"([^"]+)"/)
    if (cdnThumbUrlMatch) {
      params.cdnThumbUrl = cdnThumbUrlMatch[1]
    }

    // 提取缩略图AES密钥
    const cdnThumbAesKeyMatch = originalContent.match(/cdnthumbaeskey\s*=\s*"([^"]+)"/)
    if (cdnThumbAesKeyMatch) {
      params.cdnThumbAesKey = cdnThumbAesKeyMatch[1]
    }

    // 提取缩略图长度
    const cdnThumbLengthMatch = originalContent.match(/cdnthumblength\s*=\s*"([^"]+)"/)
    if (cdnThumbLengthMatch) {
      params.cdnThumbLength = parseInt(cdnThumbLengthMatch[1], 10)
    }

    // 提取缩略图尺寸
    const cdnThumbWidthMatch = originalContent.match(/cdnthumbwidth\s*=\s*"([^"]+)"/)
    if (cdnThumbWidthMatch) {
      params.cdnThumbWidth = parseInt(cdnThumbWidthMatch[1], 10)
    }

    const cdnThumbHeightMatch = originalContent.match(/cdnthumbheight\s*=\s*"([^"]+)"/)
    if (cdnThumbHeightMatch) {
      params.cdnThumbHeight = parseInt(cdnThumbHeightMatch[1], 10)
    }

    // 提取发送者用户名
    const fromUserNameMatch = originalContent.match(/fromusername\s*=\s*"([^"]+)"/)
    if (fromUserNameMatch) {
      params.fromUserName = fromUserNameMatch[1]
    }

    console.log('视频消息解析结果:', {
      aesKey: params.aesKey,
      md5: params.md5,
      newMd5: params.newMd5,
      dataLen: params.dataLen,
      playLength: params.playLength,
      cdnVideoUrl: params.cdnVideoUrl,
      cdnThumbUrl: params.cdnThumbUrl,
      cdnThumbAesKey: params.cdnThumbAesKey,
      cdnThumbLength: params.cdnThumbLength,
      cdnThumbWidth: params.cdnThumbWidth,
      cdnThumbHeight: params.cdnThumbHeight,
      fromUserName: params.fromUserName
    })

  } catch (error) {
    console.error('解析视频消息XML失败:', error)
  }

  return params
}

/**
 * 验证视频下载参数是否完整
 * @param params 视频参数
 * @returns 是否包含必需的参数
 */
export function validateVideoParams(params: VideoMessageParams): boolean {
  return !!(params.dataLen && params.dataLen > 0)
}
