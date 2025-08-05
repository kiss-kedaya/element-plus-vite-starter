<template>
  <div class="voice-test-page">
    <h2>语音消息测试</h2>
    
    <div class="test-section">
      <h3>测试语音消息组件</h3>
      <div class="message-container">
        <VoiceMessage
          :msg-id="13128270"
          wxid="wxid_vjoza5t7f2n122"
          from-user-name="wxid_ywloabezitqc22"
          aes-key="4f2078acda1867e8cb2ee0dc6e6c7146"
          buf-id="0"
          :length="3037"
          :duration="2309"
          duration-seconds="2.3"
          voice-format="4"
          voice-url="3052020100044b304902010002045b04706b02032f56c20204adaaa27402046891a7730424"
          :can-download="true"
          download-api="/api/Tools/DownloadVoice"
        />
      </div>
    </div>

    <div class="test-section">
      <h3>模拟语音消息数据</h3>
      <pre>{{ voiceMessageData }}</pre>
    </div>

    <div class="test-section">
      <h3>测试下载API</h3>
      <el-button @click="testDownloadAPI" type="primary">测试语音下载</el-button>
      <div v-if="downloadResult" class="download-result">
        <h4>下载结果:</h4>
        <pre>{{ downloadResult }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import VoiceMessage from '@/components/common/VoiceMessage.vue'
import { downloadVoice } from '@/api/chat'

const downloadResult = ref<any>(null)

const voiceMessageData = {
  msgType: 34,
  content: '<msg><voicemsg endflag="1" cancelflag="0" forwardflag="0" voiceformat="4" voicelength="2309" length="3037" bufid="0" aeskey="4f2078acda1867e8cb2ee0dc6e6c7146" voiceurl="3052020100044b304902010002045b04706b02032f56c20204adaaa27402046891a7730424" voicemd5="" clientmsgid="4162373236333166376132653333340048144008052" fromusername="wxid_ywloabezitqc22" /></msg>',
  extraData: {
    aeskey: "4f2078acda1867e8cb2ee0dc6e6c7146",
    bufid: "0",
    canDownload: true,
    duration: "2309",
    durationSeconds: "2.3",
    length: "3037",
    voiceFormat: "4",
    voiceurl: "3052020100044b304902010002045b04706b02032f56c20204adaaa27402046891a7730424",
    downloadAPI: "/api/Tools/DownloadVoice",
    downloadParams: {
      Bufid: "0",
      FromUserName: "wxid_ywloabezitqc22",
      Length: "3037",
      MsgId: "13128270",
      Wxid: "wxid_vjoza5t7f2n122"
    }
  }
}

const testDownloadAPI = async () => {
  try {
    console.log('开始测试语音下载API...')
    const params = {
      Wxid: "wxid_vjoza5t7f2n122",
      FromUserName: "wxid_ywloabezitqc22",
      MsgId: 13128270,
      Length: 3037,
      Bufid: "0"
    }
    
    console.log('下载参数:', params)
    const result = await downloadVoice(params)
    downloadResult.value = result
    console.log('下载结果:', result)
  } catch (error) {
    console.error('下载测试失败:', error)
    downloadResult.value = { error: error.message }
  }
}
</script>

<style lang="scss" scoped>
.voice-test-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.test-section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #f9f9f9;
}

.message-container {
  padding: 10px;
  background: white;
  border-radius: 8px;
  display: inline-block;
}

.download-result {
  margin-top: 15px;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 4px;
}

pre {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
}

h2 {
  color: #333;
  margin-bottom: 20px;
}

h3 {
  color: #666;
  margin-bottom: 15px;
}

h4 {
  color: #888;
  margin-bottom: 10px;
}
</style>
