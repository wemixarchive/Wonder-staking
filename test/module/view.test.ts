import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { deploy } from "../../scripts/deploy_hardhat";
import { changeStaking } from "../../scripts/change_govstaking_hardhat";
import { IGov, IGovStaking,WithdrawalNFT } from "../../typechain-types";
import { BigNumber } from "ethers";
import * as fs from 'fs';

type Addr = {ncpStaking:string, rewarder:string, govStaking:string, gov:string,govMem:string};

let address : Addr={ncpStaking:"", rewarder:"", govStaking:"", gov:"",govMem:""};
const DAY7_BLOCK : Number = 604800;
const PLATFORM_FEE_COLLECTOR : string = "0x52D68c69B088dbc87e5e4F48e6F4df31F018685e"
const owner = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const MainAddr = JSON.parse(fs.readFileSync("test/module/address/wemixfi_addrs_mainnet.json").toString());
const devAddr = JSON.parse(fs.readFileSync("test/module/address/wemixfi_addrs_dev.json").toString());
const signer = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",ethers.provider);

describe("deploy", async()=> {
    it("change address", async()=> {
        const { govStaking, envStorage, registry, gov, govMems } = await changeStaking();
        address.govStaking=govStaking.address;
        address.gov = gov.address;
        address.govMem =govMems[0].address;

    })
    it("deploy ncp staking", async()=>{
    const NCPStaking = await ethers.getContractFactory("NCPStaking");
    const ncpStaking = await upgrades.deployProxy(NCPStaking, [address.gov, address.govStaking,DAY7_BLOCK, PLATFORM_FEE_COLLECTOR], { initializer: "initialize" });
    address.ncpStaking = ncpStaking.address;
    });

    it("deploy rewarder", async()=> {
        const Rewarder = await ethers.getContractFactory("Rewarder");
        const rewarder = await upgrades.deployProxy(Rewarder,[address.govStaking,address.ncpStaking,address.govMem],{initializer:"initialize"});
        address.rewarder = rewarder.address;
    })
})

describe("view", async()=> {
    it("add NCP", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        let ncp = address.govMem;
        let feeCollector = MainAddr.batch_vault;
        let rewarder = address.rewarder;
        let mp = false;
        let lock = false;
        let breaker = owner;
        let breakerSetter = owner;
        let feeRatio = 1000;
        let initValue = '15'+'0'.repeat(23);
        
        await NCPStaking.add(ncp,feeCollector,rewarder,mp,lock,breaker,breakerSetter,feeRatio,initValue);
        let poolLength=await NCPStaking.poolLength();
        expect(poolLength).greaterThan(0);

        console.log(await NCPStaking.getPoolInfo(0));
    })

    it("deposit", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking,signer);
        let pid = 0;
        let amount = '8'+'0'.repeat(24);
        let to = signer.address;
        await NCPStaking.connect(signer).deposit(pid,amount,to,false,false,{from:signer.address,value:amount});
        let userInfo=await NCPStaking.getUserInfo(pid,to);
        expect(userInfo.amount).to.equal(amount);
    });

    it("pendingReward", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking,signer);
        let pid = 0;
        let user = signer.address;
        let beforePendingReward=await NCPStaking.pendingReward(pid,user);
        let depositamount = '5'+'0'.repeat(23);
        let to = signer.address;
        let tx = {value:'1'+'0'.repeat(20),from:signer.address,to:address.rewarder};
        await NCPStaking.connect(signer).deposit(pid,depositamount,to,false,false,{from:signer.address,value:depositamount});
        await signer.sendTransaction(tx);
        let afterPendingReward=await NCPStaking.pendingReward(pid,user);
        expect(afterPendingReward).to.equal('85'+'0'.repeat(18));
    })

    it("pendingRewardInfo", async()=>{
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking,signer);
        let pid = 0;
        let user = signer.address;
        let pendingReward=await NCPStaking.pendingRewardInfo(pid,user);
        expect(pendingReward.totalPendingReward).greaterThan('0');
        expect(pendingReward.lpPendingReward).greaterThan('0');
        expect(pendingReward.mpPendingReward).equal('0');
    })

    it("pendingMP", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking,signer);
        let pid = 0;
        let user = signer.address;  
        let pendingMP = await NCPStaking.pendingMP(pid,user);
        expect(pendingMP).to.greaterThan(0);
    })

    it("getUserInfo", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking,signer);
        let pid = 0;
        let user = signer.address;
        let userInfo=await NCPStaking.getUserInfo(pid,user);

        expect(userInfo.amount).to.equal('85'+'0'.repeat(23));
        expect(userInfo.rewardDebt).to.equal('0');
        expect(userInfo.pendingReward).to.equal('0');
        expect(userInfo.pendingAmountReward).to.equal('0');
        expect(userInfo.lastRewardClaimed).to.greaterThan('0');
    })

    it("getUserMPInfo", async()=>{
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking,signer);
        let pid = 0;
        let user = signer.address;
        let userMPInfo = await NCPStaking.getUserMPInfo(pid,user);
        expect(userMPInfo.staked).to.equal(0);
        expect(userMPInfo.lastMPUpdatedTime).to.equal(0);
    })

})