import { ethers, upgrades } from "hardhat";
import { IGovStaking, IGov, IRegistry, WithdrawalNFT, NCPStaking, Rewarder } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const DAY7_BLOCK : Number = 604800;
///TODO this is a test address, change it to mainnet address
const PLATFORM_FEE_COLLECTOR : string = "0x52D68c69B088dbc87e5e4F48e6F4df31F018685e"
export async function deploy(gov : IGov, govStaking : IGovStaking, govMems : SignerWithAddress[]) {

    const NCPStaking = await ethers.getContractFactory("NCPStaking");
    const ncpStaking = await upgrades.deployProxy(NCPStaking, [gov.address, govStaking.address, DAY7_BLOCK, PLATFORM_FEE_COLLECTOR], { initializer: "initialize" }) as NCPStaking;
    await ncpStaking.deployed();

    const WithdrawalNFT = await ethers.getContractFactory("WithdrawalNFT");
    const withdrawalNFT = await upgrades.deployProxy(WithdrawalNFT, [ncpStaking.address], { initializer: "initialize" }) as WithdrawalNFT;
    await withdrawalNFT.deployed();
    console.log("WithdrawalNFT deployed to:", withdrawalNFT.address);

    await ncpStaking.setWithdrawalNFT(withdrawalNFT.address);

    let sender = (await ethers.getSigners())[0];
    const Rewarder = await ethers.getContractFactory("Rewarder");
    let rewarders = [];
    for (let i = 0; i < govMems.length; i++) {
        rewarders.push(await upgrades.deployProxy(Rewarder, [govStaking.address, ncpStaking.address, govMems[i].address], { initializer: "initialize" }) as Rewarder) ;
        await rewarders[i].deployed();
        console.log(`Rewarder ${i} deployed to: ${rewarders[i].address}`);
    }

    return { ncpStaking, withdrawalNFT, rewarders, sender };
}