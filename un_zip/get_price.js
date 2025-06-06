const { ethers } = require('ethers');

// PancakeSwap 合约地址
const FACTORY_ADDRESS = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';  //工厂地址
const ROUTER_ADDRESS = '0x10ed43c718714eb63d5aa57b78b54704e256024e'; //路由地址

// 常见稳定币地址（按优先级排序）
const STABLECOINS = [
  { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', symbol: 'WBNB' }, // BNB
  { address: '0x55d398326f99059ff775485246999027b3197955', symbol: 'USDT' }, // USDT
];

// 合约 ABI
const TOKEN_ABI = [
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];

const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

async function getTokenInfo(tokenAddress, provider) {
  const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
  return {
    address: tokenAddress,
    symbol: await tokenContract.symbol(),
    decimals: await tokenContract.decimals(),
  };
}

async function findBestPair(tokenAddress, provider) {
  const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  
  for (const stablecoin of STABLECOINS) {
    const pairAddress = await factoryContract.getPair(tokenAddress, stablecoin.address);
    
    if (pairAddress !== ethers.constants.AddressZero) {
      return {
        pairAddress,
        stablecoin,
      };
    }
  }
  
  throw new Error('未找到与任何稳定币的交易对');
}

async function getPancakeSwapPrice(tokenAddress) {
      const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
      const tokenInfo = await getTokenInfo(tokenAddress, provider);
      const { pairAddress, stablecoin } = await findBestPair(tokenAddress, provider);
      const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      
      // 获取储备量和代币顺序
      const [reserve0, reserve1] = await pairContract.getReserves().then(res => [res[0], res[1]]);
      const [token0Addr, token1Addr] = await Promise.all([pairContract.token0(), pairContract.token1()]);
      
      // 确定目标代币和稳定币的储备量
      const isToken0 = token0Addr.toLowerCase() === tokenInfo.address.toLowerCase();
      const targetReserve = isToken0 ? reserve0 : reserve1;
      const stableReserve = isToken0 ? reserve1 : reserve0;
        
      let price;
      if (isToken0) {
        price = stableReserve.mul(ethers.utils.parseUnits('1', tokenInfo.decimals)).div(targetReserve);
      } else {
        price = stableReserve.mul(ethers.utils.parseUnits('1', tokenInfo.decimals)).div(targetReserve);
      }
      
      //如果是BNB
      if(stablecoin.symbol === 'WBNB'){
          const wbnbUSDT = await getPancakeSwapPrice(stablecoin.address);
          const wbnbPrice = ethers.utils.parseUnits(wbnbUSDT.price, wbnbUSDT.stablecoin.decimals);
          price = price.mul(wbnbPrice).div(ethers.utils.parseUnits('1', stablecoin.decimals));
      }
      
      return {
        pairAddress,
        token: tokenInfo,
        stablecoin: stablecoin,
        price: ethers.utils.formatUnits(price, stablecoin.decimals), // 按稳定币精度格式化
        liquidity: {
          [tokenInfo.symbol]: ethers.utils.formatUnits(targetReserve, tokenInfo.decimals),
          [stablecoin.symbol]: ethers.utils.formatUnits(stableReserve, stablecoin.decimals),
        },
        timestamp: Math.floor(Date.now() / 1000),
      };
}

// 使用示例：获取任意代币价格（只需提供代币地址）
async function main() {
  // 替换为你想查询的代币地址
  const TOKEN_ADDRESS = ''; // 
  
  try {
    const priceData = await getPancakeSwapPrice(TOKEN_ADDRESS);
    console.log(`PancakeSwap ${priceData.token.symbol} 价格数据:`, JSON.stringify(priceData, null, 2));
  } catch (error) {
    console.error('获取价格失败:', error.message);
  }
}

main();    