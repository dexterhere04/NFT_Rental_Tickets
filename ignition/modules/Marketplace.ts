import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MarketplaceModule", (m) => {
  const feeRecipient = m.getAccount(0); // deployer as fee recipient
  const feeBps = 500; // 5% fee

  const marketplace = m.contract("RentableNFTMarketplace", [feeRecipient, feeBps]);
  return { marketplace };
});
