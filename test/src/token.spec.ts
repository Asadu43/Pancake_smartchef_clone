const { network, ethers, deployments } = require("hardhat");
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect, use } from "chai";
import { Contract, BigNumber, Signer } from "ethers";
import { parseEther } from "ethers/lib/utils";
import hre from "hardhat";
import { SmartChefInitializable__factory } from "../../typechain";

describe("Smart Chef ", function async() {
  let signers: Signer[];

  let factoryContract: Contract;
  let stakeToken: Contract;
  let rewardToken: Contract;
  let cake: Contract;
  let profile: Contract;
  let nft: Contract;

  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  let SmartChefFactory: any;
  let MockERC20: any;
  let MockERC721: any;
  let MockPancakeProfile: any;

  let smartChef: any;
  let startBlock: any;
  let blockNumber: any;

  before(async () => {
    startBlock = 40;

    [owner, user, user2, user3] = await ethers.getSigners();

    hre.tracer.nameTags[owner.address] = "ADMIN";
    hre.tracer.nameTags[user.address] = "USER1";
    hre.tracer.nameTags[user2.address] = "USER2";

    MockERC20 = await ethers.getContractFactory("MockERC20");
    stakeToken = await MockERC20.deploy("Asad", "ASD", parseEther("10000"));
    rewardToken = await MockERC20.deploy("AsadReward", "ASDR", parseEther("10000"));

    MockERC721 = await ethers.getContractFactory("MockERC721");
    nft = await MockERC721.deploy("AsadNFT", "ASD");

    MockPancakeProfile = await ethers.getContractFactory("MockPancakeProfile");
    profile = await MockPancakeProfile.deploy(stakeToken.address, parseEther("2"), parseEther("1"), parseEther("2"));

    SmartChefFactory = await ethers.getContractFactory("SmartChefFactory");
    factoryContract = await SmartChefFactory.deploy();
  });

  async function increaseTime(n: any): Promise<void> {
    for (let index = 0; index < n; index++) {
      await ethers.provider.send("evm_increaseTime", [1]);
      await ethers.provider.send("evm_mine", []);
    }
  }

  it("Add Team", async function () {
    // trying to Deploy Pool but Fail because Team is Not Added
    await expect(
      factoryContract.deployPool(
        stakeToken.address,
        rewardToken.address,
        parseEther("1"),
        startBlock,
        500,
        parseEther("2"),
        0,
        profile.address,
        true,
        0,
        owner.address
      )
    ).to.be.revertedWith("function call to a non-contract account");

    //  Trying to add team But Fail Because Not Main Admin
    await expect(profile.connect(user2).addTeam("1st Team", "Be A Chef")).to.be.revertedWith("Not the main admin");

    await expect(profile.addTeam("1st Team", "Be A Chef")).to.emit(profile,"TeamAdd").withArgs("1","1st Team");
  });


  
  it("Deploy Pool and Tranfer Reward Token", async () => {
    // Deploy Pool Successfully
    const team = await factoryContract.deployPool(
      stakeToken.address,
      rewardToken.address,
      parseEther("1"),
      startBlock,
      500,
      parseEther("2"),
      0,
      profile.address,
      true,
      0,
      owner.address
    );

    // Now getting Pool Address
    const receipt = await team.wait();

    const poolAddress = receipt.logs[0].address;

    // Deploy smartchef/ SmartChefInitializable Using pool Address
    smartChef = SmartChefInitializable__factory.connect(poolAddress, owner);

    // Transfer RewardToken to SmartChef Address
    await expect(rewardToken.transfer(smartChef.address, parseEther("4000"))).to.emit(rewardToken,"Transfer").withArgs(owner.address,smartChef.address,parseEther("4000"));

  })


  it("Create Profile", async () => {
 
    // Trying to Create Profile without adding nft address in profile add nft address
    await expect(profile.connect(owner).createProfile("1", nft.address, 1)).to.be.revertedWith("NFT address invalid");

    await profile.addNftAddress(nft.address);

    // Trying to Create Profile without minting NFT
    await expect(profile.connect(user).createProfile("1", nft.address, 1)).to.be.revertedWith("ERC721: invalid token ID");

    await nft.connect(user).mint();

    // Trying to Create Profile without Approved profile
    await expect(profile.connect(user).createProfile("1", nft.address, 0)).to.be.revertedWith("ERC721: caller is not token owner nor approved");

    await nft.connect(user).setApprovalForAll(profile.address, true);

    // Trying to Create Profile without Giving Allownce to Profile Address
    await expect(profile.connect(user).createProfile("1", nft.address, 0)).to.be.revertedWith("ERC20: insufficient allowance");

    await stakeToken.connect(user).mintTokens(parseEther("1000"));

    await stakeToken.connect(user).approve(profile.address, parseEther("100"));

    // // Create Profile Successfully
    await expect(profile.connect(user).createProfile("1", nft.address, 0)).to.emit(profile,"UserNew").withArgs(user.address,"1",nft.address,"0");

  })


  it("Deposit Token", async () => {
 
    // Trying to Desposit Token with To Smart Chef Without Allowance
    await expect(smartChef.connect(user).deposit(parseEther("2"))).to.be.revertedWith("ERC20: insufficient allowance");

    // Approve SmartChef
    await stakeToken.connect(user).approve(smartChef.address, parseEther("1000"));

    // Trying to deposit More than Limit Tokens
    await expect(smartChef.connect(user).deposit(parseEther("3"))).to.be.revertedWith("Deposit: Amount above limit");

    // Trying to Add Non profile user or Not User Active
    await expect(smartChef.connect(user2).deposit(parseEther("2"))).to.be.revertedWith("Deposit: Must have an active profile");

    await expect(smartChef.connect(user).deposit(parseEther("2"))).to.emit(smartChef,"Deposit").withArgs(user.address,parseEther("2"));
  });


  it("Multipal User Deposit Tokens", async () => {
 
    // Multipal User Deposit Tokens
    let i = 1;
    for (let owner of [user2, user3]) {
      await nft.connect(owner).mint();

      await nft.connect(owner).setApprovalForAll(profile.address, true);

      await stakeToken.connect(owner).mintTokens(parseEther("1000"));

      await stakeToken.connect(owner).approve(smartChef.address, parseEther("1000"));

      await stakeToken.connect(owner).approve(profile.address, parseEther("100"));

      await profile.connect(owner).createProfile("1", nft.address, i.toString());

      await smartChef.connect(owner).deposit(parseEther("2"));

      i++;
    }
  });

  it("Update Reward per Block", async () => {
    await expect(smartChef.connect(user2).updateRewardPerBlock(parseEther("1.3"))).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(smartChef.updateRewardPerBlock(parseEther("1.2"))).to.emit(smartChef,"NewRewardPerBlock").withArgs(parseEther("1.2"));

    await increaseTime(20);

    await expect(smartChef.updateRewardPerBlock(parseEther("1.3"))).to.be.revertedWith("Pool has started");
  });

  it("Pending Reward", async () => {
    expect(await smartChef.pendingReward(user.address)).to.be.equal(parseEther("6.8"));

    expect(await smartChef.pendingReward(user2.address)).to.be.equal(parseEther("6.8"));

    await increaseTime(4);

    expect(await smartChef.pendingReward(user2.address)).to.be.equal(parseEther("8.4"));
  });

  it("WithDraw amount", async () => {
    await expect(smartChef.connect(user).withdraw(parseEther("3"))).to.be.revertedWith("Amount to withdraw too high");

    await expect(smartChef.connect(user).withdraw(parseEther("1"))).to.emit(smartChef,"Withdraw").withArgs(user.address,parseEther("1"));

    expect(await smartChef.pendingReward(user.address)).to.be.equal(parseEther("0"));

    await increaseTime(4);

    expect(await smartChef.pendingReward(user.address)).to.be.equal(parseEther("0.96"));
  });

  it(" Emergency WithDraw amount || Withdraw staked tokens without caring about rewards rewards", async () => {
    await expect(smartChef.connect(user2).emergencyWithdraw()).to.emit(smartChef,"EmergencyWithdraw").withArgs(user2.address,parseEther("0"));

    expect(await smartChef.pendingReward(user2.address)).to.be.equal(parseEther("0"));
  });

  it("Update pool limit per user", async () => {
    await expect(smartChef.connect(user).updatePoolLimitPerUser(true, parseEther("1.5"))).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(smartChef.updatePoolLimitPerUser(true, parseEther("1.5"))).to.be.revertedWith("New limit must be higher");

    await expect(smartChef.updatePoolLimitPerUser(true, parseEther("10"))).to.emit(smartChef,"NewPoolLimit").withArgs(parseEther("10"));
  });

  it("update start and end blocks", async () => {
    await expect(smartChef.connect(user).updateStartAndEndBlocks(20, 1000)).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(smartChef.updateStartAndEndBlocks(20, 1000)).to.be.revertedWith("Pool has started");
  });

  it(" emergency Withdraw", async () => {
    await smartChef.connect(owner).emergencyRewardWithdraw(parseEther("2"));
  });

  it("Stops Reward", async () => {
    await smartChef.connect(owner).stopReward();
  });
});
