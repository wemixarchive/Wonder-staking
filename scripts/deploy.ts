import { ethers, upgrades } from "hardhat";
import { IGovStaking, IGov, IRegistry, WithdrawalNFT, NCPStaking, Rewarder } from "../typechain-types";
import { Wallet } from "ethers";
import { getGov } from "./get_govstaking";
import {FeeData } from "@ethersproject/abstract-provider";

const DAY7_BLOCK : Number = 604800;

///TODO this is a test address, change it to mainnet address
const PLATFORM_FEE_COLLECTOR : string = "0x52D68c69B088dbc87e5e4F48e6F4df31F018685e"

export async function deploy(gov : IGov, govStaking : IGovStaking, govMems : Wallet[]) {


    const overrideProvider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:9100");
    overrideProvider.getFeeData = async () : Promise<FeeData> => {
        return {
            gasPrice : ethers.utils.parseUnits("101", "gwei"),
            maxFeePerGas : ethers.utils.parseUnits("101", "gwei"),
            maxPriorityFeePerGas : ethers.utils.parseUnits("100", "gwei"),
            lastBaseFeePerGas : ethers.utils.parseUnits("1", "wei"),
        };
    };


    const NCPStaking = await ethers.getContractFactory("NCPStaking", govMems[0]);
    const ncpStaking = await upgrades.deployProxy(NCPStaking, [gov.address, govStaking.address, DAY7_BLOCK, PLATFORM_FEE_COLLECTOR], { initializer: "initialize" }) as NCPStaking;
    await ncpStaking.deployed();
    console.log("NCPStaking deployed to:", ncpStaking.address);

    const WithdrawalNFT = await ethers.getContractFactory("WithdrawalNFT", govMems[0]);
    const withdrawalNFT = await upgrades.deployProxy(WithdrawalNFT, [ncpStaking.address], { initializer: "initialize" }) as WithdrawalNFT;
    await withdrawalNFT.deployed();
    console.log("WithdrawalNFT deployed to:", withdrawalNFT.address);

    await ncpStaking.setWithdrawalNFT(withdrawalNFT.address);

    let sender = govMems[0];//(await ethers.getSigners())[0];
    const Rewarder = await ethers.getContractFactory("Rewarder", govMems[0]);
    let rewarders = [];
    let rewardAddresses = [];
    for (let i = 0; i < (await gov.getMemberLength()).toNumber(); i++) {
        rewarders.push(await upgrades.deployProxy(Rewarder, [govStaking.address, ncpStaking.address, govMems[i].address], { initializer: "initialize" }) as Rewarder) ;
        await rewarders[i].deployed();
        // console.log(`Rewarder ${i} deployed to: ${rewarders[i].address}`);
        rewardAddresses.push(rewarders[i].address);
        await ncpStaking.add(govMems[i].address, govMems[0].address, rewarders[i].address, false, false, sender.address, sender.address, 500, ethers.utils.parseEther("1500000"));
    }

    return { ncpStaking, withdrawalNFT, rewarders, sender, rewardAddresses };
}

async function main(){
    const { govStaking, envStorage, registry, gov, govMems} = await getGov();
    const { ncpStaking, withdrawalNFT, rewarders, sender, rewardAddresses } = await deploy(gov as IGov, govStaking, govMems);
    await gov.connect(govMems[0]).reInitV3(rewardAddresses);
}

main().then();