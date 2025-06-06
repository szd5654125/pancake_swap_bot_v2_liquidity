const ethers = require('ethers');

const config = {
  // BSC 主网 RPC
  rpcUrl: 'https://bsc-dataseed.binance.org/',
  // PancakeSwap V2 Router 地址
  routerAddress: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
  // USDT 地址
  usdtAddress: '0x55d398326f99059ff775485246999027b3197955'
};

// 加载 ABI
const erc20Abi = require('./erc20abi.json');
const routerAbi = require('./pancakeswap.json');

//添加流动性
async function addLiquidity(privateKey, tokenAddress,  tokenAmount, pairAmount) {

    // 创建钱包和 provider
    const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // 初始化合约实例
    const router = new ethers.Contract(config.routerAddress, routerAbi, wallet);
    const token = new ethers.Contract(tokenAddress, erc20Abi, wallet);
    
    // 确保有足够的代币余额
    const tokenBalance = await token.balanceOf(wallet.address);
    if (ethers.BigNumber.from(tokenAmount).gt(tokenBalance)) {
    throw new Error('代币余额不足');
    }
    
    
    const usdt = new ethers.Contract(config.usdtAddress, erc20Abi, wallet);
    
    // 确保有足够的 USDT 余额
    const usdtBalance = await usdt.balanceOf(wallet.address);
    if (ethers.BigNumber.from(pairAmount).gt(usdtBalance)) {
     throw new Error('USDT 余额不足');
    }

    // 授权 Router 花费代币
    const tokenAllowance = await token.allowance(wallet.address, config.routerAddress);
    if (ethers.BigNumber.from(tokenAmount).gt(tokenAllowance)) {
      const approveTx = await token.approve(config.routerAddress, tokenAmount);
      await approveTx.wait();
      console.log('代币授权成功');
    }
    
    // 授权 Router 花费 USDT
    const usdtAllowance = await usdt.allowance(wallet.address, config.routerAddress);
    if (ethers.BigNumber.from(pairAmount).gt(usdtAllowance)) {
      const approveTx = await usdt.approve(config.routerAddress, pairAmount);
      await approveTx.wait();
      console.log('USDT 授权成功');
    }
    
    // 添加代币/USDT 流动性
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 分钟后过期
    
    const tx = await router.addLiquidity(
      tokenAddress,
      config.usdtAddress,
      tokenAmount,
      pairAmount,
      tokenAmount, // 最小代币数量
      pairAmount, // 最小 USDT 数量
      wallet.address,
      deadline,
      { gasLimit: 500000 }
    );
    
    const receipt = await tx.wait();
    console.log('添加代币/USDT 流动性成功，交易哈希:', receipt.transactionHash);
    return receipt;
  
      
   
}

// 使用示例
async function main() {
  try {
    const privateKey = ''; // 请替换为您的私钥
    const tokenAddress = ''; // 请替换为您的代币地址

    // 代币和配对资产的数量 (Wei 单位)
    const tokenAmount = ethers.utils.parseUnits('100', 18); //代币1
    const pairAmount = ethers.utils.parseUnits('0.01', 18); //代币2 //默认为USDT，可以自己改
    
    const receipt = await addLiquidity(privateKey, tokenAddress, tokenAmount, pairAmount);
    console.log('交易确认数:', receipt.confirmations);
  } catch (error) {
    console.error('添加流动性失败:', error.message);
    process.exit(1);
  }
}

main();    