const { expect } = require("chai");
const { ethers } = require("hardhat");

const NAME = "TokenMaster";
const SYMBOL = "TM";

const OCCASION_NAME = "ETH Texas";
const OCCASION_COST = ethers.utils.parseUnits("1", "ether");
const OCCASION_MAX_TICKETS = 100;
const OCCASION_DATE = "Apr 27";
const OCCASION_TIME = "10:00AM CST";
const OCCASION_LOCATION = "Austin, Texas";

describe("RentableTicketNFT", function () {
  let tokenMaster;
  let deployer, buyer;

  beforeEach(async () => {
    [deployer, buyer] = await ethers.getSigners();

    const RentableTicketNFT = await ethers.getContractFactory("RentableTicketNFT");
    tokenMaster = await RentableTicketNFT.deploy(NAME, SYMBOL, deployer.address, 0);

    await tokenMaster
      .connect(deployer)
      .listOccasion(
        OCCASION_NAME,
        OCCASION_COST,
        OCCASION_MAX_TICKETS,
        OCCASION_DATE,
        OCCASION_TIME,
        OCCASION_LOCATION
      );
  });

  // ---------------- Deployment ----------------
  describe("Deployment", function () {
    it("Sets the name", async () => {
      expect(await tokenMaster.name()).to.equal(NAME);
    });

    it("Sets the symbol", async () => {
      expect(await tokenMaster.symbol()).to.equal(SYMBOL);
    });

    it("Sets the owner", async () => {
      expect(await tokenMaster.owner()).to.equal(deployer.address);
    });

    it("Sets feeRecipient and feeBps", async () => {
      expect(await tokenMaster.feeRecipient()).to.equal(deployer.address);
      expect(await tokenMaster.feeBps()).to.equal(0);
    });
  });

  // ---------------- Occasions ----------------
  describe("Occasions", function () {
    it("Returns occasion attributes", async () => {
      const occasion = await tokenMaster.getOccasion(1);
      expect(occasion.id).to.equal(1);
      expect(occasion.name).to.equal(OCCASION_NAME);
      expect(occasion.cost).to.equal(OCCASION_COST);
      expect(occasion.tickets).to.equal(OCCASION_MAX_TICKETS);
      expect(occasion.date).to.equal(OCCASION_DATE);
      expect(occasion.time).to.equal(OCCASION_TIME);
      expect(occasion.location).to.equal(OCCASION_LOCATION);
    });

    it("Updates occasions count", async () => {
      const total = await tokenMaster.totalOccasions();
      expect(total).to.equal(1);
    });

    it("Reverts if non-owner tries to list occasion", async () => {
      await expect(
        tokenMaster
          .connect(buyer)
          .listOccasion("Hackathon", OCCASION_COST, 50, "May 1", "2PM", "NYC")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Emits OccasionListed event", async () => {
      await expect(
        tokenMaster
          .connect(deployer)
          .listOccasion("Hackathon", OCCASION_COST, 50, "May 1", "2PM", "NYC")
      ).to.emit(tokenMaster, "OccasionListed");
    });
  });

  // ---------------- Minting ----------------
  describe("Minting", function () {
    const ID = 1;
    const SEAT = 50;
    const AMOUNT = ethers.utils.parseUnits("1", "ether");

    beforeEach(async () => {
      const tx = await tokenMaster
        .connect(buyer)
        .mintTicket(ID, SEAT, 0, { value: AMOUNT });
      await tx.wait();
    });

    it("Updates ticket count", async () => {
      const occasion = await tokenMaster.getOccasion(ID);
      expect(occasion.tickets).to.equal(OCCASION_MAX_TICKETS - 1);
    });

    it("Updates buying status", async () => {
      expect(await tokenMaster.hasBought(ID, buyer.address)).to.be.true;
    });

    it("Updates seat status", async () => {
      expect(await tokenMaster.seatTaken(ID, SEAT)).to.equal(buyer.address);
    });

    it("Updates overall seating status", async () => {
      const seats = await tokenMaster.getSeatsTaken(ID);
      expect(seats).to.have.lengthOf(1);
      expect(seats[0]).to.equal(SEAT);
    });

    it("Updates the contract balance", async () => {
      const balance = await ethers.provider.getBalance(tokenMaster.address);
      expect(balance).to.equal(AMOUNT);
    });

    it("Reverts if occasion ID is invalid", async () => {
      await expect(
        tokenMaster.connect(buyer).mintTicket(99, 1, 0, { value: AMOUNT })
      ).to.be.revertedWith("Invalid occasion");
    });

    it("Reverts if insufficient ETH sent", async () => {
      await expect(
        tokenMaster
          .connect(buyer)
          .mintTicket(ID, SEAT, 0, { value: AMOUNT.sub(1) })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Reverts if seat is already taken", async () => {
      await expect(
        tokenMaster
          .connect(deployer)
          .mintTicket(ID, SEAT, 0, { value: AMOUNT })
      ).to.be.revertedWith("Seat taken");
    });

    it("Reverts if seat number exceeds maxTickets", async () => {
      const badSeat = OCCASION_MAX_TICKETS + 1;
      await expect(
        tokenMaster.connect(buyer).mintTicket(ID, badSeat, 0, { value: AMOUNT })
      ).to.be.revertedWith("Invalid seat");
    });

    it("Assigns NFT ownership correctly", async () => {
      expect(await tokenMaster.ownerOf(1)).to.equal(buyer.address);
    });

    it("Emits TicketMinted event", async () => {
      await expect(
        tokenMaster
          .connect(buyer)
          .mintTicket(ID, 51, 0, { value: AMOUNT })
      ).to.emit(tokenMaster, "TicketMinted");
    });
  });

  // ---------------- Withdrawing ----------------
  describe("Withdrawing", function () {
    const ID = 1;
    const SEAT = 50;
    const AMOUNT = ethers.utils.parseUnits("1", "ether");
    let balanceBefore;

    beforeEach(async () => {
      balanceBefore = await ethers.provider.getBalance(deployer.address);
      await tokenMaster.connect(buyer).mintTicket(ID, SEAT, 0, { value: AMOUNT });
      await tokenMaster.connect(deployer).withdraw();
    });

    it("Updates the owner balance", async () => {
      const after = await ethers.provider.getBalance(deployer.address);
      expect(after).to.be.gt(balanceBefore);
    });

    it("Updates the contract balance", async () => {
      const balance = await ethers.provider.getBalance(tokenMaster.address);
      expect(balance).to.equal(0);
    });

    it("Reverts if non-owner tries to withdraw", async () => {
      await expect(tokenMaster.connect(buyer).withdraw()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  // ---------------- Rentals ----------------
  describe("Rentals", function () {
    const ID = 1;
    const SEAT = 10;
    const AMOUNT = ethers.utils.parseUnits("1", "ether");
    const PRICE_PER_DAY = ethers.utils.parseUnits("0.1", "ether");
    const RENT_DAYS = 2;

    let tokenId;

    beforeEach(async () => {
      const tx = await tokenMaster
        .connect(buyer)
        .mintTicket(ID, SEAT, PRICE_PER_DAY, { value: AMOUNT });
      await tx.wait();
      tokenId = await tokenMaster.totalSupply();
    });

    it("Owner can list for rent", async () => {
      await expect(
        tokenMaster.connect(buyer).listForRent(tokenId, PRICE_PER_DAY)
      )
        .to.emit(tokenMaster, "RentalListed")
        .withArgs(tokenId, PRICE_PER_DAY);
    });

    it("Non-owner cannot list for rent", async () => {
      await expect(
        tokenMaster.connect(deployer).listForRent(tokenId, PRICE_PER_DAY)
      ).to.be.revertedWith("Not owner");
    });

    it("Allows renting if paid correctly", async () => {
      const price = PRICE_PER_DAY.mul(RENT_DAYS);
      await expect(
        tokenMaster.connect(deployer).rent(tokenId, RENT_DAYS, { value: price })
      ).to.emit(tokenMaster, "Rented");
    });

    it("Reverts if insufficient payment", async () => {
      const bad = PRICE_PER_DAY.mul(RENT_DAYS).sub(1);
      await expect(
        tokenMaster.connect(deployer).rent(tokenId, RENT_DAYS, { value: bad })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Reverts if already rented and not expired", async () => {
      const price = PRICE_PER_DAY.mul(RENT_DAYS);
      await tokenMaster.connect(deployer).rent(tokenId, RENT_DAYS, { value: price });
      await expect(
        tokenMaster.connect(buyer).rent(tokenId, RENT_DAYS, { value: price })
      ).to.be.revertedWith("Already rented");
    });

    it("Refunds excess ETH if overpaid", async () => {
      const price = PRICE_PER_DAY.mul(RENT_DAYS);
      const overpay = price.add(ethers.utils.parseEther("1"));
      const before = await ethers.provider.getBalance(deployer.address);

      const tx = await tokenMaster
        .connect(deployer)
        .rent(tokenId, RENT_DAYS, { value: overpay });
      await tx.wait();

      const after = await ethers.provider.getBalance(deployer.address);
      expect(after).to.be.closeTo(before.sub(price), ethers.utils.parseEther("0.01"));
    });

    it("Reverts if token is not listed", async () => {
      const otherId = tokenId.add(1);
      await expect(
        tokenMaster.connect(deployer).rent(otherId, RENT_DAYS, {
          value: PRICE_PER_DAY,
        })
      ).to.be.revertedWith("Not listed");
    });

    it("Splits payment between owner and feeRecipient", async () => {
      const price = PRICE_PER_DAY.mul(RENT_DAYS);
      const feeBps = await tokenMaster.feeBps();
      const fee = price.mul(feeBps).div(10000);
      const ownerAmount = price.sub(fee);

      const ownerBefore = await ethers.provider.getBalance(buyer.address);
      const feeBefore = await ethers.provider.getBalance(deployer.address);

      await tokenMaster.connect(deployer).rent(tokenId, RENT_DAYS, { value: price });

      const ownerAfter = await ethers.provider.getBalance(buyer.address);
      const feeAfter = await ethers.provider.getBalance(deployer.address);

      const tol = ethers.utils.parseEther("0.01");
      expect(ownerAfter.sub(ownerBefore)).to.be.closeTo(ownerAmount, tol);
      expect(feeAfter.sub(feeBefore)).to.be.closeTo(fee, tol);
    });

    it("Allows re-renting after expiry", async () => {
      const price = PRICE_PER_DAY.mul(RENT_DAYS);
      await tokenMaster.connect(deployer).rent(tokenId, RENT_DAYS, { value: price });

      await ethers.provider.send("evm_increaseTime", [RENT_DAYS * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      await expect(
        tokenMaster.connect(buyer).rent(tokenId, RENT_DAYS, { value: price })
      ).to.emit(tokenMaster, "Rented");
    });
  });
});
