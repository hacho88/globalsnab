import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/globalsnab',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'change_me_access',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'change_me_refresh',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekApiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com',
  deepseekChatModel: process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat',
  yandexVisionEndpoint: process.env.YANDEX_VISION_ENDPOINT || 'https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze',
  yandexVisionApiKey: process.env.YANDEX_VISION_API_KEY || '',
  yandexVisionFolderId: process.env.YANDEX_VISION_FOLDER_ID || '',
  lunarOcrEndpoint: process.env.LUNAR_OCR_ENDPOINT || '',
  ocrSpaceApiKey: process.env.OCRSPACE_API_KEY || '',
  ocrSpaceEndpoint: process.env.OCRSPACE_ENDPOINT || 'https://api.ocr.space/parse/image',
  azureVisionEndpoint: process.env.AZURE_VISION_ENDPOINT || '',
  azureVisionApiKey: process.env.AZURE_VISION_API_KEY || '',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  vapidEmail: process.env.VAPID_EMAIL || 'mailto:admin@globalsnab.su',
};

if (!env.deepseekApiKey) {
  // Не падаем, но логируем предупреждение
  // Ключ обязательно нужно задать в реальном окружении
  console.warn('[DeepSeek] DEEPSEEK_API_KEY is not set. OCR will not work until it is configured.');
}
