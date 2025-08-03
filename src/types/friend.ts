export interface Friend {
  wxid: string
  nickname: string
  avatar: string
  remark?: string
  signature?: string
  sex: number // 1=男性, 2=女性, 0=未知
  isOnline?: boolean
}

export interface FriendRequest {
  id: string
  wxid: string
  nickname: string
  avatar: string
  verifyContent: string
  status: 'pending' | 'accepted' | 'rejected'
  timestamp: Date
}

export interface SearchContactRequest {
  Wxid: string
  ToUserName: string
  FromScene: number
  SearchScene: number
}

export interface SendFriendRequestRequest {
  Wxid: string
  V1: string
  V2: string
  Opcode: number
  Scene: number
  VerifyContent: string
}

export interface GetFriendListRequest {
  Wxid: string
  CurrentWxcontactSeq: number
  CurrentChatRoomContactSeq: number
  force_refresh?: boolean
}

export interface UploadContactRequest {
  Wxid: string
  PhoneNo: string
  CurrentPhoneNo: string
  Opcode: number
}

export interface FriendResponse {
  Code: number
  Success: boolean
  Message: string
  Data?: any
}

export interface SearchContactResponse extends FriendResponse {
  Data?: {
    UserName?: {
      string: string
    }
    NickName?: {
      string: string
    }
    Pyinitial?: {
      string: string
    }
    QuanPin?: {
      string: string
    }
    Sex?: number
    Signature?: string
    BigHeadImgUrl?: string
    SmallHeadImgUrl?: string
    AntispamTicket?: string
    V1?: string
    V2?: string
    Country?: string
    City?: string
    VerifyFlag?: number
  }
}
