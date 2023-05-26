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

const MainAddr = JSON.parse(fs.readFileSync("test/module/address/wemixfi_addrs_mainnet.json").toString());
const devAddr = JSON.parse(fs.readFileSync("test/module/address/wemixfi_addrs_dev.json").toString());

const owner = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const breaker = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";


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

describe("add", async()=> {
    it("add ncp", async()=>{
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        let ncp = address.govMem;
        let feeCollector = MainAddr.batch_vault;
        let rewarder = address.rewarder;
        let mp = true;
        let lock = false;
        let breaker = owner;
        let breakerSetter = owner;
        let feeRatio = 0;
        let initValue = '15'+'0'.repeat(23);
    
        await NCPStaking.add(ncp,feeCollector,rewarder,mp,lock,breaker,breakerSetter,feeRatio,initValue);
    })
})

describe("set functions", async()=> {
    it("set", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        let pid = 0;
        let feeCollector = MainAddr.batch_vault;
        let rewarder = address.rewarder;
        let feeRatio = 0;
        await NCPStaking.set(pid,feeCollector,rewarder,feeRatio);
    })

    it("set unbond time", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        let pid = 0;
        let unbondTime = 1000000;
        await NCPStaking.setUnbondTime(pid,unbondTime);
    })

    it("setPoolBreaker", async()=> {
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        await NCPStaking.setPoolBreaker(0,breaker);
    })

    it("setPoolBreakerSetter", async()=>{
        const NCPStaking = await ethers.getContractAt("NCPStaking",address.ncpStaking);
        let breakerSetter = breaker;
        await NCPStaking.setPoolBreakerSetter(0,breakerSetter);
    })
})
