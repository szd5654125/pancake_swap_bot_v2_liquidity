import dotenv from 'dotenv';
dotenv.config();
const testPrivateKey = process.env.TEST_WALLET_PRIVATE_KEY;
const testWalletAddress = process.env.TEST_WALLET_ADDRESS;
const tokenMap = {
  WBNB: process.env.TOKEN_ADDRESS_WBNB,
  CAKE: process.env.TOKEN_ADDRESS_CAKE,
  SHIBA: process.env.TOKEN_ADDRESS_SHIBA,
};
import { JsonRpcProvider, Wallet, parseUnits } from 'ethers';
import addLiquidity from './lib/addLiquidity.mjs';
// const removeLiquidity = require('./lib/removeLiquidity.js');
// const getPrice = require('./lib/getPrice.js');

const tokenAddress = tokenMap['WBNB'];

async function main() {
    console.log("🔑 钱包地址：", testWalletAddress);
    console.log("🎯 代币地址：", tokenAddress);
    try {
        const provider = new JsonRpcProvider('https://bsc-dataseed.binance.org/');

        const code = await provider.getCode(tokenAddress);
        if (code === '0x') {
            throw new Error('⚠️ 提供的地址不是合约地址，请检查是否为正确的 token 合约。');
            }

        const network = await provider.getNetwork();
        console.log(`✅ 已连接到网络: ${network.name} (Chain ID: ${network.chainId})`);

        // 准备流动性添加参数（这里使用默认精度 18）
        const tokenAmount = parseUnits('0.015', 18);    // 你自己的代币
        const pairAmount = parseUnits('10', 18);     // USDT
        
        console.log('🚀 正在调用 addLiquidity...');
        const receipt = await addLiquidity(testPrivateKey, tokenAddress, tokenAmount, pairAmount);
        console.log('交易确认数:', receipt.confirmations);
        console.log(`✅ 添加流动性成功，交易哈希: ${receipt.transactionHash}`);

    } catch (error) {
        console.error('❌ 添加流动性失败:', error.message || error);
    }
}

main();