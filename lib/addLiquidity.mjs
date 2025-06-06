import { JsonRpcProvider, Wallet, Contract, parseUnits, getAddress, toBigInt } from 'ethers';

const config = {
  // BSC 主网 RPC
  rpcUrl: 'https://bsc-dataseed.binance.org/',
  // PancakeSwap V2 Router 地址
  routerAddress: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
  // USDT 地址
  usdtAddress: '0x55d398326f99059ff775485246999027b3197955'
};

// 加载 ABI
import { readFile } from 'fs/promises';
const erc20Abi = JSON.parse(await readFile(new URL('./abis/erc20abi.json', import.meta.url)));
const routerAbi = JSON.parse(await readFile(new URL('./abis/pancakeswap.json', import.meta.url)));

//添加流动性
async function addLiquidity(privateKey, tokenAddress,  tokenAmount, pairAmount) {

  // 创建钱包和 provider
  const provider = new JsonRpcProvider(config.rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  
  // 初始化合约实例
  const router = new Contract(config.routerAddress, routerAbi, wallet);
  const token = new Contract(tokenAddress, erc20Abi, wallet);
  
  // 确保有足够的代币余额
  const tokenBalance = await token.balanceOf(wallet.address);
  if (toBigInt(tokenAmount) > toBigInt(tokenBalance)) {
  throw new Error('代币余额不足');
  }
  
  
  const usdt = new Contract(config.usdtAddress, erc20Abi, wallet);
  
  // 确保有足够的 USDT 余额
  const usdtBalance = await usdt.balanceOf(wallet.address);
  if (toBigInt(pairAmount) > toBigInt(usdtBalance)) {
    throw new Error('USDT 余额不足');
  }

  // 授权 Router 花费代币
  const tokenAllowance = await token.allowance(wallet.address, config.routerAddress);
  if (toBigInt(tokenAmount) > toBigInt(tokenAllowance)) {
    const approveTx = await token.approve(config.routerAddress, tokenAmount);
    await approveTx.wait();
    console.log('代币授权成功');
  }
  
  // 授权 Router 花费 USDT
  const usdtAllowance = await usdt.allowance(wallet.address, config.routerAddress);
  if (toBigInt(pairAmount) > toBigInt(usdtAllowance)) {
    const approveTx = await usdt.approve(config.routerAddress, pairAmount);
    await approveTx.wait();
    console.log('USDT 授权成功');
  }
  
  // 添加代币/USDT 流动性
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 分钟后过期
  
  console.log("🚨 Debug Params:");
  console.log("WBNB Address:", tokenAddress);
  console.log("USDT Address:", config.usdtAddress);
  console.log("Token Amount:", tokenAmount.toString());
  console.log("Pair Amount:", pairAmount.toString());

  const wbnbBalance = await token.balanceOf(wallet.address);
  const wbnbAllowance = await token.allowance(wallet.address, config.routerAddress);

  console.log("WBNB 余额:", wbnbBalance.toString());
  console.log("USDT 余额:", usdtBalance.toString());
  console.log("WBNB 授权:", wbnbAllowance.toString());
  console.log("USDT 授权:", usdtAllowance.toString());

  // 动态确认AB地址和数量
  const [tokenA, tokenB] = tokenAddress.toLowerCase() < config.usdtAddress.toLowerCase()
  ? [tokenAddress, config.usdtAddress]
  : [config.usdtAddress, tokenAddress];
  const amountADesired = tokenA === tokenAddress ? tokenAmount : pairAmount;
  const amountBDesired = tokenB === tokenAddress ? tokenAmount : pairAmount;

  // 滑点容忍度设置为 1%
  const slippageFactor = BigInt(99); // 99%
  const tokenMin = tokenAmount * slippageFactor / BigInt(100);
  const pairMin = pairAmount * slippageFactor / BigInt(100);
  const tx = await router.addLiquidity(
    tokenA,
    tokenB,
    amountADesired,
    amountBDesired,
    tokenMin, // 最小代币数量
    pairMin, // 最小 USDT 数量
    wallet.address,
    deadline,
    { gasLimit: 500000 }
  );
  
  const receipt = await tx.wait();
  console.log('添加代币/USDT 流动性成功，交易哈希:', receipt.transactionHash);
  return receipt;
  
      
   
}

export default addLiquidity;
