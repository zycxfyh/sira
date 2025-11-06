// tools/scripts/start-tunnel.mjs
import 'dotenv/config'; // 自动加载 .env 文件
import axios from 'axios';
import { execa } from 'execa';

const CLERK_API_KEY = process.env.CLERK_MANAGEMENT_API_KEY;
const CLERK_WEBHOOK_ID = process.env.CLERK_WEBHOOK_ID;
const LOCAL_PORT = 3000;

if (!CLERK_API_KEY || !CLERK_WEBHOOK_ID) {
  console.error('❌ 错误: 请确保 .env 文件中已配置 CLERK_MANAGEMENT_API_KEY 和 CLERK_WEBHOOK_ID');
  process.exit(1);
}

async function getNgrokPublicUrl() {
  // 轮询ngrok的本地API，直到获取到公网URL
  for (let i = 0; i < 10; i++) {
    try {
      const response = await axios.get('http://127.0.0.1:4040/api/tunnels');
      const httpTunnel = response.data.tunnels.find((t) => t.proto === 'https');
      if (httpTunnel?.public_url) {
        return httpTunnel.public_url;
      }
    } catch (error) {
      // ngrok 还没启动好，稍等
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('无法在5秒内从ngrok获取到公网URL。');
}

async function updateClerkWebhook(publicUrl) {
  const webhookUrl = `${publicUrl}/webhooks/clerk`;
  const clerkApiUrl = `https://api.clerk.com/v1/webhooks/svix/${CLERK_WEBHOOK_ID}`;

  console.log(`🚀 准备更新 Clerk Webhook...`);
  console.log(`   - Webhook ID: ${CLERK_WEBHOOK_ID}`);
  console.log(`   - 新的 URL: ${webhookUrl}`);

  try {
    await axios.put(
      clerkApiUrl,
      { url: webhookUrl },
      { headers: { Authorization: `Bearer ${CLERK_API_KEY}` } },
    );
    console.log('✅ Clerk Webhook URL 已成功自动更新！');
  } catch (error) {
    console.error('❌ 自动更新 Clerk Webhook 失败:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  console.log('自动化开发环境启动中...');

  // 1. 在后台以静默模式启动 ngrok
  const ngrokProcess = execa('ngrok', ['http', LOCAL_PORT], { stdio: 'pipe' });
  console.log('🚪 ngrok 传送门已启动...');

  try {
    // 2. 获取 ngrok 的公网 URL
    const publicUrl = await getNgrokPublicUrl();
    console.log(`🌍 获取到新的公网地址: ${publicUrl}`);

    // 3. 自动更新 Clerk Webhook
    await updateClerkWebhook(publicUrl);

    console.log('\n======================================================');
    console.log('🎉 自动化设置完成！您的开发环境已准备就绪。');
    console.log('   现在，Clerk 会自动将事件发送到您的本地机器。');
    console.log('======================================================\n');

    // 4. 将 ngrok 的日志实时输出到当前窗口
    ngrokProcess.stdout.pipe(process.stdout);
    ngrokProcess.stderr.pipe(process.stderr);
  } catch (error) {
    console.error('\n❌ 自动化启动失败。请检查错误信息。');
    ngrokProcess.kill(); // 如果出错，关闭ngrok进程
    process.exit(1);
  }
}

main();
