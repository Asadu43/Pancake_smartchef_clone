const { network, ethers, deployments } = require("hardhat")
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect, use } from "chai";
import { Contract, BigNumber, Signer } from "ethers";
import { parseEther } from "ethers/lib/utils";
import hre, {  } from "hardhat";
import { SmartChefInitializable__factory } from "../../typechain";

describe("Smart Chef ", function async() {
  let signers: Signer[];

  let factoryContract: Contract;
  let stakeToken: Contract;
  let rewardToken: Contract;
  let cake:Contract;
  let profile:Contract;
  let nft: Contract;

  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  let SmartChefFactory: any;
  let MockERC20: any;
  let MockERC721:any;
  let MockPancakeProfile: any;

  let smartChef : any;
  let startBlock:any;
  let blockNumber:any;



  before(async () => {


    // blockNumber = await time.latestBlock();
    startBlock = 40;



    [owner, user, user2, user3] = await ethers.getSigners();

    hre.tracer.nameTags[owner.address] = "ADMIN";
    hre.tracer.nameTags[user.address] = "USER1";
    hre.tracer.nameTags[user2.address] = "USER2";


    MockERC20 = await ethers.getContractFactory("MockERC20");
    stakeToken = await MockERC20.deploy("Asad","ASD",parseEther("10000"));
    rewardToken = await MockERC20.deploy("AsadReward","ASDR",parseEther("10000"));
    // cake = await MockERC20.deploy("Cake","ASDC",parseEther("1000000"));

    MockERC721 = await ethers.getContractFactory("MockERC721");
    nft = await MockERC721.deploy("AsadNFT","ASD");

    MockPancakeProfile = await ethers.getContractFactory("MockPancakeProfile");
    profile = await MockPancakeProfile.deploy(stakeToken.address, parseEther("2"), parseEther("1"), parseEther("2"));

    SmartChefFactory = await ethers.getContractFactory("SmartChefFactory");
    factoryContract = await SmartChefFactory.deploy();
    
  });


  async function increaseTime(n: any): Promise<void> {
    for (let index = 0; index < n; index++) {

      await ethers.provider.send('evm_increaseTime',[1]);
      await ethers.provider.send('evm_mine',[]);
    }

  }

  it("Add Team", async function () {

    await profile.addTeam("1st Team","Be A Chef")

    await profile.addNftAddress(nft.address)
    // await factoryContract.createPair(stakeToken.address, rewardToken.address);
  });


  it("Deploy Pool",async () => {

  const team = await factoryContract.deployPool(stakeToken.address,rewardToken.address,parseEther("1"),startBlock,500,parseEther("2"),0,profile.address,true,0,owner.address)


  const receipt = await team.wait();


  const poolAddress = receipt.logs[0].address;


  smartChef = SmartChefInitializable__factory.connect(poolAddress,owner)


  await rewardToken.transfer(smartChef.address, parseEther("4000"));

  console.log(await smartChef.startBlock())

  let i = 0;
  for (let owner of [user, user2, user3]) {
  await nft.connect(owner).mint();
  await nft.connect(owner).setApprovalForAll(profile.address,true)

  await stakeToken.connect(owner).mintTokens(parseEther("1000"))

  await stakeToken.connect(owner).approve(smartChef.address,parseEther("1000"))

  await stakeToken.connect(owner).approve(profile.address,parseEther("100"))

  await profile.connect(owner).createProfile("1",nft.address,i.toString());

  await smartChef.connect(owner).deposit(parseEther("2"))

  i++;
  }
 
  })



  it("Update Reward per Block",async () => {

    await expect(smartChef.connect(user2).updateRewardPerBlock(parseEther("1.3"))).to.be.revertedWith("Ownable: caller is not the owner")

    await smartChef.updateRewardPerBlock(parseEther("1.2"))

    await increaseTime(20)

    await expect(smartChef.updateRewardPerBlock(parseEther("1.3"))).to.be.revertedWith("Pool has started")
    
  })


  it("Pending Reward",async () => {

     expect(await smartChef.pendingReward(user.address)).to.be.equal(parseEther("4.4"))


     expect(await smartChef.pendingReward(user2.address)).to.be.equal(parseEther("4.4"))

    await increaseTime(4)


    expect(await smartChef.pendingReward(user2.address)).to.be.equal(parseEther("6"))

  })



  it("WithDraw amount",async () => {


    await expect(smartChef.connect(user).withdraw(parseEther("3"))).to.be.revertedWith("Amount to withdraw too high")

    await smartChef.connect(user).withdraw(parseEther("1"));

    expect(await smartChef.pendingReward(user.address)).to.be.equal(parseEther("0"))

    await increaseTime(4);

    expect(await smartChef.pendingReward(user.address)).to.be.equal(parseEther("0.96"))

 })

 it(" Emergency WithDraw amount || Withdraw staked tokens without caring about rewards rewards",async () => {


  await smartChef.connect(user2).emergencyWithdraw()

  expect(await smartChef.pendingReward(user2.address)).to.be.equal(parseEther("0"))

})

it("Update pool limit per user",async () => {


  await expect( smartChef.connect(user).updatePoolLimitPerUser(true,parseEther("1.5"))).to.be.revertedWith("Ownable: caller is not the owner")


  await expect( smartChef.updatePoolLimitPerUser(true,parseEther("1.5"))).to.be.revertedWith("New limit must be higher")
  
  await smartChef.updatePoolLimitPerUser(true,parseEther("10"))
  
})





it("update start and end blocks",async () => {

  await expect(smartChef.connect(user).updateStartAndEndBlocks(20,1000)).to.be.revertedWith("Ownable: caller is not the owner")
  await expect(smartChef.updateStartAndEndBlocks(20,1000)).to.be.revertedWith("Pool has started")
  
})



it(" emergency Withdraw",async () => {

  await smartChef.connect(owner).emergencyRewardWithdraw(parseEther("2"))

  
})







  


});