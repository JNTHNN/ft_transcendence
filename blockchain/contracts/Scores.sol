// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Tournament Scores Storage Contract
 * @dev Stores tournament results on Avalanche blockchain for transparency and immutability
 */
contract Scores {
    // Tournament data structure
    struct Tournament {
        bytes32 id;
        string name;
        address[] players;
        uint32[] scores;
        uint32 timestamp;
        address organizer;
        bool isFinalized;
        bytes32 dataHash;
    }

    // Events
    event TournamentCreated(bytes32 indexed tournamentId, string name, address indexed organizer);
    event TournamentFinalized(bytes32 indexed tournamentId, address indexed winner, bytes32 dataHash);
    event ScoresAnchored(bytes32 indexed tournamentId, address indexed sender, bytes32 digest);

    // Storage
    mapping(bytes32 => Tournament) public tournaments;
    mapping(bytes32 => bool) public published;
    mapping(address => bytes32[]) public organizerTournaments;
    mapping(address => bytes32[]) public playerTournaments;
    
    bytes32[] public allTournaments;
    uint256 public totalTournaments;

    // Modifiers
    modifier tournamentExists(bytes32 tournamentId) {
        require(tournaments[tournamentId].id != bytes32(0), "Tournament not found");
        _;
    }

    modifier onlyOrganizer(bytes32 tournamentId) {
        require(tournaments[tournamentId].organizer == msg.sender, "Only organizer");
        _;
    }

    modifier notFinalized(bytes32 tournamentId) {
        require(!tournaments[tournamentId].isFinalized, "Tournament already finalized");
        _;
    }

    /**
     * @dev Create a new tournament
     */
    function createTournament(
        bytes32 tournamentId, 
        string calldata name,
        address[] calldata players
    ) external {
        require(tournamentId != bytes32(0), "Invalid tournament ID");
        require(tournaments[tournamentId].id == bytes32(0), "Tournament already exists");
        require(bytes(name).length > 0, "Tournament name required");
        require(players.length >= 2 && players.length <= 256, "Invalid player count");

        tournaments[tournamentId] = Tournament({
            id: tournamentId,
            name: name,
            players: players,
            scores: new uint32[](players.length),
            timestamp: uint32(block.timestamp),
            organizer: msg.sender,
            isFinalized: false,
            dataHash: bytes32(0)
        });

        // Add to tracking arrays
        allTournaments.push(tournamentId);
        organizerTournaments[msg.sender].push(tournamentId);
        
        // Track player participation
        for (uint i = 0; i < players.length; i++) {
            playerTournaments[players[i]].push(tournamentId);
        }

        totalTournaments++;
        
        emit TournamentCreated(tournamentId, name, msg.sender);
    }

    /**
     * @dev Store final tournament results (backward compatibility + new features)
     */
    function storeTournament(
        bytes32 tournamentId, 
        address[] calldata players, 
        uint32[] calldata scores
    ) external {
        require(players.length == scores.length && players.length > 0, "Invalid input lengths");
        require(!published[tournamentId], "Tournament already published");

        // If tournament doesn't exist, create it (backward compatibility)
        if (tournaments[tournamentId].id == bytes32(0)) {
            string memory defaultName = string(abi.encodePacked("Tournament-", uint256(tournamentId)));
            this.createTournament(tournamentId, defaultName, players);
        }

        // Finalize with scores
        finalizeTournament(tournamentId, scores);
    }

    /**
     * @dev Finalize tournament with final scores
     */
    function finalizeTournament(
        bytes32 tournamentId, 
        uint32[] calldata finalScores
    ) public tournamentExists(tournamentId) onlyOrganizer(tournamentId) notFinalized(tournamentId) {
        Tournament storage tournament = tournaments[tournamentId];
        require(finalScores.length == tournament.players.length, "Score count mismatch");

        // Update scores
        for (uint i = 0; i < finalScores.length; i++) {
            tournament.scores[i] = finalScores[i];
        }

        // Generate data hash for integrity
        tournament.dataHash = keccak256(abi.encode(tournament.players, finalScores, tournament.timestamp));
        tournament.isFinalized = true;
        
        // Mark as published
        published[tournamentId] = true;

        // Find winner (highest score)
        address winner = tournament.players[0];
        uint32 highestScore = finalScores[0];
        for (uint i = 1; i < finalScores.length; i++) {
            if (finalScores[i] > highestScore) {
                highestScore = finalScores[i];
                winner = tournament.players[i];
            }
        }

        emit TournamentFinalized(tournamentId, winner, tournament.dataHash);
        emit ScoresAnchored(tournamentId, msg.sender, tournament.dataHash);
    }

    /**
     * @dev Get tournament details
     */
    function getTournament(bytes32 tournamentId) external view tournamentExists(tournamentId) returns (
        string memory name,
        address[] memory players,
        uint32[] memory scores,
        uint32 timestamp,
        address organizer,
        bool isFinalized,
        bytes32 dataHash
    ) {
        Tournament storage tournament = tournaments[tournamentId];
        return (
            tournament.name,
            tournament.players,
            tournament.scores,
            tournament.timestamp,
            tournament.organizer,
            tournament.isFinalized,
            tournament.dataHash
        );
    }

    /**
     * @dev Get tournaments organized by an address
     */
    function getOrganizerTournaments(address organizer) external view returns (bytes32[] memory) {
        return organizerTournaments[organizer];
    }

    /**
     * @dev Get tournaments where an address participated
     */
    function getPlayerTournaments(address player) external view returns (bytes32[] memory) {
        return playerTournaments[player];
    }

    /**
     * @dev Get all tournament IDs (paginated)
     */
    function getAllTournaments(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        require(offset < allTournaments.length, "Offset out of bounds");
        
        uint256 end = offset + limit;
        if (end > allTournaments.length) {
            end = allTournaments.length;
        }
        
        bytes32[] memory result = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allTournaments[i];
        }
        
        return result;
    }

    /**
     * @dev Verify tournament integrity
     */
    function verifyTournament(bytes32 tournamentId) external view tournamentExists(tournamentId) returns (bool) {
        Tournament storage tournament = tournaments[tournamentId];
        if (!tournament.isFinalized) return false;
        
        bytes32 expectedHash = keccak256(abi.encode(tournament.players, tournament.scores, tournament.timestamp));
        return expectedHash == tournament.dataHash;
    }

    /**
     * @dev Get tournament winner
     */
    function getTournamentWinner(bytes32 tournamentId) external view tournamentExists(tournamentId) returns (address winner, uint32 winningScore) {
        Tournament storage tournament = tournaments[tournamentId];
        require(tournament.isFinalized, "Tournament not finalized");
        
        winner = tournament.players[0];
        winningScore = tournament.scores[0];
        
        for (uint i = 1; i < tournament.scores.length; i++) {
            if (tournament.scores[i] > winningScore) {
                winningScore = tournament.scores[i];
                winner = tournament.players[i];
            }
        }
    }
}
