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
const TESTNET_NCP_GATEWAY : string = '0x64d2ccd2C4c7aC869b9f776CbC7b4d6c6fdc6022';

export async function upgrade() {
    const NCPstakingGateway = await ethers.getContractFactory("NCPStakingGateway");
    const gateway = await upgrades.upgradeProxy(
        TESTNET_NCP_GATEWAY,NCPstakingGateway
    ) as NCPStakingGateway;


    return gateway ;
}

async function main(){
    const gateway = await upgrade();
}

main().then();