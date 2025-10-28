import { useState } from 'react'
import {
  Upload,
  Button,
  Card,
  Row,
  Col,
  message,
  Progress,
  List,
  Tag,
  Space,
  Typography
} from 'antd'
import {
  CloudUploadOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { storage, callFunction, db } from '../utils/cloudbase'

const { Dragger } = Upload
const { Title, Text } = Typography

const UploadPage = () => {
  const [fileList, setFileList] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processedFiles, setProcessedFiles] = useState([])

  // 文件上传前的检查
  const beforeUpload = (file) => {
    const isValidType = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)

    if (!isValidType) {
      message.error('只支持 PNG、JPG、PDF、Word 格式的文件！')
      return false
    }

    const isLt10M = file.size / 1024 / 1024 < 10
    if (!isLt10M) {
      message.error('文件大小不能超过 10MB！')
      return false
    }

    return true
  }

  // 处理文件变化
  const handleChange = ({ fileList: newFileList }) => {
    setFileList(newFileList)
  }

  // 批量上传处理
  const handleBatchUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    const results = []

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i].originFileObj
        const fileName = `questions/${Date.now()}_${file.name}`

        try {
          // 1. 上传到云存储
          const uploadResult = await storage({
            cloudPath: fileName,
            filePath: file
          })

          // 2. 调用OCR识别(如果是图片)
          let questionData = null
          if (file.type.startsWith('image/')) {
            const ocrResult = await callFunction({
              name: 'ocrRecognize',
              data: {
                fileID: uploadResult.fileID
              }
            })

            if (ocrResult.result && ocrResult.result.success) {
              // 3. 解析OCR文本，提取题目信息（简化版）
              questionData = parseQuestionFromOCR(ocrResult.result.text)

              // 4. 保存到题库
              if (questionData) {
                await db.collection('question_bank').add({
                  data: {
                    ...questionData,
                    sourceFile: uploadResult.fileID,
                    sourceType: 'upload',
                    createTime: new Date(),
                    updateTime: new Date(),
                    usedCount: 0,
                    correctRate: 0
                  }
                })
              }
            }
          }

          results.push({
            fileName: file.name,
            status: 'success',
            fileID: uploadResult.fileID,
            questionData
          })

        } catch (error) {
          console.error(`处理文件 ${file.name} 失败:`, error)
          results.push({
            fileName: file.name,
            status: 'error',
            error: error.message
          })
        }

        setUploadProgress(((i + 1) / fileList.length) * 100)
      }

      setProcessedFiles(results)
      const successCount = results.filter(r => r.status === 'success').length
      message.success(`成功处理 ${successCount} 个文件！`)

      // 清空文件列表
      setFileList([])

    } catch (error) {
      console.error('批量上传失败:', error)
      message.error('批量上传失败')
    } finally {
      setUploading(false)
    }
  }

  // 从OCR文本解析题目信息（简化版）
  const parseQuestionFromOCR = (text) => {
    // 简单的解析逻辑，实际项目中应该使用AI进行智能解析
    return {
      subject: '未分类',
      knowledgePoint: '待标注',
      difficulty: '中等',
      content: text,
      options: [],
      correctAnswer: 0,
      explanation: '',
      tags: ['OCR识别']
    }
  }

  // 获取文件图标
  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) {
      return <FileImageOutlined style={{ fontSize: 24, color: '#1890ff' }} />
    } else if (file.type === 'application/pdf') {
      return <FilePdfOutlined style={{ fontSize: 24, color: '#f5222d' }} />
    } else if (file.type.includes('word')) {
      return <FileWordOutlined style={{ fontSize: 24, color: '#1890ff' }} />
    }
    return null
  }

  return (
    <div>
      <Title level={2}>批量上传题库</Title>

      <Row gutter={16}>
        <Col span={16}>
          <Card>
            <Dragger
              multiple
              fileList={fileList}
              beforeUpload={beforeUpload}
              onChange={handleChange}
              onRemove={(file) => {
                const index = fileList.indexOf(file)
                const newFileList = fileList.slice()
                newFileList.splice(index, 1)
                setFileList(newFileList)
              }}
              showUploadList={{
                showRemoveIcon: !uploading
              }}
              disabled={uploading}
            >
              <p className="ant-upload-drag-icon">
                <CloudUploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 PNG、JPG、PDF、Word 格式<br/>
                单个文件不超过 10MB，支持批量上传
              </p>
            </Dragger>

            {uploading && (
              <div style={{ marginTop: 24 }}>
                <Progress percent={Math.floor(uploadProgress)} status="active" />
                <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
                  正在处理文件...
                </Text>
              </div>
            )}

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<CloudUploadOutlined />}
                onClick={handleBatchUpload}
                loading={uploading}
                disabled={fileList.length === 0}
              >
                {uploading ? '上传中...' : `开始上传 (${fileList.length} 个文件)`}
              </Button>
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="上传说明" size="small">
            <Space direction="vertical" size="small">
              <Text>📄 <strong>支持格式:</strong></Text>
              <Text>• 图片: PNG, JPG</Text>
              <Text>• 文档: PDF, Word</Text>
              <br/>
              <Text>⚡ <strong>处理流程:</strong></Text>
              <Text>1. 上传文件到云存储</Text>
              <Text>2. OCR识别文字内容</Text>
              <Text>3. AI分析提取题目信息</Text>
              <Text>4. 自动保存到题库</Text>
              <br/>
              <Text type="warning">💡 建议先手动审核题目内容</Text>
            </Space>
          </Card>

          {processedFiles.length > 0 && (
            <Card title="处理结果" size="small" style={{ marginTop: 16 }}>
              <List
                size="small"
                dataSource={processedFiles}
                renderItem={item => (
                  <List.Item>
                    <Space>
                      {item.status === 'success' ? (
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: '#f5222d', fontSize: 18 }} />
                      )}
                      <Text>{item.fileName}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}

export default UploadPage
