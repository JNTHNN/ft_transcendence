// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Scores {
    event ScoresAnchored(bytes32 indexed tournamentId, address indexed sender, bytes32 digest);
    mapping(bytes32 => bool) public published;
    function storeTournament(bytes32 tournamentId, address[] calldata players, uint32[] calldata scores) external {
        require(players.length == scores.length && players.length > 0, "len");
        require(!published[tournamentId], "already");
        published[tournamentId] = true;
        bytes32 digest = keccak256(abi.encode(players, scores));
        emit ScoresAnchored(tournamentId, msg.sender, digest);
    }
}
