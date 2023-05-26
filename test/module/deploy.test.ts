import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { deploy } from "../../scripts/deploy_hardhat";
import { changeStaking } from "../../scripts/change_govstaking_hardhat";
import { IGov, IGovStaking,WithdrawalNFT } from "../../typechain-types";
import { BigNumber } from "ethers";

const DAY7_BLOCK : Number = 604800;
type Addr = {ncpStaking:string, rewarder:string, govStaking:string, gov:string,govMem:string};

let address : Addr={ncpStaking:"", rewarder:"", govStaking:"", gov:"",govMem:""};

const PLATFORM_FEE_COLLECTOR : string = "0x52D68c69B088dbc87e5e4F48e6F4df31F018685e"
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
    })
})
