import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("RentalNFTModule", (m) => {
  const nft = m.contract("RentalNFT", ["RentableNFT", "RNT"]);
  return { nft };
});
