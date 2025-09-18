import hre from "hardhat";
import { expect } from "chai";
import type { RentableNFTMarketplace, ERC721Mock } from "../types";

describe("RentableNFTMarketplace", function () {
  let marketplace: RentableNFTMarketplace;
  let nft: ERC721Mock;
  let owner: any;
  let alice: any;
  let bob: any;

  beforeEach(async function () {
    const ethers = hre.ethers; // must get ethers from hre

    [owner, alice, bob] = await ethers.getSigners(); // now works

    const NFT = await ethers.getContractFactory("ERC721Mock", owner);
    nft = (await NFT.deploy()) as ERC721Mock;
    await nft.waitForDeployment();

    const Marketplace = await ethers.getContractFactory("RentableNFTMarketplace", owner);
    marketplace = (await Marketplace.deploy(owner.address, 250)) as RentableNFTMarketplace;
    await marketplace.waitForDeployment();

    await nft.connect(alice).mint(alice.address, 1);
    await nft.connect(alice).approve(await marketplace.getAddress(), 1);
  });

  it("should allow listing, renting and update rental state", async function () {
    const ethers = hre.ethers;
    const oneEth = ethers.parseEther("1");

    await expect(
      marketplace.connect(alice).listForRent(await nft.getAddress(), 1, oneEth)
    ).to.emit(marketplace, "Listed");

    const rentTx = marketplace.connect(bob).rent(await nft.getAddress(), 1, 2, {
      value: oneEth * 2n,
    });
    await expect(rentTx).to.emit(marketplace, "Rented");

    const rental = await marketplace.rentals(await nft.getAddress(), 1);
    expect(rental.renter).to.equal(bob.address);
  });

  it("should allow cancelling a listing", async function () {
    const ethers = hre.ethers;
    const price = ethers.parseEther("0.1");
    await marketplace.connect(alice).listForRent(await nft.getAddress(), 1, price);

    await expect(
      marketplace.connect(alice).cancelListing(await nft.getAddress(), 1)
    ).to.emit(marketplace, "Cancelled");

    const rental = await marketplace.rentals(await nft.getAddress(), 1);
    expect(rental.pricePerDay).to.equal(0n);
  });
});
