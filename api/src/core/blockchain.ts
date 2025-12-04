import { ethers } from 'ethers';

interface MatchData {
  matchId: string;
  tournamentId: string;
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  winnerId: string | number;
  round: number;
  timestamp?: number;
}

interface MatchResult {
  transactionHash: string;
  blockNumber: number;
  dataHash: string;
  gasUsed: string;
}



export class BlockchainService {
  private contract: ethers.Contract | null = null;
  private provider: ethers.Provider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contractAddress: string = '';
  private contractABI: any[] = [];

  private initialized = false;
  private initPromise: Promise<void>;

  // ABI simplifiée pour le contrat MatchStats
  private readonly MATCHSTATS_ABI = [
    {
      "type": "function",
      "name": "storeMatch",
      "inputs": [
        {"name": "matchId", "type": "bytes32"},
        {"name": "tournamentId", "type": "string"},
        {"name": "player1Name", "type": "string"},
        {"name": "player2Name", "type": "string"},
        {"name": "player1Score", "type": "uint32"},
        {"name": "player2Score", "type": "uint32"},
        {"name": "winnerIndex", "type": "uint8"},
        {"name": "round", "type": "uint32"}
      ],
      "outputs": []
    },
    {
      "type": "function",
      "name": "getMatch",
      "stateMutability": "view",
      "inputs": [{"name": "matchId", "type": "bytes32"}],
      "outputs": [
        {"name": "id", "type": "bytes32"},
        {"name": "tournamentId", "type": "string"},
        {"name": "player1Name", "type": "string"},
        {"name": "player2Name", "type": "string"},
        {"name": "player1Score", "type": "uint32"},
        {"name": "player2Score", "type": "uint32"},
        {"name": "winnerIndex", "type": "uint8"},
        {"name": "round", "type": "uint32"},
        {"name": "timestamp", "type": "uint32"},
        {"name": "dataHash", "type": "bytes32"}
      ]
    },
    {
      "type": "function",
      "name": "verifyMatch",
      "stateMutability": "view",
      "inputs": [{"name": "matchId", "type": "bytes32"}],
      "outputs": [{"name": "", "type": "bool"}]
    },
    {
      "type": "function",
      "name": "getTotalMatches",
      "stateMutability": "view",
      "inputs": [],
      "outputs": [{"name": "", "type": "uint256"}]
    },
    {
      "type": "event",
      "name": "MatchStored",
      "inputs": [
        {"name": "matchId", "type": "bytes32", "indexed": true},
        {"name": "tournamentId", "type": "string", "indexed": true},
        {"name": "winnerIndex", "type": "uint8", "indexed": true},
        {"name": "dataHash", "type": "bytes32"}
      ]
    }
  ];

  constructor() {
    this.initPromise = this.initializeConnection();
  }

  public async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  private async initializeConnection() {
    try {
      const rpcUrl = process.env.AVALANCHE_RPC_URL;
      const privateKey = process.env.PRIVATE_KEY;
      const contractAddress = process.env.SCORES_CONTRACT_ADDRESS;

      if (!rpcUrl) {
        console.warn('⚠️  AVALANCHE_RPC_URL not configured, blockchain features disabled');
        return;
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      if (privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
      }

      if (contractAddress) {
        this.contractAddress = contractAddress;
        this.contractABI = this.MATCHSTATS_ABI;
        this.initializeContract();
      }

      this.initialized = true;
      console.log('✅ Blockchain service initialized with MatchStats contract');
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', (error as Error).message);
    }
  }

  private initializeContract() {
    if (!this.wallet || !this.contractAddress || !this.contractABI.length) {
      console.warn('⚠️ Missing requirements for contract initialization');
      return;
    }

    try {
      this.contract = new ethers.Contract(
        this.contractAddress,
        this.contractABI,
        this.wallet
      );
      console.log(`✅ Contract initialized at ${this.contractAddress}`);
    } catch (error) {
      console.error('❌ Failed to initialize contract:', (error as Error).message);
    }
  }

  public isAvailable(): boolean {
    return this.initialized && this.contract !== null && this.wallet !== null;
  }

  public getNetworkInfo() {
    return {
      network: 'Avalanche Fuji Testnet',
      contractAddress: this.contractAddress,
      rpcUrl: process.env.AVALANCHE_RPC_URL,
      explorerUrl: 'https://testnet.snowtrace.io'
    };
  }

  /**
   * Stocker un résultat de match sur la blockchain
   */
  public async storeMatchResult(matchData: MatchData): Promise<MatchResult> {
    await this.ensureInitialized();
    
    if (!this.isAvailable()) {
      throw new Error('Blockchain service not available');
    }

    try {
      console.log(`🏅 Storing match result on blockchain: ${matchData.matchId}`);
      console.log(`🏅 Tournament: ${matchData.tournamentId}`);
      console.log(`🏅 Score: ${matchData.player1Score}-${matchData.player2Score}, Round: ${matchData.round}`);
      
      // Convertir l'ID de match en bytes32
      const matchIdBytes = ethers.keccak256(ethers.toUtf8Bytes(matchData.matchId));
      
      // Déterminer l'index du gagnant (1 ou 2)
      let winnerIndex: number;
      if (matchData.winnerId === 1 || matchData.winnerId === "1") {
        winnerIndex = 1;
      } else if (matchData.winnerId === 2 || matchData.winnerId === "2") {
        winnerIndex = 2;
      } else {
        // Fallback basé sur le score
        winnerIndex = matchData.player1Score > matchData.player2Score ? 1 : 2;
      }
      
      console.log(`🏅 Winner index: ${winnerIndex}`);
      console.log(`🏅 Using MatchStats.storeMatch function`);
      
      // Appeler le smart contract
      const tx = await this.contract!.storeMatch(
        matchIdBytes,
        matchData.tournamentId,
        matchData.player1Name,
        matchData.player2Name,
        matchData.player1Score,
        matchData.player2Score,
        winnerIndex,
        matchData.round
      );

      console.log(`🏅 Transaction sent: ${tx.hash}`);
      
      // Attendre la confirmation
      const receipt = await tx.wait();
      console.log(`🏅 Transaction confirmed: ${receipt.hash}`);
      
      // Récupérer le dataHash depuis les logs
      let dataHash = '';
      if (receipt.logs && receipt.logs.length > 0) {
        try {
          const parsedLog = this.contract!.interface.parseLog(receipt.logs[0]);
          if (parsedLog && parsedLog.args && parsedLog.args.dataHash) {
            dataHash = parsedLog.args.dataHash;
          }
        } catch (logError) {
          console.warn('⚠️ Could not parse transaction logs:', logError);
        }
      }

      const result: MatchResult = {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        dataHash: dataHash,
        gasUsed: receipt.gasUsed.toString()
      };

      console.log(`✅ Match result stored on blockchain: ${result.transactionHash}`);
      return result;

    } catch (error) {
      console.error('❌ Failed to store match result on blockchain:', error);
      throw error;
    }
  }

  /**
   * Récupérer un match depuis la blockchain
   */
  public async getMatch(matchId: string): Promise<any> {
    await this.ensureInitialized();
    
    if (!this.isAvailable()) {
      throw new Error('Blockchain service not available');
    }

    try {
      const matchIdBytes = ethers.keccak256(ethers.toUtf8Bytes(matchId));
      
      // Use a read-only contract connected to provider instead of wallet for view functions
      const readOnlyContract = new ethers.Contract(
        this.contractAddress,
        this.contractABI,
        this.provider
      );
      
      const result = await readOnlyContract.getMatch(matchIdBytes);
      
      return {
        id: result[0],
        tournamentId: result[1],
        player1Name: result[2],
        player2Name: result[3],
        player1Score: Number(result[4]),
        player2Score: Number(result[5]),
        winnerIndex: Number(result[6]),
        round: Number(result[7]),
        timestamp: Number(result[8]),
        dataHash: result[9]
      };
    } catch (error) {
      console.warn(`⚠️ Could not retrieve match ${matchId} from blockchain:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * Vérifier l'intégrité d'un match
   */
  public async verifyMatch(matchId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const matchIdBytes = ethers.keccak256(ethers.toUtf8Bytes(matchId));
      
      // Use read-only contract for view functions
      const readOnlyContract = new ethers.Contract(
        this.contractAddress,
        this.contractABI,
        this.provider
      );
      
      return await readOnlyContract.verifyMatch(matchIdBytes);
    } catch (error) {
      console.warn(`⚠️ Could not verify match ${matchId}:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Obtenir le nombre total de matchs
   */
  public async getTotalMatches(): Promise<number> {
    await this.ensureInitialized();
    
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const total = await this.contract!.getTotalMatches();
      return Number(total);
    } catch (error) {
      console.warn('⚠️ Could not get total matches:', (error as Error).message);
      return 0;
    }
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();