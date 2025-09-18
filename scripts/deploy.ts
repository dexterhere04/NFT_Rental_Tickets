import hre from "hardhat";

async function main() {
  console.log("Starting deployment...");
  console.log("Network:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy RentableNFTMarketplace
  console.log("\nDeploying RentableNFTMarketplace...");
  
  const RentableNFTMarketplace = await hre.ethers.getContractFactory("RentableNFTMarketplace");
  const marketplace = await RentableNFTMarketplace.deploy("Rentable NFT Collection", "RNFT");
  
  await marketplace.waitForDeployment();
  const address = await marketplace.getAddress();
  
  console.log("✅ RentableNFTMarketplace deployed to:", address);
  console.log("Transaction hash:", marketplace.deploymentTransaction()?.hash);

  // Verify ERC-4907 support
  try {
    const supportsERC4907 = await marketplace.supportsInterface("0xad092b5c");
    console.log("Supports ERC-4907:", supportsERC4907);
  } catch (error) {
    console.log("Could not verify ERC-4907 support");
  }

  console.log("\nDeployment completed successfully! 🎉");
  return marketplace;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });