// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Match Stats Storage Contract
 * @dev Stores match statistics on Avalanche blockchain for transparency and immutability
 * Simplified version focused only on match stats without player addresses
 */
contract MatchStats {
    // Individual match data structure
    struct Match {
        bytes32 id;
        string tournamentId;
        string player1Name;
        string player2Name;
        uint32 player1Score;
        uint32 player2Score;
        uint8 winnerIndex; // 1 for player1, 2 for player2
        uint32 round;
        uint32 timestamp;
        bytes32 dataHash;
    }

    // Events
    event MatchStored(
        bytes32 indexed matchId, 
        string indexed tournamentId, 
        uint8 indexed winnerIndex,
        bytes32 dataHash
    );

    // Storage
    mapping(bytes32 => Match) public matches;
    bytes32[] public allMatches;
    uint256 public totalMatches;

    /**
     * @dev Store individual match result with only stats
     */
    function storeMatch(
        bytes32 matchId,
        string calldata tournamentId,
        string calldata player1Name,
        string calldata player2Name,
        uint32 player1Score,
        uint32 player2Score,
        uint8 winnerIndex,
        uint32 round
    ) external {
        require(matchId != bytes32(0), "Invalid match ID");
        require(matches[matchId].id == bytes32(0), "Match already exists");
        require(winnerIndex == 1 || winnerIndex == 2, "Winner index must be 1 or 2");
        require(bytes(tournamentId).length > 0, "Tournament ID required");
        require(bytes(player1Name).length > 0, "Player 1 name required");
        require(bytes(player2Name).length > 0, "Player 2 name required");

        // Generate data hash for integrity verification
        bytes32 dataHash = keccak256(abi.encode(
            matchId,
            tournamentId,
            player1Name,
            player2Name,
            player1Score,
            player2Score,
            winnerIndex,
            round,
            block.timestamp
        ));

        matches[matchId] = Match({
            id: matchId,
            tournamentId: tournamentId,
            player1Name: player1Name,
            player2Name: player2Name,
            player1Score: player1Score,
            player2Score: player2Score,
            winnerIndex: winnerIndex,
            round: round,
            timestamp: uint32(block.timestamp),
            dataHash: dataHash
        });

        // Add to tracking
        allMatches.push(matchId);
        totalMatches++;

        emit MatchStored(matchId, tournamentId, winnerIndex, dataHash);
    }

    /**
     * @dev Get match data
     */
    function getMatch(bytes32 matchId) external view returns (
        bytes32 id,
        string memory tournamentId,
        string memory player1Name,
        string memory player2Name,
        uint32 player1Score,
        uint32 player2Score,
        uint8 winnerIndex,
        uint32 round,
        uint32 timestamp,
        bytes32 dataHash
    ) {
        Match memory matchData = matches[matchId];
        require(matchData.id != bytes32(0), "Match not found");
        
        return (
            matchData.id,
            matchData.tournamentId,
            matchData.player1Name,
            matchData.player2Name,
            matchData.player1Score,
            matchData.player2Score,
            matchData.winnerIndex,
            matchData.round,
            matchData.timestamp,
            matchData.dataHash
        );
    }

    /**
     * @dev Verify match integrity
     */
    function verifyMatch(bytes32 matchId) external view returns (bool) {
        Match memory matchData = matches[matchId];
        if (matchData.id == bytes32(0)) return false;

        bytes32 computedHash = keccak256(abi.encode(
            matchData.id,
            matchData.tournamentId,
            matchData.player1Name,
            matchData.player2Name,
            matchData.player1Score,
            matchData.player2Score,
            matchData.winnerIndex,
            matchData.round,
            matchData.timestamp
        ));

        return computedHash == matchData.dataHash;
    }

    /**
     * @dev Get total number of matches
     */
    function getTotalMatches() external view returns (uint256) {
        return totalMatches;
    }

    /**
     * @dev Get match at specific index
     */
    function getMatchAtIndex(uint256 index) external view returns (bytes32) {
        require(index < allMatches.length, "Index out of bounds");
        return allMatches[index];
    }
}