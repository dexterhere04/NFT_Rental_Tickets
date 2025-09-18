import { ethers } from "hardhat";

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Optional: check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  // Deploy RentableNFTMarketplace
  const feeRecipient = deployer.address; // change if different fee recipient
  const feeBps = 250; // 2.5%

  const Marketplace = await ethers.getContractFactory("RentableNFTMarketplace");
  const marketplace = await Marketplace.deploy(feeRecipient, feeBps);

  await marketplace.waitForDeployment();

  console.log("RentableNFTMarketplace deployed to:", await marketplace.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
