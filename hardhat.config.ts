import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "solidity-docgen";

import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "./.env") });

task("ncpCompound", "Compound ncp's reward")
    .addParam("networkType", "0: localhost, 1: testnet, 2: mainnet")
    .addParam("ncpId", "ncp id")
    .setAction(async (args, hre) => {
        const { compoundNCP } = await import("./scripts/ncp_compound");
        await compoundNCP(hre, parseInt(args.networkType), parseInt(args.ncpId));
    });
task("ncpCliam", "Claim ncp's reward")
    .addParam("networkType", "0: localhost, 1: testnet, 2: mainnet")
    .addParam("ncpId", "ncp id")
    .setAction(async (args, hre) => {
        const { claimNCP } = await import("./scripts/ncp_compound");
        await claimNCP(hre, parseInt(args.networkType), parseInt(args.ncpId));
    });

task("stake-balance", "check staking balance")
    .addParam("ncpId", "ncp id")
    .addParam("blockNumber", "block number")
    .setAction(async (args, hre) => {
        const { checkNCPBalanceByBlockNumber } = await import("./scripts/checkBalance");
        await checkNCPBalanceByBlockNumber(hre, parseInt(args.blockNumber), parseInt(args.ncpId));
    });

task("unstake-balance", "check unstaked balance")
    .addParam("ncpId", "ncp id")
    .addParam("blockNumber", "block number")
    .setAction(async (args, hre) => {
        const { checkWithdrawBalanceByBlockNumber } = await import("./scripts/checkBalance");
        await checkWithdrawBalanceByBlockNumber(hre, parseInt(args.blockNumber), parseInt(args.ncpId));
    });

task("reward-balance", "check reward balance")
    .addParam("ncpId", "ncp id")
    .addParam("blockNumber", "block number")
    .setAction(async (args, hre) => {
        const { checkRewardBalanceByBlockNumber } = await import("./scripts/checkBalance");
        await checkRewardBalanceByBlockNumber(hre, parseInt(args.blockNumber), parseInt(args.ncpId));
    });

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.9",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },

    paths: {
        sources: path.join(__dirname, "./contracts"),
    },
    networks: {
        hardhat: {
            chains: {
                1112: {
                    hardforkHistory: {
                        berlin: 0,
                        london: 20000000000,
                    },
                },
                1111: {
                    hardforkHistory: {
                        berlin: 0,
                        london: 20000000000,
                    },
                },
            },
            accounts: {
                mnemonic: "test test test test test test test test test test test junk",
                initialIndex: 0,
                accountsBalance: "1000000000" + "0".repeat(18),
            },
            forking: {
                url: "https://api.test.wemix.com",
                // blockNumber: 21265381,
                //"http://127.0.0.1:9100",
            },
            allowUnlimitedContractSize: true,
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            gasPrice: 111000000000,
        },
        dev: {
            url: "http://127.0.0.1:9100",
            gasPrice: 111000000000,
        },
        wtestnet: {
            url: "https://api.test.wemix.com",
            gasPrice: 111000000000,
        },
        wemix: {
            url: "https://api.wemix.com",
            gasPrice: 111000000000,
        },
    },
    docgen: {
        pages: "files",
    },
    mocha: {
        timeout: 100000000,
    },
};

export default config;
