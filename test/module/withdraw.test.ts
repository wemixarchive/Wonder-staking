import { time, loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { deploy } from "../../scripts/deploy_hardhat";
import { changeStaking } from "../../scripts/change_govstaking_hardhat";
import { IGov, IGovStaking,WithdrawalNFT } from "../../typechain-types";
import { BigNumber } from "ethers";
import * as fs from 'fs';

type Addr = {ncpStaking:string, rewarder:string[], govStaking:string, gov:string,ncp:string[],withdrawNFT:string};

let address : Addr={ncpStaking:"", rewarder:[], govStaking:"", gov:"",ncp:[],withdrawNFT:""};
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
        address.ncp[0] =govMems[0].address;
        address.ncp[1] = govMems[1].address;

    })
    it("deploy ncp staking", async()=>{
    const NCPStaking = await ethers.getContractFactory("NCPStaking");
    const ncpStaking = await upgrades.deployProxy(NCPStaking, [address.gov, address.govStaking,DAY7_BLOCK, PLATFORM_FEE_COLLECTOR], { initializer: "initialize" });
    address.ncpStaking = ncpStaking.address;
    });

    it("deploy rewarder", async()=> {
        const Rewarder = await ethers.getContractFactory("Rewarder");
        const rewarder0 = await upgrades.deployProxy(Rewarder,[address.govStaking,address.ncpStaking,address.ncp[0]],{initializer:"initialize"});
        const rewarder1 = await upgrades.deployProxy(Rewarder,[address.govStaking,address.ncpStaking,address.ncp[1]],{initializer:"initialize"});
        address.rewarder[0] = rewarder0.address;
        address.rewarder[1] = rewarder1.address;
    });

    it("deploy withdrawNFT", async()=> {
        const WithdrawalNFT = await ethers.getContractFactory("WithdrawalNFT");
        const withdrawalNFT = await upgrades.deployProxy(WithdrawalNFT, [address.ncpStaking], { initializer: "initialize" });
        address.withdrawNFT = withdrawalNFT.address;
    })
})

describe("add NCP", async()=> {
    it("add NCP 0", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        let ncp = address.ncp[0];
        let feeCollector = MainAddr.batch_vault;
        let rewarder = address.rewarder[0];
        let mp = false;
        let lock = false;
        let breaker = owner;
        let breakerSetter = owner;
        let feeRatio = 1000;
        let initValue = '15'+'0'.repeat(23);
        
        await NCPStaking.add(ncp,feeCollector,rewarder,mp,lock,breaker,breakerSetter,feeRatio,initValue);
        let poolLength=await NCPStaking.poolLength();
        expect(poolLength).greaterThan(0);
    })

    it("add NCP 1", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        let ncp = address.ncp[1];
        let feeCollector = MainAddr.batch_vault;
        let rewarder = address.rewarder[1];
        let mp = false;
        let lock = false;
        let breaker = owner;
        let breakerSetter = owner;
        let feeRatio = 1000;
        let initValue = '15'+'0'.repeat(23);
        
        await NCPStaking.add(ncp,feeCollector,rewarder,mp,lock,breaker,breakerSetter,feeRatio,initValue);
        let poolLength=await NCPStaking.poolLength();
        expect(poolLength).greaterThan(1);
    })
})

describe("deposit", async()=> {
    it("deposit to ncp 0", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking,signer);
        let pid = 0;
        let amount = '8'+'0'.repeat(24);
        let to = signer.address;
        await NCPStaking.connect(signer).deposit(pid,amount,to,false,false,{from:signer.address,value:amount});
        let userInfo=await NCPStaking.getUserInfo(pid,to);
        expect(userInfo.amount).to.equal(amount);

    });

    it("deposit to ncp 1", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking,signer);
        let pid = 1;
        let amount = '8'+'0'.repeat(24);
        let to = signer.address;
        await NCPStaking.connect(signer).deposit(pid,amount,to,false,false,{from:signer.address,value:amount});
        let userInfo=await NCPStaking.getUserInfo(pid,to);
        expect(userInfo.amount).to.equal(amount);
    });

    it("get reward", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking,signer);
        let pid0 = 1;
        let pid1 = 2;
        let amount = '5'+'0'.repeat(23);
        let to = signer.address;

        let tx0 = {value:'1'+'0'.repeat(20),from:signer.address,to:address.rewarder[0]};
        let tx1 = {value:'1'+'0'.repeat(20),from:signer.address,to:address.rewarder[1]};
        
        await NCPStaking.connect(signer).deposit(pid0,amount,to,false,false,{from:signer.address,value:amount});
        await NCPStaking.connect(signer).deposit(pid1,amount,to,false,false,{from:signer.address,value:amount});
        
        await signer.sendTransaction(tx0);
        await signer.sendTransaction(tx1);
        
        let afterPendingReward0=await NCPStaking.pendingReward(pid0,signer.address);
        let afterPendingReward1=await NCPStaking.pendingReward(pid1,signer.address);

        let userInfo0=await NCPStaking.getUserInfo(pid0,to);
        let userInfo1=await NCPStaking.getUserInfo(pid1,to);

        expect(userInfo0.amount).to.equal('85'+'0'.repeat(23));
        expect(userInfo1.amount).to.equal('85'+'0'.repeat(23));
        expect(userInfo0.pendingReward).to.equal(0);
        expect(userInfo1.pendingReward).to.equal(0);
        expect(afterPendingReward0).to.equal('85'+'0'.repeat(18));
        expect(afterPendingReward1).to.equal('85'+'0'.repeat(18));
    })
})

describe("withdraw", async()=> {
    it("set withdrawNFT", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        await NCPStaking.setWithdrawalNFT(address.withdrawNFT);
    })
    it("withdraw Request with no claim", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        const WithdrawNFT = await ethers.getContractAt("WithdrawalNFT",address.withdrawNFT);
        let pid = 0;
        let toPid = 0;
        let amount = '8'+'0'.repeat(24);
        let to = signer.address;
        let claimReward = false;
        let comp = false;

        let beforeUserAmount = (await NCPStaking.getUserInfo(pid,to)).amount;
        let beforePendingReward = await NCPStaking.pendingReward(pid,to);
        await NCPStaking.connect(signer).withdrawRequest(pid,toPid,amount,to,claimReward,comp);
        let afterUserAmount = (await NCPStaking.getUserInfo(pid,to)).amount;
        let afterPendingReward = await NCPStaking.pendingReward(pid,to);

        expect(beforeUserAmount.sub(amount)).to.equal(afterUserAmount);
        expect(afterPendingReward).to.equal(beforePendingReward);
        expect(await WithdrawNFT.balanceOf(to)).to.equal(1);
        expect((await WithdrawNFT.withdrawalRequests(1)).amount).to.equal(amount);
    })

    it("withdraw with no claim", async()=> {
        await mine(86400 * 7 + 100);
        let pid = 0;
        let tokenId = 1;
        let to = signer.address;
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        const WithdrawNFT = await ethers.getContractAt("WithdrawalNFT",address.withdrawNFT);
        
        let beforeRequestAmount = (await WithdrawNFT.withdrawalRequests(tokenId)).amount;
        let beforeUserAmount = await ethers.provider.getBalance(to);
        let beforePendingReward = await NCPStaking.pendingReward(pid,to);
        
        await NCPStaking.connect(signer).withdraw(pid,tokenId,to);

        let afterUserAmount = await ethers.provider.getBalance(to);
        let afterPendingReward = await NCPStaking.pendingReward(pid,to);

        expect((await WithdrawNFT.withdrawalRequests(tokenId)).amount).to.equal(0);
        expect(afterUserAmount).to.closeTo(beforeUserAmount,beforeRequestAmount);
        expect(beforePendingReward).to.equal(afterPendingReward);
        expect(await WithdrawNFT.balanceOf(to)).to.equal(0);
    })

    it("withdraw Request with claim", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        const WithdrawNFT = await ethers.getContractAt("WithdrawalNFT",address.withdrawNFT);
        
        let pid = 0;
        let toPid = 0;
        let amount = '4'+'0'.repeat(23);
        let to = signer.address;
        let claimReward = true;
        let comp = false;

        let beforeUserAmount = (await NCPStaking.getUserInfo(pid,to)).amount;
        await NCPStaking.connect(signer).withdrawRequest(pid,toPid,amount,to,claimReward,comp);
        let afterUserAmount = (await NCPStaking.getUserInfo(pid,to)).amount;
        let afterPendingReward = await NCPStaking.pendingReward(pid,to);

        expect(beforeUserAmount.sub(amount)).to.equal(afterUserAmount);
        expect(afterPendingReward).to.equal(0);  
        expect(await WithdrawNFT.balanceOf(to)).to.equal(1);     
    })

    it("withdraw with claim", async()=> {
        await mine(86400 * 7 + 100);
        let pid = 0;
        let tokenId = 2;
        let to = signer.address;
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        const WithdrawNFT = await ethers.getContractAt("WithdrawalNFT",address.withdrawNFT);
        
        let beforeRequestAmount = (await WithdrawNFT.withdrawalRequests(tokenId)).amount;
        let beforeUserAmount = await ethers.provider.getBalance(to);
        let beforePendingReward = await NCPStaking.pendingReward(pid,to);
        
        await NCPStaking.connect(signer).withdraw(pid,tokenId,to);

        let afterUserAmount = await ethers.provider.getBalance(to);
        let afterPendingReward = await NCPStaking.pendingReward(pid,to);

        expect((await WithdrawNFT.withdrawalRequests(tokenId)).amount).to.equal(0);
        expect(afterUserAmount).to.closeTo(beforeUserAmount,beforeRequestAmount.add(beforePendingReward));
        expect(afterPendingReward).to.equal(0);
        expect(await WithdrawNFT.balanceOf(to)).to.equal(0);
    })

    it("withdraw All", async()=> {
        const WithdrawNFT = await ethers.getContractAt("WithdrawalNFT",address.withdrawNFT);
        let pid0 = 1;
        let pid1 = 2;
        let toPid = 0;
        let amount0 = '1'+'0'.repeat(23);
        let amount1 = '85'+'0'.repeat(23);
        let to = signer.address;
        let claimReward = true;
        let comp = false;
        
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        
        await NCPStaking.connect(signer).withdrawRequest(pid0,toPid,amount0,to,claimReward,comp);
        await NCPStaking.connect(signer).withdrawRequest(pid1,toPid,amount1,to,claimReward,comp);

        let beforeRequestAmount0 = (await WithdrawNFT.withdrawalRequests(3)).amount;
        let beforeRequestAmount1 = (await WithdrawNFT.withdrawalRequests(4)).amount;

        await mine(86400 * 7 + 100);
        let beforeUserAmount = await ethers.provider.getBalance(to);
        
        let beforePendingReward0 = await NCPStaking.pendingReward(0,to);
        let beforePendingReward1 = await NCPStaking.pendingReward(1,to);
        
        expect(await WithdrawNFT.balanceOf(to)).to.equal(2);

        await NCPStaking.connect(signer).withdrawAll(to);

        let afterUserAmount = await ethers.provider.getBalance(to);
        let afterRequestAmount0 = (await WithdrawNFT.withdrawalRequests(3)).amount;
        let afterRequestAmount1 = (await WithdrawNFT.withdrawalRequests(4)).amount;

        expect(await WithdrawNFT.balanceOf(to)).to.equal(0); // NFT balance 계속 갖고 있음
        expect(afterUserAmount).to.closeTo(beforeUserAmount,beforeRequestAmount0.add(beforePendingReward0).add(beforeRequestAmount1.add(beforePendingReward1)));
        console.log(await WithdrawNFT.getWithdrawableTokenList(to));
    })
    

})

