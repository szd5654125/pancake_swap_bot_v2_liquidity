import { ethers } from 'ethers';
import IUniswapV2Router02 from './abis/pancakeswap.json' assert { type: 'json' };
import ERC20_ABI from './abis/erc20abi.json' assert { type: 'json' };
const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];
const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];
// PancakeSwap V2 配置
const ROUTER_ADDRESS = '0x10ed43c718714eb63d5aa57b78b54704e256024e'; // PancakeSwap V2 Router
const FACTORY_ADDRESS = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';//工厂地址
// 配置信息
const config = {
  tokenA: '0x1D417cF1e0450a4eB2b38c1F2FF9Db7f843dCa6E',  //代币A
  tokenB: '0x55d398326f99059fF775485246999027B3197955',  //代币B
  walletPrivateKey: '', // 你的钱包私钥
  providerUrl: 'https://bsc-dataseed.binance.org/',
  liquidityPercent: 100, // 要移除的流动性百分比 (0-100)
  slippageTolerance: 5, // 滑点容忍度百分比 (建议3-10%)
  deadline: Math.floor(Date.now() / 1000) + 60 * 30, // 截止时间（秒）
};

async function getPair(provider, tokenA, tokenB) {
  const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  return await factoryContract.getPair(tokenA, tokenB);
}
async function removeLiquidity() {
  try {
    const provider = new ethers.JsonRpcProvider(config.providerUrl);
    const wallet = new ethers.Wallet(config.walletPrivateKey, provider);
    const router = new ethers.Contract(ROUTER_ADDRESS, IUniswapV2Router02, wallet);

    const pairAddress = await getPair(provider, config.tokenA, config.tokenB);
    const code = await provider.getCode(pairAddress);
    if (code === '0x') throw new Error(`流动性池 ${pairAddress} 不存在`);

    const lpToken = new ethers.Contract(pairAddress, ERC20_ABI, wallet);
    const balance = await lpToken.balanceOf(wallet.address);
    const amountToRemove = balance.mul(config.liquidityPercent).div(100);

    if (amountToRemove.eq(0)) throw new Error('流动性余额不足或百分比设置为0');

    console.log(`要移除的流动性: ${ethers.formatUnits(amountToRemove, 18)} LP tokens`);
    const approveTx = await lpToken.approve(ROUTER_ADDRESS, amountToRemove);
    await approveTx.wait();
    console.log('LP Token 批准成功');

    const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    const [reserveA, reserveB] = await pairContract.getReserves();
    const totalSupply = await lpToken.totalSupply();

    const expectedTokenA = reserveA.mul(amountToRemove).div(totalSupply);
    const expectedTokenB = reserveB.mul(amountToRemove).div(totalSupply);

    const slippageFactor = 100 - config.slippageTolerance;
    const minTokenA = expectedTokenA.mul(slippageFactor).div(100);
    const minTokenB = expectedTokenB.mul(slippageFactor).div(100);

    console.log(`预期接收: ${ethers.formatUnits(expectedTokenA, 18)} TokenA + ${ethers.formatUnits(expectedTokenB, 18)} TokenB`);
    console.log(`最小接收: ${ethers.formatUnits(minTokenA, 18)} TokenA + ${ethers.formatUnits(minTokenB, 18)} TokenB`);

    const removeTx = await router.removeLiquidity(
      config.tokenA,
      config.tokenB,
      amountToRemove,
      minTokenA,
      minTokenB,
      wallet.address,
      config.deadline,
      { gasLimit: 500000 }
    );
    const receipt = await removeTx.wait();
    console.log(`操作成功，交易哈希：${receipt.hash}`);

  } catch (e) {
    console.error('错误：', e.message || e);
    process.exit(1);
  }
}

removeLiquidity();