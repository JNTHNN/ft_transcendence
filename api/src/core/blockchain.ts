import { ethers } from 'ethers';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TournamentData {
  id: string;
  name: string;
  players: string[];
  scores: number[];
  timestamp: number;
  organizer: string;
  isFinalized: boolean;
  dataHash: string;
  verification_info?: {
    blockchain_verified: boolean;
    data_integrity: string;
    explanation: string;
    hash_represents: string;
  };
}

interface DeploymentInfo {
  contractAddress: string;
  abi: any[];
  network: string;
}

export class BlockchainService {
  private contract: ethers.Contract | null = null;
  private provider: ethers.Provider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contractAddress: string = '';
  private contractABI: any[] = [];

  private initialized = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initializeConnection();
  }

  /**
   * Ensure service is initialized before use
   */
  public async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  private async initializeConnection() {
    try {
      // Get configuration from environment
      const rpcUrl = process.env.AVALANCHE_RPC_URL;
      const privateKey = process.env.PRIVATE_KEY;
      const contractAddress = process.env.SCORES_CONTRACT_ADDRESS;

      if (!rpcUrl) {
        console.warn('⚠️  AVALANCHE_RPC_URL not configured, blockchain features disabled');
        return;
      }

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Initialize wallet if private key is provided
      if (privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
      }

      // Load contract info
      if (contractAddress) {
        this.contractAddress = contractAddress;
        await this.loadContractABI();
        this.initializeContract();
      } else {
        // Try to load from deployment file
        await this.loadDeploymentInfo();
      }

      this.initialized = true;
      console.log('✅ Blockchain service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', (error as Error).message);
    }
  }

  private async loadContractABI() {
    try {
      // Try to load from deployment file first  
      const deploymentPath = path.join(__dirname, '../../blockchain/deployments/fuji-deployment.json');
      console.log('🔍 Looking for deployment file at:', deploymentPath);
      if (fs.existsSync(deploymentPath)) {
        const deployment: DeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        this.contractABI = deployment.abi;
        console.log('✅ Loaded ABI from deployment file');
        return;
      }

      // Fallback to artifact file
      const artifactPath = path.join(__dirname, '../../blockchain/artifacts/contracts/Scores.sol/Scores.json');
      console.log('🔍 Looking for artifact file at:', artifactPath);
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        this.contractABI = artifact.abi;
        console.log('✅ Loaded ABI from artifact file');
        return;
      }

      console.warn('⚠️ No ABI files found, using fallback ABI');
      // Fallback ABI with essential tournament functions, events, and mappings
      this.contractABI = [
        {
          "inputs": [{"internalType": "bytes32", "name": "tournamentId", "type": "bytes32"}, {"internalType": "string", "name": "name", "type": "string"}, {"internalType": "address[]", "name": "players", "type": "address[]"}],
          "name": "createTournament",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [{"internalType": "bytes32", "name": "tournamentId", "type": "bytes32"}, {"internalType": "address[]", "name": "players", "type": "address[]"}, {"internalType": "uint32[]", "name": "scores", "type": "uint32[]"}],
          "name": "storeTournament",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [{"internalType": "bytes32", "name": "tournamentId", "type": "bytes32"}, {"internalType": "uint32[]", "name": "finalScores", "type": "uint32[]"}],
          "name": "finalizeTournament",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [{"internalType": "bytes32", "name": "tournamentId", "type": "bytes32"}],
          "name": "getTournament",
          "outputs": [{"internalType": "string", "name": "name", "type": "string"}, {"internalType": "address[]", "name": "players", "type": "address[]"}, {"internalType": "uint32[]", "name": "scores", "type": "uint32[]"}, {"internalType": "uint32", "name": "timestamp", "type": "uint32"}, {"internalType": "address", "name": "organizer", "type": "address"}, {"internalType": "bool", "name": "isFinalized", "type": "bool"}, {"internalType": "bytes32", "name": "dataHash", "type": "bytes32"}],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [{"internalType": "uint256", "name": "offset", "type": "uint256"}, {"internalType": "uint256", "name": "limit", "type": "uint256"}],
          "name": "getAllTournaments",
          "outputs": [{"internalType": "bytes32[]", "name": "", "type": "bytes32[]"}],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [{"internalType": "bytes32", "name": "tournamentId", "type": "bytes32"}],
          "name": "verifyTournament",
          "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
          "name": "tournaments",
          "outputs": [{"internalType": "uint32", "name": "timestamp", "type": "uint32"}, {"internalType": "address", "name": "organizer", "type": "address"}, {"internalType": "bool", "name": "isFinalized", "type": "bool"}, {"internalType": "bytes32", "name": "dataHash", "type": "bytes32"}],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "anonymous": false,
          "inputs": [{"indexed": true, "internalType": "bytes32", "name": "tournamentId", "type": "bytes32"}, {"indexed": false, "internalType": "string", "name": "name", "type": "string"}, {"indexed": false, "internalType": "address[]", "name": "players", "type": "address[]"}, {"indexed": false, "internalType": "uint32", "name": "timestamp", "type": "uint32"}],
          "name": "TournamentCreated",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [{"indexed": true, "internalType": "bytes32", "name": "tournamentId", "type": "bytes32"}, {"indexed": false, "internalType": "uint32[]", "name": "scores", "type": "uint32[]"}, {"indexed": false, "internalType": "bytes32", "name": "dataHash", "type": "bytes32"}],
          "name": "TournamentFinalized",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [{"indexed": true, "internalType": "bytes32", "name": "tournamentId", "type": "bytes32"}, {"indexed": false, "internalType": "address[]", "name": "players", "type": "address[]"}, {"indexed": false, "internalType": "bytes32", "name": "dataHash", "type": "bytes32"}],
          "name": "ScoresAnchored",
          "type": "event"
        }
      ];
    } catch (error) {
      console.error('❌ Failed to load contract ABI:', (error as Error).message);
    }
  }

  private async loadDeploymentInfo() {
    try {
      const deploymentPath = path.join(__dirname, '../../blockchain/deployments/fuji-deployment.json');
      if (!fs.existsSync(deploymentPath)) {
        console.warn('⚠️  Deployment file not found, blockchain features limited');
        return;
      }

      const deployment: DeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      this.contractAddress = deployment.contractAddress;
      this.contractABI = deployment.abi;
      
      this.initializeContract();
    } catch (error) {
      console.error('❌ Failed to load deployment info:', (error as Error).message);
    }
  }

  private initializeContract() {
    if (!this.provider || !this.contractAddress || !this.contractABI.length) {
      console.warn('⚠️  Missing contract configuration');
      return;
    }

    // Use wallet if available, otherwise read-only with provider
    const signer = this.wallet || this.provider;
    this.contract = new ethers.Contract(this.contractAddress, this.contractABI, signer);
  }

  /**
   * Check if blockchain service is available
   */
  public isAvailable(): boolean {
    const hasProvider = this.provider !== null;
    const hasContract = this.contract !== null;
    const hasContractAddress = this.contractAddress !== '';
    const hasABI = this.contractABI.length > 0;
    
    return this.initialized && hasProvider && hasContract && hasContractAddress && hasABI;
  }

  /**
   * Create a new tournament on the blockchain
   */
  public async createTournament(
    tournamentId: string, 
    name: string, 
    playerNames: string[]
  ): Promise<{ txHash: string; tournamentId: string } | null> {
    if (!this.contract || !this.wallet) {
      console.warn('⚠️  Blockchain service not available or no wallet configured');
      return null;
    }

    try {
      console.log(`🏗️  Creating tournament on blockchain: ${name}`);
      console.log(`🏗️  Players: ${JSON.stringify(playerNames)}`);
      
      // Convert tournament ID to bytes32
      const tournamentIdBytes = ethers.keccak256(ethers.toUtf8Bytes(tournamentId));
      
      // Convert player names to addresses (use wallet address as placeholder for now)
      // In a real implementation, you'd have a mapping of usernames to wallet addresses
      const playerAddresses = playerNames.length > 0 
        ? playerNames.map(() => this.wallet!.address)
        : [this.wallet!.address, this.wallet!.address]; // At least 2 addresses required
      
      console.log(`🏗️  Tournament ID bytes: ${tournamentIdBytes}`);
      console.log(`🏗️  Player addresses: ${JSON.stringify(playerAddresses)}`);
      
      // Create tournament transaction
      const tx = await this.contract.createTournament(
        tournamentIdBytes,
        name,
        playerAddresses
      );

      console.log(`🏗️  Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Tournament created on blockchain: ${receipt.hash}`);

      return {
        txHash: receipt.hash,
        tournamentId: tournamentIdBytes
      };
    } catch (error) {
      console.error('❌ Failed to create tournament on blockchain:', (error as Error).message);
      console.error('❌ Error details:', error);
      return null;
    }
  }

  /**
   * Store tournament results on the blockchain
   */
  public async storeTournamentResults(
    tournamentId: string,
    playerNames: string[],
    scores: number[]
  ): Promise<{ txHash: string; dataHash: string } | null> {
    if (!this.contract || !this.wallet) {
      console.warn('⚠️  Blockchain service not available or no wallet configured');
      return null;
    }

    try {
      console.log(`📊 Storing tournament results on blockchain: ${tournamentId}`);
      console.log(`📊 Players: ${JSON.stringify(playerNames)}, Scores: ${JSON.stringify(scores)}`);
      
      // Convert tournament ID to bytes32
      const tournamentIdBytes = ethers.keccak256(ethers.toUtf8Bytes(tournamentId));
      
      // Convert player names to addresses (use wallet address as placeholder for now)
      // In a real implementation, you'd have a mapping of usernames to wallet addresses
      const playerAddresses = playerNames.map(() => this.wallet!.address);
      const uint32Scores = scores.map(score => Math.floor(score));
      
      console.log(`📊 Tournament ID bytes: ${tournamentIdBytes}`);
      console.log(`📊 Player addresses: ${JSON.stringify(playerAddresses)}`);
      console.log(`📊 Uint32 scores: ${JSON.stringify(uint32Scores)}`);
      
      // Store results
      const tx = await this.contract.storeTournament(
        tournamentIdBytes,
        playerAddresses,
        uint32Scores
      );

      console.log(`📊 Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`📊 Transaction confirmed: ${receipt.hash}`);
      
      // Get the data hash from the event
      let dataHash = '';
      try {
        const scoresAnchoredEvent = receipt.logs.find(
          (log: any) => {
            try {
              const parsedLog = this.contract!.interface.parseLog(log);
              return parsedLog?.name === 'ScoresAnchored';
            } catch {
              return false;
            }
          }
        );
        
        if (scoresAnchoredEvent) {
          const parsedLog = this.contract.interface.parseLog(scoresAnchoredEvent);
          dataHash = parsedLog?.args[2];
        }
      } catch (eventError) {
        console.warn('⚠️  Could not parse event logs:', (eventError as Error).message);
      }

      console.log(`✅ Tournament results stored on blockchain: ${receipt.hash}`);

      return {
        txHash: receipt.hash,
        dataHash: dataHash
      };
    } catch (error) {
      console.error('❌ Failed to store tournament results:', (error as Error).message);
      console.error('❌ Error details:', error);
      return null;
    }
  }

  /**
   * Finalize tournament with final scores
   */
  public async finalizeTournament(
    tournamentId: string,
    finalScores: number[]
  ): Promise<{ txHash: string; winner: string; dataHash: string } | null> {
    if (!this.contract || !this.wallet) {
      console.warn('⚠️  Blockchain service not available');
      return null;
    }

    try {
      console.log(`🏁 Finalizing tournament on blockchain: ${tournamentId}`);
      
      const tournamentIdBytes = ethers.keccak256(ethers.toUtf8Bytes(tournamentId));
      
      const tx = await this.contract.finalizeTournament(tournamentIdBytes, finalScores);
      const receipt = await tx.wait();

      // Extract winner and data hash from events
      const finalizedEvent = receipt.logs.find(
        (log: any) => log.fragment?.name === 'TournamentFinalized'
      );

      const winner = finalizedEvent ? finalizedEvent.args[1] : '';
      const dataHash = finalizedEvent ? finalizedEvent.args[2] : '';

      console.log(`✅ Tournament finalized on blockchain: ${receipt.hash}`);

      return {
        txHash: receipt.hash,
        winner: winner,
        dataHash: dataHash
      };
    } catch (error) {
      console.error('❌ Failed to finalize tournament:', (error as Error).message);
      return null;
    }
  }

  /**
   * Get tournament data from blockchain
   */
  public async getTournament(tournamentId: string): Promise<TournamentData | null> {
    if (!this.contract) {
      console.warn('⚠️  Blockchain service not available');
      return null;
    }

    try {
      const tournamentIdBytes = ethers.keccak256(ethers.toUtf8Bytes(tournamentId));
      
      const result = await this.contract.getTournament(tournamentIdBytes);
      
      return {
        id: tournamentId,
        name: result[0],
        players: result[1],
        scores: result[2].map((score: bigint) => Number(score)),
        timestamp: Number(result[3]),
        organizer: result[4],
        isFinalized: result[5],
        dataHash: result[6]
      };
    } catch (error) {
      console.error('❌ Failed to get tournament from blockchain:', (error as Error).message);
      return null;
    }
  }

  /**
   * Verify tournament integrity
   */
  public async verifyTournament(tournamentId: string): Promise<boolean> {
    if (!this.contract) {
      console.warn('⚠️  Blockchain service not available');
      return false;
    }

    try {
      const tournamentIdBytes = ethers.keccak256(ethers.toUtf8Bytes(tournamentId));
      return await this.contract.verifyTournament(tournamentIdBytes);
    } catch (error) {
      console.error('❌ Failed to verify tournament:', (error as Error).message);
      return false;
    }
  }

  /**
   * Get tournament winner
   */
  public async getTournamentWinner(tournamentId: string): Promise<{ winner: string; score: number } | null> {
    if (!this.contract) {
      console.warn('⚠️  Blockchain service not available');
      return null;
    }

    try {
      const tournamentIdBytes = ethers.keccak256(ethers.toUtf8Bytes(tournamentId));
      const result = await this.contract.getTournamentWinner(tournamentIdBytes);
      
      return {
        winner: result[0],
        score: Number(result[1])
      };
    } catch (error) {
      console.error('❌ Failed to get tournament winner:', (error as Error).message);
      return null;
    }
  }

  /**
   * Get all tournaments (paginated)
   */
  public async getAllTournaments(offset: number = 0, limit: number = 10): Promise<string[]> {
    if (!this.contract) {
      console.warn('⚠️  Blockchain service not available');
      return [];
    }

    try {
      return await this.contract.getAllTournaments(offset, limit);
    } catch (error) {
      console.error('❌ Failed to get tournaments:', (error as Error).message);
      return [];
    }
  }

  /**
   * Get detailed tournament data from blockchain
   */
  public async getTournamentData(tournamentId: string): Promise<TournamentData | null> {
    await this.ensureInitialized();
    
    if (!this.contract) {
      return null;
    }

    try {
      const tournamentIdBytes = ethers.keccak256(ethers.toUtf8Bytes(tournamentId));
      
      // Check if tournaments mapping is available
      if (!this.contract.tournaments || typeof this.contract.tournaments !== 'function') {
        return null;
      }
      
      // Try to get tournament data from contract
      const tournamentData = await this.contract.tournaments(tournamentIdBytes);
      
      console.log(`📊 Raw contract response for ${tournamentId}:`, {
        timestamp: tournamentData[0]?.toString(),
        organizer: tournamentData[1],
        isFinalized: tournamentData[2],
        dataHash: tournamentData[3]
      });
      
      // Check if we have valid data (either finalized or has a non-zero dataHash)
      const hasValidData = tournamentData && (
        tournamentData[2] === true || // isFinalized is true
        (tournamentData[3] && tournamentData[3] !== '0x0000000000000000000000000000000000000000000000000000000000000000')
      );
      
      if (!hasValidData) {
        console.log('No valid tournament data found on blockchain for:', tournamentId);
        return null;
      }

      // Extract meaningful information from blockchain state
      const rawTimestamp = tournamentData[0];
      const organizer = tournamentData[1] || 'Unknown';
      const isFinalized = Boolean(tournamentData[2]);
      const dataHash = tournamentData[3] || '';
      
      // Handle very large timestamps by using current time if unrealistic
      let timestamp = Math.floor(Date.now() / 1000);
      try {
        const parsedTimestamp = Number(rawTimestamp);
        // Only use if it's a reasonable timestamp (between 2020 and 2030)
        if (parsedTimestamp > 1577836800 && parsedTimestamp < 1893456000) {
          timestamp = parsedTimestamp;
        } else if (parsedTimestamp > 1577836800000 && parsedTimestamp < 1893456000000) {
          timestamp = Math.floor(parsedTimestamp / 1000);
        }
      } catch (e) {
        console.warn('Could not parse timestamp, using current time');
      }

      console.log('📊 Processed blockchain data:', {
        rawTimestamp: rawTimestamp.toString(),
        processedTimestamp: timestamp,
        organizer,
        isFinalized,
        dataHash
      });

      // Since we can't decode the hash directly (it's a Keccak256 hash),
      // we provide context about what it represents
      return {
        id: tournamentId,
        name: `Tournament ${tournamentId}`,
        players: [], // Hash contains player data but we can't reverse it
        scores: [], // Hash contains scores but we can't reverse it
        timestamp,
        organizer,
        isFinalized,
        dataHash,
        verification_info: {
          blockchain_verified: true,
          data_integrity: 'Cryptographically secured',
          explanation: 'Le hash contient les données chiffrées du tournoi (joueurs, scores, gagnant). Il est impossible de les modifier sans changer le hash.',
          hash_represents: `Données encodées: joueurs, scores finaux, et résultat du match`
        }
      };
    } catch (error) {
      // Silently return null for blockchain errors - not critical for app functionality
      return null;
    }
  }

  /**
   * Get tournament events to decode stored data
   */
  public async getTournamentEvents(tournamentId: string): Promise<any[]> {
    if (!this.contract || !this.provider) {
      console.warn('⚠️  Blockchain service not available');
      return [];
    }

    try {
      const tournamentIdBytes = ethers.keccak256(ethers.toUtf8Bytes(tournamentId));
      
      // Check if filters are available
      if (!this.contract.filters || typeof this.contract.filters.TournamentCreated !== 'function') {
        console.warn('⚠️  Event filters not available in contract');
        return [];
      }

      // Get current block number
      const currentBlock = await this.provider.getBlockNumber();
      
      // Limit search to recent blocks to avoid RPC limits (last 2000 blocks)
      const fromBlock = Math.max(0, currentBlock - 2000);
      const toBlock = currentBlock;
      
      // Get tournament creation events with limited block range
      const filter = this.contract.filters.TournamentCreated(tournamentIdBytes);
      const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
      
      const decodedEvents = events.map(event => {
        try {
          const eventLog = event as ethers.EventLog;
          return {
            type: 'TournamentCreated',
            tournamentId: eventLog.args?.[0],
            name: eventLog.args?.[1],
            players: eventLog.args?.[2],
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: eventLog.args?.[3] ? Number(eventLog.args[3]) : null
          };
        } catch (decodeError) {
          console.warn('Could not decode event:', decodeError);
          return {
            type: 'Unknown',
            raw: event,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
          };
        }
      });

      // Also try to get finalization events if available
      let decodedFinalizeEvents: any[] = [];
      if (typeof this.contract.filters.TournamentFinalized === 'function') {
        const finalizeFilter = this.contract.filters.TournamentFinalized(tournamentIdBytes);
        const finalizeEvents = await this.contract.queryFilter(finalizeFilter, fromBlock, toBlock);
        
        decodedFinalizeEvents = finalizeEvents.map(event => {
          try {
            const eventLog = event as ethers.EventLog;
            return {
              type: 'TournamentFinalized',
              tournamentId: eventLog.args?.[0],
              scores: eventLog.args?.[1] ? eventLog.args[1].map((s: any) => Number(s)) : [],
              dataHash: eventLog.args?.[2],
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash
            };
          } catch (decodeError) {
            console.warn('Could not decode finalize event:', decodeError);
            return {
              type: 'Unknown',
              raw: event,
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash
            };
          }
        });
      }

      return [...decodedEvents, ...decodedFinalizeEvents];
    } catch (error) {
      console.warn('⚠️  Could not get tournament events (skipping):', (error as Error).message);
      return [];
    }
  }

  /**
   * Get contract address and network info
   */
  public getNetworkInfo(): { contractAddress: string; network: string; isAvailable: boolean } {
    return {
      contractAddress: this.contractAddress,
      network: 'Avalanche Fuji Testnet',
      isAvailable: this.isAvailable()
    };
  }
}

// Singleton instance
export const blockchainService = new BlockchainService();