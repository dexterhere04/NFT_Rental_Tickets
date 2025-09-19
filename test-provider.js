const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_URL);
  const blockNumber = await provider.getBlockNumber();
  console.log("Connected to Sepolia! Current block:", blockNumber);
}

main().catch(console.error);
