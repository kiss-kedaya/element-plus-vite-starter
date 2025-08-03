import { api } from "./index";
import type {
  SearchContactRequest,
  SendFriendRequestRequest,
  GetFriendListRequest,
  UploadContactRequest,
  FriendResponse,
  SearchContactResponse,
} from "@/types/friend";

export const friendApi = {
  // 搜索联系人
  searchContact: (
    params: SearchContactRequest
  ): Promise<SearchContactResponse> => {
    return api.post("/Friend/Search", params);
  },

  // 发送好友请求
  sendFriendRequest: (
    params: SendFriendRequestRequest
  ): Promise<FriendResponse> => {
    return api.post("/Friend/SendRequest", params);
  },

  // 获取全部通讯录好友（支持文件缓存）
  getFriendList: (params: GetFriendListRequest): Promise<FriendResponse> => {
    return api.post("/Friend/GetTotalContractList", params);
  },

  // 通过好友请求
  acceptFriendRequest: (params: {
    Wxid: string;
    V1: string;
    V2: string;
    Scene: number;
  }): Promise<FriendResponse> => {
    return api.post("/Friend/PassVerify", params);
  },

  // 获取自动同意好友状态
  getAutoAcceptFriendStatus: (params: {
    Wxid: string;
  }): Promise<{
    Code: number;
    Success: boolean;
    Message: string;
    Data: {
      wxid: string;
      enable: boolean;
      status: {
        code: number;
        description: string;
      };
      source: string;
      updated_at?: string;
      updated_by?: string;
    };
  }> => {
    return api.get(`/Friend/AutoAcceptFriendGetStatus?wxid=${params.Wxid}`);
  },

  // 设置自动同意好友状态
  setAutoAcceptFriendStatus: (params: {
    Wxid: string;
    Enable: boolean;
  }): Promise<{
    Code: number;
    Success: boolean;
    Message: string;
  }> => {
    return api.get(`/Friend/AutoAcceptFriendSetStatus?wxid=${params.Wxid}&enable=${params.Enable}`);
  },

  // 删除好友
  deleteFriend: (params: {
    Wxid: string;
    ToWxid: string;
  }): Promise<FriendResponse> => {
    return api.post("/Friend/Delete", params);
  },

  // 上传通讯录
  uploadContacts: (params: UploadContactRequest): Promise<FriendResponse> => {
    return api.post("/Friend/Upload", params);
  },

  // 获取手机通讯录
  getMobileContacts: (wxid: string): Promise<FriendResponse> => {
    return api.post(`/Friend/GetMFriend?wxid=${wxid}`);
  },

  // 设置好友备注
  setFriendRemark: (params: {
    Wxid: string;
    ToWxid: string;
    Remark: string;
  }): Promise<FriendResponse> => {
    return api.post("/Friend/SetRemarks", params);
  },

  // 拉黑好友
  blockFriend: (params: {
    Wxid: string;
    ToWxid: string;
    Val: number;
  }): Promise<FriendResponse> => {
    return api.post("/Friend/Blacklist", params);
  },

  // 获取好友详细信息
  getFriendDetail: (params: {
    Wxid: string;
    Towxids: string;
    ChatRoom?: string;
    force_refresh?: boolean;
  }): Promise<FriendResponse> => {
    return api.post("/Friend/GetContractDetail", params);
  },

  // 获取通讯录列表（支持强制刷新）
  getContactList: (params: {
    Wxid: string;
    CurrentWxcontactSeq?: number;
    CurrentChatRoomContactSeq?: number;
    force_refresh?: boolean;
  }): Promise<FriendResponse> => {
    return api.post("/Friend/GetContractList", params);
  },

  // 获取全部通讯录好友（支持强制刷新和分页）
  getTotalContactList: (params: {
    Wxid: string;
    CurrentWxcontactSeq?: number;
    CurrentChatRoomContactSeq?: number;
    Offset?: number;
    Limit?: number;
    force_refresh?: boolean;
  }): Promise<FriendResponse> => {
    return api.post("/Friend/GetTotalContractList", params);
  },

  // 获取简化格式的通讯录好友列表（支持强制刷新）
  getSimplifiedContactList: (params: {
    Wxid: string;
    CurrentWxcontactSeq?: number;
    CurrentChatRoomContactSeq?: number;
    force_refresh?: boolean;
  }): Promise<FriendResponse> => {
    return api.post("/Friend/GetSimplifiedContractList", params);
  },

  // 查询好友状态
  getFriendState: (params: {
    Wxid: string;
    ToWxid: string;
    OpCode: number;
  }): Promise<FriendResponse> => {
    return api.post("/Friend/GetFriendstate", params);
  },

  // 附近人
  findNearbyPeople: (params: {
    Wxid: string;
    OpCode: number;
  }): Promise<FriendResponse> => {
    return api.post("/Friend/LbsFind", params);
  },
};
