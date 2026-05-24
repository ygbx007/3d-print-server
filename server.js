/**
 * 3D打印预约 - 飞书多维表格同步服务
 */

const https = require('https');
const http = require('http');

// 飞书配置（从环境变量读取）
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || '';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || '';
const FEISHU_BASE_TOKEN = process.env.FEISHU_BASE_TOKEN || 'IxlhbeTG5avSRqsDbE0cleyjnad';
const FEISHU_TABLE_ID = process.env.FEISHU_TABLE_ID || 'tbl8NPFCvyIIDMED';

// 获取飞书 tenant_access_token
async function getTenantAccessToken() {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            app_id: FEISHU_APP_ID,
            app_secret: FEISHU_APP_SECRET
        });

        const options = {
            hostname: 'open.feishu.cn',
            port: 443,
            path: '/open-apis/auth/v3/tenant_access_token/internal',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    if (result.code === 0) {
                        resolve(result.tenant_access_token);
                    } else {
                        reject(new Error(`获取 token 失败: ${result.msg}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// 向飞书多维表格写入记录
async function writeRecordToBase(token, recordData) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            fields: {
                "预约人姓名": recordData.name,
                "模型名称": recordData.modelName,
                "模型颜色/参数": recordData.modelParams || "",
                "积分币数量": parseInt(recordData.coins) || 0,
                "制作者": recordData.maker || "",
                "接收人/备注": recordData.note || "",
                "状态": "待打印",
                "预约时间": new Date().toISOString()
            }
        });

        const options = {
            hostname: 'open.feishu.cn',
            port: 443,
            path: `/open-apis/bitable/v1/apps/${FEISHU_BASE_TOKEN}/tables/${FEISHU_TABLE_ID}/records`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'Authorization': `Bearer ${token}`
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    if (result.code === 0) {
                        resolve(result.data);
                    } else {
                        reject(new Error(`写入失败: ${result.msg}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// HTTP 请求处理
async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '只接受 POST 请求' }));
        return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        try {
            const data = JSON.parse(body);

            if (!data.name || !data.modelName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '缺少必填字段：姓名和模型名称' }));
                return;
            }

            const token = await getTenantAccessToken();
            const result = await writeRecordToBase(token, data);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: '预约成功！',
                data: result
            }));

        } catch (error) {
            console.error('处理失败:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: error.message || '服务器内部错误'
            }));
        }
    });
}

// 本地开发服务器
if (require.main === module) {
    const port = process.env.PORT || 3000;
    const server = http.createServer(handler);
    server.listen(port, () => {
        console.log(`🚀 3D打印预约服务已启动: http://localhost:${port}`);
    });
}

module.exports = { handler };
