import { ethers, upgrades } from "hardhat";
import { IGovStaking, IGov, IRegistry, WithdrawalNFT, NCPStaking, Rewarder, NCPStakingGateway } from "../typechain-types";
import { Wallet } from "ethers";
import { getGov } from "./get_govstaking_testnet";
import {FeeData } from "@ethersproject/abstract-provider";
import { ContractAddressOrInstance } from "@openzeppelin/hardhat-upgrades/dist/utils";

const DAY7_BLOCK : Number = 604800;

///TODO this is a test address, change it to mainnet address
const PLATFORM_FEE_COLLECTOR : string = "0x52D68c69B088dbc87e5e4F48e6F4df31F018685e"

const TESTNET_NCP_STAKING : string = '0x64d2ccd2C4c7aC869b9f776CbC7b4d6c6fdc6022';
const TESTNET_WITHDRAWALNFT : string = '0x31aBfd8AaD69D9cA50e9c8aA1692b010E613ab2E';
const TESTNET_GATEWAY : string = '0xF6165cAdA4D5D02aDb286AADFb4FE13B11750aF3';

export async function deploy(ncpStaking : ContractAddressOrInstance, gov : ContractAddressOrInstance, govStaking : ContractAddressOrInstance, withdrawNFT : ContractAddressOrInstance, envStorage : ContractAddressOrInstance, gateWay_new : ContractAddressOrInstance) {
    const NCPstakingGateway = await ethers.getContractFactory("NCPStakingGateway");
    const gateway = await upgrades.deployProxy(
        NCPstakingGateway,
        [ncpStaking, gov, govStaking, withdrawNFT, envStorage, gateWay_new],
        { initializer: "initialize" }
    ) as NCPStakingGateway;

    return gateway ;
}

async function main(){
    const { govStaking, envStorage, registry, gov, govMems} = await getGov();
    const gateway = await deploy(TESTNET_NCP_STAKING, gov.address, govStaking.address, TESTNET_WITHDRAWALNFT, envStorage.address, TESTNET_GATEWAY);
    // await gov.connect(govMems[0]).reInitV3(rewardAddresses);
    console.log("Deployed gateway to: ", gateway.address);
}

main().then();