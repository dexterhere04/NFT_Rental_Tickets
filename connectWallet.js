import 'dotenv/config';
import { Wallet, JsonRpcProvider, formatEther } from 'ethers';

const provider = new JsonRpcProvider(process.env.ALCHEMY_API_URL);
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

async function main() {
    console.log("Wallet address:", wallet.address);
    const balance = await wallet.getBalance();
    console.log("Wallet balance:", formatEther(balance), "ETH");
}

clmain().catch(console.error);
