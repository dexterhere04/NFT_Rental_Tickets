const { expect } = require("chai")

const NAME = "TokenMaster"
const SYMBOL = "TM"

const OCCASION_NAME = "ETH Texas"
const OCCASION_COST = ethers.utils.parseUnits('1', 'ether')
const OCCASION_MAX_TICKETS = 100
const OCCASION_DATE = "Apr 27"
const OCCASION_TIME = "10:00AM CST"
const OCCASION_LOCATION = "Austin, Texas"

describe("TokenMaster", () => {
  let tokenMaster
  let deployer, buyer

  beforeEach(async () => {
    // Setup accounts
    [deployer, buyer] = await ethers.getSigners()

    // Deploy contract
    const RentableTicketNFT = await ethers.getContractFactory("RentableTicketNFT")
    tokenMaster = await RentableTicketNFT.deploy(NAME, SYMBOL, deployer.address, 0)


    const transaction = await tokenMaster.connect(deployer).listOccasion(
    OCCASION_NAME,
    OCCASION_COST,
    OCCASION_MAX_TICKETS,
    OCCASION_DATE,
    OCCASION_TIME,
    OCCASION_LOCATION
  )


    await transaction.wait()
  })

  describe("Deployment", () => {
    it("Sets the name", async () => {
      expect(await tokenMaster.name()).to.equal(NAME)
    })

    it("Sets the symbol", async () => {
      expect(await tokenMaster.symbol()).to.equal(SYMBOL)
    })

    it("Sets the owner", async () => {
      expect(await tokenMaster.owner()).to.equal(deployer.address)
    })

    it("Sets feeRecipient and feeBps", async () => {
      expect(await tokenMaster.feeRecipient()).to.equal(deployer.address)
      expect(await tokenMaster.feeBps()).to.equal(0) // adjust if you pass non-zero at deploy
    })

  })

  describe("Occasions", () => {
    it('Returns occasions attributes', async () => {
      const occasion = await tokenMaster.getOccasion(1)
      expect(occasion.id).to.be.equal(1)
      expect(occasion.name).to.be.equal(OCCASION_NAME)
      expect(occasion.cost).to.be.equal(OCCASION_COST)
      expect(occasion.tickets).to.be.equal(OCCASION_MAX_TICKETS)
      expect(occasion.date).to.be.equal(OCCASION_DATE)
      expect(occasion.time).to.be.equal(OCCASION_TIME)
      expect(occasion.location).to.be.equal(OCCASION_LOCATION)
    })

    it('Updates occasions count', async () => {
      const totalOccasions = await tokenMaster.totalOccasions()
      expect(totalOccasions).to.be.equal(1)
    })

    it("Reverts if non-owner tries to list occasion", async () => {
      await expect(
        tokenMaster.connect(buyer).listOccasion(
          "Hackathon", OCCASION_COST, 50, "May 1", "2PM", "NYC"
        )
      ).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("Emits OccasionListed event", async () => {
      await expect(
        tokenMaster.connect(deployer).listOccasion(
          "Hackathon", OCCASION_COST, 50, "May 1", "2PM", "NYC"
        )
      ).to.emit(tokenMaster, "OccasionListed")
    })

  })

  describe("Minting", () => {
    const ID = 1
    const SEAT = 50
    const AMOUNT = ethers.utils.parseUnits('1', 'ether')

    beforeEach(async () => {
      const transaction = await tokenMaster.connect(buyer).mintTicket(ID, SEAT, 0, { value: AMOUNT })
      await transaction.wait()
    })

    it('Updates ticket count', async () => {
      const occasion = await tokenMaster.getOccasion(1)
      expect(occasion.tickets).to.be.equal(OCCASION_MAX_TICKETS - 1)
    })

    it('Updates buying status', async () => {
      const status = await tokenMaster.hasBought(ID, buyer.address)
      expect(status).to.be.equal(true)
    })

    it('Updates seat status', async () => {
      const owner = await tokenMaster.seatTaken(ID, SEAT)
      expect(owner).to.equal(buyer.address)
    })

    it('Updates overall seating status', async () => {
      const seats = await tokenMaster.getSeatsTaken(ID)
      expect(seats.length).to.equal(1)
      expect(seats[0]).to.equal(SEAT)
    })

    it('Updates the contract balance', async () => {
      const balance = await ethers.provider.getBalance(tokenMaster.address)
      expect(balance).to.be.equal(AMOUNT)
    })

    it("Reverts if occasion ID is invalid", async () => {
      await expect(
        tokenMaster.connect(buyer).mintTicket(99, 1, 0, { value: AMOUNT })
      ).to.be.revertedWith("Invalid occasion")
    })

    it("Reverts if insufficient ETH sent", async () => {
      await expect(
        tokenMaster.connect(buyer).mintTicket(ID, SEAT, 0, { value: AMOUNT.sub(1) })
      ).to.be.revertedWith("Insufficient payment")
    })

    it("Reverts if seat is already taken", async () => {
      await tokenMaster.connect(buyer).mintTicket(ID, SEAT, 0, { value: AMOUNT })
      await expect(
        tokenMaster.connect(deployer).mintTicket(ID, SEAT, 0, { value: AMOUNT })
      ).to.be.revertedWith("Seat taken")
    })

    it("Reverts if seat number exceeds maxTickets", async () => {
      const badSeat = OCCASION_MAX_TICKETS + 1
      await expect(
        tokenMaster.connect(buyer).mintTicket(ID, badSeat, 0, { value: AMOUNT })
      ).to.be.revertedWith("Invalid seat")
    })

    it("Assigns NFT ownership correctly", async () => {
      await tokenMaster.connect(buyer).mintTicket(ID, SEAT, 0, { value: AMOUNT })
      expect(await tokenMaster.ownerOf(1)).to.equal(buyer.address)
    })

    it("Emits TicketMinted event", async () => {
      await expect(
        tokenMaster.connect(buyer).mintTicket(ID, SEAT, 0, { value: AMOUNT })
      ).to.emit(tokenMaster, "TicketMinted")
    })

  })

  describe("Withdrawing", () => {
    const ID = 1
    const SEAT = 50
    const AMOUNT = ethers.utils.parseUnits("1", 'ether')
    let balanceBefore

    beforeEach(async () => {
      balanceBefore = await ethers.provider.getBalance(deployer.address)

      let transaction = await tokenMaster.connect(buyer).mintTicket(ID, SEAT, 0, { value: AMOUNT })
      await transaction.wait()

      transaction = await tokenMaster.connect(deployer).withdraw()
      await transaction.wait()
    })

    it('Updates the owner balance', async () => {
      const balanceAfter = await ethers.provider.getBalance(deployer.address)
      expect(balanceAfter).to.be.greaterThan(balanceBefore)
    })

    it('Updates the contract balance', async () => {
      const balance = await ethers.provider.getBalance(tokenMaster.address)
      expect(balance).to.equal(0)
    })

    it("Reverts if non-owner tries to withdraw", async () => {
      await expect(
        tokenMaster.connect(buyer).withdraw()
      ).to.be.revertedWith("Ownable: caller is not the owner")
    })

  })

    describe("Rentals", () => {
      const ID = 1
      const SEAT = 10
      const AMOUNT = ethers.utils.parseUnits("1", "ether")
      const PRICE_PER_DAY = ethers.utils.parseUnits("0.1", "ether")
      const RENT_DAYS = 2

      let tokenId

      beforeEach(async () => {
        // Mint a ticket with rental price
        const tx = await tokenMaster.connect(buyer).mintTicket(ID, SEAT, PRICE_PER_DAY, { value: AMOUNT })
        await tx.wait()
        tokenId = await tokenMaster.totalSupply()
      })

      it("Owner can list for rent", async () => {
        await expect(tokenMaster.connect(buyer).listForRent(tokenId, PRICE_PER_DAY))
          .to.emit(tokenMaster, "RentalListed")
          .withArgs(tokenId, PRICE_PER_DAY)

        const rental = await tokenMaster.rentals(tokenId)
        expect(rental.pricePerDay).to.equal(PRICE_PER_DAY)
      })

      it("Non-owner cannot list for rent", async () => {
        await expect(tokenMaster.connect(deployer).listForRent(tokenId, PRICE_PER_DAY))
          .to.be.revertedWith("Not owner")
      })

      it("Allows renting if paid correctly", async () => {
        const totalPrice = PRICE_PER_DAY.mul(RENT_DAYS)

        await expect(tokenMaster.connect(deployer).rent(tokenId, RENT_DAYS, { value: totalPrice }))
          .to.emit(tokenMaster, "Rented")

        const rental = await tokenMaster.rentals(tokenId)
        expect(rental.renter).to.equal(deployer.address)
        expect(rental.expires).to.be.gt(0)
      })

      it("Reverts if insufficient payment", async () => {
        const insufficient = PRICE_PER_DAY.mul(RENT_DAYS).sub(1)
        await expect(
          tokenMaster.connect(deployer).rent(tokenId, RENT_DAYS, { value: insufficient })
        ).to.be.revertedWith("Insufficient payment")
      })

      it("Reverts if already rented and not expired", async () => {
        const totalPrice = PRICE_PER_DAY.mul(RENT_DAYS)

        await tokenMaster.connect(deployer).rent(tokenId, RENT_DAYS, { value: totalPrice })
        await expect(
          tokenMaster.connect(buyer).rent(tokenId, RENT_DAYS, { value: totalPrice })
        ).to.be.revertedWith("Already rented")
      })

      it("Refunds excess ETH if overpaid", async () => {
        const totalPrice = PRICE_PER_DAY.mul(RENT_DAYS)
        const overpay = totalPrice.add(ethers.utils.parseUnits("1", "ether"))

        const beforeBalance = await ethers.provider.getBalance(deployer.address)

        const tx = await tokenMaster.connect(deployer).rent(tokenId, RENT_DAYS, { value: overpay })
        const receipt = await tx.wait()

        const afterBalance = await ethers.provider.getBalance(deployer.address)
        expect(afterBalance).to.be.closeTo(
          beforeBalance.sub(totalPrice), // only actual rent should be deducted
          ethers.utils.parseUnits("0.01", "ether") // allow small gas margin
        )
      })

      it("Reverts if token is not listed for rent", async () => {
      const otherId = tokenId.add(1) // non-existent
      await expect(
        tokenMaster.connect(deployer).rent(otherId, RENT_DAYS, { value: PRICE_PER_DAY })
      ).to.be.revertedWith("Not listed")
    })

    it("Splits payment between owner and feeRecipient", async () => {
      const totalPrice = PRICE_PER_DAY.mul(RENT_DAYS)

      const ownerBefore = await ethers.provider.getBalance(buyer.address)
      const feeBefore = await ethers.provider.getBalance(deployer.address) // assuming feeRecipient = deployer

      await tokenMaster.connect(deployer).rent(tokenId, RENT_DAYS, { value: totalPrice })

      const ownerAfter = await ethers.provider.getBalance(buyer.address)
      const feeAfter = await ethers.provider.getBalance(deployer.address)

      const tolerance = ethers.utils.parseEther("0.01"); // small margin for gas
      expect(ownerAfter.sub(ownerBefore)).to.be.closeTo(ownerAmount, tolerance)
      expect(feeAfter.sub(feeBefore)).to.be.closeTo(fee, tolerance)

    })

    it("Allows re-renting after expiry", async () => {
      const totalPrice = PRICE_PER_DAY.mul(RENT_DAYS)
      await tokenMaster.connect(deployer).rent(tokenId, RENT_DAYS, { value: totalPrice })

      // advance time
      await ethers.provider.send("evm_increaseTime", [RENT_DAYS * 24 * 60 * 60 + 1])
      await ethers.provider.send("evm_mine")

      await expect(
        tokenMaster.connect(buyer).rent(tokenId, RENT_DAYS, { value: totalPrice })
      ).to.emit(tokenMaster, "Rented")
    })

    })
  })
