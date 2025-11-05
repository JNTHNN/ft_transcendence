import { config as dotenv } from "dotenv"; dotenv();
import { HardhatUserConfig } from "hardhat/config";
const { AVALANCHE_RPC_URL, PRIVATE_KEY } = process.env;
const cfg: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    fuji: { url: AVALANCHE_RPC_URL || "", accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [] }
  }
};
export default cfg;
